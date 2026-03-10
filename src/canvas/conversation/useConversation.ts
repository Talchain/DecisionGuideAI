/**
 * useConversation — Conversation state and orchestrator integration
 *
 * Manages the message list, sends turns to the orchestrator, handles
 * timeouts and errors, and provides chip interaction. Session-scoped
 * (not persisted). Clears on scenario switch.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { generateGraphHash } from '../utils/graphHash'
import { callOrchestratorTurn, OrchestratorError } from './turnService'
import { isOrchestratorV2Enabled, isThreadHydrateEnabled, isThreadPersistEnabled } from '../../flags'
import { assembleAnalysisInputsSummary } from '../analysis/assembleAnalysisInputsSummary'
import { useResultsStore } from '../stores/resultsStore'
import { hydrateMessagesFromThread, formatSessionBoundary } from './utils/hydrateThread'
import { appendThreadEntries, createSnapshot } from '../../services/threadService'
import type { ThreadEntry } from '../journey/threadTypes'
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
  WireSystemEvent,
  OrchestratorTurnRequest,
  OrchestratorResponseEnvelopeV2,
  ConversationTurnPair,
  GraphPatchBlock,
} from './types'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from './types'
import { applyAutoApplyPatch, synthesiseCeeAnalysisReady } from './utils/applyPatch'
import { validateAnalysisReadyContract } from './validateAnalysisReadyContract'
import { validateResponse } from './validateResponse'
import type { CEEAnalysisReady } from '../../adapters/cee/types'

/** Sentinel message content used for system events — must never render as a user bubble */
export const SYSTEM_MESSAGE_SENTINEL = '[system]'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LONG_RUNNING_THRESHOLD_MS = 15_000
const STILL_WORKING_THRESHOLD_MS = 30_000
const TIMEOUT_MS = 60_000

/**
 * Infer a task-specific loading hint from the user message and graph state.
 * Used as the first long-running hint (15s) to give users a sense of what's happening.
 */
export function inferLoadingHint(message: string, nodeCount: number): string {
  const lower = message.toLowerCase()
  if (lower.includes('analys') || lower.includes('evaluat') || lower.includes('compare') || lower.includes('run')) return 'Analysing your options\u2026'
  if (lower.includes('research') || lower.includes('evidence') || lower.includes('find')) return 'Researching evidence\u2026'
  if (lower.includes('brief')) return 'Assembling your decision brief\u2026'
  if (lower.includes('explain') || lower.includes('why')) return 'Preparing explanation\u2026'
  if (nodeCount === 0 || lower.includes('build') || lower.includes('model') || lower.includes('create')) return 'Building your decision model\u2026'
  return 'Thinking\u2026'
}

/**
 * Fields to strip from node.data before sending to CEE.
 *
 * - RF internals (selected, dragging, measured, etc.) — React Flow rendering state
 * - label, kind, type — extracted as top-level keys in the CEE node shape
 * - uncertainty — UI-computed display field, not part of CEE node schema
 * - interventions — rebuilt from ceeAnalysisReady.options; sending the
 *   canvas-side copy would conflict with CEE's authoritative version
 */
const RF_NODE_BLOCKLIST = new Set([
  'selected', 'dragging', 'measured', 'resizing',
  'position', 'positionAbsolute', 'draggable', 'selectable',
  'deletable', 'connectable', 'focusable', 'parentId', 'extent',
  'expandParent', 'ariaLabel', 'zIndex', 'hidden',
  'label', 'kind', 'type', 'uncertainty', 'interventions',
  // UI-only snapshot (not for CEE); flagged_as_assumption intentionally passes through
  '_baseline_snapshot',
])

/** Valid CEE node kinds — unknown kinds fall back to 'factor' */
const CEE_VALID_KINDS = new Set([
  'decision', 'event', 'outcome', 'goal', 'option', 'factor', 'risk', 'action',
])

/** Clamp a number to [0, 1] */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a user-facing error message from a caught error */
export function buildErrorMessage(err: unknown): string {
  if (!(err instanceof OrchestratorError)) {
    return 'Something went wrong. Try again or rephrase your message.'
  }
  const ref = err.requestId ? ` [ref: ${err.requestId}]` : ''
  switch (true) {
    case err.status === 401:
      return `Authentication error.${ref} Please refresh and try again.`
    case err.status === 429:
      return `Too many requests.${ref} Please wait a moment and try again.`
    case err.status === 400:
      return `Request error (400).${ref} Try rephrasing your message.`
    case err.status !== undefined && err.status >= 500:
      return `Service temporarily unavailable (${err.status}).${ref} Please try again shortly.`
    default:
      return `Something went wrong (${err.status}).${ref} Try again or rephrase your message.`
  }
}

/**
 * Dev-mode post-adaptation validator. Warns if critical fields are missing
 * on adapted blocks. Catches adapter regressions before they reach the browser.
 * No-op in production builds.
 */
function validateAdaptedBlock(block: ConversationBlock, index: number): void {
  if (!import.meta.env.DEV) return

  if (block.type === 'graph_patch') {
    const patch = block as GraphPatchBlock
    if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
      console.warn(`[validateAdaptedBlock] blocks[${index}] graph_patch has 0 operations`)
    }
    for (let i = 0; i < (patch.operations?.length ?? 0); i++) {
      const op = patch.operations[i]
      if (!op.target_id) {
        console.warn(`[validateAdaptedBlock] blocks[${index}].operations[${i}] missing target_id`, { op: op.op })
      }
      if (op.op.startsWith('add_') && op.data == null) {
        console.warn(`[validateAdaptedBlock] blocks[${index}].operations[${i}] add op missing data`, { op: op.op, target_id: op.target_id })
      }
    }
  }

  if (block.type === 'commentary' && !(block as any).text) {
    console.warn(`[validateAdaptedBlock] blocks[${index}] commentary has empty text`)
  }

  if (block.type === 'fact' && !(block as any).label) {
    console.warn(`[validateAdaptedBlock] blocks[${index}] fact has empty label`)
  }
}

/** Extract last N turn pairs (user+assistant = 1 pair) from messages */
export function buildHistory(
  messages: ConversationMessage[],
  maxPairs: number,
): ConversationTurnPair[] {
  const pairs: ConversationTurnPair[] = []
  for (const msg of messages) {
    if (msg.synthetic) continue
    // Track 3: Exclude hydrated entries that are not suitable for LLM context.
    // Only conversation-origin, complete, full-redaction entries should reach the LLM.
    if (msg._threadMeta) {
      if (msg._threadMeta.origin !== 'conversation') continue
      if (msg._threadMeta.entryStatus !== 'complete') continue
      if (msg._threadMeta.redactionState !== 'full') continue
    }
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
 * Normalise a single patch operation from CEE wire format to UI PatchOperation.
 *
 * CEE sends operations in two formats:
 *   V2 (current): { op, path, value }
 *     - path: "/nodes/<id>" or "/edges/<from>-><to>"
 *     - value: the node/edge data object
 *     - target_id is derived from value.id or the path tail
 *   Legacy: { op, target_id, data }
 *     - Already in UI format, pass through
 */
function normalisePatchOp(raw: Record<string, unknown>): Record<string, unknown> {
  // Already in UI format (has target_id)
  if (typeof raw.target_id === 'string') return raw

  // V2 format: { op, path, value }
  if ('value' in raw || 'path' in raw) {
    const value = (raw.value != null && typeof raw.value === 'object' ? raw.value : {}) as Record<string, unknown>
    const path = typeof raw.path === 'string' ? raw.path : ''
    // Derive target_id: prefer value.id, fall back to last segment of path
    const pathTail = path.split('/').pop() ?? ''
    const targetId = typeof value.id === 'string' ? value.id : pathTail

    if (import.meta.env.DEV) {
      if (!targetId) {
        console.warn('[normalisePatchOp] empty target_id — no value.id and path has no usable tail', { op: raw.op, path })
      }
      if (typeof raw.op === 'string' && raw.op.startsWith('add_') && Object.keys(value).length === 0) {
        console.warn('[normalisePatchOp] add op has empty data (value was null/undefined)', { op: raw.op, path })
      }
    }

    return {
      op: raw.op,
      target_id: targetId,
      data: value,
    }
  }

  // Unknown shape — pass through, buildNode/buildEdge will guard on missing fields
  if (import.meta.env.DEV) {
    console.warn('[normalisePatchOp] unknown op shape — no target_id, no path/value', { op: raw.op, keys: Object.keys(raw) })
  }
  return raw
}

/**
 * Normalise a block as received from CEE's wire format into the flat UI type.
 *
 * CEE may send blocks in two shapes:
 *  1. Wrapped (V2): { block_id, block_type, data: { operations: [{op, path, value}], auto_apply, ... }, provenance }
 *  2. Flat (legacy): { type, operations: [{op, target_id, data}], ...fields } — already in UI format
 *
 * Within graph_patch, operations may use either:
 *  - V2 format: { op, path: "/nodes/<id>", value: {...} }
 *  - Legacy format: { op, target_id: "<id>", data: {...} }
 * Both are normalised to { op, target_id, data } for applyAutoApplyPatch.
 *
 * Unknown block_type values are passed through as-is; InlineBlocks renders a
 * fallback for them. Unknown enum values within known block types degrade
 * gracefully — never crash.
 */
/**
 * Normalise a CEE analysis_ready payload from graph_patch block data.
 * Maps option_id → id if CEE sends option_id instead of id.
 * Returns undefined if the payload is absent or structurally invalid.
 */
function normaliseAnalysisReady(raw: unknown): CEEAnalysisReady | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.options) || typeof obj.goal_node_id !== 'string') return undefined

  // Map option_id → id but preserve ALL options (including malformed ones)
  // so validateAnalysisReadyContract can enforce all-or-nothing rejection.
  const options = obj.options
    .map((opt: any) => ({
      ...opt,
      id: opt.id ?? opt.option_id,
    }))

  const mapped = { ...obj, options } as CEEAnalysisReady

  // Boundary validation — rejects entire payload if any field fails contract
  return validateAnalysisReadyContract(mapped)
}

export function adaptCEEBlock(raw: unknown): ConversationBlock {
  if (raw == null || typeof raw !== 'object') {
    // Return a minimal unknown block so InlineBlocks can show fallback
    return { type: 'commentary', text: '' } as ConversationBlock
  }

  const obj = raw as Record<string, unknown>

  // Defensive: warn if block has neither type identifier
  if (import.meta.env.DEV && typeof obj.block_type !== 'string' && typeof obj.type !== 'string') {
    console.warn('[adaptCEEBlock] Block missing type identifier:', Object.keys(obj))
  }

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

      case 'graph_patch': {
        const rawOps = Array.isArray(dataObj.operations) ? dataObj.operations : []
        const normOps = rawOps.map((op: unknown) =>
          op != null && typeof op === 'object' ? normalisePatchOp(op as Record<string, unknown>) : op
        )

        if (import.meta.env.DEV) {
          if (rawOps.length > 0 && normOps.length > 0) {
            const firstOp = normOps[0] as Record<string, unknown>
            const hadPathValue = rawOps.some((o: any) => 'path' in o || 'value' in o)
            if (hadPathValue) {
              console.warn('[adaptCEEBlock] Normalised graph_patch ops from path/value → target_id/data', {
                rawCount: rawOps.length,
                sampleTargetId: firstOp.target_id,
                sampleOp: firstOp.op,
              })
            }
          }
          // Warn: operations resolved to empty but block had data
          if (normOps.length === 0 && Object.keys(dataObj).length > 0) {
            console.warn('[adaptCEEBlock] graph_patch has 0 operations but data keys:', Object.keys(dataObj))
          }
        }

        return {
          type: 'graph_patch',
          patch_id: String(dataObj.patch_id ?? block_id ?? ''),
          summary: String(dataObj.description ?? dataObj.summary ?? ''),
          operations: normOps as any,
          target_graph_hash: String(dataObj.applied_graph_hash ?? dataObj.target_graph_hash ?? ''),
          auto_apply: dataObj.auto_apply === true,
          actions: Array.isArray(actions) ? actions as any : undefined,
          block_id: typeof block_id === 'string' ? block_id : undefined,
          analysis_ready: normaliseAnalysisReady(dataObj.analysis_ready),
        }
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

      case 'evidence':
        return {
          type: 'evidence',
          title: dataObj.title != null ? String(dataObj.title) : undefined,
          findings: Array.isArray(dataObj.findings) ? dataObj.findings : [],
          query: String(dataObj.query ?? ''),
        }

      default:
        // Unknown block_type — pass raw type through for InlineBlocks fallback
        return { type: block_type as any, ...dataObj } as unknown as ConversationBlock
    }
  }

  // Flat format (legacy / already-normalised)
  // Still normalise graph_patch operations in case they use path/value format
  if (obj.type === 'graph_patch' && Array.isArray(obj.operations)) {
    return {
      ...obj,
      operations: obj.operations.map((op: unknown) =>
        op != null && typeof op === 'object' ? normalisePatchOp(op as Record<string, unknown>) : op
      ),
      analysis_ready: normaliseAnalysisReady(obj.analysis_ready),
    } as unknown as ConversationBlock
  }
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
  sendMessage: (text: string, opts?: { hidden?: boolean }) => Promise<void>
  sendSystemEvent: (event: WireSystemEvent) => Promise<void>
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

  // Refs for timers, abort, and in-flight lock
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  const longRunningTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const stillWorkingTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const lastUserInputRef = useRef<{ message: string; clientTurnId?: string }>({ message: '' })

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(longRunningTimerRef.current)
      clearTimeout(stillWorkingTimerRef.current)
      clearTimeout(timeoutTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Clear conversation when scenario changes (with Track 3 thread hydration)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const prevScenarioRef = useRef(scenarioId)
  useEffect(() => {
    if (scenarioId !== prevScenarioRef.current) {
      prevScenarioRef.current = scenarioId

      // Track 3: Hydrate conversation from persisted thread on scenario resume
      if (isThreadHydrateEnabled() && scenarioId) {
        const store = useCanvasStore.getState()
        const rawThread = store._hydratedThread as ThreadEntry[] | null
        if (rawThread && rawThread.length > 0) {
          try {
            // Use current graph structure hash (not last analysis hash) for
            // like-for-like stale detection against graph_hash_at_proposal.
            const graphHash = generateGraphHash(store.nodes, store.edges)
            const result = hydrateMessagesFromThread(rawThread, graphHash || undefined)

            // Append session boundary divider
            const boundaryMsg: ConversationMessage = {
              id: `boundary-${crypto.randomUUID().slice(0, 8)}`,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              synthetic: true,
              sessionDivider: formatSessionBoundary(new Date()),
            }

            setMessages([...result.messages, boundaryMsg])
            setPatchBlockStates(result.blockStates)
            setIsThinking(false)
            setLongRunningHint(null)
            setLastFailedInput(null)

            // Persist session boundary entry (best-effort)
            if (isThreadPersistEnabled()) {
              void appendThreadEntries(scenarioId, [{
                entry_id: crypto.randomUUID(),
                entry_schema_version: 1,
                role: 'system',
                origin: 'session_boundary',
                entry_status: 'complete',
                system_event_type: 'session_resumed',
                system_event_detail: formatSessionBoundary(new Date()),
                redaction_state: 'full',
              }])
            }
          } catch (err) {
            console.error('[useConversation] Thread hydration failed — starting fresh', err)
            // Reset to clean state so the user sees an empty conversation, not
            // stale messages from the previous scenario.
            setMessages([])
            setIsThinking(false)
            setLongRunningHint(null)
            setLastFailedInput(null)
          } finally {
            // Clear from store to prevent re-hydration (even on error)
            useCanvasStore.setState({ _hydratedThread: null })
          }
          return
        }
      }

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
    (text: string, opts?: { clientTurnId?: string }): OrchestratorTurnRequest => {
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

      // Build analysis_inputs from ceeAnalysisReady when options and a resolved goal are available.
      // goal_node_id comes from ceeAnalysisReady (required field); omit analysis_inputs entirely
      // if either options are absent or goal_node_id is falsy (partial context is worse than none).
      const ceeReady = store.ceeAnalysisReady
      const analysisInputs =
        ceeReady && ceeReady.options.length > 0 && ceeReady.goal_node_id
          ? {
              // PLoT requires option_id; we use CEE option id as the canonical identifier on both fields for now.
              options: ceeReady.options.map((opt) => ({
                id: opt.id,
                option_id: opt.id,
                label: opt.label,
                interventions: opt.interventions,
              })),
              goal_node_id: ceeReady.goal_node_id,
            }
          : undefined

      // Transform React Flow nodes → CEE schema: { id, kind, label, category?, observed_state?, ... }
      // CEE rejects React Flow internal fields (type, position, data wrapper).
      // Uses a blocklist to strip RF internals while passing through CEE-relevant fields.
      const ceeNodes = store.nodes.map((n) => {
        const d = n.data ?? {}
        const rawKind = (d as any).kind ?? n.type ?? 'factor'
        const out: Record<string, unknown> = {
          id: n.id,
          kind: CEE_VALID_KINDS.has(rawKind) ? rawKind : 'factor',
          label: (d as any).label ?? n.id,
        }
        // Pass through CEE-relevant fields, skip RF internals
        for (const [key, value] of Object.entries(d as Record<string, unknown>)) {
          if (RF_NODE_BLOCKLIST.has(key) || value === undefined) continue
          // Rename observedState → observed_state for CEE
          if (key === 'observedState') { out.observed_state = value; continue }
          out[key] = value
        }
        return out
      })

      // Transform React Flow edges → CEE schema: { from, to, strength?, exists_probability?, ... }
      const ceeEdges = store.edges.map((e) => {
        const d = e.data ?? {}
        const weight = typeof d.weight === 'number' ? clamp01(d.weight / 2) * 2 : 0.5
        const direction = d.direction === 'negative' ? -1 : 1
        const mean = direction * weight
        const std = typeof d.strengthStd === 'number' ? Math.max(0, d.strengthStd) : undefined
        const rawExistsProb = d.beliefExists ?? d.confidence ?? d.belief
        const existsProb = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
        const effectDir = d.direction === 'positive' || d.direction === 'negative' ? d.direction : undefined
        return {
          from: e.source,
          to: e.target,
          strength: { mean, ...(std !== undefined ? { std } : {}) },
          ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
          ...(effectDir ? { effect_direction: effectDir } : {}),
        }
      })

      return {
        scenario_id: store.currentScenarioId ?? `session-${Date.now()}`,
        message: text,
        conversation_history: buildHistory(messages, 5),
        graph_state: {
          nodes: ceeNodes,
          edges: ceeEdges,
        },
        analysis_state: {
          has_results: store.results.status === 'complete',
          last_run_hash: store.currentScenarioLastResultHash,
          // BIL Phase 1: include assembled analysis summary when available (always-on)
          ...(useResultsStore.getState().results.analysisSummary
            ? { analysis_summary: useResultsStore.getState().results.analysisSummary }
            : {}),
        },
        selected_elements:
          nodeIds.size > 0 || edgeIds.size > 0
            ? { node_ids: [...nodeIds], edge_ids: [...edgeIds] }
            : undefined,
        analysis_inputs: analysisInputs,
        client_turn_id: opts?.clientTurnId ?? crypto.randomUUID(),
      }
    },
    [messages],
  )

  const handleEnvelope = useCallback(
    (envelope: OrchestratorResponseEnvelopeV2, requestId?: string) => {
      // Defensive validation: repair incomplete CEE responses before processing.
      // Non-mutating — original envelope preserved; cleaned copy used below.
      const { cleaned } = validateResponse(envelope, requestId)
      envelope = cleaned

      // Update stage if provided. CEE sends either a plain string or
      // { stage, confidence, source } — extract the stage string.
      if (envelope.stage_indicator) {
        const raw = envelope.stage_indicator
        const stage = typeof raw === 'string' ? raw : raw.stage
        if (stage) {
          useCanvasStore.getState().setCurrentStage(stage)
        }
      }

      // NOTE: guidance items are set AFTER auto-apply patches (below) so that
      // if patches fail, we don't leave stale guidance referencing unmodified elements.
      // See "Move guidance setGuidanceItems after auto-apply" fix.

      // A.9 Task 1: Hydrate results store when envelope carries analysis results
      const store = useCanvasStore.getState()
      if (envelope.analysis_response) {
        const raw = envelope.analysis_response
        // Guard: skip write if this response_hash is already in the store
        if (raw.response_hash && raw.response_hash === store.results.hash) {
          if (import.meta.env.DEV) {
            console.warn('[handleEnvelope] Skipping duplicate analysis response (same hash)', raw.response_hash)
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

            // BIL Phase 1: cache assembled analysis summary for subsequent turn requests.
            // Always-on persistence — not gated behind BIL preview flag.
            try {
              const summary = assembleAnalysisInputsSummary(result)
              useResultsStore.getState().setAnalysisSummary(summary)
            } catch {
              // Non-fatal: summary assembly failed
            }

            // BIL Phase 1: create immutable snapshot of graph + analysis state.
            // One snapshot per analysis run, cached in resultsStore for linking turns.
            // Note: async fire-and-forget — the assistant message (addMessage below)
            // may trigger useThreadPersistence before this resolves. If so, the
            // assistant turn persists without a snapshot link (acceptable best-effort).
            void (async () => {
              try {
                const graphHash = generateGraphHash(store.nodes, store.edges)
                const snapshotId = await createSnapshot({
                  scenarioId: store.currentScenarioId ?? '',
                  graph: { nodes: store.nodes, edges: store.edges },
                  graphHash,
                  analysis: result,
                  seed: store.results.seed,
                  qualityMode: result.meta?.detail_level,
                })
                if (snapshotId) {
                  useResultsStore.getState().setLastSnapshotId(snapshotId)
                }
              } catch {
                // Non-fatal: snapshot creation is best-effort
              }
            })()
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

      // Dev-mode validation: catch adapter regressions before they reach the UI
      normalisedBlocks.forEach(validateAdaptedBlock)

      // Stamp graph_hash_at_proposal on graph_patch blocks so the accept flow
      // can detect staleness if the graph changes before the user clicks Accept.
      const currentGraphHash = generateGraphHash(store.nodes, store.edges)
      for (const block of normalisedBlocks) {
        if (block.type === 'graph_patch') {
          (block as GraphPatchBlock).graph_hash_at_proposal = currentGraphHash
        }
      }

      // Auto-apply graph_patch blocks with auto_apply=true (e.g. initial brief
      // response from orchestrator). Delegates to applyAutoApplyPatch which
      // handles field normalisation (kind→type, from/to→source/target), bulk
      // setState, ELK layout, and post-apply invalidation.
      const autoApplyModifiedIds: string[] = []
      let ceeProvidedAnalysisReady: CEEAnalysisReady | undefined

      for (const block of normalisedBlocks) {
        if (block.type === 'graph_patch' && (block as GraphPatchBlock).auto_apply === true) {
          const patchBlock = block as GraphPatchBlock
          try {
            // Single history snapshot before bulk mutation, then suppress
            // per-operation pushToHistory calls to avoid undo-stack bloat.
            useCanvasStore.getState().pushHistory?.()
            useCanvasStore.getState().beginExternalGraphMutation?.('patch_apply', { suppressHistory: true })

            const patchResult = applyAutoApplyPatch(patchBlock)
            autoApplyModifiedIds.push(...patchResult.modifiedIds)

            // Track analysis_ready from the last applied block.
            // Reset on each block so only the final block's analysis_ready
            // (or synthesis fallback) matches the post-mutation graph state.
            ceeProvidedAnalysisReady = patchBlock.analysis_ready

            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.log('[handleEnvelope] auto-apply:', {
                nodes: patchResult.addedNodeCount,
                edges: patchResult.addedEdgeCount,
                modified: patchResult.modifiedIds.length,
              })
            }
          } catch (patchErr) {
            if (import.meta.env.DEV) {
              console.error('[handleEnvelope] auto-apply patch failed:', patchErr)
            }
          } finally {
            useCanvasStore.getState().endExternalGraphMutation?.()
          }
        }
      }

      // Set ceeAnalysisReady from the auto-applied blocks.
      // Primary path: use CEE-provided analysis_ready directly.
      // FALLBACK: Edge synthesis used only when CEE block lacks analysis_ready.
      // Remove fallback once all CEE paths guaranteed to include it.
      if (autoApplyModifiedIds.length > 0) {
        if (ceeProvidedAnalysisReady) {
          useCanvasStore.getState().setCeeAnalysisReady(ceeProvidedAnalysisReady)
          if (import.meta.env.DEV) {
            console.warn('[handleEnvelope] Using CEE-provided analysis_ready', {
              options: ceeProvidedAnalysisReady.options.length,
              goal: ceeProvidedAnalysisReady.goal_node_id,
            })
          }
        } else {
          // FALLBACK: Edge synthesis used only when CEE block lacks analysis_ready.
          // Remove once all CEE paths guaranteed to include it.
          const synthesised = synthesiseCeeAnalysisReady()
          if (synthesised) {
            const validated = validateAnalysisReadyContract(synthesised)
            if (validated) {
              useCanvasStore.getState().setCeeAnalysisReady(validated)
              if (import.meta.env.DEV) {
                console.warn('[handleEnvelope] Fallback: synthesised ceeAnalysisReady from graph', {
                  options: validated.options.length,
                  goal: validated.goal_node_id,
                })
              }
            } else if (import.meta.env.DEV) {
              console.warn('[handleEnvelope] Synthesised ceeAnalysisReady failed validation — skipping')
            }
          }
        }
      }

      // Set guidance items AFTER auto-apply patches complete, so items
      // reference the post-patch graph state (not pre-patch).
      useGuidanceStore.getState().setGuidanceItems(envelope.guidance_items ?? [])

      // Clear guidance items targeting elements modified by auto-apply patches
      if (autoApplyModifiedIds.length > 0) {
        useGuidanceStore.getState().clearItemsByTargetIds(autoApplyModifiedIds)
      }

      const orderedBlocks = prioritiseBlocks(normalisedBlocks)

      // Strip trailing text lines that duplicate chip labels (LLM sometimes
      // echoes suggested actions as plain text at the end of assistant_text).
      // Only strip lines that look like a list item (bulleted/numbered prefix)
      // to avoid removing semantically valid prose endings.
      let assistantText = envelope.assistant_text ?? ''
      if (chips.length > 0) {
        const chipLabels = new Set(chips.map(c => c.label.toLowerCase().trim()))
        const LIST_PREFIX = /^[-•*\d.)\u2022\u2013\u2014]\s*/
        const lines = assistantText.split('\n')
        while (lines.length > 0) {
          const raw = lines[lines.length - 1].trim()
          // Allow stripping trailing blank lines
          if (!raw) { lines.pop(); continue }
          // Only strip lines with a list-item prefix that match a chip label
          if (LIST_PREFIX.test(raw) && chipLabels.has(raw.replace(LIST_PREFIX, '').toLowerCase())) {
            lines.pop()
          } else {
            break
          }
        }
        assistantText = lines.join('\n').trimEnd()
      }

      // Guard: skip empty assistant messages (no visible content and no blocks)
      const hasContent = assistantText.trim().length > 0
      const hasBlocks = orderedBlocks.length > 0
      if (!hasContent && !hasBlocks) return

      const assistantMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantText,
        blocks: hasBlocks ? orderedBlocks : undefined,
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
      /** Text shown in conversation bubble (defaults to message) */
      displayText?: string
      systemEvent?: SystemEvent
      mode: 'user' | 'system'
      /** When true, send the request but don't show a user bubble (e.g. programmatic "run it") */
      hidden?: boolean
      /** When true, skip adding a user bubble but keep error handling active (retry path) */
      skipUserBubble?: boolean
      /** Reuse a previous client_turn_id for idempotent retry */
      retryClientTurnId?: string
    }) => {
      const { message, systemEvent, mode, hidden, displayText, skipUserBubble, retryClientTurnId } = opts

      // Synchronous in-flight lock — prevents duplicate dispatch from rapid
      // clicks before React re-renders the isThinking state guard.
      if (inFlightRef.current) {
        if (import.meta.env.DEV) console.warn('[sendTurn] Blocked by in-flight lock (rapid double-click?)')
        return
      }
      inFlightRef.current = true

      // Generate or reuse a stable client_turn_id for idempotent retry
      const turnClientId = retryClientTurnId ?? crypto.randomUUID()

      if (mode === 'user') {
        if (!message.trim() || isThinking) {
          if (import.meta.env.DEV) console.warn('[sendTurn] Blocked:', !message.trim() ? 'empty message' : 'isThinking=true')
          inFlightRef.current = false; return
        }

        // Hidden sends (e.g. "run it") must not pollute user-facing recovery state
        if (!hidden) {
          lastUserInputRef.current = { message, clientTurnId: turnClientId }
          setLastFailedInput(null)

          if (!skipUserBubble) {
            addMessage({
              id: crypto.randomUUID(),
              role: 'user',
              content: displayText ?? message,
              displayContent: displayText,
              submittedPrompt: message,
              timestamp: new Date(),
            })
          }
        }
      } else {
        // System events: no user bubble, but still guard against concurrent sends.
        // Note: '[system]' sentinel turns must be excluded when conversation persistence
        // is implemented. They are infrastructure turns, not user content.
        if (isThinking) {
          if (import.meta.env.DEV) console.warn('[sendTurn] System event blocked: isThinking=true')
          inFlightRef.current = false; return
        }
      }

      // Start thinking state
      setIsThinking(true)
      setLongRunningHint(null)

      // Abort any previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // 15s → task-specific hint, 30s → "Still working…"
      const hint = inferLoadingHint(message, useCanvasStore.getState().nodes.length)
      longRunningTimerRef.current = setTimeout(() => {
        setLongRunningHint(hint)
      }, LONG_RUNNING_THRESHOLD_MS)

      stillWorkingTimerRef.current = setTimeout(() => {
        setLongRunningHint('Still working\u2026')
      }, STILL_WORKING_THRESHOLD_MS)

      // 60s timeout — hidden sends must not restore input or show retry chips
      const inputForRestore = (mode === 'user' && !hidden) ? message : null
      timeoutTimerRef.current = setTimeout(() => {
        controller.abort()
        clearTimeout(longRunningTimerRef.current)
        clearTimeout(stillWorkingTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
        if (inputForRestore) setLastFailedInput(inputForRestore)
        // Only visible user sends show a timeout error bubble.
        // Hidden sends and system events time out silently (matches catch block).
        if (mode === 'user' && !hidden) {
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'This is taking longer than expected. Try again or rephrase your message.',
            synthetic: true,
            actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
            timestamp: new Date(),
          })
        }
      }, TIMEOUT_MS)

      try {
        const request = buildRequest(message, { clientTurnId: turnClientId })
        // Attach system_event in CEE v3 wire format. Unknown types already
        // filtered by sendSystemEvent pre-check; null here is a safety net.
        if (systemEvent) {
          const wire = serializeSystemEvent(systemEvent)
          if (wire !== null) {
            request.system_event = wire
          }
        }
        const envelope = await callOrchestratorTurn(request, controller.signal)
        handleEnvelope(envelope, turnClientId)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // timeout already handled

        if (mode === 'user' && !hidden) {
          setLastFailedInput(message)

          const errorMessage = buildErrorMessage(err)

          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errorMessage,
            synthetic: true,
            actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
            timestamp: new Date(),
          })
        }
        // System events and hidden sends fail silently — the user didn't
        // initiate these, so showing an error would be confusing. Logged in turnService.
        if (mode === 'system' && import.meta.env.DEV) {
          const status = err instanceof OrchestratorError ? err.status : 'network'
          console.warn(`[sendTurn] System event failed: ${status}`, {
            eventType: systemEvent?.type,
            error: (err as Error).message,
          })
        }
      } finally {
        clearTimeout(longRunningTimerRef.current)
        clearTimeout(stillWorkingTimerRef.current)
        clearTimeout(timeoutTimerRef.current)
        setIsThinking(false)
        setLongRunningHint(null)
        inFlightRef.current = false
      }
    },
    [isThinking, addMessage, buildRequest, handleEnvelope],
  )

  // ---------------------------------------------------------------------------
  // Public API: sendMessage, sendSystemEvent, sendChip
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string, opts?: { hidden?: boolean }) => {
      await sendTurn({ message: text, mode: 'user', hidden: opts?.hidden })
    },
    [sendTurn],
  )

  const sendSystemEvent = useCallback(
    async (event: WireSystemEvent) => {
      // No-op when orchestrator V2 is OFF
      if (!isOrchestratorV2Enabled()) return

      // Pre-check: skip the entire network turn if the event type is not
      // supported by the CEE v3 schema. Prevents phantom [system] turns
      // with no wire event payload (wasted tokens, confusing context).
      const wire = serializeSystemEvent(event)
      if (wire === null) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(`[sendSystemEvent] Dropped unsupported event: ${event.type}`)
        }
        return
      }

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
        // Show chip.label in conversation bubble, send chip.message to orchestrator
        await sendTurn({ message: chip.message, displayText: chip.label, mode: 'user' })
      } else {
        // Chip has no message and is not an undo — this should not happen in practice
        // (validateResponse and render filters both block messageless chips), but if it
        // does, throw so the .catch() handler in SuggestedChips can show an inline error.
        throw new Error(`Chip "${chip.label}" has no message field`)
      }
    },
    [sendTurn, addMessage],
  )

  const retryLast = useCallback(async () => {
    const last = lastUserInputRef.current
    if (last.message) {
      // Remove the error/timeout synthetic message; keep original user bubble
      setMessages((prev) => {
        const tail = prev[prev.length - 1]
        if (tail?.synthetic) return prev.slice(0, -1)
        return prev
      })
      // Re-send without creating a new user bubble (original is already in thread).
      // Reuse the original client_turn_id for idempotent retry.
      await sendTurn({
        message: last.message,
        mode: 'user',
        skipUserBubble: true,
        retryClientTurnId: last.clientTurnId,
      })
    }
  }, [sendTurn])

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
