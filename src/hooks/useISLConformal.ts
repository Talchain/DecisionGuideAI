import { useState, useCallback, useMemo } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type { ISLConformalResponse, ISLRunRequest } from '../adapters/isl/types'

interface UseISLConformalState {
  data: ISLConformalResponse | null
  loading: boolean
  error: ISLError | null
}

export function useISLConformal() {
  const [state, setState] = useState<UseISLConformalState>({
    data: null,
    loading: false,
    error: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  const predict = useCallback(
    async (request: ISLRunRequest) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.conformal(request)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Conformal prediction failed',
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
    predict,
  }
}
