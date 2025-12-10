import { useState, useCallback, useMemo } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type { ISLValidationResponse, ISLRunRequest } from '../adapters/isl/types'

interface UseISLValidationState {
  data: ISLValidationResponse | null
  loading: boolean
  error: ISLError | null
}

export function useISLValidation() {
  const [state, setState] = useState<UseISLValidationState>({
    data: null,
    loading: false,
    error: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  const validate = useCallback(
    async (request: ISLRunRequest) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.validate(request)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Validation failed',
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
    validate,
  }
}
