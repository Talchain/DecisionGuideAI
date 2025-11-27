import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { plot } from '../../adapters/plot'
import type { RunRequest, ErrorV1, ReportV1 } from '../../adapters/plot/types'
import { validateGraph, ensureHydrated } from '../validation/graphPreflight'

interface UsePreviewRunReturn {
  runPreview: (templateId: string, seed?: number) => Promise<void>
  cancel: () => void
}

// Debounce delay for run triggers (500ms)
const RUN_DEBOUNCE_MS = 500

/**
 * Hook for running Preview Mode analysis without mutating live graph
 *
 * Features:
 * - 500ms debouncing to prevent rapid successive runs
 * - Automatic cancellation of in-flight requests when new run starts
 * - Uses previewGetMergedGraph() to get current + staged changes
 * - Stores results in preview state without mutating live graph
 */
export function usePreviewRun(): UsePreviewRunReturn {
  const cancelRef = useRef<(() => void) | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProgressUpdate = useRef<number>(0)

  const previewGetMergedGraph = useCanvasStore(s => s.previewGetMergedGraph)
  const previewSetReport = useCanvasStore(s => s.previewSetReport)
  const previewStart = useCanvasStore(s => s.previewStart)
  const previewProgress = useCanvasStore(s => s.previewProgress)
  const previewError = useCanvasStore(s => s.previewError)
  const previewCancelled = useCanvasStore(s => s.previewCancelled)

  const runPreview = useCallback(async (templateId: string, seed?: number) => {
    // Clear any pending debounced run
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Cancel any in-flight request
    if (cancelRef.current) {
      if (import.meta.env.DEV) {
        console.log('[usePreviewRun] Cancelling in-flight request to start new run')
      }
      cancelRef.current()
      cancelRef.current = null
    }

    // Debounce: Wait 500ms before executing
    return new Promise<void>((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null

        const useSeed = seed ?? 1337

        // Get merged graph (current + staged changes)
        const mergedGraph = previewGetMergedGraph()

        // Ensure limits are hydrated (wait for boot hydration if in progress)
        await ensureHydrated()

        // Client-side preflight validation
        const validationResult = validateGraph(mergedGraph)

        if (!validationResult.valid) {
          previewError({
            code: 'BAD_INPUT',
            message: `Cannot run preview: ${validationResult.violations.length} validation error${validationResult.violations.length > 1 ? 's' : ''}`,
            violations: validationResult.violations
          })
          resolve()
          return
        }

        // Start preparing (use separate preview status)
        previewStart({ seed: useSeed })

        // Build request with merged graph
        const request: RunRequest = {
          template_id: templateId,
          graph: mergedGraph,
          seed: useSeed,
        }

        // Check if adapter supports streaming
        const adapter = plot as any
        const hasStreaming = adapter.stream && typeof adapter.stream.run === 'function'

        if (hasStreaming) {
          // Use streaming API
          try {
            cancelRef.current = adapter.stream.run(request, {
              onHello: () => {
                // Connection established
              },
              onTick: (data: { index: number }) => {
                // Throttle progress updates to ~100ms
                const now = Date.now()
                if (now - lastProgressUpdate.current > 100) {
                  // LIMITATION: Assumes ~5 ticks to reach 90% progress
                  // TODO: Use exponential approach or backend-provided total
                  const progress = Math.min(90, Math.round((data.index / 5) * 90))
                  previewProgress(progress)
                  lastProgressUpdate.current = now
                }
              },
              onDone: (data: { response_id: string; report: ReportV1 }) => {
                const report = data.report
                previewSetReport(report, useSeed, report.model_card.response_hash)
                cancelRef.current = null
                resolve()
              },
              onError: (error: ErrorV1) => {
                previewError({
                  code: error.code,
                  message: error.error,
                  retryAfter: error.retry_after
                })
                cancelRef.current = null
                resolve()
              }
            })
          } catch (err) {
            console.error('[usePreviewRun] Stream setup failed:', err)
            const error = err as ErrorV1
            previewError({
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

            previewSetReport(report, useSeed, report.model_card.response_hash)
            resolve()
          } catch (err) {
            const error = err as ErrorV1
            previewError({
              code: error.code,
              message: error.error,
              retryAfter: error.retry_after
            })
            resolve()
          }
        }
      }, RUN_DEBOUNCE_MS)
    })
  }, [previewGetMergedGraph, previewSetReport, previewStart, previewProgress, previewError])

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
      previewCancelled()
    }
  }, [previewCancelled])

  return {
    runPreview,
    cancel
  }
}
