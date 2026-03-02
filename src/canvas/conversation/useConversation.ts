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
import type {
  ConversationMessage,
  ActionChip,
  OrchestratorTurnRequest,
  OrchestratorResponseEnvelopeV2,
  ConversationTurnPair,
} from './types'
import { MAX_CHIPS_PER_TURN } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_RUNNING_THRESHOLD_MS = 10_000
const TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract last N turn pairs (user+assistant = 1 pair) from messages */
function buildHistory(
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

/** Enforce chip budget: coaching chips first, then suggested actions */
function enforceChipBudget(
  coachingChips: ActionChip[],
  suggestedActions: ActionChip[],
): ActionChip[] {
  const merged = [...coachingChips, ...suggestedActions]
  return merged.slice(0, MAX_CHIPS_PER_TURN)
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseConversationReturn {
  messages: ConversationMessage[]
  isThinking: boolean
  longRunningHint: string | null
  sendMessage: (text: string) => Promise<void>
  sendChip: (chip: ActionChip) => Promise<void>
  clearHistory: () => void
  retryLast: () => Promise<void>
}

export function useConversation(): UseConversationReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [longRunningHint, setLongRunningHint] = useState<string | null>(null)

  // Refs for timers and abort
  const abortRef = useRef<AbortController | null>(null)
  const longRunningTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastUserInputRef = useRef<string>('')

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(longRunningTimerRef.current)
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
    }
  }, [scenarioId])

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  const buildRequest = useCallback(
    (text: string): OrchestratorTurnRequest => {
      const store = useCanvasStore.getState()
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isThinking) return

      lastUserInputRef.current = text

      // Add user message
      const userMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      addMessage(userMsg)

      // Start thinking state
      setIsThinking(true)
      setLongRunningHint(null)

      // Abort any previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // 10s long-running placeholder
      longRunningTimerRef.current = setTimeout(() => {
        setLongRunningHint('Running analysis...')
      }, LONG_RUNNING_THRESHOLD_MS)

      // 30s timeout
      timeoutTimerRef.current = setTimeout(() => {
        controller.abort()
        clearTimeout(longRunningTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'This is taking longer than expected. Try again or rephrase your message.',
          synthetic: true,
          actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
          timestamp: new Date(),
        })
      }, TIMEOUT_MS)

      try {
        const request = buildRequest(text)
        const envelope = await callOrchestratorTurn(request, controller.signal)
        handleEnvelope(envelope)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // timeout already handled

        const message =
          err instanceof OrchestratorError
            ? `Something went wrong (${err.status}). Try again or rephrase your message.`
            : 'Something went wrong. Try again or rephrase your message.'

        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          synthetic: true,
          actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
          timestamp: new Date(),
        })
      } finally {
        clearTimeout(longRunningTimerRef.current)
        clearTimeout(timeoutTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
      }
    },
    [isThinking, addMessage, buildRequest, handleEnvelope],
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
    abortRef.current?.abort()
    clearTimeout(longRunningTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
  }, [])

  return {
    messages,
    isThinking,
    longRunningHint,
    sendMessage,
    sendChip,
    clearHistory,
    retryLast,
  }
}
