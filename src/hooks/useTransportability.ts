import { useState, useCallback } from 'react'
import { ISLClient, ISLError } from '../adapters/isl/client'
import type {
  TransportabilityRequest,
  TransportabilityResponse,
} from '../adapters/isl/types'

interface UseTransportabilityState {
  data: TransportabilityResponse | null
  loading: boolean
  error: ISLError | null
}

export function useTransportability() {
  const [state, setState] = useState<UseTransportabilityState>({
    data: null,
    loading: false,
    error: null,
  })

  const client = new ISLClient()

  const check = useCallback(
    async (request: TransportabilityRequest) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.checkTransportability(request)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const islError = error instanceof ISLError ? error : new ISLError(
          (error as Error).message || 'Transportability check failed',
          500
        )
        setState({ data: null, loading: false, error: islError })
        throw islError
      }
    },
    []
  )

  return {
    ...state,
    check,
  }
}
