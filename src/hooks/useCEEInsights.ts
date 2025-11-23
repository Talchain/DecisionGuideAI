import { useState, useCallback } from 'react'
import { CEEClient, CEEError } from '../adapters/cee/client'
import type { CEEInsightsResponse } from '../adapters/cee/types'

interface UseCEEInsightsState {
  data: CEEInsightsResponse | null
  loading: boolean
  error: CEEError | null
}

export function useCEEInsights() {
  const [state, setState] = useState<UseCEEInsightsState>({
    data: null,
    loading: false,
    error: null,
  })

  const client = new CEEClient()

  const analyze = useCallback(
    async (graph: {
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ from: string; to: string }>
    }) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.analyzeInsights(graph)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const ceeError = error instanceof CEEError ? error : new CEEError(
          (error as Error).message || 'Analysis failed',
          500
        )
        setState({ data: null, loading: false, error: ceeError })
        throw ceeError
      }
    },
    []
  )

  return {
    ...state,
    analyze,
  }
}
