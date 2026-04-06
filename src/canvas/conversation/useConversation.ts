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
import { isOrchestratorV2Enabled, isOrchestratorStreamingEnabled, isThreadHydrateEnabled, isThreadPersistEnabled, isOrchestratorRenderingV2Enabled } from '../../flags'
import { assembleAnalysisInputsSummary } from '../analysis/assembleAnalysisInputsSummary'
import { useResultsStore } from '../stores/resultsStore'
import { hydrateMessagesFromThread, formatSessionBoundary } from './utils/hydrateThread'
import { appendThreadEntries, createSnapshot } from '../../services/threadService'
import type { ThreadEntry } from '../journey/threadTypes'
import { useGuidanceStore, type GuidanceItem } from '../stores/guidanceStore'
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
  CommentaryBlock,
  ProposalReviewItem,
  RelatedElementRef,
  BaseRateChipSet,
} from './types'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from './types'
import { applyAutoApplyPatch, synthesiseCeeAnalysisReady } from './utils/applyPatch'
import { backfillInterventionsOntoOptionNodes, backfillGoalThresholdOntoGoalNode } from '../utils/applyDraftResult'
import { validateAnalysisReadyContract } from './validateAnalysisReadyContract'
import { validateResponse, stripRepairLogLines, FALLBACK_TEXT } from './validateResponse'
import type { CEEAnalysisReady, CEEGoalConstraint } from '../../adapters/cee/types'
import type { PLoTEnrichment } from '../../adapters/plot/enrichment'
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
import { isDebugBundleV2Enabled } from '../../components/debug/utils/exportBundle'

/** Sentinel message content used for system events — must never render as a user bubble */
export const SYSTEM_MESSAGE_SENTINEL = '[system]'

/**
 * Detect assistant text that should NOT be stored in conversation history.
 * These are error fallbacks, empty placeholders, or system acknowledgements
 * that pollute LLM context on subsequent turns.
 * Exported for unit testing and retroactive filtering in buildHistory.
 */
export function isNonConversationalContent(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (trimmed.startsWith("I received your message but couldn't")) return true
  if (trimmed === "I'm ready to help with your decision.") return true
  if (trimmed === SYSTEM_MESSAGE_SENTINEL) return true
  if (/^\s*noted\s+the\s+changes\s+to\s+your\s+model\.?\s*$/i.test(trimmed)) return true
  if (/^\s*changes\s+applied\.?\s*$/i.test(trimmed)) return true
  return false
}

/** Collapse whitespace runs to a single space for comparison. */
function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ')
}

/**
 * Deduplicate assistant_text against a commentary block's narrative.
 *
 * When explain_result produces both assistant_text and a commentary block,
 * the text often repeats the block's headline. This function returns the
 * portion of assistantText that is NOT already present in the block's text.
 *
 * Heuristic: if the first sentence of assistantText appears verbatim
 * (case-insensitive, whitespace-normalised) in the block narrative, strip it.
 * Preserve any remaining non-duplicate content (e.g. follow-up questions).
 *
 * Exported for unit testing.
 */
export function deduplicateAgainstCommentary(
  assistantText: string,
  commentaryText: string,
): string {
  if (!assistantText.trim() || !commentaryText.trim()) return assistantText

  const textTrimmed = assistantText.trim()
  // Normalise whitespace so minor formatting differences don't prevent matching
  const narrativeNorm = normaliseWhitespace(commentaryText.toLowerCase())

  // Extract the first sentence of assistantText
  const firstSentenceMatch = textTrimmed.match(/^(.+?[.!?])(?:\s|$)/)
  if (!firstSentenceMatch) {
    // No sentence boundary — check full text as single unit
    if (narrativeNorm.includes(normaliseWhitespace(textTrimmed.toLowerCase()))) return ''
    return assistantText
  }

  const firstSentence = firstSentenceMatch[1]
  if (!narrativeNorm.includes(normaliseWhitespace(firstSentence.toLowerCase()))) {
    // First sentence not in commentary — no duplication, keep as-is
    return assistantText
  }

  // First sentence is duplicated. Preserve remaining text after it.
  const remainder = textTrimmed.slice(firstSentenceMatch[0].length).trim()
  return remainder
}

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

/**
 * Strip diagnostics content from assistant_text. Handles two patterns:
 * 1. XML-wrapped: `<diagnostics>…</diagnostics>` (with optional whitespace/newlines)
 * 2. Bare preamble: lines starting with "Mode:" followed by stage/intent metadata
 *    that CEE's internal diagnostics emits (e.g. "Mode: INTERPRET. Stage: IDEATE. …")
 *
 * Belt-and-braces defence — CEE strips these server-side, but LLM output variance
 * can cause leaks.
 */
export function stripDiagnostics(text: string): string {
  // 1. Remove <diagnostics>…</diagnostics> blocks (dotAll for multiline content)
  let cleaned = text.replace(/<diagnostics>[\s\S]*?<\/diagnostics>\s*/gi, '')

  // 2. Remove bare diagnostics preamble lines: "Mode: <WORD>. Stage: <WORD>."
  //    followed by optional further sentence(s) on the same line.
  //    Only strip lines that look like the internal preamble pattern to avoid
  //    false-positives on user-visible content.
  cleaned = cleaned.replace(/^\s*Mode:\s+\w+[.:]\s*Stage:\s+\w+[.:][^\n]*$/gm, '')

  // 3. Handle T3 XML envelope: <response><assistant_text>…</assistant_text>…</response>
  //    CEE staging sometimes wraps the response in this envelope. Extract only
  //    the content inside <assistant_text>…</assistant_text> when present.
  //    Also handles PARTIAL envelopes during streaming (opening tags arrived,
  //    closing tags not yet received).
  const responseEnvelopeMatch = cleaned.match(/<response>[\s\S]*?<assistant_text>([\s\S]*?)<\/assistant_text>[\s\S]*?<\/response>/i)
  if (responseEnvelopeMatch) {
    cleaned = responseEnvelopeMatch[1]
  } else {
    // Partial envelope during streaming: opening tags present but closing tags haven't arrived.
    // Extract content after <assistant_text> and strip any trailing incomplete XML.
    const partialMatch = cleaned.match(/^\s*<response[^>]*>\s*<assistant_text>([\s\S]*)$/i)
    if (partialMatch) {
      cleaned = partialMatch[1]
      // If a closing </assistant_text> has arrived but </response> hasn't yet, strip it
      cleaned = cleaned.replace(/<\/assistant_text>[\s\S]*$/i, '')
    } else if (/^\s*<response[^>]*>\s*$/i.test(cleaned)) {
      // <response> tag arrived but <assistant_text> hasn't yet — suppress entirely
      // to prevent raw XML flashing for one RAF frame during streaming.
      cleaned = ''
    }
  }

  // Collapse leading/trailing blank lines left by removals
  return cleaned.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd()
}

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
    // Retroactive cleanup: filter error/fallback text from previously stored messages
    if (msg.role === 'assistant' && isNonConversationalContent(msg.content)) continue
    // Skip [system] sentinel user messages
    if (msg.content === SYSTEM_MESSAGE_SENTINEL) continue
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
 * Extract clean assistant text from a potentially JSON-wrapped string.
 * CEE's fallback parser may set assistant_text to a stringified JSON envelope
 * like {"text": "...", "insights": [...]}. This extracts just the text field
 * so conversation_history contains plain text, not JSON.
 * Single extraction point — all handleEnvelope paths converge here.
 * Exported for unit testing.
 */
export function extractAssistantText(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  // Detect JSON objects — check for opening brace and closing brace
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'object' && parsed !== null) {
        // Priority 1: V2 envelope shape — assistant_text field
        if (typeof parsed.assistant_text === 'string' && parsed.assistant_text.trim()) {
          return parsed.assistant_text
        }
        // Priority 2: Legacy/fallback shape — text field
        if (typeof parsed.text === 'string' && parsed.text.trim()) {
          return parsed.text
        }
        // Parsed as JSON but no extractable text — warn and return original
        console.warn('[extractAssistantText] JSON object with no extractable text field', {
          keys: Object.keys(parsed).slice(0, 10),
        })
      }
    } catch {
      // Not valid JSON — use as-is
    }
  }
  return raw
}

/**
 * Extract a BaseRateChipSet from guidance items for the MISSING_BASE_RATE signal.
 * Returns the highest-priority match (lowest number = highest priority), or undefined.
 * Exported for unit testing.
 */
export function extractBaseRateChipSet(
  items: GuidanceItem[] | undefined | null,
): BaseRateChipSet | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined
  const matches = items
    .filter((g) =>
      g.signal_code === 'MISSING_BASE_RATE'
      && g.primary_action?.type === 'discuss',
    )
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
  const top = matches[0]
  if (!top) return undefined
  const label = top.target_object?.label || 'This factor'
  return { factorLabel: label, itemId: top.item_id, factorId: top.target_object?.id }
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

export function deriveProposalItemFromOperation(
  raw: unknown,
  nodeLabels?: Map<string, string>,
): ProposalReviewItem | null {
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

  // Edge ops: resolve source/target labels and render as "{from} → {to}".
  // Preference order:
  //   1. explicit label fields on the op (from_label/to_label or
  //      source_label/target_label) — needed when CEE adds an edge between
  //      nodes created in the same patch, where the canvas store lookup
  //      can't resolve yet
  //   2. canvas-store lookup by id (nodeLabels map)
  //   3. raw id fallback
  // Data shape: { from, to } (canvas convention) or { source, target } (RF).
  if (action === 'add_edge' || action === 'remove_edge' || action === 'update_edge') {
    const fromId = asOptionalString(data.from) ?? asOptionalString(data.source)
    const toId = asOptionalString(data.to) ?? asOptionalString(data.target)
    const explicitFromLabel =
      asOptionalString(data.from_label) ?? asOptionalString(data.source_label)
    const explicitToLabel =
      asOptionalString(data.to_label) ?? asOptionalString(data.target_label)
    const fromLabel =
      explicitFromLabel || (fromId && nodeLabels?.get(fromId)) || fromId
    const toLabel =
      explicitToLabel || (toId && nodeLabels?.get(toId)) || toId
    if (fromLabel && toLabel) {
      return {
        description: `${verb} connection: ${fromLabel} → ${toLabel}`,
        changeLabel: humaniseToken(action),
      }
    }
  }

  const description = elementLabel
    ? `${verb} ${elementLabel}`
    : `${verb} ${kind.toLowerCase()}`

  return {
    description,
    // Suppress elementLabel when description already contains it — mirrors
    // normaliseProposalReviewItems() dedup logic below.
    ...(elementLabel && !description.includes(elementLabel) ? { elementLabel } : {}),
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
          goal_constraints: Array.isArray(dataObj.goal_constraints) && dataObj.goal_constraints.length > 0
            ? dataObj.goal_constraints as CEEGoalConstraint[]
            : undefined,
          related_elements: normaliseRelatedElements(dataObj.related_elements),
          proposal_items: proposalItems,
          ...(proposalItems.length > 0 ? { proposal_items_source: 'backend' as const } : {}),
          // Per-operation rationale from CEE edit_graph (non-contractual debug field)
          operation_meta: Array.isArray(dataObj.operation_meta) ? dataObj.operation_meta as GraphPatchBlock['operation_meta'] : undefined,
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
          title: dataObj.title != null ? String(dataObj.title) : undefined,
          citations: Array.isArray(dataObj.citations) ? dataObj.citations as any : undefined,
          sections: Array.isArray(dataObj.sections)
            ? dataObj.sections.map((s: any) => ({
                heading: s?.heading != null ? String(s.heading) : undefined,
                content: s?.content != null ? String(s.content) : undefined,
                items: Array.isArray(s?.items) ? s.items.map(String) : undefined,
              }))
            : undefined,
        }

      case 'review_card': {
        // DS v5 §16.2: tone is the authoritative field (challenger → alert,
        // facilitator → info). Takes precedence over explicit variant when
        // present. Previously flag-gated on orchestratorRenderingV2 for
        // rollback safety; ungated so dot colour and card wrapper stay
        // consistent with the block badge (which is also always-on).
        const tone = typeof dataObj.tone === 'string' ? dataObj.tone as 'challenger' | 'facilitator' : undefined
        const variantDirect = dataObj.variant === 'alert' ? 'alert' : dataObj.variant === 'info' ? 'info' : undefined
        const variantFromTone: 'info' | 'alert' | undefined =
          tone === 'challenger' ? 'alert' : tone === 'facilitator' ? 'info' : undefined
        const resolvedVariant: 'info' | 'alert' = variantFromTone ?? variantDirect ?? 'info'
        return {
          type: 'review_card',
          title: String(dataObj.title ?? ''),
          body: String(dataObj.description ?? dataObj.body ?? ''),
          variant: resolvedVariant,
          tone,
          priority: dataObj.priority as any ?? undefined,
        }
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

      // Deterministic CEE block types (architecture v3)
      case 'comparison':
        return {
          type: 'comparison',
          narrative: dataObj.narrative != null ? String(dataObj.narrative) : undefined,
          options: Array.isArray(dataObj.options)
            ? dataObj.options.map((o: any) => ({
                id: o?.id != null ? String(o.id) : undefined,
                label: String(o?.label ?? ''),
                probability: typeof o?.probability === 'number' ? o.probability : undefined,
                rank: typeof o?.rank === 'number' ? o.rank : undefined,
                strengths: Array.isArray(o?.strengths) ? o.strengths.map(String) : undefined,
                weaknesses: Array.isArray(o?.weaknesses) ? o.weaknesses.map(String) : undefined,
                key_differentiators: Array.isArray(o?.key_differentiators) ? o.key_differentiators.map(String) : undefined,
              }))
            : [],
        } as ConversationBlock

      case 'premortem':
        return {
          type: 'premortem',
          target_option: dataObj.target_option != null && typeof dataObj.target_option === 'object'
            ? { id: String((dataObj.target_option as any).id ?? ''), label: String((dataObj.target_option as any).label ?? '') }
            : undefined,
          narrative: dataObj.narrative != null ? String(dataObj.narrative) : undefined,
          risk_paths: Array.isArray(dataObj.risk_paths)
            ? dataObj.risk_paths.map((rp: any) => ({
                path: Array.isArray(rp?.path) ? rp.path.map(String) : undefined,
                description: String(rp?.description ?? ''),
                influence: typeof rp?.influence === 'number' ? rp.influence : undefined,
                likelihood: rp?.likelihood != null ? String(rp.likelihood) : undefined,
                mitigation: rp?.mitigation != null ? String(rp.mitigation) : undefined,
              }))
            : [],
        } as ConversationBlock

      case 'flip_analysis':
        return {
          type: 'flip_analysis',
          current_winner: dataObj.current_winner != null && typeof dataObj.current_winner === 'object'
            ? {
                id: String((dataObj.current_winner as any).id ?? ''),
                label: String((dataObj.current_winner as any).label ?? ''),
                ...(typeof (dataObj.current_winner as any).probability === 'number'
                  ? { probability: (dataObj.current_winner as any).probability }
                  : {}),
              }
            : undefined,
          narrative: dataObj.narrative != null ? String(dataObj.narrative) : undefined,
          flip_conditions: Array.isArray(dataObj.flip_conditions)
            ? dataObj.flip_conditions.map((fc: any) => ({
                assumption: String(fc?.assumption ?? ''),
                current_value: fc?.current_value != null ? String(fc.current_value) : undefined,
                flip_threshold: String(fc?.flip_threshold ?? ''),
                direction: String(fc?.direction ?? ''),
                alternative_winner: fc?.alternative_winner != null ? String(fc.alternative_winner) : undefined,
              }))
            : [],
        } as ConversationBlock

      case 'proposal':
        return {
          type: 'proposal',
          action_type: String(dataObj.action_type ?? ''),
          description: String(dataObj.description ?? ''),
          proposal_id: String(dataObj.proposal_id ?? block_id ?? ''),
          changes: Array.isArray(dataObj.changes)
            ? dataObj.changes.map((c: any) => ({
                operation: String(c?.operation ?? ''),
                target: String(c?.target ?? ''),
                detail: String(c?.detail ?? ''),
              }))
            : [],
          consequences: Array.isArray(dataObj.consequences) ? dataObj.consequences.map(String) : undefined,
          confirmation_required: typeof dataObj.confirmation_required === 'boolean' ? dataObj.confirmation_required : undefined,
        } as ConversationBlock

      case 'exercise':
        return {
          type: 'exercise',
          exercise_type: String(dataObj.exercise_type ?? ''),
          title: String(dataObj.title ?? ''),
          instructions: String(dataObj.instructions ?? ''),
          content: dataObj.content != null ? String(dataObj.content) : undefined,
        } as ConversationBlock

      default:
        // Unknown block_type — pass raw type through for InlineBlocks fallback.
        // The type string is outside the ConversationBlock union but InlineBlocks
        // renders a generic card for unrecognised types. Single assertion is safe
        // because the spread preserves all fields the renderer may inspect.
        return { type: block_type, ...dataObj } as ConversationBlock
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
    } as GraphPatchBlock
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

/** Deterministic action_type → turn type mapping. Falls back to 'conversation' for unknown actions. Exported for tests. */
export const ACTION_TO_TURN_TYPE: Record<string, Exclude<TurnType, 'system_event'>> = {
  run_analysis: 'run_analysis',
  explain_result: 'explain',
  compare_options: 'explain',
  what_would_flip: 'explain',
  challenge_assumption: 'conversation',
  set_factor_value: 'conversation',
  add_factor: 'conversation',
  add_option: 'conversation',
  add_constraint: 'conversation',
  adjust_edge_strength: 'conversation',
  remove_factor: 'conversation',
  set_goal_target: 'conversation',
  run_premortem: 'explain',
  draft_graph: 'explicit_generate',
}

/** Source surface for action dispatch — used for logging and telemetry */
export type ActionSource = 'chip' | 'insight' | 'canvas_coaching' | 'pre_analysis' | 'guidance' | 'inspector' | 'base_rate'

/** Options for the unified action dispatch function */
export interface DispatchActionOpts {
  /** Deterministic action type for CEE routing */
  action_type?: string
  /** Structured parameters for action execution */
  parameters?: Record<string, unknown>
  /** Display label for the action indicator and aria */
  label: string
  /** Fallback message text sent to CEE */
  message: string
  /** If true, suppress the user message bubble */
  hidden?: boolean
  /** Origin surface for telemetry */
  source: ActionSource
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
  /** Unified action dispatch — routes all pill/chip/action triggers through a single path with proper metadata */
  dispatchAction: (opts: DispatchActionOpts) => Promise<void>
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
  // Mirror isThinking in a ref so sendTurn can read it without being in the
  // useCallback dependency array. Including the state value in deps caused the
  // callback to be recreated on every isThinking toggle, breaking the async
  // streaming loop (the old closure's finally block fired immediately).
  const isThinkingRef = useRef(false)
  useEffect(() => { isThinkingRef.current = isThinking }, [isThinking])
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
      const wasNull = prevScenarioRef.current === null || prevScenarioRef.current === undefined
      prevScenarioRef.current = scenarioId

      // When the previous ID was null/undefined, this is the initial lazy UUID
      // assignment from buildRequest — not a real scenario switch. Clearing
      // messages here would wipe the in-flight conversation and kill isThinking.
      if (wasNull && scenarioId) {
        if (import.meta.env.DEV) {
          console.debug('[useConversation] Skipping reset — initial scenario_id assignment:', scenarioId)
        }
        return
      }

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
            useCanvasStore.getState().setIsGenerating(false)
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
            useCanvasStore.getState().setIsGenerating(false)
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
      useCanvasStore.getState().setIsGenerating(false)
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
  /** Tracks the analysis hash for which array-coercion was last reported — deduplicates telemetry */
  const coercionWarnedHashRef = useRef<string | null>(null)
  /** Deterministic CEE: routing mode from turn_start — skips XML stripping when 'deterministic' */
  const streamRoutingRef = useRef<'deterministic' | 'llm' | null>(null)

  /** Flush accumulated text_delta tokens to the streaming message */
  const flushStreamFrame = useCallback(() => {
    rafIdRef.current = null
    const buf = frameBufRef.current
    const msgId = streamingMsgIdRef.current
    if (!buf.length || !msgId) return
    frameBufRef.current = []
    streamTextRef.current += buf.join('')
    // Strip diagnostics and repair logs during streaming so internal text never flashes in the bubble.
    // Deterministic routing: skip XML stripping (text is always plain text).
    const raw = streamTextRef.current
    const cleaned = streamRoutingRef.current === 'deterministic'
      ? stripRepairLogLines(raw)
      : stripRepairLogLines(stripDiagnostics(raw))
    updateMessage(msgId, { content: cleaned })
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
    streamRoutingRef.current = null
  }, [])

  const buildRequest = useCallback(
    (opts: {
      text: string
      clientTurnId?: string
      turnType: TurnType
      systemEventWire?: WireSystemEvent
      chipMeta?: { action_type: string; parameters?: Record<string, unknown> }
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
              ...(store.goalConstraints && store.goalConstraints.length > 0
                ? { constraints: store.goalConstraints }
                : {}),
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
        // UI-SEM-035: Canvas weight [0,2] + direction → signed mean clamped to [-1,+1] for CEE.
        const weight = typeof weightValue === 'number' ? Math.max(0, Math.min(weightValue, 2.0)) : 0.5
        const direction = directionValue === 'negative' ? -1 : 1
        const mean = Math.max(-1, Math.min(1, direction * weight))
        const std = typeof strengthStdValue === 'number' ? Math.max(0, strengthStdValue) : undefined
        const rawExistsProb = d.beliefExists ?? d.confidence ?? d.belief
        const existsProb = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
        const effectDir = directionValue === 'positive' || directionValue === 'negative' ? directionValue : undefined
        const edgeType = typeof d.edge_type === 'string' ? d.edge_type : 'directed'
        return {
          from: e.source,
          to: e.target,
          strength: { mean, ...(std !== undefined ? { std } : {}) },
          ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
          ...(effectDir ? { effect_direction: effectDir } : {}),
          edge_type: edgeType,
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

      // Build results from rawV2Response — CEE expects V2 field names
      // (option_comparison, robustness, drivers, etc.) directly on results.
      // The AnalysisInputsSummary used different names (options, top_drivers)
      // which caused CEE to log results_is_array: false / no valid options.
      const rawV2 = store.rawV2Response
      // Flag when completed analysis has non-array critical fields — likely a PLoT regression.
      // Still send what we have (CEE benefits from partial context) but warn loudly.
      // Detect non-array critical fields in rawV2 — warn once per analysis hash.
      if (rawV2 && rawV2.analysis_status === 'computed' && analysisHash && analysisHash !== coercionWarnedHashRef.current) {
        const v2ArrayCoercions: string[] = []
        if (!Array.isArray(rawV2.option_comparison)) v2ArrayCoercions.push('option_comparison')
        if (!Array.isArray(rawV2.drivers)) v2ArrayCoercions.push('drivers')
        if (!Array.isArray(rawV2.edge_sensitivity)) v2ArrayCoercions.push('edge_sensitivity')
        if (rawV2.factor_sensitivity !== undefined && !Array.isArray(rawV2.factor_sensitivity)) v2ArrayCoercions.push('factor_sensitivity')
        if (v2ArrayCoercions.length > 0) {
          coercionWarnedHashRef.current = analysisHash
          console.warn('[buildRequest] rawV2Response has non-array fields coerced to []:', v2ArrayCoercions)
          recordCrossSurfaceEvent({
            eventType: 'analysis_state_coercion',
            summary: `Critical arrays coerced to []: ${v2ArrayCoercions.join(', ')}`,
            payloadSummary: { fields: v2ArrayCoercions },
          })
        }
      }
      const v2Results = rawV2 ? {
        option_comparison: Array.isArray(rawV2.option_comparison) ? rawV2.option_comparison : [],
        robustness: rawV2.robustness ?? null,
        // Retained for backward compatibility; factor_sensitivity is the canonical driver surface for CEE.
        drivers: Array.isArray(rawV2.drivers) ? rawV2.drivers : [],
        edge_sensitivity: Array.isArray(rawV2.edge_sensitivity) ? rawV2.edge_sensitivity : [],
        // Forward top-5 factor_sensitivity entries so CEE orchestrator can produce
        // driver-based coaching (referenced by v32a prompt plays). PLoT already returns
        // these in importance_rank order — slice without re-sorting to preserve passthrough semantics.
        // Omit the key entirely when PLoT does not provide it (don't fabricate empty arrays).
        ...(Array.isArray(rawV2.factor_sensitivity)
          ? { factor_sensitivity: rawV2.factor_sensitivity.slice(0, 5) }
          : {}),
        constraints_status: rawV2.constraints_status ?? null,
        critiques: Array.isArray(rawV2.critiques) ? rawV2.critiques : [],
        meta: rawV2.meta ?? null,
        analysis_status: rawV2.analysis_status,
        option_comparison_status: rawV2.option_comparison_status,
        robustness_status: rawV2.robustness_status,
        drivers_status: rawV2.drivers_status,
        // Attach compact summary when available — supplementary context for CEE
        ...(analysisSummary ? { compact_summary: analysisSummary } : {}),
      } : null
      // Include repairs_applied in analysis_state so the orchestrator LLM can
      // mention PLoT's normalisation/clamping/defaulting to users.
      const repairsSummary = rawV2?.repairs_applied?.length
        ? { count: rawV2.repairs_applied.length, codes: rawV2.repairs_applied.map(r => r.code).filter(Boolean) }
        : undefined
      // CEE reads V2 fields (option_comparison, robustness, drivers, etc.) at the
      // TOP LEVEL of analysis_state — NOT nested inside a `results` wrapper.
      // `results` was removed: it was redundant (CEE ignores it) and when
      // analysisSummary was null it fell back to `true`, which crashed CEE.
      const analysisState: ExplainAnalysisStatePayload | undefined =
        graphIsStale ? undefined
        : analysisStatus === 'completed' && analysisHash && v2Results
          ? {
              ...v2Results,
              // analysis_status and meta MUST come AFTER v2Results spread so they
              // are not overwritten by rawV2's own analysis_status / meta fields.
              analysis_status: analysisStatus,
              meta: { ...v2Results.meta, response_hash: analysisHash },
              ...(repairsSummary ? { repairs_summary: repairsSummary } : {}),
            }
        : undefined

      if (import.meta.env.DEV) {
        console.warn('[buildRequest] analysis_state present:', !!analysisState, {
          turnType: opts.turnType,
          analysisStatus,
          hasHash: !!analysisHash,
          hasRawV2: !!rawV2,
          hasSummary: !!analysisSummary,
          graphIsStale,
          has_option_comparison: Array.isArray(analysisState?.option_comparison),
          option_comparison_length: Array.isArray(analysisState?.option_comparison) ? (analysisState!.option_comparison as unknown[]).length : 0,
        })
      }

      if (opts.turnType === 'system_event') {
        return buildSystemEventTurnRequest({
          scenario_id: scenarioId,
          conversation_history: conversationHistory,
          message: opts.text,
          graph_state: graphState,
          // R11: analysis_state omitted — system events (graph edits) don't need it
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
          // R11: analysis_state omitted — draft generation doesn't need it
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
            chip_metadata: opts.chipMeta,
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

      // R11 (updated): analysis_state now included on conversation turns so CEE
      // can detect post-analysis stage and reference computed results.
      return buildConversationTurnRequest({
        scenario_id: scenarioId,
        conversation_history: conversationHistory,
        message: opts.text,
        graph_state: graphState,
        selected_elements: selectedElements,
        analysis_state: analysisState,
        chip_metadata: opts.chipMeta,
        client_turn_id: opts.clientTurnId,
      })
    },
    [], // messagesRef (stable ref) + useCanvasStore.getState() — no state/prop deps

  )

  const handleEnvelope = useCallback(
    (envelope: OrchestratorResponseEnvelopeV2, requestId?: string) => {
      // Silent system event routing: CEE may mark system event responses as silent.
      // Process blocks (structural data) but skip message storage and history.
      const turnPlan = (envelope as Record<string, unknown>).turn_plan as Record<string, unknown> | undefined
      if (turnPlan?.routing === 'system_event_silent') {
        console.warn('[handleEnvelope] Silent system event — skipping message storage', {
          turnId: envelope.client_turn_id ?? null,
        })
        if (streamingMsgIdRef.current) {
          updateMessage(streamingMsgIdRef.current, {
            content: '', isStreaming: false, toolLoadingState: null, synthetic: true,
          })
        }
        return
      }

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
        return type && !['commentary', 'review_card', 'fact', 'graph_patch', 'framing', 'brief', 'model_receipt', 'evidence', 'artefact', 'comparison', 'premortem', 'flip_analysis', 'proposal', 'exercise'].includes(type)
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

      // Capture _diagnostic_trace from CEE envelope for debug bundle v2.0.
      // Passthrough only — store as-is without transformation.
      // Always write (even null) so stale traces from prior runs don't leak.
      if (isDebugBundleV2Enabled()) {
        const cs = useCanvasStore.getState()
        cs.setRunMeta({
          ...cs.runMeta,
          ceeDiagnosticTrace: (envelope._diagnostic_trace as Record<string, unknown>) ?? null,
        })
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
            // SAFETY: V2-derived enrichment has sensitivity_analysis.edges/factors with
            // {elasticity, importance_rank} instead of PLoTEdgeSensitivity shape.
            // Downstream accesses duck-type these fields so the cast is safe at runtime.
            const enrichment = createEnrichmentFromV2Response(result) as PLoTEnrichment | null
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
      // Map of current canvas node id → label, so derived patch rows can render
      // "Add connection: {from_label} → {to_label}" instead of "Add connection".
      const nodeLabels = new Map<string, string>(
        store.nodes.map((n) => [n.id, (n.data?.label as string | undefined) ?? n.id]),
      )
      const normalisedBlocks = mergeProposalReviewIntoBlocks(
        responseBlocks.map(adaptCEEBlock).map((block) => {
          if (block.type !== 'graph_patch') return block
          const patch = block as GraphPatchBlock
          if ((patch.proposal_items?.length ?? 0) > 0) return patch
          const fallbackItems = patch.operations
            .map((op) => deriveProposalItemFromOperation(op, nodeLabels))
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
      let ceeProvidedGoalConstraints: CEEGoalConstraint[] | undefined

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

            // Track analysis_ready and goal_constraints from the last applied block.
            // Reset on each block so only the final block's values match the
            // post-mutation graph state.
            ceeProvidedAnalysisReady = patchBlock.analysis_ready
            ceeProvidedGoalConstraints = patchBlock.goal_constraints

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

      // Store goal_constraints — check block data first, then fall back to
      // envelope root. CEE places goal_constraints at the response root, but
      // the orchestrator may not nest them inside block.data.
      // IMPORTANT: Not gated on autoApplyModifiedIds — constraints can arrive
      // on any envelope, even without auto-apply patches.
      {
        const envelopeGoalConstraints = Array.isArray(envelope.goal_constraints) && envelope.goal_constraints.length > 0
          ? envelope.goal_constraints
          : undefined
        // Also check raw envelope with duck-typing for untyped pass-through
        const rawEnvelopeConstraints = !envelopeGoalConstraints
          ? (() => {
              const raw = (envelope as Record<string, unknown>).goal_constraints
              return Array.isArray(raw) && raw.length > 0 ? raw as CEEGoalConstraint[] : undefined
            })()
          : undefined
        const resolvedGoalConstraints = ceeProvidedGoalConstraints ?? envelopeGoalConstraints ?? rawEnvelopeConstraints
        if (resolvedGoalConstraints) {
          useCanvasStore.setState({ goalConstraints: resolvedGoalConstraints })
          if (import.meta.env.DEV) {
            console.warn('[handleEnvelope] goal_constraints:', resolvedGoalConstraints.length, {
              fromBlock: ceeProvidedGoalConstraints?.length ?? 0,
              fromEnvelope: envelopeGoalConstraints?.length ?? rawEnvelopeConstraints?.length ?? 0,
            })
          }
        } else if (autoApplyModifiedIds.length > 0) {
          // Only clear stale constraints when a graph patch was applied (new draft),
          // not on every conversational turn which may lack constraints.
          useCanvasStore.setState({ goalConstraints: null })
          if (import.meta.env.DEV) {
            console.warn('[handleEnvelope] goal_constraints: 0 (cleared — new draft with no constraints)')
          }
        }
      }

      // Set ceeAnalysisReady from the auto-applied blocks.
      // Primary path: use CEE-provided analysis_ready directly.
      // FALLBACK: Edge synthesis used only when CEE block lacks analysis_ready.
      // Remove fallback once all CEE paths guaranteed to include it.
      if (autoApplyModifiedIds.length > 0) {
        let resolvedAnalysisReady: CEEAnalysisReady | null = null
        if (ceeProvidedAnalysisReady) {
          resolvedAnalysisReady = ceeProvidedAnalysisReady
          if (import.meta.env.DEV) {
            console.warn('[handleEnvelope] Using CEE-provided analysis_ready', {
              options: ceeProvidedAnalysisReady.options.length,
              goal: ceeProvidedAnalysisReady.goal_node_id,
            })
          }
        } else {
          const synthesised = synthesiseCeeAnalysisReady()
          if (synthesised) {
            const validated = validateAnalysisReadyContract(synthesised)
            if (validated) {
              resolvedAnalysisReady = validated
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

        // ceeAnalysisReady must go through the canonical setter (not raw setState)
        // because it also captures ceeAnalysisReadyNodeIds and persists to sessionStorage.
        if (resolvedAnalysisReady) {
          useCanvasStore.getState().setCeeAnalysisReady(resolvedAnalysisReady)

          // Backfill interventions onto option nodes for debug bundle capture.
          // CEE sends interventions on analysis_ready.options, not on graph_patch add_node data.
          // TODO: Remove backfill when CEE includes interventions in graph_patch add_node ops.
          // Timing assumption: applyAutoApplyPatch ran synchronously above, so option nodes
          // are already in the store. If they aren't (shouldn't happen), this is a silent no-op.
          backfillInterventionsOntoOptionNodes(resolvedAnalysisReady)

          // Backfill goal_threshold_raw/unit/cap onto goal node for GoalNode display.
          // CEE sends these on analysis_ready, but GoalNode reads from node.data.
          backfillGoalThresholdOntoGoalNode(resolvedAnalysisReady)
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

      // Detect full_draft patch early — coaching text must be preserved as-is.
      // Full_draft turns (Turn 1 graph generation) carry meaningful LLM coaching
      // alongside the graph patch. We skip ALL text filters for these turns so the
      // coaching is never accidentally suppressed.
      const hasGraphPatch = orderedBlocks.some((b) => b.type === 'graph_patch')
      const hasFullDraftPatch = orderedBlocks.some(
        (b) => b.type === 'graph_patch' && (b as GraphPatchBlock).patch_type === 'full_draft',
      )

      // Belt-and-braces: strip <diagnostics>…</diagnostics> XML blocks and bare
      // diagnostics preamble ("Mode: …") that CEE should have removed server-side.
      // Protects against LLM output variance where diagnostics leak into assistant_text.
      let assistantText = extractAssistantText(envelope.assistant_text ?? '')

      // Deterministic format (response_version >= 2): plain text, no XML stripping needed
      const isV2Format = typeof rawEnvelope.response_version === 'number'
        && rawEnvelope.response_version >= 2
      if (!isV2Format) {
        assistantText = stripDiagnostics(assistantText)
      }

      // Full_draft turns: preserve coaching text, skip all content filters.
      // Fall back to streamed text only if assistant_text is empty.
      if (hasFullDraftPatch) {
        if (!assistantText.trim()) {
          const streamedText = streamTextRef.current
          if (streamedText.trim()) {
            assistantText = streamedText
          }
        }
      } else {
      // --- Begin non-full_draft filter chain ---

      // Strip trailing text lines that duplicate chip labels or messages (LLM sometimes
      // echoes suggested actions — either the display label or the raw prompt — as plain
      // text at the end of assistant_text). Only strip lines that look like a list item
      // (bulleted/numbered prefix) to avoid removing semantically valid prose endings.
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

      // Coaching dedup: when an incremental graph_patch block is present, suppress
      // or collapse assistant_text to avoid the user reading the same coaching
      // prose twice.
      const patchBlock = orderedBlocks.find(
        (b): b is GraphPatchBlock => b.type === 'graph_patch',
      )
      if (patchBlock && assistantText.trim()) {
        const patchSummary = (patchBlock.summary || '').toLowerCase().trim()
        const textLower = assistantText.toLowerCase().trim()
        // Exact/substring match → suppress entirely
        if (
          patchSummary && (
            textLower === patchSummary
            || patchSummary.includes(textLower)
            || textLower.includes(patchSummary)
          )
        ) {
          assistantText = ''
        } else if (patchSummary) {
          // Word-overlap check: if ≥60% of assistant_text words appear in the summary,
          // collapse to just the first sentence to avoid visual duplication.
          const textWords = new Set(textLower.split(/\s+/).filter(w => w.length > 3))
          const summaryWords = new Set(patchSummary.split(/\s+/).filter(w => w.length > 3))
          const overlap = [...textWords].filter(w => summaryWords.has(w)).length
          if (textWords.size > 0 && overlap / textWords.size > 0.6) {
            const firstSentence = assistantText.match(/^[^.!?]+[.!?]/)?.[0]
            assistantText = firstSentence ?? ''
          }
        }
      }

      // Commentary dedup: when a commentary block is present, suppress the portion
      // of assistant_text that repeats the block's narrative. explain_result turns
      // often echo the headline in both fields.
      const commentaryBlock = orderedBlocks.find(
        (b): b is CommentaryBlock => b.type === 'commentary',
      )
      if (commentaryBlock && assistantText.trim()) {
        assistantText = deduplicateAgainstCommentary(assistantText, commentaryBlock.text)
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

      // Suppress stock acknowledgement phrases that duplicate patch card status.
      // Orchestrator sometimes responds to patch_accepted/patch_dismissed system events
      // with a bare "Changes applied." or similar — the graph_patch card already shows this.
      // Only suppress when the same turn includes a graph_patch block, so standalone
      // "Noted." responses to user questions are preserved.
      if (hasGraphPatch) {
        const STOCK_ACK_PATTERNS = [
          /^\s*changes\s+applied\.?\s*$/i,
          /^\s*got\s+it[.!]?\s*$/i,
          /^\s*understood[.!]?\s*$/i,
          /^\s*noted[.!]?\s*$/i,
          /^\s*noted\s+the\s+changes\s+to\s+your\s+model\.?\s*$/i,
        ]
        if (STOCK_ACK_PATTERNS.some((p) => p.test(assistantText))) {
          assistantText = ''
        }
      }

      } // --- End non-full_draft filter chain ---

      // Extract deterministic CEE insights from V2 envelopes
      const insights = isV2Format && Array.isArray(rawEnvelope.insights)
        ? rawEnvelope.insights as import('./types').Insight[]
        : undefined

      // Extract base rate elicitation chips from MISSING_BASE_RATE guidance items.
      // One factor per turn — take only the highest-priority match (lowest number).
      const baseRateChips = extractBaseRateChipSet(envelope.guidance_items)

      // Guard: skip or filter non-conversational assistant turns.
      // Covers empty responses, error fallback text, system sentinels.
      const hasContent = assistantText.trim().length > 0
      const hasBlocks = orderedBlocks.length > 0
      const shouldFilter = !hasContent || isNonConversationalContent(assistantText)

      if (shouldFilter && !hasBlocks) {
        // Nothing to display — clean up streaming placeholder and return
        console.warn('[handleEnvelope] Filtered non-conversational turn from history', {
          turnId: envelope.client_turn_id ?? null,
          reason: !hasContent ? 'empty' : 'non_conversational',
          preview: assistantText.slice(0, 80) || '(empty)',
        })
        if (streamingMsgIdRef.current) {
          updateMessage(streamingMsgIdRef.current, {
            content: '',
            isStreaming: false,
            toolLoadingState: null,
            synthetic: true,
          })
        }
        return
      }
      if (shouldFilter && hasBlocks) {
        // Has blocks but non-conversational text — keep blocks, clear text.
        // Full_draft turns are already handled above (text preserved as-is).
        if (!hasFullDraftPatch) {
          assistantText = ''
        }
      }

      // Streaming guard: if a streaming message already exists for this turn,
      // update it in place instead of creating a duplicate.
      // P0-2: If the envelope text is a fallback placeholder but the stream
      // accumulated real content, prefer the streamed text.
      if (streamingMsgIdRef.current) {
        const streamedText = streamTextRef.current
        const isFallback = assistantText === FALLBACK_TEXT
        const finalContent = (isFallback && streamedText.trim()) ? streamedText : assistantText
        updateMessage(streamingMsgIdRef.current, {
          content: finalContent,
          blocks: hasBlocks ? orderedBlocks : undefined,
          actionChips: chips.length > 0 ? chips : undefined,
          insights,
          baseRateChips,
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
          insights,
          baseRateChips,
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
      /** Deterministic chip metadata forwarded for CEE action routing */
      chipMeta?: { action_type: string; parameters?: Record<string, unknown> }
      /** When true, render the user bubble as a compact action indicator */
      chipInitiated?: boolean
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
        chipMeta,
        chipInitiated,
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
        if (!message.trim() || isThinkingRef.current) {
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
              ...(chipInitiated ? { chipInitiated: true } : {}),
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
        if (isThinkingRef.current) {
          if (import.meta.env.DEV) console.warn('[sendTurn] System event blocked: isThinking=true')
          inFlightRef.current = false; return
        }
      }

      // Start thinking state
      setIsThinking(true)
      useCanvasStore.getState().setIsGenerating(true)

      // Abort any previous request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Resolve turn type early — needed for dynamic timeout computation
      const resolvedTurnType: TurnType = mode === 'system'
        ? 'system_event'
        : resolveUserTurnType(source, hidden, turnType)
      const dynamicTimeout = getTimeoutMs(resolvedTurnType, triggerSurface)

      // Show task-specific hint immediately; append elapsed counter after 15s
      const hint = inferLoadingHint(message, useCanvasStore.getState().nodes.length, turnType)
      const sendStartTime = Date.now()
      setLongRunningHint(hint)
      longRunningTimerRef.current = setTimeout(() => {
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
        useCanvasStore.getState().setIsGenerating(false)
        setLongRunningHint(null)
        if (inputForRestore) setLastFailedInput(inputForRestore)
        // Only visible user sends show a timeout error bubble.
        // Hidden sends and system events time out silently (matches catch block).
        if (mode === 'user' && !hidden) {
          const timeoutContent = 'This is taking longer than expected. Try again or rephrase your message.'
          const timeoutChips: ActionChip[] = [{ id: 'retry', label: 'Try again', intent: 'primary' }]
          // If a streaming message was pre-created, update it instead of adding a
          // second bubble — prevents cascading error messages in the chat.
          if (streamingMsgIdRef.current) {
            updateMessage(streamingMsgIdRef.current, {
              content: timeoutContent,
              isStreaming: false,
              isProvisional: false,
              toolLoadingState: null,
              synthetic: true,
              actionChips: timeoutChips,
            })
            streamingMsgIdRef.current = null
          } else {
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: timeoutContent,
              synthetic: true,
              actionChips: timeoutChips,
              timestamp: new Date(),
            })
          }
        }
      }, dynamicTimeout)

      try {
        const systemEventWire = mode === 'system' && systemEvent ? serializeSystemEvent(systemEvent) : undefined
        const request = buildRequest({
          text: message,
          clientTurnId: turnClientId,
          turnType: resolvedTurnType,
          systemEventWire: systemEventWire ?? undefined,
          chipMeta,
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

          // Show local "Thinking..." if no progress/text_delta within 3s
          const thinkingTimerId = setTimeout(() => {
            if (streamingMsgIdRef.current === msgId && !streamTextRef.current) {
              updateMessage(msgId, { toolLoadingState: 'Thinking\u2026' })
            }
          }, 3000)

          for await (const event of streamOrchestratorTurn(request, controller.signal)) {
            switch (event.type) {
              case 'turn_start':
                // Capture routing mode for deterministic CEE format detection
                streamRoutingRef.current = event.routing ?? null
                // Stream is live — stop the elapsed-time counter but keep the
                // current hint visible so the status label doesn't flash to
                // generic "Thinking…" before text_delta arrives.
                clearTimeout(longRunningTimerRef.current)
                clearInterval(elapsedIntervalRef.current)
                break

              case 'text_delta':
                clearTimeout(thinkingTimerId)
                // Clear progress/thinking status when real content starts arriving
                if (frameBufRef.current.length === 0 && !streamTextRef.current) {
                  updateMessage(msgId, { toolLoadingState: null })
                }
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

              case 'progress':
                // CEE progress update (e.g. "Olumi is thinking...") — show as status text.
                // Cleared when first text_delta arrives or turn_complete fires.
                if (event.message) {
                  updateMessage(msgId, { toolLoadingState: event.message })
                }
                break

              case 'tool_result':
                updateMessage(msgId, { toolLoadingState: null })
                break

              case 'turn_complete':
                clearTimeout(thinkingTimerId)
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
        useCanvasStore.getState().setIsGenerating(false)
        setLongRunningHint(null)
        inFlightRef.current = false
      }
    },
    [addMessage, updateMessage, buildRequest, handleEnvelope, scheduleStreamFlush, cleanupStreamRefs],
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

  /**
   * dispatchAction — unified entry point for all pill/chip/action triggers.
   *
   * Builds chip_metadata for deterministic CEE routing, creates a compact
   * action indicator bubble (or suppresses the bubble entirely when hidden),
   * and sends the turn via the existing streaming path.
   */
  const dispatchAction = useCallback(
    async (opts: DispatchActionOpts) => {
      if (import.meta.env.DEV) {
        console.debug('[Action]', opts.source, opts.action_type, opts.parameters)
      }

      recordUserAction({
        actionType: 'clicked action',
        payloadSummary: { label: opts.label, source: opts.source, action_type: opts.action_type },
      })

      const chipMeta = opts.action_type
        ? { action_type: opts.action_type, ...(opts.parameters ? { parameters: opts.parameters } : {}) }
        : undefined

      // Resolve turn type: deterministic map first, then keyword heuristic for legacy chips
      let turnType: Exclude<TurnType, 'system_event'> = 'conversation'
      if (opts.action_type && ACTION_TO_TURN_TYPE[opts.action_type]) {
        turnType = ACTION_TO_TURN_TYPE[opts.action_type]
      } else if (!opts.action_type) {
        // Legacy fallback: scan label/message for routing keywords
        const token = `${opts.label} ${opts.message}`.toLowerCase()
        if (token.includes('clarif')) turnType = 'clarification_response'
        else if (token.includes('explain') || token.includes('why')) turnType = 'explain'
        else if (token.includes('patch') || token.includes('proposal')) turnType = 'patch_followup'
      }

      await sendTurn({
        message: opts.message,
        displayText: opts.label,
        mode: 'user',
        hidden: opts.hidden,
        source: opts.source,
        turnType,
        chipMeta,
        chipInitiated: !opts.hidden,
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

      const messageToSend = chip.message || chip.prompt
      if (messageToSend) {
        // Delegate to dispatchAction for unified metadata handling
        await dispatchAction({
          action_type: chip.action_type,
          parameters: chip.parameters,
          label: chip.label,
          message: messageToSend,
          source: 'chip',
        })
      } else {
        // Chip has no message and is not an undo — this should not happen in practice
        // (validateResponse and render filters both block messageless chips), but if it
        // does, throw so the .catch() handler in SuggestedChips can show an inline error.
        throw new Error(`Chip "${chip.label}" has no message field`)
      }
    },
    [dispatchAction, addMessage],
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
    useCanvasStore.getState().setIsGenerating(false)
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
    dispatchAction,
    clearHistory,
    retryLast,
    patchBlockStates,
    setPatchBlockState,
    patchRejections,
    setPatchRejection,
  }
}
