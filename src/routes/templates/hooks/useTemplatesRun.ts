import { useState, useCallback, useRef } from 'react'
import { plot } from '../../../adapters/plot'
import type { ReportV1, ErrorV1, RunRequest } from '../../../adapters/plot'

export interface UseTemplatesRunState {
  loading: boolean
  progress: number // 0-100
  result: ReportV1 | null
  error: ErrorV1 | null
  retryAfter: number | null
  canCancel: boolean
}

export function useTemplatesRun() {
  const [state, setState] = useState<UseTemplatesRunState>({
    loading: false,
    progress: 0,
    result: null,
    error: null,
    retryAfter: null,
    canCancel: false
  })

  const cancelRef = useRef<(() => void) | null>(null)

  const run = useCallback(async (request: RunRequest) => {
    setState(prev => ({ ...prev, loading: true, progress: 0, error: null, canCancel: false }))

    // Check if adapter supports streaming
    const adapter = plot as any
    const hasStreaming = adapter.stream && typeof adapter.stream.run === 'function'

    if (hasStreaming) {
      // Use streaming API
      setState(prev => ({ ...prev, canCancel: true }))

      cancelRef.current = adapter.stream.run(request, {
        onTick: (data: { index: number }) => {
          // Convert tick index (0-5) to percentage (0-100)
          const progress = Math.min(100, Math.round((data.index / 5) * 100))
          setState(prev => ({ ...prev, progress }))
        },
        onDone: (data: { response_id: string; report: ReportV1 }) => {
          // Use the report from streaming completion (no second run needed!)
          setState({
            loading: false,
            progress: 100,
            result: data.report,
            error: null,
            retryAfter: null,
            canCancel: false
          })
          cancelRef.current = null
        },
        onError: (error: ErrorV1) => {
          setState({
            loading: false,
            progress: 0,
            result: null,
            error,
            retryAfter: error.retry_after || null,
            canCancel: false
          })
          cancelRef.current = null
        }
      })
    } else {
      // Fallback to sync API
      try {
        const result = await plot.run(request)
        setState({
          loading: false,
          progress: 100,
          result,
          error: null,
          retryAfter: null,
          canCancel: false
        })
      } catch (err) {
        const error = err as ErrorV1
        setState({
          loading: false,
          progress: 0,
          result: null,
          error,
          retryAfter: error.retry_after || null,
          canCancel: false
        })
      }
    }
  }, [])

  const cancel = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
      setState({
        loading: false,
        progress: 0,
        result: null,
        error: null,
        retryAfter: null,
        canCancel: false
      })
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryAfter: null }))
  }, [])

  return {
    ...state,
    run,
    cancel,
    clearError
  }
}
