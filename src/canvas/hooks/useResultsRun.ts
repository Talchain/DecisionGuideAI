import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { plot } from '../../adapters/plot'
import type { RunRequest, ErrorV1, ReportV1 } from '../../adapters/plot/types'
import { validateGraph, ensureHydrated } from '../validation/graphPreflight'

interface UseResultsRunReturn {
  run: (request: RunRequest) => Promise<void>
  cancel: () => void
}

// Debounce delay for run triggers (500ms)
const RUN_DEBOUNCE_MS = 500

/**
 * Hook for running PLoT analysis and managing Results panel state
 *
 * Features:
 * - 500ms debouncing to prevent rapid successive runs
 * - Automatic cancellation of in-flight requests when new run starts
 * - Wires adapter (auto/httpv1/mock) to canvas store results slice
 * - Handles both sync and streaming modes transparently
 * - Throttles progress updates to ~100ms
 */
export function useResultsRun(): UseResultsRunReturn {
  const cancelRef = useRef<(() => void) | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProgressUpdate = useRef<number>(0)

  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStart = useCanvasStore(s => s.resultsStart)
  const resultsConnecting = useCanvasStore(s => s.resultsConnecting)
  const resultsProgress = useCanvasStore(s => s.resultsProgress)
  const resultsComplete = useCanvasStore(s => s.resultsComplete)
  const resultsError = useCanvasStore(s => s.resultsError)
  const resultsCancelled = useCanvasStore(s => s.resultsCancelled)

  const run = useCallback(async (request: RunRequest) => {
    // Clear any pending debounced run
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Cancel any in-flight request
    if (cancelRef.current) {
      console.log('[useResultsRun] Cancelling in-flight request to start new run')
      cancelRef.current()
      cancelRef.current = null
    }

    // Debounce: Wait 500ms before executing
    return new Promise<void>((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null

        const seed = request.seed ?? 1337

        // Start preparing
        resultsStart({ seed })

        // Ensure limits are hydrated (wait for boot hydration if in progress)
        await ensureHydrated()

        // Client-side preflight validation
        const uiGraph = { nodes, edges }
        const validationResult = validateGraph(uiGraph)

        if (!validationResult.valid) {
          resultsError({
            code: 'BAD_INPUT',
            message: `Cannot run: ${validationResult.violations.length} validation error${validationResult.violations.length > 1 ? 's' : ''}`,
            violations: validationResult.violations
          })
          resolve()
          return
        }

        // Check if adapter supports streaming
        const adapter = plot as any
        const hasStreaming = adapter.stream && typeof adapter.stream.run === 'function'

        if (hasStreaming) {
          // Use streaming API - wrap in try/catch to handle setup errors
          try {
            cancelRef.current = adapter.stream.run(request, {
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
              onDone: (data: { response_id: string; report: ReportV1 }) => {
                const report = data.report

                // Extract drivers from report (if present)
                // Note: Current ReportV1 has drivers as labels, not IDs
                // We'll need to map them later when we have node/edge metadata
                const drivers = undefined // TODO: Map report.drivers to node/edge IDs

                resultsComplete({
                  report,
                  hash: report.model_card.response_hash,
                  drivers
                })
                cancelRef.current = null
                resolve()
              },
              onError: (error: ErrorV1) => {
                resultsError({
                  code: error.code,
                  message: error.error,
                  retryAfter: error.retry_after
                })
                cancelRef.current = null
                resolve()
              }
            })
          } catch (err) {
            // Catch synchronous errors from stream setup (e.g., 404 during initial fetch)
            console.error('[useResultsRun] Stream setup failed:', err)
            const error = err as ErrorV1
            resultsError({
              code: error.code || 'SERVER_ERROR',
              message: error.error || error.message || 'Failed to connect to analysis service',
              retryAfter: error.retry_after
            })
            cancelRef.current = null
            resolve()
          }
        } else {
          // Fallback to sync API
          try {
            // Show preparing state briefly
            await new Promise(r => setTimeout(r, 200))

            const report = await plot.run(request)

            resultsComplete({
              report,
              hash: report.model_card.response_hash,
              drivers: undefined
            })
            resolve()
          } catch (err) {
            const error = err as ErrorV1
            resultsError({
              code: error.code,
              message: error.error,
              retryAfter: error.retry_after
            })
            resolve()
          }
        }
      }, RUN_DEBOUNCE_MS)
    })
  }, [nodes, edges, resultsStart, resultsConnecting, resultsProgress, resultsComplete, resultsError])

  const cancel = useCallback(() => {
    // Clear debounce timer if pending
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Cancel in-flight request if any
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
