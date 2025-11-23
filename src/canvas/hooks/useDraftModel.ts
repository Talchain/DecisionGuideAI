import { useState, useCallback } from 'react'
import type { DraftRequest, DraftResponse, DraftStreamEvent, AssistError } from '../../adapters/assistants/types'
import { draftGraph, draftGraphStream } from '../../adapters/assistants/http'
import { pocFlags } from '../../flags'
import { track } from '../../lib/telemetry'

export type DraftStatus = 'idle' | 'requesting' | 'streaming' | 'ready' | 'error'

export interface DraftModelState {
  status: DraftStatus
  description: string
  draft: DraftResponse | null
  events: DraftStreamEvent[]
  error: string | null
  /** Optional structured error details from AssistError.details for UI diagnostics */
  errorDetails?: AssistError['details'] | null
}

export interface UseDraftModelOptions {
  /**
   * Optional override for streaming behaviour.
   * When undefined, defaults to pocFlags.sse
   */
  streaming?: boolean
}

export interface UseDraftModelReturn {
  state: DraftModelState
  /**
   * Request a new draft from the Assistants backend.
   * This will reset any previous draft and begin a new request.
   */
  requestDraft: (request: DraftRequest) => Promise<void>
  /** Reset state back to initial idle state. */
  reset: () => void
  /** Manually clear or set an error message. */
  setError: (message: string | null) => void
}

const INITIAL_STATE: DraftModelState = {
  status: 'idle',
  description: '',
  draft: null,
  events: [],
  error: null,
  errorDetails: null,
}

function toErrorMessage(err: unknown): string {
  const assist = err as AssistError
  if (assist && typeof assist === 'object' && 'code' in assist && 'message' in assist) {
    return assist.message || 'Draft failed. Please try again.'
  }
  if (err instanceof Error) return err.message
  return 'Draft failed. Please try again.'
}

export function useDraftModel(options: UseDraftModelOptions = {}): UseDraftModelReturn {
  const [state, setState] = useState<DraftModelState>(INITIAL_STATE)

  const setError = useCallback((message: string | null) => {
    setState(prev => ({ ...prev, error: message, errorDetails: null }))
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const requestDraft = useCallback(async (request: DraftRequest) => {
    const description = request.prompt.trim()

    if (!description) {
      setState(prev => ({
        ...prev,
        status: 'error',
        description: '',
        draft: null,
        events: [],
        error: 'Please describe your decision before drafting.',
      }))
      return
    }

    track('draft.request')

    const useStreaming = options.streaming ?? pocFlags.sse

    // Helper to transition into an error state
    const fail = (err: unknown) => {
      const message = toErrorMessage(err)
      const assist = err as AssistError
      const details =
        assist && typeof assist === 'object' && 'details' in assist ? (assist as AssistError).details : undefined
      track('draft.error')
      setState({
        status: 'error',
        description,
        draft: null,
        events: [],
        error: message,
        errorDetails: details ?? null,
      })
    }

    if (useStreaming) {
      // Streaming path using /draft-graph/stream + SSE events
      setState({
        status: 'streaming',
        description,
        draft: null,
        events: [],
        error: null,
        errorDetails: null,
      })

      track('draft.stream.start')

      const events: DraftStreamEvent[] = []

      try {
        for await (const event of draftGraphStream(request)) {
          events.push(event)

          // Update events incrementally so UI (DraftStreamPanel) can render progress
          setState(prev => ({
            ...prev,
            status: prev.status === 'streaming' ? 'streaming' : prev.status,
            description,
            events: [...events],
          }))

          if (event.type === 'complete') {
            track('draft.success')
            track('draft.stream.done')
            setState({
              status: 'ready',
              description,
              draft: event.data,
              events: [...events],
              error: null,
            })
            return
          }

          if (event.type === 'error') {
            track('draft.error')
            setState({
              status: 'error',
              description,
              draft: null,
              events: [...events],
              error: event.data.message || 'Draft failed. Please try again.',
              errorDetails: null,
            })
            return
          }
        }

        // If we exit the loop without a complete or error event
        setState(prev => ({
          ...prev,
          status: prev.draft ? 'ready' : 'error',
          error: prev.draft ? prev.error : 'Draft ended unexpectedly. Please try again.',
        }))
      } catch (err) {
        fail(err)
      }
    } else {
      // Simple sync path using /draft-graph
      setState({
        status: 'requesting',
        description,
        draft: null,
        events: [],
        error: null,
        errorDetails: null,
      })

      try {
        const response = await draftGraph(request)
        track('draft.success')
        setState({
          status: 'ready',
          description,
          draft: response,
          events: [],
          error: null,
        })
      } catch (err) {
        fail(err)
      }
    }
  }, [options.streaming])

  return {
    state,
    requestDraft,
    reset,
    setError,
  }
}
