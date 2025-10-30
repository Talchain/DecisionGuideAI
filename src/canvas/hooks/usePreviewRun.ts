import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import { plot } from '../../adapters/plot'
import type { RunRequest, ErrorV1, ReportV1 } from '../../adapters/plot/types'
import { validateGraph } from '../validation/graphPreflight'

interface UsePreviewRunReturn {
  runPreview: (templateId: string, seed?: number) => Promise<void>
  cancel: () => void
}

/**
 * Hook for running Preview Mode analysis without mutating live graph
 *
 * Uses previewGetMergedGraph() to get current + staged changes,
 * then runs analysis and stores results in preview state.
 */
export function usePreviewRun(): UsePreviewRunReturn {
  const cancelRef = useRef<(() => void) | null>(null)
  const lastProgressUpdate = useRef<number>(0)

  const previewGetMergedGraph = useCanvasStore(s => s.previewGetMergedGraph)
  const previewSetReport = useCanvasStore(s => s.previewSetReport)
  const previewStart = useCanvasStore(s => s.previewStart)
  const previewProgress = useCanvasStore(s => s.previewProgress)
  const previewError = useCanvasStore(s => s.previewError)
  const previewCancelled = useCanvasStore(s => s.previewCancelled)

  const runPreview = useCallback(async (templateId: string, seed?: number) => {
    const useSeed = seed ?? 1337

    // Get merged graph (current + staged changes)
    const mergedGraph = previewGetMergedGraph()

    // Client-side preflight validation
    const validationResult = validateGraph(mergedGraph)

    if (!validationResult.valid) {
      previewError({
        code: 'BAD_INPUT',
        message: `Cannot run preview: ${validationResult.violations.length} validation error${validationResult.violations.length > 1 ? 's' : ''}`,
        violations: validationResult.violations
      })
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
          },
          onError: (error: ErrorV1) => {
            previewError({
              code: error.code,
              message: error.error,
              retryAfter: error.retry_after
            })
            cancelRef.current = null
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
      }
    } else {
      // Fallback to sync API
      try {
        // Show preparing state briefly
        await new Promise(resolve => setTimeout(resolve, 200))

        const report = await plot.run(request)

        previewSetReport(report, useSeed, report.model_card.response_hash)
      } catch (err) {
        const error = err as ErrorV1
        previewError({
          code: error.code,
          message: error.error,
          retryAfter: error.retry_after
        })
      }
    }
  }, [previewGetMergedGraph, previewSetReport, previewStart, previewProgress, previewError])

  const cancel = useCallback(() => {
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
