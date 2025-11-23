import { useState, useCallback } from 'react'
import { CEEClient, CEEError } from '../adapters/cee/client'
import type { CEEDraftResponse } from '../adapters/cee/types'

interface UseCEEDraftState {
  data: CEEDraftResponse | null
  loading: boolean
  error: CEEError | null
}

export function useCEEDraft() {
  const [state, setState] = useState<UseCEEDraftState>({
    data: null,
    loading: false,
    error: null,
  })

  const client = new CEEClient()

  const draft = useCallback(
    async (description: string) => {
      setState({ data: null, loading: true, error: null })

      try {
        const data = await client.draftModel(description)
        setState({ data, loading: false, error: null })
        return data
      } catch (error) {
        const ceeError = error instanceof CEEError ? error : new CEEError(
          (error as Error).message || 'Draft failed',
          500
        )
        setState({ data: null, loading: false, error: ceeError })
        throw ceeError
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    draft,
    reset,
  }
}
