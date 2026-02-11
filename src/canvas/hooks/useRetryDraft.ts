/**
 * useRetryDraft - Hook for retrying a CEE draft from the pre-analysis panel
 *
 * Encapsulates the retry flow:
 * 1. Gets lastDraftDescription from store
 * 2. Resets canvas
 * 3. Calls draftModel() via useCEEDraft
 * 4. Applies result to canvas via applyDraftResult
 * 5. Exposes loading/error state for UI feedback
 *
 * retryDraft() returns a deterministic result so callers can show
 * success/error toasts without relying on try/catch.
 */

import { useState, useCallback } from 'react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { useCanvasStore } from '../store'
import { applyDraftResult } from '../utils/applyDraftResult'

export interface RetryDraftResult {
  success: boolean
  error?: string
}

interface RetryDraftState {
  isRetrying: boolean
  error: string | null
}

export function useRetryDraft() {
  const { draft } = useCEEDraft()
  const [state, setState] = useState<RetryDraftState>({
    isRetrying: false,
    error: null,
  })

  const retryDraft = useCallback(async (): Promise<RetryDraftResult> => {
    const store = useCanvasStore.getState()
    const description = store.lastDraftDescription

    if (!description?.trim()) {
      const error = 'No draft description available to retry'
      setState({ isRetrying: false, error })
      return { success: false, error }
    }

    setState({ isRetrying: true, error: null })

    try {
      // Clear existing graph
      store.resetCanvas()

      // Re-draft with same description
      const result = await draft(description)

      if (!result?.nodes?.length) {
        const error = 'Draft returned empty graph'
        setState({ isRetrying: false, error })
        return { success: false, error }
      }

      // Apply to canvas (replaces current graph)
      applyDraftResult(result)

      setState({ isRetrying: false, error: null })
      return { success: true }
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'Draft retry failed'
      setState({ isRetrying: false, error })
      return { success: false, error }
    }
  }, [draft])

  /** Whether retry is available (lastDraftDescription exists) */
  const canRetry = useCanvasStore((s) => !!s.lastDraftDescription?.trim())

  return {
    retryDraft,
    canRetry,
    isRetrying: state.isRetrying,
    retryError: state.error,
  }
}
