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
import { callOrchestratorTurn, streamOrchestratorTurn, OrchestratorError } from './turnService'
import { isOrchestratorV2Enabled, isOrchestratorStreamingEnabled, isThreadHydrateEnabled, isThreadPersistEnabled } from '../../flags'
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
  OrchestratorResponseEnvelopeV2,
  OrchestratorStreamEvent,
  ConversationTurnPair,
  GraphPatchBlock,
  ProposalReviewItem,
  RelatedElementRef,
} from './types'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from './types'
import { applyAutoApplyPatch, synthesiseCeeAnalysisReady } from './utils/applyPatch'
import { validateAnalysisReadyContract } from './validateAnalysisReadyContract'
import { validateResponse } from './validateResponse'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import {
  beginInteractionChain,
  bindRequestToInteraction,
  consumePendingInteractionContext,
  getUiSurfaceState,
  recordConversationRenderTrace,
  recordCrossSurfaceEvent,
  recordRequestContext,
  recordResponseRepair,
  recordUserAction,
  setLastAnalysisInteractionChainId,
  updateInteractionResponse,
  type InteractionStateSnapshot,
} from '../../lib/debug-state'
import {
  buildClarificationResponseTurnRequest,
  buildConversationTurnRequest,
  buildExplicitGenerateTurnRequest,
  buildExplainTurnRequest,
  buildPatchFollowupTurnRequest,
  buildRunAnalysisTurnRequest,
  buildSystemEventTurnRequest,
  type ExplainAnalysisStatePayload,
  type GraphStatePayload,
  type SelectedElementsPayload,
  isUUID,
  type TurnRequestPayload,
  type TurnType,
} from '../../services/turn-request-builder'

/** Sentinel message content used for system events — must never render as a user bubble */
export const SYSTEM_MESSAGE_SENTINEL = '[system]'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Log streaming flag diagnosis once per page load (always in dev) */
let _streamingDiagLogged = false

const LONG_RUNNING_THRESHOLD_MS = 15_000
const DEFAULT_TIMEOUT_MS = 60_000
const EXTENDED_TIMEOUT_MS = 120_000

/** Longer timeout for turns that invoke heavy CEE pipelines (draft_graph, analysis). */
function getTimeoutMs(turnType?: string, triggerSurface?: string): number {
  if (
    turnType === 'explicit_generate' ||
    turnType === 'run_analysis' ||
    triggerSurface === 'analyse_now'
  ) return EXTENDED_TIMEOUT_MS
  return DEFAULT_TIMEOUT_MS
}

/** Map CEE tool names to user-facing loading labels */
function mapToolLoadingLabel(toolName: string): string {
  switch (toolName) {
    case 'draft_graph': return 'Building your decision model\u2026'
    case 'edit_graph': return 'Updating the model\u2026'
    case 'run_analysis': return 'Running simulations\u2026'
    case 'explain_results': return 'Analysing results\u2026'
    case 'research_topic': return 'Researching\u2026'
    default: return 'Working\u2026'
  }
}

function summariseRequestPayload(request: TurnRequestPayload, source: string, hidden: boolean, systemEventType?: string): Record<string, unknown> {
  return {
    source,
    hidden,
    turn_type: request._turn_type ?? 'unknown',
    message_length: request.message?.length ?? 0,
    conversation_pairs: request.conversation_history.length,
    graph_nodes: request.graph_state?.nodes?.length ?? 0,
    graph_edges: request.graph_state?.edges?.length ?? 0,
    has_analysis_state: Boolean(request.analysis_state),
    analysis_hash:
      request.analysis_state && typeof request.analysis_state.meta === 'object'
        ? (request.analysis_state.meta as { response_hash?: unknown }).response_hash ?? null
        : null,
    selected_node_count: request.selected_elements?.node_ids?.length ?? 0,
    selected_edge_count: request.selected_elements?.edge_ids?.length ?? 0,
    analysis_input_option_count: request.analysis_inputs?.options?.length ?? 0,
    system_event_type: systemEventType ?? null,
  }
}

function summariseEnvelope(envelope: OrchestratorResponseEnvelopeV2): Record<string, unknown> {
  return {
    assistant_text_length: typeof envelope.assistant_text === 'string' ? envelope.assistant_text.length : 0,
    block_count: envelope.blocks?.length ?? 0,
    guidance_count: envelope.guidance_items?.length ?? 0,
    suggested_action_count: envelope.suggested_actions?.length ?? 0,
    has_analysis_response: Boolean(envelope.analysis_response),
    has_analysis_error: Boolean(envelope.analysis_error),
    stage_indicator: typeof envelope.stage_indicator === 'string'
      ? envelope.stage_indicator
      : envelope.stage_indicator?.stage ?? null,
    client_turn_id: envelope.client_turn_id ?? null,
  }
}

function createInteractionSnapshot(messagesCount: number): InteractionStateSnapshot {
  const store = useCanvasStore.getState()
  const ui = getUiSurfaceState('conversation')
  const guidanceItemsVisible = ui?.guidanceItemsVisible ?? useGuidanceStore.getState().guidanceItems.length
  return {
    scenarioId: store.currentScenarioId ?? null,
    stagePill: store.currentStage ?? null,
    hasGraph: store.nodes.length > 0 || store.edges.length > 0,
    hasAnalysis: store.results.status === 'complete' && Boolean(store.results.hash ?? store.currentScenarioLastResultHash),
    hasAnalysisReady: Boolean(store.ceeAnalysisReady),
    firstDraftControlsVisible: ui?.firstDraftControlsVisible ?? false,
    staleFirstDraftGuidanceVisible: ui?.staleFirstDraftGuidanceVisible ?? false,
    aiPanelOpen: ui?.aiPanelOpen ?? Boolean(store.showDraftChat),
    composerHasText: ui?.composerHasText ?? false,
    composerTextLength: ui?.composerTextLength ?? 0,
    guidanceItemsVisible,
    chatMessagesCount: messagesCount,
  }
}

function mapTriggerSurface(source: string | undefined, mode: 'user' | 'system', hidden: boolean, systemEvent?: SystemEvent): string {
  if (source) return source
  if (mode === 'system') {
    return systemEvent?.type === 'direct_analysis_run' ? 'analysis_complete_followup' : 'system_event'
  }
  if (hidden) return 'analyse_now'
  return 'composer_submit'
}

function mapSourceSurface(triggerSurface: string, mode: 'user' | 'system'): string {
  if (triggerSurface === 'analyse_now' || triggerSurface === 'discuss_button') return 'right_panel'
  if (triggerSurface === 'analysis_complete_followup' || mode === 'system') return 'automatic_followup'
  return 'ai_panel'
}

/**
 * Infer a task-specific loading hint from the user message and graph state.
 * Used as the first long-running hint (15s) to give users a sense of what's happening.
 */
export function inferLoadingHint(message: string, nodeCount: number, turnType?: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('analys') || lower.includes('evaluat') || lower.includes('compare') || lower.includes('run')) return 'Analysing your options\u2026'
  if (lower.includes('research') || lower.includes('evidence') || lower.includes('find')) return 'Researching evidence\u2026'
  if (lower.includes('brief')) return 'Assembling your decision brief\u2026'
  if (lower.includes('explain') || lower.includes('why')) return 'Preparing explanation\u2026'
  if (turnType === 'explicit_generate') return 'Building your decision model\u2026'
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

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function humaniseToken(token: string): string {
  const words = token
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (words.length === 0) return ''
  return words
    .map((word, index) => {
      const lower = word.toLowerCase()
      return index === 0 ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : lower
    })
    .join(' ')
}

function normaliseRelatedElements(raw: unknown): RelatedElementRef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const related = raw
    .map((item) => {
      if (item == null || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const node_id = asOptionalString(obj.node_id)
      const edge_id = asOptionalString(obj.edge_id)
      const label = asOptionalString(obj.label)
      const type = asOptionalString(obj.type)
      if (!node_id && !edge_id && !label) return null
      return { ...(node_id ? { node_id } : {}), ...(edge_id ? { edge_id } : {}), ...(label ? { label } : {}), ...(type ? { type } : {}) }
    })
    .filter(Boolean) as RelatedElementRef[]

  return related.length > 0 ? related : undefined
}

function deriveProposalItemFromOperation(raw: unknown): ProposalReviewItem | null {
  if (raw == null || typeof raw !== 'object') return null
  const op = raw as Record<string, unknown>
  const action = asOptionalString(op.op) ?? 'change'
  const data = (op.data != null && typeof op.data === 'object' ? op.data : {}) as Record<string, unknown>
  const rawKind = asOptionalString(data.kind) ?? asOptionalString(data.type)
  const kind = rawKind ? humaniseToken(rawKind) : (action.includes('edge') ? 'connection' : 'item')
  const elementLabel = asOptionalString(data.label)
  const verb = action.startsWith('add_')
    ? 'Add'
    : action.startsWith('remove_')
      ? 'Remove'
      : action.startsWith('update_')
        ? 'Update'
        : 'Change'
  const description = elementLabel
    ? `${verb} ${elementLabel}`
    : `${verb} ${kind.toLowerCase()}`

  return {
    description,
    ...(elementLabel ? { elementLabel } : {}),
    changeLabel: humaniseToken(action),
  }
}

function normaliseProposalReviewItems(raw: unknown): ProposalReviewItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (item == null || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const description =
        asOptionalString(obj.description)
        ?? asOptionalString(obj.summary)
        ?? asOptionalString(obj.text)
        ?? asOptionalString(obj.title)
        ?? asOptionalString(obj.message)
      if (!description) return null

      const elementLabel =
        asOptionalString(obj.affected_element_label)
        ?? asOptionalString(obj.element_label)
        ?? asOptionalString(obj.target_label)
        ?? asOptionalString(obj.affected_label)
        ?? asOptionalString(obj.label)
      const changeToken =
        asOptionalString(obj.change_type)
        ?? asOptionalString(obj.action)
        ?? asOptionalString(obj.operation)
        ?? asOptionalString(obj.type)

      return {
        description,
        ...(elementLabel && elementLabel !== description ? { elementLabel } : {}),
        ...(changeToken ? { changeLabel: humaniseToken(changeToken) } : {}),
      }
    })
    .filter(Boolean) as ProposalReviewItem[]
}

function mergeProposalReviewIntoBlocks(
  blocks: ConversationBlock[],
  proposalItems: ProposalReviewItem[],
): ConversationBlock[] {
  if (proposalItems.length === 0) return blocks
  if (blocks.some((block) => block.type === 'graph_patch')) return blocks

  return [
    {
      type: 'review_card',
      title: 'Suggested changes',
      body: proposalItems.map((item) => item.description).join(' · '),
      variant: 'info',
    },
    ...blocks,
  ]
}

function extractRawBlockType(block: unknown): string | null {
  if (block == null || typeof block !== 'object') return null
  const obj = block as Record<string, unknown>
  if (typeof obj.block_type === 'string') return obj.block_type
  if (typeof obj.type === 'string') return obj.type
  return null
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
        const proposalItems = normaliseProposalReviewItems(dataObj.proposed_changes)

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

        // Preserve patch_type from CEE wire format for rendering classification
        const patchType = dataObj.patch_type === 'full_draft' || dataObj.patch_type === 'incremental'
          ? dataObj.patch_type
          : undefined

        return {
          type: 'graph_patch',
          patch_id: String(dataObj.patch_id ?? block_id ?? ''),
          summary: String(dataObj.description ?? dataObj.summary ?? ''),
          operations: normOps as any,
          target_graph_hash: String(dataObj.applied_graph_hash ?? dataObj.target_graph_hash ?? ''),
          status: asOptionalString(dataObj.status),
          auto_apply: dataObj.auto_apply === true,
          ...(patchType ? { patch_type: patchType } : {}),
          actions: Array.isArray(actions) ? actions as any : undefined,
          block_id: typeof block_id === 'string' ? block_id : undefined,
          analysis_ready: normaliseAnalysisReady(dataObj.analysis_ready),
          related_elements: normaliseRelatedElements(dataObj.related_elements),
          proposal_items: proposalItems,
          ...(proposalItems.length > 0 ? { proposal_items_source: 'backend' as const } : {}),
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
    const status = asOptionalString(obj.status)
    const relatedElements = normaliseRelatedElements(obj.related_elements)
    const proposalItems = normaliseProposalReviewItems(obj.proposed_changes)
    return {
      ...obj,
      operations: obj.operations.map((op: unknown) =>
        op != null && typeof op === 'object' ? normalisePatchOp(op as Record<string, unknown>) : op
      ),
      analysis_ready: normaliseAnalysisReady(obj.analysis_ready),
      ...(status ? { status } : {}),
      ...(relatedElements ? { related_elements: relatedElements } : {}),
      ...(proposalItems.length > 0 ? { proposal_items: proposalItems } : {}),
    } as unknown as ConversationBlock
  }
  return raw as ConversationBlock
}

/**
 * Budget-aware block selection: keep original CEE array order.
 *
 * Returns a shallow copy so downstream consumers can apply visual slicing
 * without mutating the original block list. Patch settlement state
 * (proposed/accepted/rejected/dismissed) is managed separately in
 * `patchBlockStates` and is not available here.
 */
export function prioritiseBlocks(blocks: ConversationBlock[]): ConversationBlock[] {
  return [...blocks]
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

function inferChipTurnType(chip: ActionChip): Exclude<TurnType, 'system_event' | 'explicit_generate' | 'run_analysis'> {
  const token = `${chip.id} ${chip.label} ${chip.message ?? ''}`.toLowerCase()
  if (token.includes('clarif')) return 'clarification_response'
  if (token.includes('explain') || token.includes('why')) return 'explain'
  if (token.includes('patch') || token.includes('proposal')) return 'patch_followup'
  return 'conversation'
}

function resolveUserTurnType(
  source: string | undefined,
  hidden: boolean | undefined,
  explicitTurnType: Exclude<TurnType, 'system_event'> | undefined,
): Exclude<TurnType, 'system_event'> {
  if (explicitTurnType) return explicitTurnType
  if (source === 'generate_model') return 'explicit_generate'
  if (source === 'analyse_now' || source === 'right_panel_action') return 'run_analysis'
  if (source === 'patch_followup') return 'patch_followup'
  if (source === 'explain') return 'explain'
  if (source === 'clarification_response') return 'clarification_response'
  if (hidden) return 'run_analysis'
  return 'conversation'
}

export interface UseConversationReturn {
  messages: ConversationMessage[]
  isThinking: boolean
  longRunningHint: string | null
  /** The user's last input text, restored on error so they can edit and resend */
  lastFailedInput: string | null
  sendMessage: (text: string, opts?: {
    hidden?: boolean
    turnType?: Exclude<TurnType, 'system_event'>
    debugSource?: string
    debugVisibleText?: string | null
    debugParentChainId?: string | null
    debugInitiatedBy?: 'user' | 'automatic'
    debugSourceSurface?: string
    debugRightPanelComposerLeak?: boolean
  }) => Promise<void>
  sendSystemEvent: (event: WireSystemEvent, opts?: {
    debugSource?: string
    debugVisibleText?: string | null
    debugParentChainId?: string | null
    debugInitiatedBy?: 'user' | 'automatic'
    debugSourceSurface?: string
  }) => Promise<void>
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
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval>>()
  const lastUserInputRef = useRef<{ message: string; clientTurnId?: string }>({ message: '' })
  // Mirror messages state into a ref so buildRequest always reads the latest
  // committed value — avoids stale closure when addMessage + buildRequest run
  // in the same synchronous block (React batches the state update).
  const messagesRef = useRef<ConversationMessage[]>([])

  // Cleanup timers on unmount
  useEffect(() => {
    const visibleBlockCountByType = messages.reduce<Record<string, number>>((acc, message) => {
      for (const block of message.blocks ?? []) {
        acc[block.type] = (acc[block.type] ?? 0) + 1
      }
      return acc
    }, {})
    const visibleChipsCount = messages.reduce((sum, message) => sum + (message.actionChips?.length ?? 0), 0)
    const timeoutOrRetryStateShown = messages.some((message) =>
      message.synthetic === true && (message.actionChips?.some((chip) => chip.id === 'retry') ?? false)
    )
    recordConversationRenderTrace({
      messagesRenderedCount: messages.length,
      syntheticMessagesCount: messages.filter((message) => message.synthetic).length,
      visibleChipsCount,
      visibleBlockCountByType,
      thinkingIndicatorShown: isThinking || longRunningHint !== null,
      timeoutOrRetryStateShown,
    })
  }, [messages, isThinking, longRunningHint])

  useEffect(() => {
    return () => {
      clearTimeout(longRunningTimerRef.current)
      clearTimeout(timeoutTimerRef.current)
      clearInterval(elapsedIntervalRef.current)
      cleanupStreamRefs()
      abortRef.current?.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

            const hydrated = [...result.messages, boundaryMsg]
            messagesRef.current = hydrated
            setMessages(hydrated)
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
            messagesRef.current = []
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

      messagesRef.current = []
      setMessages([])
      setIsThinking(false)
      setLongRunningHint(null)
      setLastFailedInput(null)
    }
  }, [scenarioId])

  const addMessage = useCallback((msg: ConversationMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg]
      messagesRef.current = next
      return next
    })
  }, [])

  /** Update an existing message in-place by id (used by streaming path) */
  const updateMessage = useCallback((id: string, patch: Partial<ConversationMessage>) => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      messagesRef.current = next
      return next
    })
  }, [])

  // Streaming state — refs to avoid stale closures in RAF callbacks
  const streamingMsgIdRef = useRef<string | null>(null)
  const streamTextRef = useRef('')
  const streamBlocksRef = useRef<ConversationBlock[]>([])
  const frameBufRef = useRef<string[]>([])
  const rafIdRef = useRef<number | null>(null)

  /** Flush accumulated text_delta tokens to the streaming message */
  const flushStreamFrame = useCallback(() => {
    rafIdRef.current = null
    const buf = frameBufRef.current
    const msgId = streamingMsgIdRef.current
    if (!buf.length || !msgId) return
    frameBufRef.current = []
    streamTextRef.current += buf.join('')
    updateMessage(msgId, { content: streamTextRef.current })
  }, [updateMessage])

  /** Schedule a RAF-batched flush (prevents duplicate scheduling) */
  const scheduleStreamFlush = useCallback(() => {
    if (rafIdRef.current != null) return
    if (typeof requestAnimationFrame === 'function') {
      rafIdRef.current = requestAnimationFrame(flushStreamFrame)
    } else {
      // SSR / test fallback
      rafIdRef.current = -1
      Promise.resolve().then(flushStreamFrame)
    }
  }, [flushStreamFrame])

  /** Cancel any pending RAF and reset streaming refs */
  const cleanupStreamRefs = useCallback(() => {
    if (rafIdRef.current != null && rafIdRef.current !== -1 && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = null
    streamingMsgIdRef.current = null
    streamTextRef.current = ''
    streamBlocksRef.current = []
    frameBufRef.current = []
  }, [])

  const buildRequest = useCallback(
    (opts: {
      text: string
      clientTurnId?: string
      turnType: TurnType
      systemEventWire?: WireSystemEvent
    }): TurnRequestPayload => {
      const store = useCanvasStore.getState()
      const { nodeIds, edgeIds } = store.selection
      // Lazy UUID allocation: generate a fresh UUID when store has no scenario_id or a
      // legacy non-UUID format (e.g. "scenario-1709827200000-abc"). Persist to store so
      // subsequent turns in the same session reuse the same ID.
      let scenarioId = store.currentScenarioId
      if (!scenarioId || !isUUID(scenarioId)) {
        const newId = crypto.randomUUID()
        if (import.meta.env.DEV) {
          console.warn('[buildRequest] Replaced non-UUID scenario_id:', scenarioId, '→', newId)
        }
        scenarioId = newId
        useCanvasStore.setState({ currentScenarioId: scenarioId })
      }
      const conversationHistory = buildHistory(messagesRef.current, 5)
      const selectedElements: SelectedElementsPayload | undefined =
        nodeIds.size > 0 || edgeIds.size > 0
          ? { node_ids: [...nodeIds], edge_ids: [...edgeIds] }
          : undefined

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
        const d = (e.data ?? {}) as Record<string, unknown>
        const weightValue = d.weight
        const directionValue = d.direction
        const strengthStdValue = d.strengthStd
        const weight = typeof weightValue === 'number' ? clamp01(weightValue / 2) * 2 : 0.5
        const direction = directionValue === 'negative' ? -1 : 1
        const mean = direction * weight
        const std = typeof strengthStdValue === 'number' ? Math.max(0, strengthStdValue) : undefined
        const rawExistsProb = d.beliefExists ?? d.confidence ?? d.belief
        const existsProb = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
        const effectDir = directionValue === 'positive' || directionValue === 'negative' ? directionValue : undefined
        return {
          from: e.source,
          to: e.target,
          strength: { mean, ...(std !== undefined ? { std } : {}) },
          ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
          ...(effectDir ? { effect_direction: effectDir } : {}),
        }
      })

      const graphState: GraphStatePayload = {
        nodes: ceeNodes,
        edges: ceeEdges,
      }

      // Assemble analysis_state from store fields.
      // status and hash live on the canvas store (set by resultsComplete); analysisSummary
      // lives on useResultsStore (set by setAnalysisSummary after assembly).
      // Omit when graph has been edited since the last analysis — stale results are worse than none.
      const analysisStatus = store.results.status === 'complete' ? 'completed' : store.results.status
      const analysisHash = store.results.hash
      const { analysisSummary } = useResultsStore.getState().results
      const graphIsStale = store.graphEditedSinceLastRun
      // When summary assembly failed but raw V2 response is available, extract
      // the key fields CEE reads so it still gets structured analysis context.
      const rawV2 = store.rawV2Response
      const fallbackResults = !analysisSummary && rawV2 ? {
        option_comparison: rawV2.option_comparison,
        robustness: rawV2.robustness ?? null,
        // Guard array fields — raw response is pre-sanitization and may have
        // non-array shapes if PLoT sent malformed data (sanitizer fixes these).
        drivers: Array.isArray(rawV2.drivers) ? rawV2.drivers : null,
        edge_sensitivity: Array.isArray(rawV2.edge_sensitivity) ? rawV2.edge_sensitivity : null,
        constraints_status: rawV2.constraints_status ?? null,
        meta: rawV2.meta ?? null,
        analysis_status: rawV2.analysis_status,
      } : null
      const analysisState: ExplainAnalysisStatePayload | undefined =
        graphIsStale ? undefined
        : analysisStatus === 'completed' && analysisHash && analysisSummary
          ? { analysis_status: analysisStatus, meta: { response_hash: analysisHash }, results: analysisSummary }
        : analysisStatus === 'completed' && analysisHash && fallbackResults
          ? { analysis_status: analysisStatus, meta: { response_hash: analysisHash }, results: fallbackResults }
        : undefined

      if (import.meta.env.DEV) {
        const optionCount = analysisState
          ? ((analysisState.results as Record<string, unknown>)?.options as unknown[] | undefined)?.length ?? 0
          : 0
        console.warn('[buildRequest] analysis_state present:', !!analysisState, {
          turnType: opts.turnType,
          analysisStatus,
          hasHash: !!analysisHash,
          hasSummary: !!analysisSummary,
          graphIsStale,
          optionCount,
        })
      }

      if (opts.turnType === 'system_event') {
        return buildSystemEventTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          message: opts.text,
          graph_state: graphState,
          analysis_state: analysisState,
          client_turn_id: opts.clientTurnId,
          system_event: opts.systemEventWire ?? { type: 'direct_graph_edit', payload: {} },
        })
      }

      if (opts.turnType === 'explicit_generate') {
        return buildExplicitGenerateTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          message: opts.text,
          graph_state: graphState,
          analysis_state: analysisState,
          client_turn_id: opts.clientTurnId,
        })
      }

      if (opts.turnType === 'run_analysis') {
        if (!analysisInputs) {
          if (import.meta.env.DEV) {
            console.warn('[buildRequest] run_analysis turn requested but ceeAnalysisReady is unavailable — falling back to conversation turn')
          }
          return buildConversationTurnRequest({
            scenario_id: scenarioId,
            conversation_history: conversationHistory,
            message: opts.text,
            graph_state: graphState,
            selected_elements: selectedElements,
            analysis_state: analysisState,
            client_turn_id: opts.clientTurnId,
          })
        }
        return buildRunAnalysisTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          graph_state: graphState,
          analysis_inputs: analysisInputs,
          client_turn_id: opts.clientTurnId,
        })
      }

      if (opts.turnType === 'patch_followup') {
        return buildPatchFollowupTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          graph_state: graphState,
          analysis_state: analysisState,
          client_turn_id: opts.clientTurnId,
        })
      }

      if (opts.turnType === 'explain') {
        return buildExplainTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          message: opts.text,
          graph_state: graphState,
          selected_elements: selectedElements,
          analysis_state: analysisState,
          client_turn_id: opts.clientTurnId,
        })
      }

      if (opts.turnType === 'clarification_response') {
        return buildClarificationResponseTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          message: opts.text,
          client_turn_id: opts.clientTurnId,
        })
      }

      return buildConversationTurnRequest({
        scenario_id: scenarioId,
        conversation_history: conversationHistory,
        message: opts.text,
        graph_state: graphState,
        selected_elements: selectedElements,
        analysis_state: analysisState,
        client_turn_id: opts.clientTurnId,
      })
    },
    [], // messagesRef (stable ref) + useCanvasStore.getState() — no state/prop deps

  )

  const handleEnvelope = useCallback(
    (envelope: OrchestratorResponseEnvelopeV2, requestId?: string) => {
      // Defensive validation: repair incomplete CEE responses before processing.
      // Non-mutating — original envelope preserved; cleaned copy used below.
      const rawEnvelope = envelope
      const { cleaned, repairs } = validateResponse(envelope, requestId)
      envelope = cleaned
      const rawBlocks = rawEnvelope.blocks ?? []
      const rawChips = rawEnvelope.suggested_actions ?? []
      const cleanedBlocks = envelope.blocks ?? []
      const cleanedChips = envelope.suggested_actions ?? []
      const renderableCount = (envelope.assistant_text?.trim().length ?? 0) > 0 || cleanedBlocks.length > 0 ? 1 : 0
      const rawUnknownBlockTypes = rawBlocks.flatMap((block) => {
        const type = extractRawBlockType(block)
        return type && !['commentary', 'review_card', 'fact', 'graph_patch', 'framing', 'brief', 'model_receipt', 'evidence'].includes(type)
          ? [type]
          : []
      })
      if (requestId) {
        recordResponseRepair({
          requestId,
          validatorRepairs: repairs,
          emptyTextFallbackInjected: repairs.includes('empty_text') || repairs.includes('nothing_renderable'),
          chipsDropped: [
            { reason: 'missing_chip_label', count: repairs.filter((repair) => repair === 'missing_chip_label').length },
            { reason: 'missing_chip_message', count: repairs.filter((repair) => repair === 'missing_chip_message').length },
          ].filter((item) => item.count > 0),
          blocksDropped: [
            { reason: 'missing_block_type', count: repairs.filter((repair) => repair === 'missing_block_type').length },
          ].filter((item) => item.count > 0),
          unknownBlockTypes: [...new Set(rawUnknownBlockTypes)],
          rawChipCount: rawChips.length,
          cleanedChipCount: cleanedChips.length,
          rawBlockCount: rawBlocks.length,
          cleanedBlockCount: cleanedBlocks.length,
          renderableCount,
          nonRenderableCount: Math.max(0, rawBlocks.length - cleanedBlocks.length),
        })
      }

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
            const seedUsed = typeof store.results.seed === 'number' ? store.results.seed : 0
            const report = mapV2ResponseToReportV1(result, { seed: seedUsed })
            const enrichment = createEnrichmentFromV2Response(result) as any
            const ceeReviewV1 = synthesizeCeeReviewFromV2(result)
            const ceeTraceV1 = synthesizeCeeTraceFromV2(result, result.response_hash, 0)

            store.resultsComplete({
              report,
              hash: result.response_hash,
              enrichment,
              ceeReviewV1,
              ceeTraceV1,
              resultsSource: 'conversation',
              rawV2Response: raw,
            })
            recordCrossSurfaceEvent({
              eventType: 'analysis_completed',
              summary: 'Analysis response received and results hydrated',
              payloadSummary: {
                response_hash: result.response_hash,
                source: 'conversation',
              },
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
        recordCrossSurfaceEvent({
          eventType: 'analysis_blocked',
          summary: envelope.analysis_error.message,
          payloadSummary: {
            code: envelope.analysis_error.code,
          },
        })
      }

      // Build action chips from suggested_actions (enforced budget)
      const chips = enforceChipBudget([], envelope.suggested_actions ?? [])

      // Normalise CEE blocks and apply budget priority (proposed patches first)
      const responseBlocks = envelope.blocks ?? []
      const proposalItems = normaliseProposalReviewItems(envelope.proposed_changes)
      const normalisedBlocks = mergeProposalReviewIntoBlocks(
        responseBlocks.map(adaptCEEBlock).map((block) => {
          if (block.type !== 'graph_patch') return block
          const patch = block as GraphPatchBlock
          if ((patch.proposal_items?.length ?? 0) > 0) return patch
          const fallbackItems = patch.operations
            .map(deriveProposalItemFromOperation)
            .filter(Boolean) as ProposalReviewItem[]
          return fallbackItems.length > 0
            ? { ...patch, proposal_items: fallbackItems, proposal_items_source: 'derived_ops' as const }
            : patch
        }),
        proposalItems,
      )

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

            // Task 2: Signal full_draft to DraftChat for auto-collapse.
            // A "full draft" is a patch that adds ≥3 nodes — distinguishes initial
            // graph generation from small incremental edits.
            if (patchResult.addedNodeCount >= 3) {
              useCanvasStore.getState().setFullDraftAppliedAt?.(Date.now())
            }

            if (import.meta.env.DEV) {
              console.warn('[handleEnvelope] auto-apply:', {
                nodes: patchResult.addedNodeCount,
                edges: patchResult.addedEdgeCount,
                modified: patchResult.modifiedIds.length,
              })
            }
            recordCrossSurfaceEvent({
              eventType: autoApplyModifiedIds.length === 0 ? 'graph_drafted' : 'graph_edited',
              summary: patchBlock.summary || 'Auto-applied graph patch',
              payloadSummary: {
                patch_id: patchBlock.patch_id,
                operations: patchBlock.operations.length,
              },
            })
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

      // Strip trailing text lines that duplicate chip labels or messages (LLM sometimes
      // echoes suggested actions — either the display label or the raw prompt — as plain
      // text at the end of assistant_text). Only strip lines that look like a list item
      // (bulleted/numbered prefix) to avoid removing semantically valid prose endings.
      let assistantText = envelope.assistant_text ?? ''
      if (chips.length > 0) {
        const chipLabels = new Set(chips.map(c => c.label.toLowerCase().trim()))
        const chipMessages = new Set(chips.flatMap(c => c.message ? [c.message.toLowerCase().trim()] : []))
        const LIST_PREFIX = /^[-•*\d.)\u2022\u2013\u2014]\s*/
        const lines = assistantText.split('\n')
        while (lines.length > 0) {
          const raw = lines[lines.length - 1].trim()
          // Allow stripping trailing blank lines
          if (!raw) { lines.pop(); continue }
          // Strip lines with a list-item prefix that match a chip label or chip message
          const stripped = raw.replace(LIST_PREFIX, '').toLowerCase()
          if (LIST_PREFIX.test(raw) && (chipLabels.has(stripped) || chipMessages.has(stripped))) {
            lines.pop()
          } else {
            break
          }
        }
        assistantText = lines.join('\n').trimEnd()
      }

      // Task 4 (defensive): Intercept raw structural violation text that CEE should
      // not send. Replace with a safe, neutral message and log for CEE-side tracking.
      const STRUCTURAL_VIOLATION_PATTERNS = [
        /this change would leave a node/i,
        /cannot reach the goal/i,
        /structural validation failed/i,
        /would leave a node that/i,
      ]
      if (STRUCTURAL_VIOLATION_PATTERNS.some((p) => p.test(assistantText))) {
        if (import.meta.env.DEV || import.meta.env.VITE_VERBOSE_LOG === 'true') {
          console.warn('[useConversation] Task4: Suppressed raw structural violation text:', assistantText.slice(0, 200))
        }
        assistantText = "I wasn't able to make that change safely. Let me try a simpler approach."
      }

      // Guard: skip empty assistant messages (no visible content and no blocks)
      const hasContent = assistantText.trim().length > 0
      const hasBlocks = orderedBlocks.length > 0
      if (!hasContent && !hasBlocks) return

      // Streaming guard: if a streaming message already exists for this turn,
      // update it in place instead of creating a duplicate.
      if (streamingMsgIdRef.current) {
        updateMessage(streamingMsgIdRef.current, {
          content: assistantText,
          blocks: hasBlocks ? orderedBlocks : undefined,
          actionChips: chips.length > 0 ? chips : undefined,
          isStreaming: false,
          isProvisional: false,
          toolLoadingState: null,
        })
      } else {
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
      }
    },
    [addMessage, updateMessage],
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
      source?: string
      sourceSurface?: string
      parentChainId?: string | null
      initiatedBy?: 'user' | 'automatic'
      rightPanelAccidentallySubmittedComposerContent?: boolean
      turnType?: Exclude<TurnType, 'system_event'>
    }) => {
      const {
        message,
        systemEvent,
        mode,
        hidden,
        displayText,
        skipUserBubble,
        retryClientTurnId,
        source,
        sourceSurface,
        parentChainId,
        initiatedBy,
        rightPanelAccidentallySubmittedComposerContent,
        turnType,
      } = opts

      // Synchronous in-flight lock — prevents duplicate dispatch from rapid
      // clicks before React re-renders the isThinking state guard.
      if (inFlightRef.current) {
        if (import.meta.env.DEV) console.warn('[sendTurn] Blocked by in-flight lock (rapid double-click?)')
        return
      }
      inFlightRef.current = true

      // Generate or reuse a stable client_turn_id for idempotent retry
      const pendingContext = consumePendingInteractionContext()
      const turnClientId = retryClientTurnId ?? pendingContext?.chainId ?? crypto.randomUUID()
      const triggerSurface = pendingContext?.triggerSurface ?? mapTriggerSurface(source, mode, hidden === true, systemEvent)
      const resolvedSourceSurface = sourceSurface ?? pendingContext?.sourceSurface ?? mapSourceSurface(triggerSurface, mode)
      const interactionStateBefore = pendingContext?.stateBefore ?? createInteractionSnapshot(messages.length)
      const interactionChainId = beginInteractionChain({
        chainId: turnClientId,
        parentChainId: parentChainId ?? pendingContext?.parentChainId,
        triggerSurface,
        sourceSurface: resolvedSourceSurface,
        initiatedBy: initiatedBy ?? pendingContext?.initiatedBy ?? (mode === 'system' ? 'automatic' : hidden ? 'user' : 'user'),
        visibleTextSubmitted: hidden ? null : (displayText ?? message),
        submittedText: message,
        stateBefore: interactionStateBefore,
      })

      if (mode === 'user') {
        if (!message.trim() || isThinking) {
          if (import.meta.env.DEV) console.warn('[sendTurn] Blocked:', !message.trim() ? 'empty message' : 'isThinking=true')
          inFlightRef.current = false; return
        }

        // Hidden sends (e.g. "run it") must not pollute user-facing recovery state
        if (!hidden) {
          recordUserAction({
            actionType: source === 'chip' || source === 'chip_click'
              ? 'clicked chip'
              : source === 'retry'
                ? 'clicked retry'
                : 'sent chat message',
            payloadSummary: {
              display_text: displayText ?? message,
              raw_message: message,
            },
          })
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
        } else if (source === 'right_panel_action') {
          recordUserAction({
            actionType: 'clicked run analysis',
            payloadSummary: {
              raw_message: message,
            },
          })
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

      // Resolve turn type early — needed for dynamic timeout computation
      const resolvedTurnType: TurnType = mode === 'system'
        ? 'system_event'
        : resolveUserTurnType(source, hidden, turnType)
      const dynamicTimeout = getTimeoutMs(resolvedTurnType, triggerSurface)

      // 15s → task-specific hint, then update every 5s with elapsed time
      const hint = inferLoadingHint(message, useCanvasStore.getState().nodes.length, turnType)
      const sendStartTime = Date.now()
      longRunningTimerRef.current = setTimeout(() => {
        setLongRunningHint(hint)
        // Update hint with elapsed time every 5s
        elapsedIntervalRef.current = setInterval(() => {
          const elapsed = Math.round((Date.now() - sendStartTime) / 1000)
          setLongRunningHint(`${hint.replace(/\u2026$/, '')}... ${elapsed}s`)
        }, 5_000)
      }, LONG_RUNNING_THRESHOLD_MS)

      // Dynamic timeout — hidden sends must not restore input or show retry chips
      const inputForRestore = (mode === 'user' && !hidden) ? message : null
      timeoutTimerRef.current = setTimeout(() => {
        controller.abort()
        clearTimeout(longRunningTimerRef.current)
        clearInterval(elapsedIntervalRef.current)
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
      }, dynamicTimeout)

      try {
        const systemEventWire = mode === 'system' && systemEvent ? serializeSystemEvent(systemEvent) : undefined
        const request = buildRequest({
          text: message,
          clientTurnId: turnClientId,
          turnType: resolvedTurnType,
          systemEventWire: systemEventWire ?? undefined,
        })
        const payloadSummary = summariseRequestPayload(request, triggerSurface, hidden === true, systemEvent?.type)
        bindRequestToInteraction(turnClientId, {
          chainId: interactionChainId,
          endpoint: '/bff/orchestrate/v1/turn',
          triggerSurface,
          sourceSurface: resolvedSourceSurface,
          initiatedBy: initiatedBy ?? (mode === 'system' ? 'automatic' : 'user'),
          visibleTextSubmitted: hidden ? null : (displayText ?? message),
          submittedText: message,
          payloadShapeSummary: payloadSummary,
          rightPanelAccidentallySubmittedComposerContent,
          stateBefore: interactionStateBefore,
        })
        recordRequestContext({
          requestId: turnClientId,
          source: source ?? (mode === 'system' ? 'system_event' : hidden ? 'right_panel_action' : 'chat'),
          scenarioId: request.scenario_id,
          clientTurnId: request.client_turn_id,
          latestUserVisibleMessageText: hidden ? null : (displayText ?? message),
          rawMessageSent: message,
          stageSystemEventSummary: systemEvent?.type ?? null,
          systemEventType: systemEvent?.type ?? null,
        })
        if (!_streamingDiagLogged) {
          _streamingDiagLogged = true
          import('../../flags').then((mod) => {
            if (typeof mod.diagnoseOrchestratorStreaming === 'function') {
              const diag = mod.diagnoseOrchestratorStreaming()
              console.warn('[sendTurn] streaming flag:', diag.resolved, '| source:', diag.source,
                '| localStorage:', diag.localStorageRaw, '| env:', diag.envRaw)
            }
          }).catch(() => { /* noop in test */ })
        }
        if (isOrchestratorStreamingEnabled()) {
          // --- STREAMING PATH ---
          const msgId = crypto.randomUUID()
          streamingMsgIdRef.current = msgId
          streamTextRef.current = ''
          streamBlocksRef.current = []
          frameBufRef.current = []

          // Create placeholder streaming message
          addMessage({
            id: msgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            timestamp: new Date(),
            clientTurnId: request.client_turn_id,
          })

          let streamEnvelope: OrchestratorResponseEnvelopeV2 | undefined

          for await (const event of streamOrchestratorTurn(request, controller.signal)) {
            switch (event.type) {
              case 'turn_start':
                // Stream is live — clear progressive loading hints
                clearTimeout(longRunningTimerRef.current)
                clearInterval(elapsedIntervalRef.current)
                setLongRunningHint(null)
                break

              case 'text_delta':
                frameBufRef.current.push(event.delta)
                scheduleStreamFlush()
                break

              case 'tool_start': {
                const toolLabel = mapToolLoadingLabel(event.tool_name)
                updateMessage(msgId, { isProvisional: true, toolLoadingState: toolLabel })
                break
              }

              case 'block':
                streamBlocksRef.current = [...streamBlocksRef.current, event.block]
                updateMessage(msgId, { blocks: streamBlocksRef.current })
                break

              case 'tool_result':
                updateMessage(msgId, { toolLoadingState: null })
                break

              case 'turn_complete':
                // Final flush of any pending RAF buffer
                if (rafIdRef.current != null) {
                  if (typeof cancelAnimationFrame === 'function' && rafIdRef.current !== -1) {
                    cancelAnimationFrame(rafIdRef.current)
                  }
                  rafIdRef.current = null
                }
                streamEnvelope = event.envelope
                handleEnvelope(event.envelope, turnClientId)
                streamingMsgIdRef.current = null
                break

              case 'error': {
                // Flush any pending RAF buffer so priorText is complete
                if (frameBufRef.current.length > 0) {
                  streamTextRef.current += frameBufRef.current.join('')
                  frameBufRef.current = []
                }
                const priorText = streamTextRef.current
                cleanupStreamRefs()
                const errText = event.error.message || 'Something went wrong.'
                // When non-provisional text was already streamed, append the
                // error so the user keeps the partial content. When the message
                // is still provisional (tool-backed placeholder), replace.
                const content = priorText.length > 0
                  ? `${priorText}\n\n---\n\n${errText}`
                  : errText
                updateMessage(msgId, {
                  content,
                  isStreaming: false,
                  isProvisional: false,
                  toolLoadingState: null,
                  synthetic: priorText.length === 0,
                  actionChips: event.recoverable
                    ? [{ id: 'retry', label: 'Try again', intent: 'primary' as const }]
                    : undefined,
                })
                break
              }
            }
          }

          // Terminal guarantee: if the stream ended without turn_complete or
          // error, the pre-created message is stuck with isStreaming: true.
          // Finalise it so one settled assistant message always remains.
          if (streamingMsgIdRef.current) {
            // Flush any pending RAF buffer
            if (frameBufRef.current.length > 0) {
              streamTextRef.current += frameBufRef.current.join('')
              frameBufRef.current = []
            }
            const settledContent = streamTextRef.current || 'The response ended unexpectedly.'
            updateMessage(msgId, {
              content: settledContent,
              isStreaming: false,
              isProvisional: false,
              toolLoadingState: null,
              synthetic: !streamTextRef.current,
              actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' as const }],
            })
            streamingMsgIdRef.current = null
          }

          // Use the envelope for interaction logging if available
          if (streamEnvelope) {
            const streamMutatedGraph = (streamEnvelope.blocks ?? []).some((block: any) => {
              const btype = typeof block?.block_type === 'string' ? block.block_type : block?.type
              return btype === 'graph_patch'
            })
            const interactionStateAfterStream = createInteractionSnapshot(messages.length + (hidden || mode === 'system' ? 0 : 1))
            updateInteractionResponse(turnClientId, {
              responseStatus: 200,
              responseSummary: summariseEnvelope(streamEnvelope),
              mutatedGraph: streamMutatedGraph,
              mutatedAnalysis: Boolean(streamEnvelope.analysis_response),
              mutatedChat: Boolean((streamEnvelope.assistant_text?.trim().length ?? 0) > 0 || (streamEnvelope.blocks?.length ?? 0) > 0),
              stateAfter: interactionStateAfterStream,
            })

            // Detect generate_model turns that got a conversational response instead of a draft
            if (resolvedTurnType === 'explicit_generate' && !streamMutatedGraph) {
              console.warn('[sendTurn] generate_model.no_draft_returned', { requestId: turnClientId })
              recordCrossSurfaceEvent({
                eventType: 'generate_model_no_draft',
                summary: 'CEE returned conversational response for explicit_generate turn (streaming)',
                payloadSummary: { request_id: turnClientId, path: 'streaming' },
              })
            }
          }

          if (triggerSurface === 'analyse_now') {
            setLastAnalysisInteractionChainId(interactionChainId)
          }
        } else {
          // --- NON-STREAMING PATH (unchanged) ---
          const envelope = await callOrchestratorTurn(request, controller.signal)
          handleEnvelope(envelope, turnClientId)
          const nonStreamMutatedGraph = (envelope.blocks ?? []).some((block: any) => {
            const btype = typeof block?.block_type === 'string' ? block.block_type : block?.type
            return btype === 'graph_patch'
          })
          const interactionStateAfter = createInteractionSnapshot(messages.length + (hidden || mode === 'system' ? 1 : 2))
          updateInteractionResponse(turnClientId, {
            responseStatus: 200,
            responseSummary: summariseEnvelope(envelope),
            mutatedGraph: nonStreamMutatedGraph,
            mutatedAnalysis: Boolean(envelope.analysis_response),
            mutatedChat: Boolean((envelope.assistant_text?.trim().length ?? 0) > 0 || (envelope.blocks?.length ?? 0) > 0),
            stateAfter: interactionStateAfter,
          })
          // Detect generate_model turns that got a conversational response instead of a draft
          if (resolvedTurnType === 'explicit_generate' && !nonStreamMutatedGraph) {
            console.warn('[sendTurn] generate_model.no_draft_returned', { requestId: turnClientId })
            recordCrossSurfaceEvent({
              eventType: 'generate_model_no_draft',
              summary: 'CEE returned conversational response for explicit_generate turn (non-streaming)',
              payloadSummary: { request_id: turnClientId, path: 'non-streaming' },
            })
          }

          if (triggerSurface === 'analyse_now') {
            setLastAnalysisInteractionChainId(interactionChainId)
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // timeout already handled

        if (mode === 'user' && !hidden) {
          setLastFailedInput(message)

          const errorMessage = buildErrorMessage(err)

          // If the streaming path pre-created a message, reuse it instead
          // of creating a duplicate.
          if (streamingMsgIdRef.current) {
            updateMessage(streamingMsgIdRef.current, {
              content: errorMessage,
              isStreaming: false,
              isProvisional: false,
              toolLoadingState: null,
              synthetic: true,
              actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' as const }],
            })
            streamingMsgIdRef.current = null
          } else {
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: errorMessage,
              synthetic: true,
              actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
              timestamp: new Date(),
            })
          }
        }
        updateInteractionResponse(turnClientId, {
          responseStatus: err instanceof OrchestratorError ? err.status : 0,
          responseSummary: err instanceof OrchestratorError && err.body && typeof err.body === 'object'
            ? { body_keys: Object.keys(err.body as Record<string, unknown>) }
            : undefined,
          responseError: (err as Error).message,
          mutatedGraph: false,
          mutatedAnalysis: false,
          mutatedChat: mode === 'user' && !hidden,
          stateAfter: createInteractionSnapshot(messages.length + (mode === 'user' && !hidden ? 1 : 0)),
        })
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
        clearInterval(elapsedIntervalRef.current)
        clearTimeout(timeoutTimerRef.current)
        // Finalise any stuck streaming message before clearing refs
        if (streamingMsgIdRef.current) {
          if (frameBufRef.current.length > 0) {
            streamTextRef.current += frameBufRef.current.join('')
          }
          const content = streamTextRef.current || 'The response was interrupted.'
          updateMessage(streamingMsgIdRef.current, {
            content,
            isStreaming: false,
            isProvisional: false,
            toolLoadingState: null,
            synthetic: !streamTextRef.current,
            actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' as const }],
          })
        }
        cleanupStreamRefs()
        setIsThinking(false)
        setLongRunningHint(null)
        inFlightRef.current = false
      }
    },
    [isThinking, addMessage, updateMessage, buildRequest, handleEnvelope, scheduleStreamFlush, cleanupStreamRefs],
  )

  // ---------------------------------------------------------------------------
  // Public API: sendMessage, sendSystemEvent, sendChip
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(
    async (text: string, opts?: {
      hidden?: boolean
      turnType?: Exclude<TurnType, 'system_event'>
      debugSource?: string
      debugVisibleText?: string | null
      debugParentChainId?: string | null
      debugInitiatedBy?: 'user' | 'automatic'
      debugSourceSurface?: string
      debugRightPanelComposerLeak?: boolean
    }) => {
      await sendTurn({
        message: text,
        mode: 'user',
        hidden: opts?.hidden,
        turnType: opts?.turnType,
        source: opts?.debugSource,
        displayText: opts?.debugVisibleText ?? undefined,
        parentChainId: opts?.debugParentChainId,
        initiatedBy: opts?.debugInitiatedBy,
        sourceSurface: opts?.debugSourceSurface,
        rightPanelAccidentallySubmittedComposerContent: opts?.debugRightPanelComposerLeak,
      })
    },
    [sendTurn],
  )

  const sendSystemEvent = useCallback(
    async (event: WireSystemEvent, opts?: {
      debugSource?: string
      debugVisibleText?: string | null
      debugParentChainId?: string | null
      debugInitiatedBy?: 'user' | 'automatic'
      debugSourceSurface?: string
    }) => {
      // No-op when orchestrator V2 is OFF
      if (!isOrchestratorV2Enabled()) return

      // Pre-check: skip the entire network turn if the event type is not
      // supported by the CEE v3 schema. Prevents phantom [system] turns
      // with no wire event payload (wasted tokens, confusing context).
      const wire = serializeSystemEvent(event)
      if (wire === null) {
        if (import.meta.env.DEV) {
          console.warn(`[sendSystemEvent] Dropped unsupported event: ${event.type}`)
        }
        return
      }

      recordCrossSurfaceEvent({
        eventType: event.type,
        summary: typeof event.payload?.summary === 'string' ? event.payload.summary : event.type,
        payloadSummary: event.payload,
      })

      await sendTurn({
        message: SYSTEM_MESSAGE_SENTINEL,
        systemEvent: event,
        mode: 'system',
        source: opts?.debugSource ?? 'system_event',
        displayText: opts?.debugVisibleText ?? undefined,
        parentChainId: opts?.debugParentChainId,
        initiatedBy: opts?.debugInitiatedBy ?? 'automatic',
        sourceSurface: opts?.debugSourceSurface,
      })
    },
    [sendTurn],
  )

  const sendChip = useCallback(
    async (chip: ActionChip) => {
      // Undo draft: restore pre-draft snapshot via store action
      if (chip.intent === 'undo') {
        recordUserAction({
          actionType: 'clicked chip',
          payloadSummary: { chip_label: chip.label, intent: chip.intent },
        })
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
        recordUserAction({
          actionType: 'clicked chip',
          payloadSummary: { chip_label: chip.label, intent: chip.intent },
        })
        // Show chip.label in conversation bubble, send chip.message to orchestrator
        await sendTurn({
          message: chip.message,
          displayText: chip.label,
          mode: 'user',
          source: 'chip_click',
          turnType: inferChipTurnType(chip),
        })
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
      recordUserAction({
        actionType: 'clicked retry',
        payloadSummary: {
          raw_message: last.message,
          client_turn_id: last.clientTurnId ?? null,
        },
      })
      // Remove the error/timeout synthetic message; keep original user bubble
      setMessages((prev) => {
        const tail = prev[prev.length - 1]
        const next = tail?.synthetic ? prev.slice(0, -1) : prev
        messagesRef.current = next
        return next
      })
      // Re-send without creating a new user bubble (original is already in thread).
      // Reuse the original client_turn_id for idempotent retry.
      await sendTurn({
        message: last.message,
        mode: 'user',
        skipUserBubble: true,
        retryClientTurnId: last.clientTurnId,
        source: 'retry',
      })
    }
  }, [sendTurn])

  const clearHistory = useCallback(() => {
    messagesRef.current = []
    setMessages([])
    setIsThinking(false)
    setLongRunningHint(null)
    setLastFailedInput(null)
    setPatchBlockStates(new Map())
    setPatchRejectionsMap(new Map())
    abortRef.current?.abort()
    clearTimeout(longRunningTimerRef.current)
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
