/**
 * useRetryDraft - Hook for retrying a CEE draft from the pre-analysis panel
 *
 * Encapsulates the retry flow:
 * 1. Gets lastDraftDescription from store
 * 2. Calls draftModel() via useCEEDraft (does NOT resetCanvas first)
 * 3. On success: applies result to canvas via applyDraftResult (replaces graph)
 * 4. On failure: canvas remains untouched (graph preserved)
 * 5. Exposes loading/error state for UI feedback
 *
 * retryDraft() returns a deterministic result so callers can show
 * success/error toasts without relying on try/catch.
 */

import { useState, useCallback } from 'react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { CEEError } from '../../adapters/cee/client'
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
      // Do NOT resetCanvas() before the draft succeeds (amendment #5).
      // applyDraftResult() replaces the graph atomically on success.
      const result = await draft(description)

      if (!result?.nodes?.length) {
        const error = 'Draft returned empty graph'
        setState({ isRetrying: false, error })
        store.setLastDraftError({ message: error, timestamp: Date.now() })
        return { success: false, error }
      }

      // Apply to canvas (replaces current graph atomically)
      applyDraftResult(result)

      setState({ isRetrying: false, error: null })
      store.setLastDraftError(null)
      return { success: true }
    } catch (err) {
      // Graph remains untouched — no snapshot/restore needed
      const error =
        err instanceof Error ? err.message : 'Draft retry failed'
      setState({ isRetrying: false, error })

      const draftError: { message: string; status?: number; correlationId?: string; timestamp: number; retryable?: boolean } = {
        message: error,
        timestamp: Date.now(),
      }
      if (err instanceof CEEError) {
        draftError.status = err.status
        draftError.correlationId = err.correlationId ?? undefined
        // Extract retryable from CEE response body, fallback to HTTP status heuristic
        const details = err.details as any
        const ceeRetryable = details?.cee_response?.retryable ?? details?.retryable
        draftError.retryable = typeof ceeRetryable === 'boolean'
          ? ceeRetryable
          : (err.status === 429 || err.status >= 500)
      }
      store.setLastDraftError(draftError)

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
