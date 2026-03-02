/**
 * useConversation — Conversation state and orchestrator integration
 *
 * Manages the message list, sends turns to the orchestrator, handles
 * timeouts and errors, and provides chip interaction. Session-scoped
 * (not persisted). Clears on scenario switch.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { callOrchestratorTurn, OrchestratorError } from './turnService'
import { isOrchestratorV2Enabled } from '../../flags'
import type {
  ConversationMessage,
  ActionChip,
  SystemEvent,
  OrchestratorTurnRequest,
  OrchestratorResponseEnvelopeV2,
  ConversationTurnPair,
} from './types'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from './types'

/** Sentinel message content used for system events — must never render as a user bubble */
export const SYSTEM_MESSAGE_SENTINEL = '[system]'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_RUNNING_THRESHOLD_MS = 10_000
const STILL_WORKING_THRESHOLD_MS = 20_000
const TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract last N turn pairs (user+assistant = 1 pair) from messages */
export function buildHistory(
  messages: ConversationMessage[],
  maxPairs: number,
): ConversationTurnPair[] {
  const pairs: ConversationTurnPair[] = []
  for (const msg of messages) {
    if (msg.synthetic) continue
    pairs.push({ role: msg.role, content: msg.content })
  }
  // Keep last maxPairs * 2 entries (each pair = user + assistant)
  return pairs.slice(-(maxPairs * 2))
}

/** Enforce chip budget: coaching chips take priority, suggested actions capped at MAX_SUGGESTED_ACTIONS */
export function enforceChipBudget(
  coachingChips: ActionChip[],
  suggestedActions: ActionChip[],
): ActionChip[] {
  const coaching = coachingChips.slice(0, MAX_CHIPS_PER_TURN)
  const remainingSlots = Math.min(
    MAX_SUGGESTED_ACTIONS,
    MAX_CHIPS_PER_TURN - coaching.length,
  )
  return [...coaching, ...suggestedActions.slice(0, remainingSlots)]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Map of patch_id → block state for GraphPatchBlock UI (keyed by `${turnId}:${patchId}`) */
export type PatchBlockState = 'proposed' | 'accepted' | 'rejected' | 'dismissed'

export interface PatchRejectionInfo {
  code: string
  message: string
  violations?: string[]
}

export interface UseConversationReturn {
  messages: ConversationMessage[]
  isThinking: boolean
  longRunningHint: string | null
  /** The user's last input text, restored on error so they can edit and resend */
  lastFailedInput: string | null
  sendMessage: (text: string) => Promise<void>
  sendSystemEvent: (event: SystemEvent) => Promise<void>
  sendChip: (chip: ActionChip) => Promise<void>
  clearHistory: () => void
  retryLast: () => Promise<void>
  /** GraphPatchBlock state map (keyed by `${turnId}:${patchId}`) */
  patchBlockStates: Map<string, PatchBlockState>
  setPatchBlockState: (key: string, state: PatchBlockState) => void
  /** Rejection details for patches that failed validation */
  patchRejections: Map<string, PatchRejectionInfo>
  setPatchRejection: (key: string, info: PatchRejectionInfo) => void
}

export function useConversation(): UseConversationReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [longRunningHint, setLongRunningHint] = useState<string | null>(null)
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null)
  const [patchBlockStates, setPatchBlockStates] = useState<Map<string, PatchBlockState>>(new Map())
  const [patchRejections, setPatchRejectionsMap] = useState<Map<string, PatchRejectionInfo>>(new Map())

  // Refs for timers and abort
  const abortRef = useRef<AbortController | null>(null)
  const longRunningTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const stillWorkingTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastUserInputRef = useRef<string>('')

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(longRunningTimerRef.current)
      clearTimeout(stillWorkingTimerRef.current)
      clearTimeout(timeoutTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Clear conversation when scenario changes
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const prevScenarioRef = useRef(scenarioId)
  useEffect(() => {
    if (scenarioId !== prevScenarioRef.current) {
      prevScenarioRef.current = scenarioId
      setMessages([])
      setIsThinking(false)
      setLongRunningHint(null)
      setLastFailedInput(null)
    }
  }, [scenarioId])

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const buildRequest = useCallback(
    (text: string): OrchestratorTurnRequest => {
      const store = useCanvasStore.getState()
      const { nodeIds, edgeIds } = store.selection
      return {
        scenario_id: store.currentScenarioId ?? `session-${Date.now()}`,
        message: text,
        conversation_history: buildHistory(messages, 5),
        graph_state: {
          node_count: store.nodes.length,
          edge_count: store.edges.length,
          has_goal: store.nodes.some((n) => n.type === 'goal'),
        },
        analysis_state: {
          has_results: store.results.status === 'complete',
          last_run_hash: store.currentScenarioLastResultHash,
        },
        selected_elements:
          nodeIds.size > 0 || edgeIds.size > 0
            ? { node_ids: [...nodeIds], edge_ids: [...edgeIds] }
            : undefined,
        client_turn_id: crypto.randomUUID(),
      }
    },
    [messages],
  )

  const handleEnvelope = useCallback(
    (envelope: OrchestratorResponseEnvelopeV2) => {
      // Update stage if provided
      if (envelope.stage_indicator) {
        useCanvasStore.getState().setCurrentStage(envelope.stage_indicator)
      }

      // Build action chips from suggested_actions (enforced budget)
      const chips = enforceChipBudget([], envelope.suggested_actions ?? [])

      const assistantMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: envelope.assistant_text,
        blocks: envelope.blocks,
        actionChips: chips.length > 0 ? chips : undefined,
        timestamp: new Date(),
        clientTurnId: envelope.client_turn_id,
      }

      addMessage(assistantMsg)
    },
    [addMessage],
  )

  const setPatchBlockState = useCallback((key: string, state: PatchBlockState) => {
    setPatchBlockStates((prev) => {
      const next = new Map(prev)
      next.set(key, state)
      return next
    })
  }, [])

  const setPatchRejection = useCallback((key: string, info: PatchRejectionInfo) => {
    setPatchRejectionsMap((prev) => {
      const next = new Map(prev)
      next.set(key, info)
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // sendTurn — shared core for user messages and system events
  // ---------------------------------------------------------------------------

  const sendTurn = useCallback(
    async (opts: {
      message: string
      systemEvent?: SystemEvent
      mode: 'user' | 'system'
    }) => {
      const { message, systemEvent, mode } = opts

      if (mode === 'user') {
        if (!message.trim() || isThinking) return
        lastUserInputRef.current = message
        setLastFailedInput(null)

        // Add user message bubble
        addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: new Date(),
        })
      } else {
        // System events: no user bubble, but still guard against concurrent sends.
        // Note: '[system]' sentinel turns must be excluded when conversation persistence
        // is implemented. They are infrastructure turns, not user content.
        if (isThinking) return
      }

      // Start thinking state
      setIsThinking(true)
      setLongRunningHint(null)

      // Abort any previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // 10s → "Running analysis…", 20s → "Still working…"
      longRunningTimerRef.current = setTimeout(() => {
        setLongRunningHint('Running analysis\u2026')
      }, LONG_RUNNING_THRESHOLD_MS)

      stillWorkingTimerRef.current = setTimeout(() => {
        setLongRunningHint('Still working\u2026')
      }, STILL_WORKING_THRESHOLD_MS)

      // 30s timeout
      const inputForRestore = mode === 'user' ? message : null
      timeoutTimerRef.current = setTimeout(() => {
        controller.abort()
        clearTimeout(longRunningTimerRef.current)
        clearTimeout(stillWorkingTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
        if (inputForRestore) setLastFailedInput(inputForRestore)
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'This is taking longer than expected. Try again or rephrase your message.',
          synthetic: true,
          actionChips: mode === 'user'
            ? [{ id: 'retry', label: 'Try again', intent: 'primary' }]
            : undefined,
          timestamp: new Date(),
        })
      }, TIMEOUT_MS)

      try {
        const request = buildRequest(message)
        // Attach system_event when provided, including client_turn_id for correlation
        if (systemEvent) {
          request.system_event = {
            ...systemEvent,
            payload: { ...systemEvent.payload, client_turn_id: request.client_turn_id },
          }
        }
        const envelope = await callOrchestratorTurn(request, controller.signal)
        handleEnvelope(envelope)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // timeout already handled

        if (mode === 'user') setLastFailedInput(message)

        const errorMessage =
          err instanceof OrchestratorError
            ? `Something went wrong (${err.status}). Try again or rephrase your message.`
            : 'Something went wrong. Try again or rephrase your message.'

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMessage,
          synthetic: true,
          actionChips: mode === 'user'
            ? [{ id: 'retry', label: 'Try again', intent: 'primary' }]
            : undefined,
          timestamp: new Date(),
        })
      } finally {
        clearTimeout(longRunningTimerRef.current)
        clearTimeout(stillWorkingTimerRef.current)
        clearTimeout(timeoutTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
      }
    },
    [isThinking, addMessage, buildRequest, handleEnvelope],
  )

  // ---------------------------------------------------------------------------
  // Public API: sendMessage, sendSystemEvent, sendChip
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string) => {
      await sendTurn({ message: text, mode: 'user' })
    },
    [sendTurn],
  )

  const sendSystemEvent = useCallback(
    async (event: SystemEvent) => {
      // No-op when orchestrator V2 is OFF
      if (!isOrchestratorV2Enabled()) return
      await sendTurn({
        message: SYSTEM_MESSAGE_SENTINEL,
        systemEvent: event,
        mode: 'system',
      })
    },
    [sendTurn],
  )

  const sendChip = useCallback(
    async (chip: ActionChip) => {
      // Undo draft: restore pre-draft snapshot via store action
      if (chip.intent === 'undo') {
        useCanvasStore.getState().undoDraft()
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Draft undone. The canvas has been restored to its previous state.',
          synthetic: true,
          timestamp: new Date(),
        })
        return
      }

      if (chip.message) {
        await sendMessage(chip.message)
      }
    },
    [sendMessage, addMessage],
  )

  const retryLast = useCallback(async () => {
    if (lastUserInputRef.current) {
      // Remove the error message before retrying
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.synthetic) return prev.slice(0, -1)
        return prev
      })
      await sendMessage(lastUserInputRef.current)
    }
  }, [sendMessage])

  const clearHistory = useCallback(() => {
    setMessages([])
    setIsThinking(false)
    setLongRunningHint(null)
    setLastFailedInput(null)
    setPatchBlockStates(new Map())
    setPatchRejectionsMap(new Map())
    abortRef.current?.abort()
    clearTimeout(longRunningTimerRef.current)
    clearTimeout(stillWorkingTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
  }, [])

  return {
    messages,
    isThinking,
    longRunningHint,
    lastFailedInput,
    sendMessage,
    sendSystemEvent,
    sendChip,
    clearHistory,
    retryLast,
    patchBlockStates,
    setPatchBlockState,
    patchRejections,
    setPatchRejection,
  }
}
