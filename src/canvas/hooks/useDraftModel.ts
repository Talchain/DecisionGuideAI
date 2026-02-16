import { useState, useCallback, useRef, useEffect } from 'react'
import type { DraftRequest, DraftResponse, DraftStreamEvent, AssistError } from '../../adapters/assistants/types'
import { draftGraph, draftGraphStream } from '../../adapters/assistants/http'
import { pocFlags } from '../../flags'
import { track } from '../../lib/telemetry'

// Client-side timeout for draft-graph requests
// Must be >= CEE backend timeout (120s) to avoid premature client-side aborts
const DRAFT_TIMEOUT_MS = 125_000

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

  // P0: Track current request for cancellation on unmount/new request/navigation
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestStartTimeRef = useRef<number>(0)

  // P0: Cleanup function to cancel in-flight requests
  const cancelCurrentRequest = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // P0: Cancel on unmount
  useEffect(() => {
    return () => {
      cancelCurrentRequest()
    }
  }, [cancelCurrentRequest])

  const setError = useCallback((message: string | null) => {
    setState(prev => ({ ...prev, error: message, errorDetails: null }))
  }, [])

  const reset = useCallback(() => {
    cancelCurrentRequest()
    setState(INITIAL_STATE)
  }, [cancelCurrentRequest])

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

    // P0: Cancel any in-flight request before starting new one
    cancelCurrentRequest()

    // P0: Create new AbortController with timeout
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    requestStartTimeRef.current = Date.now()

    // P0: Set timeout to abort after 35s
    timeoutIdRef.current = setTimeout(() => {
      const elapsedMs = Date.now() - requestStartTimeRef.current
      console.error('[DRAFT_GRAPH_FAILED]', { reason: 'client_timeout', elapsedMs, timeoutMs: DRAFT_TIMEOUT_MS })
      abortController.abort()
    }, DRAFT_TIMEOUT_MS)

    track('draft.request')

    const useStreaming = options.streaming ?? pocFlags.sse

    // Helper to check if error is from our client-side timeout vs other abort
    const isClientTimeout = (err: unknown): boolean => {
      return err instanceof Error && err.name === 'AbortError' && !abortController.signal.aborted
        ? false // Abort from elsewhere (unmount, new request)
        : abortController.signal.aborted // Our timeout triggered it
    }

    // Helper to transition into an error state
    // P0: Don't wipe existing graph on timeout - show retry-friendly error
    const fail = (err: unknown, preserveGraph = false) => {
      // Clear timeout since we're done
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }

      // P0: Check if this was a user-initiated abort (unmount/new request) - don't show error
      if (err instanceof Error && err.name === 'AbortError' && !isClientTimeout(err)) {
        // Silent abort - user started new request or navigated away
        return
      }

      const message = toErrorMessage(err)
      const assist = err as AssistError
      const details =
        assist && typeof assist === 'object' && 'details' in assist ? (assist as AssistError).details : undefined
      track('draft.error')

      if (preserveGraph) {
        // P0: Timeout - preserve existing state, just set error
        setState(prev => ({
          ...prev,
          status: 'error',
          error: message,
          errorDetails: details ?? null,
        }))
      } else {
        setState({
          status: 'error',
          description,
          draft: null,
          events: [],
          error: message,
          errorDetails: details ?? null,
        })
      }
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
        // P0: Pass signal for timeout/cancellation
        for await (const event of draftGraphStream(request, { signal: abortController.signal })) {
          events.push(event)

          // Update events incrementally so UI (DraftStreamPanel) can render progress
          setState(prev => ({
            ...prev,
            status: prev.status === 'streaming' ? 'streaming' : prev.status,
            description,
            events: [...events],
          }))

          if (event.type === 'complete') {
            // P0: Clear timeout on success
            if (timeoutIdRef.current) {
              clearTimeout(timeoutIdRef.current)
              timeoutIdRef.current = null
            }
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
            // P0: Clear timeout on error
            if (timeoutIdRef.current) {
              clearTimeout(timeoutIdRef.current)
              timeoutIdRef.current = null
            }
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

        // P0: Clear timeout if loop ends
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current)
          timeoutIdRef.current = null
        }

        // If we exit the loop without a complete or error event
        setState(prev => ({
          ...prev,
          status: prev.draft ? 'ready' : 'error',
          error: prev.draft ? prev.error : 'Draft ended unexpectedly. Please try again.',
        }))
      } catch (err) {
        // P0: On timeout, preserve existing graph state
        const isTimeout = isClientTimeout(err)
        fail(err, isTimeout)
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
        // P0: Pass signal for timeout/cancellation
        const response = await draftGraph(request, { signal: abortController.signal })
        // P0: Clear timeout on success
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current)
          timeoutIdRef.current = null
        }
        track('draft.success')
        setState({
          status: 'ready',
          description,
          draft: response,
          events: [],
          error: null,
        })
      } catch (err) {
        // P0: On timeout, preserve existing graph state
        const isTimeout = isClientTimeout(err)
        fail(err, isTimeout)
      }
    }
  }, [options.streaming, cancelCurrentRequest])

  return {
    state,
    requestDraft,
    reset,
    setError,
  }
}
