import { useState, useCallback } from 'react'
import { plot } from '../../../adapters/plot'
import type { ReportV1, ErrorV1, RunRequest } from '../../../adapters/plot'

export interface UseTemplatesRunState {
  loading: boolean
  result: ReportV1 | null
  error: ErrorV1 | null
  retryAfter: number | null
}

export function useTemplatesRun() {
  const [state, setState] = useState<UseTemplatesRunState>({
    loading: false,
    result: null,
    error: null,
    retryAfter: null
  })

  const run = useCallback(async (request: RunRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await plot.run(request)
      setState({
        loading: false,
        result,
        error: null,
        retryAfter: null
      })
    } catch (err) {
      const error = err as ErrorV1
      setState({
        loading: false,
        result: null,
        error,
        retryAfter: error.retry_after || null
      })
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryAfter: null }))
  }, [])

  return {
    ...state,
    run,
    clearError
  }
}
