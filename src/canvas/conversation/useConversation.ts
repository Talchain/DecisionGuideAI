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
import { isOrchestratorV2Enabled, isV3SystemEventsEnabled } from '../../flags'
import { useGuidanceStore } from '../stores/guidanceStore'
import { serializeSystemEvent } from './systemEvents'
import {
  isSuccessfulAnalysis,
  sanitizeV2RunResponse,
  validateV2RunResponseFull,
} from '../../adapters/plot/v2'
import {
  mapV2ResponseToReportV1,
  createEnrichmentFromV2Response,
  synthesizeCeeReviewFromV2,
  synthesizeCeeTraceFromV2,
} from '../../adapters/plot/v2/responseMapper'
import type {
  ConversationMessage,
  ConversationBlock,
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

/**
 * Normalise a block as received from CEE's wire format into the flat UI type.
 *
 * CEE may send blocks in two shapes:
 *  1. Wrapped: { block_id, block_type, data: {...}, actions: [...] }
 *  2. Flat (legacy): { type, ...fields } — already in UI format
 *
 * Unknown block_type values are passed through as-is; InlineBlocks renders a
 * fallback for them. Unknown enum values within known block types degrade
 * gracefully — never crash.
 */
export function adaptCEEBlock(raw: unknown): ConversationBlock {
  if (raw == null || typeof raw !== 'object') {
    // Return a minimal unknown block so InlineBlocks can show fallback
    return { type: 'commentary', text: '' } as ConversationBlock
  }

  const obj = raw as Record<string, unknown>

  // Wrapped CEE format: { block_type, data, ... }
  if (typeof obj.block_type === 'string' && 'data' in obj) {
    const { block_type, block_id, data, actions } = obj
    const dataObj = (data != null && typeof data === 'object' ? data : {}) as Record<string, unknown>

    switch (block_type) {
      case 'framing':
        return {
          type: 'framing',
          goal: String(dataObj.goal ?? ''),
          options: Array.isArray(dataObj.options) ? dataObj.options.map(String) : [],
          constraints: Array.isArray(dataObj.constraints) ? dataObj.constraints.map(String) : undefined,
          key_risks: Array.isArray(dataObj.key_risks) ? dataObj.key_risks.map(String) : undefined,
        }

      case 'graph_patch':
        return {
          type: 'graph_patch',
          patch_id: String(dataObj.patch_id ?? block_id ?? ''),
          summary: String(dataObj.description ?? dataObj.summary ?? ''),
          operations: Array.isArray(dataObj.operations) ? dataObj.operations as any : [],
          target_graph_hash: String(dataObj.applied_graph_hash ?? dataObj.target_graph_hash ?? ''),
          auto_apply: dataObj.auto_apply === true,
          actions: Array.isArray(actions) ? actions as any : undefined,
          block_id: typeof block_id === 'string' ? block_id : undefined,
        }

      case 'fact':
        return {
          type: 'fact',
          label: String(dataObj.label ?? ''),
          value: String(dataObj.value ?? ''),
          source: dataObj.source != null ? String(dataObj.source) : undefined,
          fact_type: (dataObj.fact_type as any) ?? undefined,
          facts: Array.isArray(dataObj.facts) ? dataObj.facts as any : undefined,
          lineage: dataObj.lineage as any ?? undefined,
        }

      case 'commentary':
        return {
          type: 'commentary',
          text: String(dataObj.narrative ?? dataObj.text ?? ''),
          citations: Array.isArray(dataObj.citations) ? dataObj.citations as any : undefined,
        }

      case 'review_card':
        return {
          type: 'review_card',
          title: String(dataObj.title ?? ''),
          body: String(dataObj.description ?? dataObj.body ?? ''),
          variant: dataObj.variant === 'alert' ? 'alert' : 'info',
          priority: dataObj.priority as any ?? undefined,
        }

      case 'brief':
        return {
          type: 'brief',
          title: String(dataObj.title ?? ''),
          summary: String(dataObj.summary ?? ''),
          brief_url: dataObj.shareable_url != null ? String(dataObj.shareable_url) : undefined,
        }

      default:
        // Unknown block_type — pass raw type through for InlineBlocks fallback
        return { type: block_type as any, ...dataObj } as unknown as ConversationBlock
    }
  }

  // Flat format (legacy / already-normalised) — pass through as-is
  return raw as ConversationBlock
}

/**
 * Budget-aware block selection: keep original CEE array order.
 * Moves all graph_patch blocks to the front so that if the visible-set slice
 * is applied (MAX_VISIBLE_BLOCKS_PER_TURN), patch blocks are never hidden
 * behind the "Show more" toggle.
 *
 * NOTE: This returns the FULL reordered array. InlineBlocks applies the visual
 * slice. Block settlement state (proposed/accepted/rejected/dismissed) is
 * managed separately in patchBlockStates and is not available here.
 */
export function prioritiseBlocks(blocks: ConversationBlock[]): ConversationBlock[] {
  // Separate graph_patch blocks from the rest (preserve sub-order within each group)
  const patchBlocks = blocks.filter((b) => b.type === 'graph_patch')
  const others = blocks.filter((b) => b.type !== 'graph_patch')
  // Patch blocks first, then everything else in original order
  return [...patchBlocks, ...others]
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

      // Dev assertion: full graph must include structural fields (kind on nodes,
      // strength/weight on edges). Catches accidental compact-form regression.
      if (import.meta.env.DEV) {
        const hasKind = store.nodes.length === 0 || store.nodes.some((n) => n.data?.kind !== undefined)
        const hasEdgeData = store.edges.length === 0 || store.edges.some((e) => e.data !== undefined)
        if (!hasKind || !hasEdgeData) {
          console.warn(
            '[buildRequest] graph_state may be missing structural fields. ' +
            'Nodes should have data.kind; edges should have data. Got:',
            { hasKind, hasEdgeData, nodeCount: store.nodes.length, edgeCount: store.edges.length },
          )
        }
      }

      return {
        scenario_id: store.currentScenarioId ?? `session-${Date.now()}`,
        message: text,
        conversation_history: buildHistory(messages, 5),
        graph_state: {
          nodes: store.nodes,
          edges: store.edges,
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

      // Update guidance items (replaces previous array; clears stale active ID)
      useGuidanceStore.getState().setGuidanceItems(envelope.guidance_items ?? [])

      // A.9 Task 1: Hydrate results store when envelope carries analysis results
      const store = useCanvasStore.getState()
      if (envelope.analysis_response) {
        const raw = envelope.analysis_response
        // Guard: skip write if this response_hash is already in the store
        if (raw.response_hash && raw.response_hash === store.results.hash) {
          if (import.meta.env.DEV) {
            console.log('[handleEnvelope] Skipping duplicate analysis response (same hash)', raw.response_hash)
          }
        } else if (isSuccessfulAnalysis(raw)) {
          try {
            // Apply the same validate → sanitize → map pipeline as the direct path
            validateV2RunResponseFull(raw) // soft warnings only; don't block on them
            const result = sanitizeV2RunResponse(raw)
            const report = mapV2ResponseToReportV1(result, { seed: store.results.seed })
            const enrichment = createEnrichmentFromV2Response(result)
            const ceeReviewV1 = synthesizeCeeReviewFromV2(result)
            const ceeTraceV1 = synthesizeCeeTraceFromV2(result, undefined, undefined)

            store.resultsComplete({
              report,
              hash: result.response_hash,
              enrichment,
              ceeReviewV1,
              ceeTraceV1,
              resultsSource: 'conversation',
            })
          } catch (err) {
            // Non-fatal: envelope analysis wiring failed — log and continue
            // The conversation message will still be shown.
            if (import.meta.env.DEV) {
              console.error('[handleEnvelope] Failed to hydrate results from envelope:', err)
            }
          }
        }
      }

      // A.9 Task 4: Propagate analysis error from envelope to results panel
      if (envelope.analysis_error && !envelope.analysis_response) {
        store.resultsError({
          code: envelope.analysis_error.code,
          message: envelope.analysis_error.message,
        })
      }

      // Build action chips from suggested_actions (enforced budget)
      const chips = enforceChipBudget([], envelope.suggested_actions ?? [])

      // Normalise CEE blocks and apply budget priority (proposed patches first)
      const rawBlocks = envelope.blocks ?? []
      const normalisedBlocks = rawBlocks.map(adaptCEEBlock)
      const orderedBlocks = prioritiseBlocks(normalisedBlocks)

      const assistantMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: envelope.assistant_text,
        blocks: orderedBlocks.length > 0 ? orderedBlocks : undefined,
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
        // Attach system_event at the wire boundary.
        // When ENABLE_V3_SYSTEM_EVENTS is ON: serialize to CEE v3 format
        // { event_type, timestamp, event_id, details }. Unknown types are
        // skipped by serializeSystemEvent (returns null) to prevent 400s.
        // When OFF: send the raw internal { type, payload } shape.
        if (systemEvent) {
          if (isV3SystemEventsEnabled()) {
            const wire = serializeSystemEvent(systemEvent)
            if (wire !== null) {
              request.system_event = wire
            }
            // null means unknown type — skipped, no system_event sent this turn
          } else {
            request.system_event = systemEvent
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
