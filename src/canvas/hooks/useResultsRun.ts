import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { plot } from '../../adapters/plot'
import type { RunRequest, ErrorV1, ReportV1 } from '../../adapters/plot/types'
import { mapErrorToUserMessage } from '../utils/errorTaxonomy'

interface UseResultsRunReturn {
  // eslint-disable-next-line no-unused-vars
  run: (request: RunRequest, options?: { forceRerun?: boolean }) => Promise<void>
  cancel: () => void
}

/**
 * Hook for running PLoT analysis and managing Results panel state
 *
 * Wires adapter (auto/httpv1/mock) to canvas store results slice.
 * Handles both sync and streaming modes transparently.
 * Throttles progress updates to ~100ms.
 *
 * v1.2: Supports force-rerun with automatic seed increment to bypass hash dedupe
 */
export function useResultsRun(): UseResultsRunReturn {
  const cancelRef = useRef<(() => void) | null>(null)
  const lastProgressUpdate = useRef<number>(0)

  const resultsStart = useCanvasStore(s => s.resultsStart)
  const resultsConnecting = useCanvasStore(s => s.resultsConnecting)
  const resultsProgress = useCanvasStore(s => s.resultsProgress)
  const resultsComplete = useCanvasStore(s => s.resultsComplete)
  const resultsError = useCanvasStore(s => s.resultsError)
  const resultsCancelled = useCanvasStore(s => s.resultsCancelled)
  const setRunMeta = useCanvasStore(s => s.setRunMeta)

  const run = useCallback(async (request: RunRequest, options?: { forceRerun?: boolean }) => {
    let seed = request.seed ?? 1337

    // v1.2: Force re-run by incrementing seed to generate new hash
    if (options?.forceRerun) {
      seed = seed + 1
      if (import.meta.env.DEV) {
        console.log('[useResultsRun] Force re-run: seed bumped from', request.seed, 'to', seed)
      }
    }

    // Start preparing
    resultsStart({ seed, wasForced: options?.forceRerun })

    // Reset run metadata for new run
    setRunMeta({
      diagnostics: undefined,
      correlationIdHeader: undefined,
      degraded: undefined,
      ceeReview: null,
      ceeTrace: null,
      ceeError: null,
    })

    // Check if adapter supports streaming
    const adapter = plot as any
    const hasStreaming = adapter.stream && typeof adapter.stream.run === 'function'

    if (hasStreaming) {
      // Use streaming API - wrap in try/catch to handle setup errors
      try {
        // Use bumped seed if force-rerun
        const actualRequest = options?.forceRerun ? { ...request, seed } : request
        cancelRef.current = adapter.stream.run(actualRequest, {
          onHello: (data: { response_id: string }) => {
            resultsConnecting(data.response_id)
          },
          onTick: (data: { index: number }) => {
            // Throttle progress updates to ~100ms
            const now = Date.now()
            if (now - lastProgressUpdate.current > 100) {
              // Convert tick index (0-5) to percentage (0-90, capped)
              const progress = Math.min(90, Math.round((data.index / 5) * 90))
              resultsProgress(progress)
              lastProgressUpdate.current = now
            }
          },
          onDone: (data: {
            response_id: string
            report: ReportV1
            diagnostics?: any
            correlationIdHeader?: string
            degraded?: boolean
          }) => {
            const report = data.report

            const anyData = data as any
            const ceeReview = anyData.ceeReview ?? null
            const ceeTrace = anyData.ceeTrace ?? null
            const ceeError = anyData.ceeError ?? null

            // Extract drivers from report (if present)
            // Note: Current ReportV1 has drivers as labels, not IDs
            // We'll need to map them later when we have node/edge metadata
            const drivers = undefined // TODO: Map report.drivers to node/edge IDs

            // Persist results and any CEE metadata into history
            resultsComplete({
              report,
              hash: report.model_card.response_hash,
              drivers,
              ceeReview,
              ceeTrace,
              ceeError,
            })

            // Capture diagnostics, correlation metadata, and any CEE metadata when available
            if (
              data.diagnostics ||
              data.correlationIdHeader ||
              typeof data.degraded === 'boolean' ||
              ceeReview ||
              ceeTrace ||
              ceeError
            ) {
              setRunMeta({
                diagnostics: data.diagnostics,
                correlationIdHeader: data.correlationIdHeader,
                degraded: data.degraded,
                ceeReview,
                ceeTrace,
                ceeError,
              })
            }
            cancelRef.current = null
          },
          onError: (error: ErrorV1) => {
            // Map error to user-friendly message
            const friendlyError = mapErrorToUserMessage({
              code: error.code,
              status: (error as any).status,
              message: error.error,
              retryAfter: error.retry_after
            })

            resultsError({
              code: error.code,
              message: `${friendlyError.title}: ${friendlyError.message}${friendlyError.suggestion ? ` ${friendlyError.suggestion}` : ''}`,
              retryAfter: error.retry_after
            })
            cancelRef.current = null
          }
        })
      } catch (err) {
        // Catch synchronous errors from stream setup (e.g., 404 during initial fetch)
        console.error('[useResultsRun] Stream setup failed:', err)
        const error = err as any

        // Map error to user-friendly message
        const friendlyError = mapErrorToUserMessage({
          code: error.code,
          status: (error as any).status,
          message: error.error || error.message
        })

        resultsError({
          code: error.code || 'SERVER_ERROR',
          message: `${friendlyError.title}: ${friendlyError.message}${friendlyError.suggestion ? ` ${friendlyError.suggestion}` : ''}`,
          retryAfter: error.retry_after
        })
        cancelRef.current = null
      }
    } else {
      // Fallback to sync API
      try {
        // Show preparing state briefly
        await new Promise(resolve => setTimeout(resolve, 200))

        // Use bumped seed if force-rerun
        const actualRequest = options?.forceRerun ? { ...request, seed } : request
        const report = await plot.run(actualRequest)

        resultsComplete({
          report,
          hash: report.model_card.response_hash,
          drivers: undefined
        })
      } catch (err) {
        const error = err as any

        // Map error to user-friendly message
        const friendlyError = mapErrorToUserMessage({
          code: error.code,
          status: (error as any).status,
          message: error.error || error.message,
          retryAfter: error.retry_after
        })

        resultsError({
          code: error.code,
          message: `${friendlyError.title}: ${friendlyError.message}${friendlyError.suggestion ? ` ${friendlyError.suggestion}` : ''}`,
          retryAfter: error.retry_after
        })
      }
    }
  }, [resultsStart, resultsConnecting, resultsProgress, resultsComplete, resultsError, setRunMeta])

  const cancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
      resultsCancelled()
    }
  }, [resultsCancelled])

  return {
    run,
    cancel
  }
}
