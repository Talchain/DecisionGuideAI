import { useState, useCallback, useMemo } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type { ISLComparisonResponse, ISLRunRequest } from '../adapters/isl/types'

interface UseISLComparisonState {
  data: ISLComparisonResponse | null
  loading: boolean
  error: ISLError | null
}

export function useISLComparison() {
  const [state, setState] = useState<UseISLComparisonState>({
    data: null,
    loading: false,
    error: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  const compare = useCallback(
    async (request: ISLRunRequest) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.compare(request)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Comparison failed',
          500
        )
        setState({ data: null, loading: false, error: islError })
        throw islError
      }
    },
    [client]
  )

  return {
    ...state,
    compare,
  }
}
