import { useState, useCallback, useMemo } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type {
  ContrastiveExplanationRequest,
  ContrastiveExplanationResponse,
} from '../adapters/isl/types'

interface UseContrastiveExplanationState {
  data: ContrastiveExplanationResponse | null
  loading: boolean
  error: ISLError | null
}

export function useContrastiveExplanation() {
  const [state, setState] = useState<UseContrastiveExplanationState>({
    data: null,
    loading: false,
    error: null,
  })

  // Memoize client to prevent recreation on every render
  const client = useMemo(() => new ISLClient(), [])

  const findPath = useCallback(
    async (request: ContrastiveExplanationRequest) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.contrastiveExplanation(request)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Path finding failed',
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
    findPath,
  }
}
