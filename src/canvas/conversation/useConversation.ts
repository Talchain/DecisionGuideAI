/**
 * useConversation — Conversation state and orchestrator integration
 *
 * Manages the message list, sends turns to the orchestrator, handles
 * timeouts and errors, and provides chip interaction. Session-scoped
 * (not persisted). Clears on scenario switch.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { setCurrentScenarioId } from '../store/scenarios'
import { useDraftStore } from '../stores/draftStore'
import { generateGraphHash } from '../utils/graphHash'
import { callOrchestratorTurn, streamOrchestratorTurn, OrchestratorError } from './turnService'
import {
  buildFailureRender,
  extractCeeRecovery,
  formatRecoveryHints,
  isDisplaySafeReason,
} from './ceeRecovery'
import { buildTransportFailureCopy, isTransportFailure } from './transportFailure'
import { callV5Turn, getV5Endpoint } from '../../v5/v5Adapter'
import { routeV5Response } from '../../v5/responseRouter'
import { getTimeoutMs } from '../../v5/getTimeoutMs'
import { isV5Eligible } from '../../v5/eligibility'
import { buildV5Payload } from '../../v5/buildPayload'
import {
  checkRetryableAgreement,
  extractReason as extractV5ErrorReason,
  resolveGuidance as resolveV5ErrorGuidance,
  resolveRetryable as resolveV5Retryable,
  resolveFailureBaseCopy,
} from '../../v5/failureTypeRetryability'
import { mapV5Blocks } from '../../v5/blocks/mapV5Blocks'
import { deriveV5Stage, v5StageToScenarioStage } from '../../v5/stageMapper'
import { applyV5State } from '../../v5/applyV5State'
import {
  extractPhase3FromV5Response,
  deriveV5AnalysisFactUpdate,
  type Phase3RawBlock,
} from '../../v5/extractPhase3FromV5Response'
import {
  adaptTypedReviewCardBlock,
  adaptTypedCoachingBlock,
  adaptTypedEvidenceBlock,
  adaptTypedExerciseBlock,
} from '../../v5/phase3TypedBlocks'
// Track C slice 1 (D-5): the bridge counts every Phase 3 block it does NOT
// surface (malformed / no renderer / legacy suppression). Counting only —
// recordDroppedContent never throws and never changes composition output.
import { recordDroppedContent } from '../../lib/droppedContentCounter'
import { buildChipMeta, toLegacyChipMetadata, type ChipMeta } from './chipMeta'
import { isOrchestratorV2Enabled, isOrchestratorStreamingEnabled, isThreadHydrateEnabled, isThreadPersistEnabled, isPreAnalysisEnrichedEnabled, isReasoningDisclosureEnabled } from '../../flags'
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'
import { extractAnswerShapeSidecar } from './answerShape'
// Leg 3 blocker fix: the wire->camelCase coaching mapper lives in the CEE
// client adapter (DraftChat/useRetryDraft path); the V5 inline-draft seam
// reuses it so one mapper owns the coaching wire shape.
import { mapDraftCoachingFromResponse } from '../../adapters/cee/client'
import { maybeBuildModelReceiptBlock } from '../adapters/modelCardAdapter'
import { buildDraftBiasSignalBlocks } from './draftBiasSignalBlocks'
import { assembleAnalysisInputsSummary } from '../analysis/assembleAnalysisInputsSummary'
import { useResultsStore } from '../stores/resultsStore'
import { hydrateMessagesFromThread, formatSessionBoundary } from './utils/hydrateThread'
import { appendThreadEntries, createSnapshot } from '../../services/threadService'
import type { ThreadEntry } from '../journey/threadTypes'
import { useGuidanceStore, type GuidanceItem } from '../stores/guidanceStore'
import { serializeSystemEvent } from './systemEvents'
import {
  isSuccessfulAnalysis,
  reconcileOptionsWithCanvasNodes,
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
  ConversationTurnPair,
  GraphPatchBlock,
  CommentaryBlock,
  ProposalReviewItem,
  RelatedElementRef,
  ReviewCardBlock,
} from './types'
import { MAX_CHIPS_PER_TURN, MAX_SUGGESTED_ACTIONS } from './types'
import { applyAutoApplyPatch, synthesiseCeeAnalysisReady } from './utils/applyPatch'
import { applyAnalysisReadyPatch } from './utils/mirrorAnalysisReady'
import { loadScenario as loadScenarioFromDb, storeAnalysis } from '../../services/scenarioService'
import { applyDraftResult, backfillGoalThresholdOntoGoalNode } from '../utils/applyDraftResult'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { trackEvent } from '../../lib/posthog'
import { buildTurnAuthHeaders } from '../../v5/turnAuthHeaders'
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
export function inferLoadingHint(message: string, _nodeCount: number, turnType?: string): string {
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

export interface BuildErrorMessageOptions {
  /**
   * Whether a "Try again" affordance will actually be rendered alongside this
   * copy. Defaults to `true` (fail open — today's behaviour and copy).
   *
   * When `false` the caller has decided, from the CEE `retryable` marker, that
   * no retry control will exist. The copy must then NOT instruct the user to
   * retry: an instruction with no control to carry it out is a dead end. Each
   * retry-directive base below has a non-retry-directive counterpart that
   * states what happened and names an action the user can still take without a
   * retry button (refresh, wait, rephrase and send a new message).
   */
  canRetry?: boolean
}

/**
 * Build a user-facing error message from a caught error.
 *
 * `opts.canRetry === false` selects the non-retry-directive copy variants. See
 * BuildErrorMessageOptions and ./ceeRecovery — `buildFailureRender` is the
 * single composition point that decides `canRetry` from the wire and calls
 * back into this function, so the two can never disagree.
 */
export function buildErrorMessage(err: unknown, opts?: BuildErrorMessageOptions): string {
  const canRetry = opts?.canRetry !== false
  // Always log structured detail for development console output (never rendered).
  if (err instanceof OrchestratorError) {
    if (import.meta.env.DEV) {
      console.warn('[orchestrator] error', {
        status: err.status,
        requestId: err.requestId,
        body: err.body,
      })
    }
  }
  if (!(err instanceof OrchestratorError)) {
    return canRetry
      ? 'Something went wrong. Try again or rephrase your message.'
      : 'Something went wrong. Rephrasing your message may help.'
  }
  // DEV-only ref suffix to aid debugging; never in production bundles.
  const ref = import.meta.env.DEV && err.requestId ? ` [ref: ${err.requestId}]` : ''
  switch (true) {
    case err.status === 401:
      return canRetry
        ? `Authentication error.${ref} Please refresh and try again.`
        : `Authentication error.${ref} Please refresh the page to continue.`
    case err.status === 429:
      return canRetry
        ? `Too many requests.${ref} Please wait a moment and try again.`
        : `Too many requests.${ref} Please wait a moment before sending another message.`
    case err.status === 400:
      // No retry directive in either variant: "rephrase your message" is an
      // action the user can always take from the composer, with or without a
      // retry chip. Single copy on purpose.
      return `Request error.${ref} Try rephrasing your message.`
    case err.status !== undefined && err.status >= 500:
      return canRetry
        ? `Service temporarily unavailable.${ref} Please try again shortly.`
        : `Service temporarily unavailable.${ref} Please wait a moment before continuing.`
    default:
      return canRetry
        ? `Something went wrong.${ref} Try again or rephrase your message.`
        : `Something went wrong.${ref} Rephrasing your message may help.`
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
export function normaliseAnalysisReady(raw: unknown): CEEAnalysisReady | undefined {
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

  // Freshness: pass through the four valid enum values; coerce anything else
  // (including absent legacy responses) to 'unknown' so the UI can render a
  // neutral pill rather than silently treating stale results as fresh.
  const freshnessRaw = obj.freshness
  const freshness =
    freshnessRaw === 'fresh' || freshnessRaw === 'stale' ||
    freshnessRaw === 'unknown' || freshnessRaw === 'none'
      ? freshnessRaw
      : 'unknown'

  // freshness_reason: keep only well-typed strings; drop everything else at
  // the boundary so the store never holds a value that violates the declared
  // type. Spread ...obj first, then overwrite to enforce the guard.
  const freshness_reason =
    typeof obj.freshness_reason === 'string' ? obj.freshness_reason : undefined

  const mapped = { ...obj, options, freshness, freshness_reason } as CEEAnalysisReady

  // Boundary validation — rejects entire payload if any field fails contract
  return validateAnalysisReadyContract(mapped)
}

export function attachAnalysisReadyToInlineDraftGraph(
  draftGraph: unknown,
  // The FULL parsed V5 response (review-folds A3: this used to be three
  // all-optional-unknown positional params — analysis_ready,
  // goal_constraints, response — where the first two were literally reads
  // off the third at the call site, an invisible-transposition hazard).
  // Everything this helper needs lives on the response:
  //  - `analysis_ready` (strict surface) — attached below, mirroring the
  //    original behaviour.
  //  - `goal_constraints` (ROADMAP 1.22 residual, filed alongside UI PR
  //    #250): CEE places it at the response ROOT as a SIBLING of
  //    `draft_graph`, never nested inside it. applyDraftResult only reads
  //    goal_constraints off the object it is handed, so without this
  //    attachment the "no constraints" branch fired on every inline-draft
  //    turn and cleared the store even when the root carried real
  //    constraints.
  //  - `coaching` (Leg 3 blocker fix, PR #356 review): also at the
  //    response ROOT. At the pinned boundary schema (0.15.0) the strict
  //    OlumiResponseSchema declares NO `coaching` key, so the parser
  //    demotes it to the non-enumerable `__additive__` sidecar (it must
  //    NOT be added to KNOWN_OLUMI_TOP_LEVEL_KEYS — the schema is
  //    .strict(), so routing an undeclared key into strict validation
  //    would fail the whole parse; formalising `coaching` at the root is a
  //    @talchain/schemas ask, tracked in the PR record). The read checks
  //    the formal root key first (should the schema ever declare it),
  //    falls back to the sidecar, maps the wire shape through
  //    mapDraftCoachingFromResponse, and attaches the post-adapter
  //    `draftCoaching` field that applyDraftResult already reads and
  //    commits to the store. Absent/malformed coaching attaches nothing,
  //    so applyDraftResult's existing "new draft clears stale coaching"
  //    semantics are preserved unchanged.
  parsedResponse?: unknown,
): Record<string, unknown> | undefined {
  if (draftGraph == null || typeof draftGraph !== 'object') return undefined

  const graph = draftGraph as Record<string, unknown>
  const responseAnalysisReady = (
    parsedResponse as { analysis_ready?: unknown } | null | undefined
  )?.analysis_ready
  const responseGoalConstraints = (
    parsedResponse as { goal_constraints?: unknown } | null | undefined
  )?.goal_constraints

  // Only attach when the inline object doesn't already carry its own
  // goal_constraints AND the root genuinely has a non-empty array — a
  // straight passthrough, never fabricated. An absent/empty root value is
  // left unattached so applyDraftResult's existing "no constraints on this
  // new draft" clear semantics are preserved unchanged.
  const hasOwnGoalConstraints = Array.isArray(graph.goal_constraints)
  const rootGoalConstraints =
    !hasOwnGoalConstraints && Array.isArray(responseGoalConstraints) && responseGoalConstraints.length > 0
      ? responseGoalConstraints
      : undefined

  const graphWithConstraints = rootGoalConstraints
    ? { ...graph, goal_constraints: rootGoalConstraints }
    : graph

  // Root coaching → post-adapter draftCoaching (see the parameter note
  // above). Attach only when the inline object doesn't already carry its
  // own and the mapping yields a real payload (mapDraftCoachingFromResponse
  // is fail-closed: null for absent/non-object input).
  const rootCoaching =
    (parsedResponse as { coaching?: unknown } | null | undefined)?.coaching ??
    (parsedResponse as OlumiResponseWithExtensions | null | undefined)?.[
      ADDITIVE_EXTENSIONS_KEY
    ]?.['coaching']
  const mappedCoaching =
    graphWithConstraints.draftCoaching == null
      ? mapDraftCoachingFromResponse(rootCoaching)
      : null
  const graphWithCoaching = mappedCoaching
    ? { ...graphWithConstraints, draftCoaching: mappedCoaching }
    : graphWithConstraints

  if (graphWithCoaching.analysis_ready != null) return graphWithCoaching

  const normalised = normaliseAnalysisReady(responseAnalysisReady)
  if (!normalised) return graphWithCoaching

  return {
    ...graphWithCoaching,
    analysis_ready: normalised,
  }
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * ROADMAP 1.42 (Show-reasoning progressive disclosure — verbatim, labelled):
 * `_reasoning` is an unknown top-level key at the pinned schema (0.13.1), so
 * the parser's `splitAdditiveExtensions`/`splitBlocksTolerance` demote it into
 * the non-enumerable `ADDITIVE_EXTENSIONS_KEY` sidecar (responseParser.ts)
 * rather than validating it on the strict OlumiResponse surface. Read it from
 * there. Defensive: only a non-empty string is accepted, and it is capped at
 * REASONING_MAX_CHARS with a disclosed truncation suffix — CEE is a separate
 * service on its own deploy cadence and this field carries no contract yet.
 */
const REASONING_MAX_CHARS = 20000
const REASONING_TRUNCATION_SUFFIX = '\n\n[reasoning truncated]'

function extractReasoningSidecar(response: unknown): string | undefined {
  // 0.15.0 formalises `reasoning` on the strict surface; CEE still emits the
  // legacy `_reasoning` sidecar today. Prefer the formal field, fall back to
  // the sidecar — both verbatim, so the migration can never blank the panel.
  const formal = (response as { reasoning?: unknown })?.reasoning
  const additive = (response as OlumiResponseWithExtensions)?.[ADDITIVE_EXTENSIONS_KEY]
  const raw = typeof formal === 'string' ? formal : additive?.['_reasoning']
  if (typeof raw !== 'string') return undefined
  // Verbatim: only whitespace-only strings are rejected as "empty"; the
  // accepted string itself is never trimmed/altered (Paul's ruling —
  // VERBATIM-with-label — the rendered panel must match CEE byte-for-byte,
  // short of the disclosed truncation below).
  if (raw.trim().length === 0) return undefined
  if (raw.length > REASONING_MAX_CHARS) {
    return raw.slice(0, REASONING_MAX_CHARS) + REASONING_TRUNCATION_SUFFIX
  }
  return raw
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

/**
 * adaptPhase3ReviewCard — lossless mapper from a verbatim CEE Phase 3
 * review_card raw payload (see `extractPhase3FromV5Response.rawBlocks[].raw`)
 * to the UI's typed `ReviewCardBlock` shape.
 *
 * Mapping mirrors the existing wrapped-block path (`adaptCEEBlock` review_card
 * branch above) so the bridge surfaces no different defaults than CEE wrapped
 * blocks would today:
 *   - title    ← raw.title                                          (required)
 *   - body     ← raw.description ?? raw.body ?? raw.summary         (required)
 *                (description/body order matches adaptCEEBlock at the
 *                 useConversation review_card branch; `summary` is the
 *                 v1.3 Phase 3 extension — only consulted when wrapped-path
 *                 fields are both absent.)
 *   - variant  ← tone='challenger'→'alert', tone='facilitator'→'info';
 *                else raw.variant when 'alert'/'info'; else 'info'
 *   - tone     ← passthrough when 'challenger'/'facilitator'
 *   - priority ← passthrough when 'critical'/'high'/'medium'/'low'
 *
 * Returns null when title or body would be empty — the bridge refuses to
 * render an empty card. No fallback copy, no semantic rewriting.
 */
export function adaptPhase3ReviewCard(
  raw: Record<string, unknown>,
): ReviewCardBlock | null {
  const title =
    typeof raw.title === 'string' && raw.title.trim().length > 0
      ? raw.title
      : ''
  if (!title) return null

  // Nullish-coalescing selection — matches the wrapped-block path's
  // `dataObj.description ?? dataObj.body ?? ''` precedence (only falls
  // through on null/undefined, NOT on empty string). The bridge then
  // refuses the card when the selected field is empty, so an empty-string
  // `description` rejects the card rather than silently surfacing a `body`
  // or `summary` that the wrapped path would have suppressed.
  const descriptionField =
    typeof raw.description === 'string' ? raw.description : undefined
  const bodyField = typeof raw.body === 'string' ? raw.body : undefined
  const summaryField = typeof raw.summary === 'string' ? raw.summary : undefined
  const body = descriptionField ?? bodyField ?? summaryField ?? ''
  if (!body) return null

  const tone =
    raw.tone === 'challenger' || raw.tone === 'facilitator'
      ? (raw.tone as 'challenger' | 'facilitator')
      : undefined
  const variantDirect: 'info' | 'alert' | undefined =
    raw.variant === 'alert' ? 'alert' : raw.variant === 'info' ? 'info' : undefined
  const variantFromTone: 'info' | 'alert' | undefined =
    tone === 'challenger' ? 'alert' : tone === 'facilitator' ? 'info' : undefined
  const variant: 'info' | 'alert' = variantFromTone ?? variantDirect ?? 'info'

  const priority =
    raw.priority === 'critical' ||
    raw.priority === 'high' ||
    raw.priority === 'medium' ||
    raw.priority === 'low'
      ? (raw.priority as 'critical' | 'high' | 'medium' | 'low')
      : undefined

  return {
    type: 'review_card',
    title,
    body,
    variant,
    ...(tone ? { tone } : {}),
    ...(priority ? { priority } : {}),
  }
}

/**
 * selectTopPhase3ReviewCard — pick the highest-priority review_card from
 * extractPhase3FromV5Response's verbatim rawBlocks list.
 *
 * Ranking: CEE v1.3 §0 emits an optional `priority_rank: number` on Phase 3
 * blocks where lower values mean higher priority. When at least one candidate
 * carries it, sort ascending by priority_rank; ties and missing values
 * preserve harvest order. No new ranking is invented.
 */
export function selectTopPhase3ReviewCard(
  rawBlocks: readonly Phase3RawBlock[],
): Phase3RawBlock | null {
  const candidates = rawBlocks.filter((b) => b.type === 'review_card')
  if (candidates.length === 0) return null

  const indexed = candidates.map((b, i) => ({
    block: b,
    rank:
      typeof b.raw.priority_rank === 'number' && Number.isFinite(b.raw.priority_rank)
        ? (b.raw.priority_rank as number)
        : Number.POSITIVE_INFINITY,
    order: i,
  }))
  indexed.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return indexed[0]?.block ?? null
}

/**
 * composePhase3BridgedBlocks — composition of the Phase 3 rendering bridge
 * applied at the V5 assistant-turn rendering site (Track C slice 1,
 * approved D-5; provisional_doctrine_v0).
 *
 * Inputs:
 *   - factPresent: whether the current response carries a successful
 *     run_analysis fact (deriveV5AnalysisFactUpdate action === 'set'). Gates
 *     ONLY the legacy review_card fallback below — 0.13.x-typed blocks are
 *     per-turn producer content and render on the turn CEE emitted them
 *     (coaching legitimately arrives on draft turns, which carry no
 *     run_analysis fact).
 *   - phase3RawBlocks: verbatim Phase 3 blocks harvested by
 *     extractPhase3FromV5Response.
 *   - mappedBlocks: V5 schema-strict blocks already produced by mapV5Blocks.
 *
 * Returns the final ordered blocks array for the assistant turn:
 *   [...mappedBlocks,
 *    ...schema-typed coaching/review_card (producer priority_rank asc,
 *       ties by harvest order; deduped by block_id),
 *    ...legacy top-1 review_card fallback when eligible]
 *
 * Typed path (slice 1 + slice 2): raw blocks of type 'coaching' /
 * 'review_card' (slice 1, D-5) and 'evidence' / 'exercise' (slice 2,
 * Lane UI-W4 C) that adapt cleanly against the 0.13.x typed shapes render
 * as first-class v5_* blocks — exactly the typed fields, all copy
 * producer-verbatim. Fail-closed: a malformed block (including a
 * content-less exercise — schema-shaped but with no producer prose) is
 * COUNTED (dropped-content counter, 'malformed_phase3_block_suppressed')
 * and suppressed; it never crashes composition and never renders with
 * invented fields.
 *
 * Ordering: producer priority_rank ascending across all typed blocks.
 * The exercise type carries NO priority_rank per the v1.3 contract (not
 * hero eligible), so exercises take rank +Infinity — after every ranked
 * block, preserving harvest order among themselves (the same missing-rank
 * convention as selectTopPhase3ReviewCard).
 *
 * Legacy fallback (unchanged behaviour): review_card blocks that are NOT
 * 0.13.x-shaped go through the original bridge — factPresent gate, top-1
 * cap by priority_rank, adaptPhase3ReviewCard defaults, dedupe against an
 * existing legacy review_card in mappedBlocks. Legacy cards not surfaced
 * are counted ('legacy_review_card_suppressed').
 */
export function composePhase3BridgedBlocks(
  factPresent: boolean,
  phase3RawBlocks: readonly Phase3RawBlock[],
  mappedBlocks: readonly ConversationBlock[],
): ConversationBlock[] {
  const out: ConversationBlock[] = [...mappedBlocks]

  // ── Typed path: 0.13.x coaching + review_card + evidence + exercise ───
  const typed: Array<{ block: ConversationBlock; rank: number; order: number }> = []
  const legacyReviewCandidates: Phase3RawBlock[] = []
  const seenTypedBlockIds = new Set<string>(
    mappedBlocks.flatMap((b) =>
      (b.type === 'v5_review_card' || b.type === 'v5_coaching' ||
       b.type === 'v5_evidence' || b.type === 'v5_exercise') ? [b.block_id] : [],
    ),
  )
  let order = 0
  for (const rb of phase3RawBlocks) {
    if (rb.type === 'review_card') {
      const adapted = adaptTypedReviewCardBlock(rb.raw)
      if (adapted) {
        if (!seenTypedBlockIds.has(adapted.block_id)) {
          seenTypedBlockIds.add(adapted.block_id)
          typed.push({ block: adapted, rank: adapted.priority_rank, order: order++ })
        }
        continue
      }
      // Not 0.13.x-shaped — hand to the legacy bridge below.
      legacyReviewCandidates.push(rb)
      continue
    }
    if (rb.type === 'coaching') {
      const adapted = adaptTypedCoachingBlock(rb.raw)
      if (adapted) {
        if (!seenTypedBlockIds.has(adapted.block_id)) {
          seenTypedBlockIds.add(adapted.block_id)
          typed.push({ block: adapted, rank: adapted.priority_rank, order: order++ })
        }
        continue
      }
      // Fail-closed: malformed coaching → counted + suppressed, never crash.
      recordDroppedContent({
        blockType: 'coaching',
        source: 'phase3_block_bridge',
        rationale: 'malformed_phase3_block_suppressed',
      })
      continue
    }
    if (rb.type === 'evidence') {
      // Slice 2 (Lane UI-W4 C): evidence renders first-class; carries its
      // producer priority_rank into the shared ordering.
      const adapted = adaptTypedEvidenceBlock(rb.raw)
      if (adapted) {
        if (!seenTypedBlockIds.has(adapted.block_id)) {
          seenTypedBlockIds.add(adapted.block_id)
          typed.push({ block: adapted, rank: adapted.priority_rank, order: order++ })
        }
        continue
      }
      recordDroppedContent({
        blockType: 'evidence',
        source: 'phase3_block_bridge',
        rationale: 'malformed_phase3_block_suppressed',
      })
      continue
    }
    if (rb.type === 'exercise') {
      // Slice 2 (Lane UI-W4 C): exercise renders first-class. The v1.3
      // contract declares NO priority_rank on this type (not hero
      // eligible), so exercises take +Infinity — after every ranked
      // block, harvest order among themselves (the selectTopPhase3
      // missing-rank convention). Content-less blocks fail closed in the
      // adapter and are counted like any other malformed block.
      const adapted = adaptTypedExerciseBlock(rb.raw)
      if (adapted) {
        if (!seenTypedBlockIds.has(adapted.block_id)) {
          seenTypedBlockIds.add(adapted.block_id)
          typed.push({ block: adapted, rank: Number.POSITIVE_INFINITY, order: order++ })
        }
        continue
      }
      recordDroppedContent({
        blockType: 'exercise',
        source: 'phase3_block_bridge',
        rationale: 'malformed_phase3_block_suppressed',
      })
      continue
    }
  }
  // Producer-owned ordering: priority_rank ascending (lower = higher
  // priority, per CEE v1.3 §0); ties preserve harvest order. No new
  // ranking is invented.
  typed.sort((a, b) => a.rank - b.rank || a.order - b.order)
  out.push(...typed.map((t) => t.block))

  // ── Legacy fallback: pre-0.13.x review_card bridge (unchanged rules) ──
  const countLegacySuppressed = (n: number): void => {
    if (n <= 0) return
    recordDroppedContent({
      blockType: 'review_card',
      source: 'phase3_block_bridge',
      rationale: 'legacy_review_card_suppressed',
      count: n,
    })
  }
  if (legacyReviewCandidates.length === 0) return out
  if (!factPresent) {
    countLegacySuppressed(legacyReviewCandidates.length)
    return out
  }
  const topReview = selectTopPhase3ReviewCard(legacyReviewCandidates)
  if (!topReview) {
    countLegacySuppressed(legacyReviewCandidates.length)
    return out
  }
  const adapted = adaptPhase3ReviewCard(topReview.raw)
  if (!adapted || mappedBlocks.some((b) => b.type === 'review_card')) {
    countLegacySuppressed(legacyReviewCandidates.length)
    return out
  }
  countLegacySuppressed(legacyReviewCandidates.length - 1)
  return [...out, adapted]
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
          ...(typeof dataObj.applied_summary === 'string' && dataObj.applied_summary.trim().length > 0
            ? { applied_summary: dataObj.applied_summary }
            : {}),
          operations: normOps as any,
          target_graph_hash: String(dataObj.applied_graph_hash ?? dataObj.target_graph_hash ?? ''),
          status: asOptionalString(dataObj.status),
          auto_apply: dataObj.auto_apply === true,
          ...(patchType ? { patch_type: patchType } : {}),
          actions: Array.isArray(actions) ? actions as any : undefined,
          block_id: typeof block_id === 'string' ? block_id : undefined,
          // CEE places analysis_ready inside applied_graph (not at data top-level) on
          // draft_graph responses. Prefer top-level when present; fall back to
          // applied_graph. Without this fallback, handleEnvelope receives
          // analysis_ready=undefined, synthesises from edge weight+direction (all
          // option→factor edges default to weight 1 / positive), and every option
          // ends up with identical interventions — PLoT then blocks with
          // IDENTICAL_OPTIONS. See debug bundle 523dc15a (2026-04-14).
          analysis_ready: normaliseAnalysisReady(
            dataObj.analysis_ready
            ?? (dataObj.applied_graph as Record<string, unknown> | undefined)?.analysis_ready,
          ),
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
      analysis_ready: normaliseAnalysisReady(
        obj.analysis_ready
        ?? (obj.applied_graph as Record<string, unknown> | undefined)?.analysis_ready,
      ),
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
  // V5 backend handler ID is the PLURAL `explain_results` (see backend
  // `src/orchestrator-v5/handlers/chip-click-dispatch.ts:137-141` whitelist +
  // `src/orchestrator-v5/compose/chip-generator.ts` chip emission, post-
  // Phase-2b). Singular `explain_result` retained as a legacy alias because
  // the chip-generator's `promptChip(...)` used it as a discriminator string
  // for years and existing chip surfaces still emit it; either form must
  // reach the same 'explain' turn type so dispatch is consistent and the
  // deterministic chip-click bypass fires regardless of which alias the
  // chip carries.
  explain_result: 'explain',
  explain_results: 'explain',
  compare_options: 'explain',
  what_would_flip: 'explain',
  // F2 CHANGE B (2026-07-22): the "What changed?" pill is an analytical
  // comparison — same explanation class as what_would_flip / compare_options,
  // so it dispatches as an 'explain' turn (correct timeout class + local
  // handling). The CEE answer is a direct_answer run-over-run delta.
  what_changed: 'explain',
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

/**
 * Structured record of the most recent visible user send that failed
 * (transcript honesty, trust item #3). This fires for EVERY failed visible
 * user send — including the ones no transcript shows — so
 * point-of-failure surfaces with no visible transcript (the first-use hero)
 * can show feedback instead of failing silently. Cleared on the next
 * visible user dispatch, clearHistory, and scenario switch.
 */
export interface SendFailureNotice {
  /**
   * 'transport': no CEE body reached the UI (proxy 504, network throw) —
   *   the turn never produced a server outcome.
   * 'timeout':   the browser's own timer aborted the wait.
   * 'server':    the server received the turn and failed it (typed error /
   *   empty response).
   */
  kind: 'transport' | 'timeout' | 'server'
  /** Whether the retry affordance is being offered for this failure. */
  retryable: boolean
  /** The submitted input text, for restore-into-composer affordances. */
  inputText: string
}

export interface UseConversationReturn {
  messages: ConversationMessage[]
  isThinking: boolean
  longRunningHint: string | null
  /** The user's last input text, restored on error so they can edit and resend */
  /** Most recent visible-user-send failure, all classes. Null when none. */
  lastSendFailure: SendFailureNotice | null
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
  /**
   * T6: User-initiated cancel of the current in-flight turn. Aborts the
   * AbortController, marks the streaming message as `stoppedByUser`, and
   * tears down thinking state. No-op when no turn is active. Stop must NEVER
   * accept, reject, or mutate any patch state.
   */
  cancelTurn: () => void
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
  const [lastSendFailure, setLastSendFailure] = useState<SendFailureNotice | null>(null)
  const [patchBlockStates, setPatchBlockStates] = useState<Map<string, PatchBlockState>>(new Map())
  const [patchRejections, setPatchRejectionsMap] = useState<Map<string, PatchRejectionInfo>>(new Map())

  // Refs for timers, abort, and in-flight lock
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  // Generation counter: each sendTurn invocation captures a token at dispatch;
  // only the run whose token still matches the current generation may clear
  // the lock in its finally/return branches. Prevents an aborted/preempted
  // run from clobbering a newer run's ownership. See the preempt block in
  // sendTurn for the rationale (v5-ui-exclusive-path brief, Phase 8a review).
  const inFlightGenerationRef = useRef(0)
  const longRunningTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval>>()
  const lastUserInputRef = useRef<{ message: string; clientTurnId?: string }>({ message: '' })
  // Transcript honesty (trust item #3): id of the most recent VISIBLE user
  // bubble. Written when the V5 path adds a user bubble; read by the
  // retryLast/skipUserBubble path so a retry re-pends and (on the next
  // outcome) re-marks the ORIGINAL bubble instead of minting a duplicate.
  const lastVisibleUserBubbleIdRef = useRef<string | null>(null)
  // Tracks the client_turn_id of the most-recently-dispatched V5 turn of ANY
  // kind — visible, hidden, or system. Used by applyV5State's stale-turn
  // guard so that hidden and system responses are NOT falsely treated as
  // stale against lastUserInputRef (which only tracks visible user sends).
  // Updated at dispatch time at every sendTurn site; read in the response
  // handler to decide whether the arriving response is the current turn.
  const activeV5TurnIdRef = useRef<string | null>(null)
  // 1.16i: client turn id of the in-flight run_analysis turn, when one is.
  // Set at V5 run dispatch, cleared in that turn's finally. Read by the
  // swallow guard so a run re-click neither preempt-aborts the running
  // analysis nor mints a fresh turn id (which would defeat CEE's coalescing).
  const activeRunTurnIdRef = useRef<string | null>(null)
  // Mirror messages state into a ref so buildRequest always reads the latest
  // committed value — avoids stale closure when addMessage + buildRequest run
  // in the same synchronous block (React batches the state update).
  const messagesRef = useRef<ConversationMessage[]>([])
  // Opaque CEE session state — stored from envelope.updated_session_state,
  // sent back on every turn request as session_state. Never persisted to
  // message history, analytics, or debug bundles. Transient only.
  const sessionStateRef = useRef<Record<string, unknown> | null>(null)

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
            useDraftStore.getState().setIsGenerating(false)
            setLongRunningHint(null)
            setLastSendFailure(null)

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
            useDraftStore.getState().setIsGenerating(false)
            setLongRunningHint(null)
            setLastSendFailure(null)
          } finally {
            // Clear from store to prevent re-hydration (even on error)
            useCanvasStore.setState({ _hydratedThread: null })
          }
          return
        }
      }

      messagesRef.current = []
      sessionStateRef.current = null
      setMessages([])
      setIsThinking(false)
      useDraftStore.getState().setIsGenerating(false)
      setLongRunningHint(null)
      setLastSendFailure(null)
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
      chipMeta?: ChipMeta
    }): TurnRequestPayload => {
      const store = useCanvasStore.getState()
      const { nodeIds, edgeIds } = store.selection
      // Lazy UUID allocation: generate a fresh UUID when store has no scenario_id or a
      // legacy non-UUID format (e.g. "scenario-1709827200000-abc"). Persist to store AND
      // through the localStorage current-scenario writer so the same conversation reuses
      // the same ID across a page refresh / store re-init (scenario/thread continuity).
      let scenarioId = store.currentScenarioId
      if (!scenarioId || !isUUID(scenarioId)) {
        const newId = crypto.randomUUID()
        if (import.meta.env.DEV) {
          console.warn('[buildRequest] Replaced non-UUID scenario_id:', scenarioId, '→', newId)
        }
        scenarioId = newId
        useCanvasStore.setState({ currentScenarioId: scenarioId })
        setCurrentScenarioId(scenarioId)
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

      // Build analysis_inputs from ceeAnalysisReady when a resolved goal is available.
      // goal_node_id comes from ceeAnalysisReady (required field); omit analysis_inputs entirely
      // if goal_node_id is falsy (partial context is worse than none).
      //
      // Options are reconciled with canvas nodes: analysisReady.options are primary, but
      // when an entry has empty/needs_encoding interventions OR a canvas option node has
      // no analysisReady entry at all, we backfill from node.data.interventions. This
      // mirrors the PLoT /v2/run path (useV2Run.ts:334, adapter.ts:1092) so the
      // conversational turn path can never send stale interventions to CEE after
      // add_option / draft_graph / manual canvas edits.
      //
      // Reconcile is gated on ceeReady?.goal_node_id: when no goal exists,
      // analysis_inputs would be omitted anyway, so calling reconcile would
      // (a) waste a per-turn allocation and (b) emit per-option backfill
      // warnings for data that is never actually sent — misleading console
      // noise that suggests "we backfilled then transmitted" when in fact
      // nothing was transmitted at all.
      //
      // NOTE: silent flag intentionally omitted (defaults to false). Unlike the PLoT
      // run path — where useV2Run pre-validates with silent: true and adapter.ts:1092
      // calls reconcile a second time without silent (where the canonical warning
      // fires) — the conversational path calls reconcile exactly once. Suppressing
      // here would mean MISSING_INTERVENTIONS regressions on this path leave no
      // console trace. The per-option backfill warning is the observability hook.
      const ceeReady = store.ceeAnalysisReady
      const reconciledOptions = ceeReady?.goal_node_id
        ? reconcileOptionsWithCanvasNodes(
            ceeReady,
            store.nodes as any,
            new Set(store.nodes.map((n) => n.id)),
            { scenarioId: store.currentScenarioId ?? null, phase: 'turn_request' },
          )
        : []
      const analysisInputs =
        reconciledOptions.length > 0 && ceeReady?.goal_node_id
          ? {
              // PLoT requires option_id; we use CEE option id as the canonical identifier on both fields for now.
              // NOTE: interventions remain in the CEEInterventionV3 nested {value, source, target_match}
              // shape here — CEE expects the nested form on its turn endpoint and only the V2/PLoT
              // request edge (via ceeOptionToV2Option → flattenInterventions) collapses to numbers.
              options: reconciledOptions.map((opt) => ({
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
      // Belt-and-braces freshness gate (2026-04-09). `analysisStateReady` is
      // flipped true only inside `resultsComplete` alongside the atomic write
      // of results.hash + rawV2Response, and back to false on resultsStart /
      // resultsError / resultsCancelled / any graph edit. Guards against the
      // race where a new run is mid-flight (resultsStart preserves the prior
      // hash for continuity) but the user sends a turn before the new
      // snapshot has landed — without this check, buildRequest would ship
      // the prior run's data under the prior hash. See
      // docs/open-issues-root-cause-investigation-2026-04-09.md.
      const analysisIsReady = store.analysisStateReady

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
        graphIsStale || !analysisIsReady ? undefined
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
            // V4 wire requires action_type on chip_metadata; identity-only
            // meta (parameters without action_type) is V5-only.
            chip_metadata: toLegacyChipMetadata(opts.chipMeta),
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
        // V4 wire requires action_type on chip_metadata; identity-only
        // meta (parameters without action_type) is V5-only.
        chip_metadata: toLegacyChipMetadata(opts.chipMeta),
        client_turn_id: opts.clientTurnId,
      })
    },
    [], // messagesRef (stable ref) + useCanvasStore.getState() — no state/prop deps

  )

  const handleEnvelope = useCallback(
    (envelope: OrchestratorResponseEnvelopeV2, requestId?: string) => {
      // Always capture session state, even on silent system events.
      // CEE session-level coaching (chip suppression, play deduplication, convergence
      // detection) depends on this surviving across all turn types.
      if (envelope.updated_session_state !== undefined) {
        sessionStateRef.current = envelope.updated_session_state
      }

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
      //
      // The extracted value is in the CANONICAL WIRE vocabulary
      // (`frame | analyse | decide | review`) and MUST be mapped to the UI/DB
      // `ScenarioStage` lifecycle vocabulary before it reaches the store —
      // `currentStage` is persisted to `scenarios.stage`, whose CHECK
      // constraint admits only `frame | ideate | evaluate | decide | optimise`.
      // This previously wrote the raw wire value straight through (the
      // mis-typed `StageIndicatorWire` hid it from the compiler), so a
      // canonical `analyse` landed as an unrecognised stage: `useStagePill`
      // failed its `isKnownStage` check and silently fell back to local
      // derivation. Mirrors the V5 path in `applyV5State.ts`, which already
      // maps correctly.
      if (envelope.stage_indicator) {
        const raw = envelope.stage_indicator
        const stage = typeof raw === 'string' ? raw : raw.stage
        if (stage) {
          useCanvasStore.getState().setCurrentStage(v5StageToScenarioStage(stage))
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
            // Receipts fail closed (T2): the only real seed for THIS
            // response is the engine echo (meta.seed_used). A fabricated 0
            // and a stale store.results.seed left over from a previous
            // direct run are both provenance lies — no echo → null → the
            // Seed receipt row hides.
            const echoedSeed = result.meta?.seed_used != null
              ? Number.parseInt(String(result.meta.seed_used), 10)
              : Number.NaN
            const seedUsed = Number.isFinite(echoedSeed) ? echoedSeed : null
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

            // Journey step 8 — reload persistence. resultsComplete above only
            // hydrates the IN-SESSION results slice; it does NOT write the
            // scenario row's analysis columns. The standalone Run path persists
            // via persistAnalysisSuccess (useV2Run.ts:997 → storeAnalysis), so a
            // Run-button answer survives a reload — but a conversation-driven
            // analysis (the actual user journey) never reached that call, so
            // loadScenario found analysis_status !== 'ready' on reload and the
            // user's answer was lost while the graph (autosaved on its own
            // subscription) survived. Persist the same V2RunResponse through the
            // same store_analysis_and_log RPC the Run path uses, so the existing
            // hydrateAnalysisFromV2Response → resultsHydrateFromSupabase path
            // restores it on reload — with the honest 'unknown' freshness that
            // path already stamps, never a fabricated 'fresh'
            // (store.resultsHydrateFromSupabase). Seed provenance is the same
            // T2b null-safe echo used for the mapper above — no fabricated 0.
            //
            // Best-effort and fire-and-forget, mirroring the createSnapshot call
            // below and the "always-on normalised persistence" contract
            // (threadService header): the write is gated on a scenario id, and a
            // guest / unauthenticated call fails the RPC's row-level security and
            // is swallowed here rather than surfacing to the user.
            if (store.currentScenarioId) {
              const analysisGraphHash = generateGraphHash(store.nodes, store.edges)
              void storeAnalysis(
                store.currentScenarioId,
                raw,
                analysisGraphHash,
                seedUsed,
                result.response_hash,
                crypto.randomUUID(),
                {
                  option_count: Array.isArray(raw.option_comparison)
                    ? raw.option_comparison.length
                    : 0,
                  analysis_status: raw.analysis_status,
                  source: 'conversation',
                },
                envelope.client_turn_id ?? undefined,
              ).catch((err) => {
                if (import.meta.env.DEV) {
                  console.warn('[handleEnvelope] Supabase analysis persistence failed', err)
                }
              })
            }

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
              useDraftStore.getState().setFullDraftAppliedAt?.(Date.now())
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

        // Apply analysis_ready via shared utility — identical store mutations
        // as the manual-accept path in ConversationPanel.tsx.
        if (resolvedAnalysisReady) {
          applyAnalysisReadyPatch(
            { ceeAnalysisReady: resolvedAnalysisReady },
            { scenarioId: useCanvasStore.getState().currentScenarioId },
          )
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
      chipMeta?: ChipMeta
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

      // 1.16i swallow guard: a run_analysis (re-)click while a run turn is
      // ALREADY in flight is swallowed — no preempt-abort of the running
      // analysis, no fresh turn id, one telemetry event. This is what stops
      // the re-click storm (each old re-click aborted the in-flight request
      // and minted a new client_turn_id, defeating CEE's coalescing). A
      // non-run turn in flight is NOT swallowed — the user may still
      // deliberately preempt a chat turn with a run (pre-existing rule).
      const isRunAnalysisSend =
        !systemEvent && resolveUserTurnType(source, hidden, turnType) === 'run_analysis'
      if (inFlightRef.current && isRunAnalysisSend && activeRunTurnIdRef.current) {
        trackEvent('run_click_swallowed', {
          inflight_turn_id: activeRunTurnIdRef.current,
          source: source ?? 'unknown',
        })
        if (import.meta.env.DEV) {
          console.warn('[sendTurn] Run re-click swallowed — analysis turn already in flight')
        }
        return
      }

      // Synchronous in-flight lock — prevents duplicate dispatch from rapid
      // double-clicks before React re-renders the isThinking state guard.
      //
      // v5-ui-exclusive-path brief: when flag is on AND the new caller is
      // a user-initiated free-text / chip send (not a retry or system
      // event), abort the in-flight V5 request rather than drop the send.
      // Retry/system-event callers still queue (blocked) because they
      // shouldn't preempt a user's active turn.
      //
      // Generation token prevents the aborted run's finally block from
      // clearing the lock while a newer run is executing. Each run
      // captures its own token at dispatch and only clears the lock in
      // its finally if its token still matches the current generation.
      if (inFlightRef.current) {
        const v5FlagOn = import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR === 'true'
        const isUserPreempt =
          v5FlagOn
          && opts.mode === 'user'
          && opts.source !== 'retry'
          && !opts.retryClientTurnId
        if (isUserPreempt) {
          if (import.meta.env.DEV) console.warn('[sendTurn] Preempting in-flight V5 request for new user send')
          abortRef.current?.abort()
          // The aborted turn only clears isThinkingRef in its async finally,
          // which runs AFTER the aborted fetch settles. Clear it synchronously
          // here so this preempting send is not immediately blocked by the
          // isThinking guard below — otherwise the in-flight turn is aborted
          // AND the user's new message is silently dropped, contradicting the
          // preempt design ("abort the in-flight request rather than drop the
          // send"). The aborted run's late finally is ownership-guarded
          // (generation token + active-turn ref) so it cannot clobber this
          // newer turn's lock or analysing state.
          isThinkingRef.current = false
        } else {
          if (import.meta.env.DEV) console.warn('[sendTurn] Blocked by in-flight lock (rapid double-click?)')
          return
        }
      }
      inFlightRef.current = true
      const inFlightGeneration = ++inFlightGenerationRef.current
      // Release the lock only if we still own it (not preempted by a newer
      // run). Used at every V5/V4 return / finally site below.
      const releaseInFlightLockIfOwned = () => {
        if (inFlightGenerationRef.current === inFlightGeneration) {
          inFlightRef.current = false
        }
      }

      // Generate or reuse a stable client_turn_id for idempotent retry
      const pendingContext = consumePendingInteractionContext()
      const turnClientId = retryClientTurnId ?? pendingContext?.chainId ?? crypto.randomUUID()
      // Stamp the V5 active-turn ref at dispatch time for every turn kind
      // (visible, hidden, system). The stale-turn guard in applyV5State
      // reads this ref, not lastUserInputRef, so hidden/system responses
      // are not dropped just because the user did not type.
      activeV5TurnIdRef.current = turnClientId
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

      // -------------------------------------------------------------------
      // V5 exclusive path (v5-ui-exclusive-path brief).
      //
      // When VITE_ENABLE_V5_ORCHESTRATOR === 'true', every turn routes to
      // /orchestrate/v2/turn. There is no fall-through to V4; typed errors
      // surface directly. The V4 block below is reachable ONLY when the flag
      // is off (rollback path).
      //
      // This block owns the full request lifecycle: AbortController, timeout
      // timer, long-running hint, recordUserAction, lastSendFailure. System
      // events never render a user bubble — enforced via
      // `mode === 'system'`, not the incidental `hidden` flag.
      const v5Eligibility = isV5Eligible({
        flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR,
      })
      if (v5Eligibility.eligible) {
        const isSystemEvent = mode === 'system'
        const addUserBubble = !isSystemEvent && !hidden && !skipUserBubble
        const inputForRestore = (mode === 'user' && !hidden) ? message : null

        // Mode-gated preconditions — keep parity with V4 block's guards below.
        if (mode === 'user' && !message.trim()) {
          if (import.meta.env.DEV) console.warn('[sendTurn V5] Blocked: empty message')
          releaseInFlightLockIfOwned(); return
        }
        if (isThinkingRef.current) {
          if (import.meta.env.DEV) console.warn('[sendTurn V5] Blocked: isThinking=true')
          releaseInFlightLockIfOwned(); return
        }

        // Record user action + capture retry input (user mode only, non-hidden).
        if (!hidden && mode === 'user') {
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
          setLastSendFailure(null)
        } else if (hidden && source === 'right_panel_action') {
          recordUserAction({
            actionType: 'clicked run analysis',
            payloadSummary: { raw_message: message },
          })
        }

        // User bubble — HARD RULE: system events never get one, and `hidden`
        // turns skip the bubble too. See docs/v5/ui-outbound-payload-coverage.md.
        //
        // Transcript honesty (trust item #3): the bubble starts
        // deliveryState 'pending' and this turn's outcome resolves it to
        // 'sent' or 'failed' — a send lost to a 504 must not sit in the
        // transcript looking identical to a delivered one. A retryLast
        // re-dispatch (skipUserBubble) re-pends the ORIGINAL bubble so the
        // failed marker clears for the new attempt without a duplicate.
        let userBubbleIdForTurn: string | null = null
        if (addUserBubble) {
          userBubbleIdForTurn = crypto.randomUUID()
          lastVisibleUserBubbleIdRef.current = userBubbleIdForTurn
          addMessage({
            id: userBubbleIdForTurn,
            role: 'user',
            content: displayText ?? message,
            displayContent: displayText,
            submittedPrompt: message,
            timestamp: new Date(),
            deliveryState: 'pending',
            ...(chipInitiated ? { chipInitiated: true } : {}),
          })
        } else if (skipUserBubble && mode === 'user' && !hidden) {
          userBubbleIdForTurn = lastVisibleUserBubbleIdRef.current
          if (userBubbleIdForTurn) {
            updateMessage(userBubbleIdForTurn, { deliveryState: 'pending' })
          }
        }

        // Lazy UUID allocation — mirrors V4 buildRequest above.
        // If the store has no scenario_id or a legacy non-UUID format, generate
        // one client-side and persist it (store + localStorage writer) so subsequent
        // turns — including after a page refresh / re-init — reuse the same ID.
        let currentScenarioId = useCanvasStore.getState().currentScenarioId
        if (!currentScenarioId || !isUUID(currentScenarioId)) {
          const newId = crypto.randomUUID()
          if (import.meta.env.DEV) {
            console.warn('[sendTurn V5] Allocated fresh scenario_id:', newId)
          }
          currentScenarioId = newId
          useCanvasStore.setState({ currentScenarioId: newId })
          setCurrentScenarioId(newId)
        }

        const resolvedTurnType: TurnType = isSystemEvent
          ? 'system_event'
          : resolveUserTurnType(source, hidden, turnType)

        // 1.16i: authoritative analysing state — set synchronously at run
        // dispatch so every isRunning gate (OutputsDock, ConversationPanel)
        // and the visible processing furniture hold for the whole turn.
        // Settled in this turn's finally; a landed analysis_result flips
        // 'complete' via applyV5State before the settle no-ops.
        const isRunAnalysisTurn = resolvedTurnType === 'run_analysis'
        if (isRunAnalysisTurn) {
          useCanvasStore.getState().resultsAnalysing()
          activeRunTurnIdRef.current = turnClientId
        }

        // Derive stage from canvas state (UI-SEM-020 pattern). turn_class
        // stays advisory ('frame') — CEE types.ts notes propose/decide/review
        // are unreachable placeholders and yield UnhandledTurnClassError.
        // Sonnet classifier drives dispatch downstream regardless of the
        // caller-provided turn_class.
        const canvasSnap = useCanvasStore.getState()
        const derivedStage = deriveV5Stage({
          currentStage: canvasSnap.currentStage,
          hasNodes: canvasSnap.nodes.length > 0,
          isAnalysisComplete:
            canvasSnap.results.status === 'complete' || canvasSnap.hasCompletedFirstRun,
        })
        const build = buildV5Payload({
          turnId: turnClientId,
          scenarioId: currentScenarioId,
          stage: derivedStage,
          turnClass: 'frame',
          mode,
          message,
          source,
          chipMeta,
          systemEvent,
        })

        if (!build.ok) {
          // buildV5Payload refused — missing message or unsupported system
          // event. Surface a typed error rather than a malformed request.
          //
          // ⚠ The `mode === 'user'` branch below is currently UNREACHABLE, and
          // a 2026-07-20 review that mapped this as "the exit that sets no
          // failure notice" missed why. buildV5Payload can only fail two ways:
          //   · 'missing_message'          — mode 'user' only, and the guard at
          //     the top of this block (`if (mode === 'user' && !message.trim())`)
          //     already returned, so it never gets here;
          //   · 'unsupported_system_event' — reachable only via
          //     buildSystemEventPayload, i.e. mode === 'system', which fails
          //     this very `mode === 'user'` test.
          // So for a user send this is dead, and adding a failure notice here
          // would be dead code. Left in place as a defensive backstop; if a
          // third refusal reason is ever added for user mode, it MUST raise a
          // SendFailureNotice — the hero has no transcript to show the
          // synthetic bubble below.
          if (mode === 'user' && !hidden) {
            // Nothing was dispatched — the bubble must not read as sent.
            if (userBubbleIdForTurn) {
              updateMessage(userBubbleIdForTurn, { deliveryState: 'failed' })
            }
            const msg = build.reason === 'missing_message'
              ? 'Please enter a message.'
              : "This action isn't supported yet. Try a different approach."
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              synthetic: true,
              content: msg,
              timestamp: new Date(),
            })
          } else if (import.meta.env.DEV) {
            console.warn('[sendTurn V5] Payload build refused:', build.reason, build.detail)
          }
          releaseInFlightLockIfOwned(); return
        }

        // Lifecycle: abort any previous request, set up AbortController,
        // timeout timer, and long-running hint. Mirrors V4 block structure
        // so behaviour is consistent across both paths.
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setIsThinking(true)
        useDraftStore.getState().setIsGenerating(true)

        const hint = inferLoadingHint(message, useCanvasStore.getState().nodes.length, turnType)
        const sendStartTime = Date.now()
        setLongRunningHint(hint)
        longRunningTimerRef.current = setTimeout(() => {
          elapsedIntervalRef.current = setInterval(() => {
            const elapsed = Math.round((Date.now() - sendStartTime) / 1000)
            setLongRunningHint(`${hint.replace(/\u2026$/, '')}... ${elapsed}s`)
          }, 5_000)
        }, LONG_RUNNING_THRESHOLD_MS)

        const dynamicTimeout = getTimeoutMs(resolvedTurnType, triggerSurface, derivedStage)
        timeoutTimerRef.current = setTimeout(() => {
          controller.abort()
          clearTimeout(longRunningTimerRef.current)
          clearInterval(elapsedIntervalRef.current)
          setIsThinking(false)
          useDraftStore.getState().setIsGenerating(false)
          setLongRunningHint(null)
          if (mode === 'user' && !hidden) {
            // Transcript honesty: we stopped waiting — the turn produced no
            // response, so the bubble must not read as delivered.
            if (userBubbleIdForTurn) {
              updateMessage(userBubbleIdForTurn, { deliveryState: 'failed' })
            }
            if (inputForRestore) {
              setLastSendFailure({ kind: 'timeout', retryable: true, inputText: inputForRestore })
            }
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'This is taking longer than expected. We stopped waiting, so your message has not gone through. Nothing you typed was lost. Try again or rephrase your message.',
              synthetic: true,
              actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
              timestamp: new Date(),
            })
          }
        }, dynamicTimeout)

        bindRequestToInteraction(turnClientId, {
          chainId: interactionChainId,
          endpoint: getV5Endpoint(),
          triggerSurface,
          sourceSurface: resolvedSourceSurface,
          initiatedBy: initiatedBy ?? (mode === 'system' ? 'automatic' : 'user'),
          visibleTextSubmitted: hidden ? null : (displayText ?? message),
          submittedText: message,
          payloadShapeSummary: { v5: true, payload_kind: build.payload.kind },
          rightPanelAccidentallySubmittedComposerContent,
          stateBefore: interactionStateBefore,
        })

        const clearLifecycleTimers = () => {
          if (timeoutTimerRef.current !== undefined) {
            clearTimeout(timeoutTimerRef.current)
            timeoutTimerRef.current = undefined
          }
          if (longRunningTimerRef.current !== undefined) {
            clearTimeout(longRunningTimerRef.current)
            longRunningTimerRef.current = undefined
          }
          if (elapsedIntervalRef.current !== undefined) {
            clearInterval(elapsedIntervalRef.current)
            elapsedIntervalRef.current = undefined
          }
          setLongRunningHint(null)
        }

        try {
          // Resolve session identity once — X-User-Id + Authorization Bearer
          // (login 3.4 UI half) and the post-response graph re-fetch auth
          // guard. A single call avoids two getSession() round-trips per turn.
          const v5Identity = await getSessionIdentity()
          const v5UserId = v5Identity.userId
          const v5Headers: Record<string, string> = buildTurnAuthHeaders(v5Identity)
          const v5Result = await callV5Turn(build.payload, { signal: controller.signal, headers: v5Headers })
          clearLifecycleTimers()

          // Race guard: if the controller was aborted while the fetch was in
          // flight (user stop, preempt, or timeout), the timeout handler has
          // already rendered its synthetic bubble. Silently drop the
          // now-stale response to avoid double-rendering.
          if (controller.signal.aborted) {
            if (import.meta.env.DEV) {
              console.warn('[sendTurn V5] Response arrived after abort; discarding')
            }
            return
          }

          const target = routeV5Response(v5Result)

          // Transcript honesty: resolve this turn's user bubble. Any server
          // response (including an empty one) means the send was delivered;
          // only typed_error leaves it failed. Resolved BEFORE rendering so
          // the marker and the outcome message land in the same commit.
          if (userBubbleIdForTurn) {
            updateMessage(userBubbleIdForTurn, {
              deliveryState: target.kind === 'typed_error' ? 'failed' : 'sent',
            })
          }

          if (target.kind === 'text_only' || target.kind === 'blocks') {
            // Apply side-effects (stage, graph_patch mutations) BEFORE the
            // message renders so subsequent React effects (panel data, chat
            // auto-scroll) see consistent canvas state.
            // Stale-turn guard: compare this response's client_turn_id
            // against the id of the most recently dispatched V5 turn of
            // any kind — visible, hidden, or system. activeV5TurnIdRef is
            // stamped at every sendTurn dispatch, unlike lastUserInputRef
            // which only tracks visible user sends (hidden/system turns
            // would otherwise be falsely dropped). When a newer turn fires
            // between request and response, this response is stale and
            // must not regress V5 state. See applyV5State's top-of-
            // function invariant.
            // The full canvas store already satisfies the legacy V5ApplicatorStore
            // surface (stage, graph_patch, runMeta, ceeAnalysisReady). Step 5
            // (results hydration, 2026-05-12) reads `currentResultsHash` for
            // dedupe — the store carries that value at `results.hash`, not at
            // the top level, so we splice it in here rather than widening the
            // store shape upstream.
            const v5StoreSnapshot = useCanvasStore.getState()
            const stateApply = applyV5State(
              target.response,
              {
                ...v5StoreSnapshot,
                currentResultsHash: v5StoreSnapshot.results?.hash ?? null,
                // ROADMAP 1.22: wire the shared backfill helper (writes via
                // a direct store.setState, not updateNode — see the
                // V5ApplicatorStore.backfillGoalThreshold doc comment for
                // why: updateNode's analytical-field-change guard would
                // otherwise treat CEE echoing its own just-received
                // threshold back as a user edit and invalidate the fresh
                // analysis this same turn just set).
                backfillGoalThreshold: backfillGoalThresholdOntoGoalNode,
              },
              {
                turnClientId,
                currentClientTurnId: activeV5TurnIdRef.current,
              },
            )
            if (import.meta.env.DEV) {
              if (stateApply.applied.length > 0) {
                console.warn('[sendTurn V5] state applied:', stateApply.applied)
              }
              if (stateApply.deferred.length > 0) {
                console.warn('[sendTurn V5] state deferred:', stateApply.deferred)
              }
            }

            // Phase 3 extraction (v5-canonical-analysis brief).
            //
            // The extractor reads from three locations — the additive sidecar
            // attached by responseParser, `analysis_ready` passthrough, and
            // each `analysis_result` block's enrichment. Raw blocks are
            // preserved verbatim so consumers can read freshness,
            // action_intent, priority_rank, target_refs, and
            // graph_hash_at_generation directly.
            //
            // Per correction 4: this code does NOT clear v5AnalysisFact or
            // guidanceItems on responses that lack Phase 3 content. Stale
            // data is cleared only on explicit no-analysis / orphan / reset
            // states (scenario switch in store.ts; orphan classification
            // computed by useAnalysisStateSource).
            //
            // Per correction 3 (as amended by F10): the v5AnalysisFact slice
            // is only written when the response carries real run signals —
            // explicit has_run_analysis_fact=true, OR an analysis_result
            // block regardless of the freshness verdict (a stale-verdict run
            // still RAN; "ran" and "current" are different questions).
            // Generic readiness is never a substitute. The whole decision —
            // set (with the COMPOSED hasRunAnalysisFact, never CEE's raw
            // nullable flag) / clear / retain — lives in
            // deriveV5AnalysisFactUpdate so the mint→classify seam is pinned
            // against the production path.
            const phase3 = extractPhase3FromV5Response(target.response)
            const factUpdate = deriveV5AnalysisFactUpdate(target.response, phase3)
            const factPresent = factUpdate.action === 'set'
            if (factUpdate.action === 'set') {
              const analysisHash = useCanvasStore.getState().results?.hash ?? null
              useCanvasStore.getState().setV5AnalysisFact({
                scenarioId: useCanvasStore.getState().currentScenarioId,
                analysisHash,
                hasRunAnalysisFact: factUpdate.hasRunAnalysisFact,
                freshness: factUpdate.freshness,
                freshnessReason: factUpdate.freshnessReason,
                rawBlocks: factUpdate.rawBlocks.map((b) => ({
                  type: b.type,
                  raw: b.raw,
                  id: b.id,
                  source: b.source,
                })),
                writtenAt: Date.now(),
              })
            } else if (factUpdate.action === 'clear') {
              // CEE explicitly says "no successful run_analysis fact" — this
              // is a legitimate clear (not a blind one). Drop the slice.
              useCanvasStore.getState().setV5AnalysisFact(null)
            }
            // else ('retain'): response carries no signal either way — leave
            // the existing fact slice untouched. Conversational turns must
            // not wipe a prior analysis fact.

            // Populate GuidanceStore from derived Phase 3 items ONLY when
            // the response carries them. Empty Phase 3 on a conversational
            // turn is NOT a signal to clear — that would race against the
            // V4 envelope path's guidance writes and erase legitimate
            // coaching from a prior turn.
            if (phase3.guidanceItems.length > 0) {
              const guidance: GuidanceItem[] = phase3.guidanceItems.map((g) => ({
                item_id: g.item_id,
                signal_code: g.signal_code,
                category: g.category,
                source: g.source,
                title: g.title,
                ...(g.detail ? { detail: g.detail } : {}),
                primary_action: g.primary_action,
                ...(g.target_object ? { target_object: g.target_object } : {}),
                ...(g.related_elements ? { related_elements: g.related_elements } : {}),
                ...(g.valid_while ? { valid_while: g.valid_while } : {}),
                priority: g.priority,
                // UI-SEM-085 (narrowed): carry the producer's verbatim rank
                // and the priority-provenance fact through unchanged — never
                // recomputed, never inverted here.
                ...(typeof g.priorityRank === 'number' ? { priorityRank: g.priorityRank } : {}),
                priorityIsProducerSupplied: g.priorityIsProducerSupplied,
              }))
              useGuidanceStore.getState().setGuidanceItems(guidance)
            }

            // Primary path: inline graph in response.draft_graph (CEE v0.8.0+).
            // Gated on canvas-empty + scenario-match only — NOT on stage bookkeeping.
            // This ensures draft_graph is applied even if applyV5State didn't emit
            // 'stage:analyse' (e.g. stage was already at analyse, or stage tracking
            // diverged). Works in guest mode — no auth required.
            const canvasIsEmpty = useCanvasStore.getState().nodes.length === 0
            const scenarioIdAtDispatch = currentScenarioId
            // The helper reads analysis_ready, the response-root
            // goal_constraints (ROADMAP 1.22 residual) and the sidecar-borne
            // root `coaching` (Leg 3) off the full parsed response
            // internally — see its doc comment. Seam pinned by
            // draftBiasSignalBlocks.seam.spec.ts — keep the spec's driveSeam
            // wiring in step with this call.
            const inlineGraph = attachAnalysisReadyToInlineDraftGraph(
              target.response.draft_graph,
              target.response,
            )
            const inlineNodeCount = (inlineGraph?.nodes as unknown[] | undefined)?.length ?? 0

            // F1 PR B: track whether THIS turn applied a fresh inline draft graph.
            // Used below to construct the post-draft model_receipt card exactly
            // once — later conversational turns leave the canvas non-empty, so
            // this branch does not re-run and no second receipt is emitted.
            let draftAppliedThisTurn = false
            if (inlineGraph && inlineNodeCount > 0 && canvasIsEmpty) {
              if (useCanvasStore.getState().currentScenarioId === scenarioIdAtDispatch) {
                applyDraftResult(inlineGraph as any)
                draftAppliedThisTurn = true
                if (import.meta.env.DEV) {
                  console.log('[sendTurn V5] graph applied from inline response:', inlineNodeCount, 'nodes')
                }
              }
            } else if (inlineGraph && inlineNodeCount > 0 && !canvasIsEmpty) {
              // POC Lane C (edit-journey display closure): applied-edit
              // receipt ingestion. CEE #414/#424 attach the FULL committed
              // post-mutation graph to applied-edit receipts via the same
              // top-level draft_graph field, post-commit only. The V5 payload
              // carries NO graph_state (buildPayload.ts — CEE's
              // extensions.graphState is null on every V5 turn), so what
              // keeps a fresh-draft draft_graph away from a non-empty canvas
              // is CEE's continuation guard (route-v2 isDraftGraphShape
              // requires no prior committed turns on the scenario) — plus the
              // client-side zero-overlap guard inside reconcileAppliedGraph
              // for the residual misfire (fresh scenario_id + populated canvas
              // + first brief-shaped message).
              //
              // B2 (Codex deep review, 2026-07-18): this reconcile is ATOMIC —
              // adds, UPDATES and deletions. It used to be additive-only, on
              // the stated belief that "value updates arrive separately as
              // graph_patch blocks". That belief was FALSE for the edit_graph
              // path: a successful edit returns `blocks: []`
              // (edit-graph-dispatch.ts:832-833) and the receipt's draft_graph
              // is the entire committed post-state. So a confirmed "set Spend
              // to 250" left the canvas on 100, and the debounced autosave
              // then wrote that 100 back over CEE's committed 250. Layout
              // stays canvas-owned throughout — CEE's node schema has no
              // position field. See reconcileAppliedGraph's header.
              if (useCanvasStore.getState().currentScenarioId === scenarioIdAtDispatch) {
                const merged = reconcileAppliedGraph(inlineGraph as any)
                if (
                  import.meta.env.DEV &&
                  (merged.addedNodeCount > 0 ||
                    merged.addedEdgeCount > 0 ||
                    merged.updatedNodeCount > 0 ||
                    merged.updatedEdgeCount > 0 ||
                    merged.removedNodeCount > 0 ||
                    merged.removedEdgeCount > 0)
                ) {
                  console.log(
                    '[sendTurn V5] applied-edit receipt reconciled into canvas:',
                    `+${merged.addedNodeCount}n/+${merged.addedEdgeCount}e`,
                    `~${merged.updatedNodeCount}n/~${merged.updatedEdgeCount}e`,
                    `-${merged.removedNodeCount}n/-${merged.removedEdgeCount}e`,
                  )
                }
              }
            } else if (!inlineGraph && stateApply.applied.includes('stage:analyse') && canvasIsEmpty) {
              // Fallback path: draft_graph absent → re-fetch from Supabase.
              // Still gated on stage:analyse because without an inline graph, that
              // transition is the only signal that a graph was produced. Requires auth.
              // Fire-and-forget: do not await so message renders immediately.
              ;(async () => {
                try {
                  if (!v5UserId) {
                    if (import.meta.env.DEV) {
                      console.warn('[sendTurn V5] graph re-fetch skipped: no auth session (guest mode)')
                    }
                    return
                  }
                  const row = await loadScenarioFromDb(scenarioIdAtDispatch)
                  if (!row?.graph) {
                    if (import.meta.env.DEV) {
                      console.warn('[sendTurn V5] graph re-fetch: no graph in DB yet for scenario', scenarioIdAtDispatch)
                    }
                    return
                  }
                  // Staleness guard: user may have switched scenarios while the
                  // DB fetch was in-flight. Discard if the active scenario changed.
                  if (useCanvasStore.getState().currentScenarioId !== scenarioIdAtDispatch) {
                    if (import.meta.env.DEV) {
                      console.warn('[sendTurn V5] graph re-fetch: scenario changed during fetch, discarding')
                    }
                    return
                  }
                  const graphData = row.graph as any
                  const nodeCount = (graphData?.nodes as unknown[])?.length ?? 0
                  if (nodeCount === 0) {
                    if (import.meta.env.DEV) {
                      console.warn('[sendTurn V5] graph re-fetch: empty graph returned from DB')
                    }
                    return
                  }
                  applyDraftResult(graphData as any)
                  if (import.meta.env.DEV) {
                    console.log('[sendTurn V5] graph applied from DB fallback:', nodeCount, 'nodes')
                  }
                } catch (err) {
                  if (import.meta.env.DEV) {
                    console.warn('[sendTurn V5] graph re-fetch failed:', err)
                  }
                }
              })()
            }

            const mappedBlocks =
              target.kind === 'blocks'
                // Pass suggested_actions so the held-proposal mapper (R8) can
                // resolve confirm_action_id / decline_action_id refs into the
                // {label, message} the card dispatches through the chip seam.
                ? mapV5Blocks(target.response.blocks, target.response.suggested_actions)
                : []

            // Phase 3 rendering bridge (Track C slice 1, D-5) — surface
            // CEE-produced 0.13.x coaching + review_card blocks as typed
            // conversation blocks (producer copy verbatim), with the legacy
            // top-1 review_card fallback for pre-0.13.x shapes. Malformed /
            // renderer-less blocks are counted + suppressed (fail-closed).
            // Full rules documented on composePhase3BridgedBlocks above.
            const finalBlocks = composePhase3BridgedBlocks(
              factPresent,
              phase3.rawBlocks,
              mappedBlocks,
            )

            // F1 PR B: append the client-synthesised pre-analysis model receipt
            // on the turn that applied a fresh draft graph, after applyDraftResult
            // committed nodes/edges + ceeAnalysisReady (incl coaching_summary) to
            // the store synchronously above. Gated on the flag + a non-empty
            // coaching summary; the block is local-only (no CEE/wire/parser change).
            const receipt = maybeBuildModelReceiptBlock({
              enabled: isPreAnalysisEnrichedEnabled(),
              isDraftTurn: draftAppliedThisTurn,
              store: useCanvasStore.getState(),
            })

            // Leg 3 (bias coaching, BIAS-COACHING-PROPOSAL-2026-07-16 §2
            // FRAME beat): bridge the draft response's coaching.bias_signals
            // into ≤2 typed v5_coaching blocks with coaching_kind
            // 'bias_signal'. The coaching arrives at the response ROOT
            // (demoted to the __additive__ sidecar at the pinned 0.15.0
            // schema); attachAnalysisReadyToInlineDraftGraph maps it onto
            // the inline graph as `draftCoaching`, and applyDraftResult
            // committed it to the store synchronously above — on any other
            // path (no fresh draft applied) the store slice is stale, which
            // is why the isDraftTurn gate below is load-bearing. Same gate
            // pattern as the model receipt: fires only on the turn that
            // applied a fresh draft graph. Fail-closed throughout
            // (absent/empty/unknown/malformed/ungrounded entries render
            // nothing); producer-typed bias coaching in finalBlocks
            // suppresses the bridge entirely. Seam pinned end to end by
            // draftBiasSignalBlocks.seam.spec.ts.
            const biasSignalBlocks = buildDraftBiasSignalBlocks({
              isDraftTurn: draftAppliedThisTurn,
              store: useCanvasStore.getState(),
              existingBlocks: finalBlocks,
            })
            const renderBlocks = [
              ...finalBlocks,
              ...(receipt ? [receipt] : []),
              ...biasSignalBlocks,
            ]

            // V5 suggested_actions → ActionChip. CEE caps count server-side;
            // UI additionally caps rendering at 3 in SuggestedChips (ruled
            // doctrine D-K, closed 15 Jul: 0-3 chips, no fabricated filler).
            // action_type when present drives deterministic routing on next click.
            const actionChips: ActionChip[] = target.response.suggested_actions.map((a) => ({
              id: a.id,
              label: a.label,
              intent: 'primary',
              message: a.message,
              ...(a.action_type ? { action_type: a.action_type } : {}),
            }))
            // ROADMAP 1.42 (Show-reasoning progressive disclosure — verbatim,
            // labelled): CEE MAY carry a top-level `_reasoning` string. At the
            // pinned schema (0.13.1) this unknown key is auto-demoted by the
            // parser's additive-extensions sidecar (responseParser.ts) rather
            // than validated — read it from there, never from the strict
            // OlumiResponse surface. Sporadic field: accept only a non-empty
            // string, defensively length-capped. NEVER merged into `content`
            // (that feeds extractFromRawJson/truncation) — attached as its own
            // field, rendered separately, verbatim.
            const reasoning = isReasoningDisclosureEnabled()
              ? extractReasoningSidecar(target.response)
              : undefined
            // F1 (Paul's #1, answer-shape progressive disclosure): CEE ships an
            // answer-shape sidecar (confirmed: top-level `_answer_shape` on the
            // V5 body, { headline, bullets, detail }) UNCONDITIONALLY (no UI
            // flag). The parser demotes that top-level key into
            // target.response[__additive__] exactly like `_reasoning`;
            // extractAnswerShapeSidecar reads it there and fail-closes to null
            // on absent/malformed, so the bubble renders `content` as today
            // until the sidecar lands on the wire, then auto-lights-up. NEVER
            // merged into `content` (attached as its own field, rendered by
            // AnswerBody). See answerShape.ts for the full contract note.
            const answerShape = extractAnswerShapeSidecar(target.response)
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: target.response.assistant_text,
              ...(renderBlocks.length > 0 ? { blocks: renderBlocks } : {}),
              ...(actionChips.length > 0 ? { actionChips } : {}),
              ...(reasoning ? { reasoning } : {}),
              ...(answerShape ? { answerShape } : {}),
              timestamp: new Date(),
            })
          } else if (target.kind === 'empty') {
            // Blank-response guard: no text, no blocks, no chips from CEE.
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              synthetic: true,
              content: "I received your message but couldn't generate a response. Try rephrasing.",
              actionChips: (mode === 'user' && !hidden)
                ? [{ id: 'retry', label: 'Try again', intent: 'primary' }]
                : [],
              timestamp: new Date(),
            })
            if (inputForRestore) {
              // Delivered but produced nothing — the hero must still show
              // feedback rather than fail silently (server class).
              setLastSendFailure({ kind: 'server', retryable: true, inputText: inputForRestore })
            }
          } else {
            // Typed error — the LIVE V5 error surface (Codex F6 fix; #383's
            // recovery rendering was wired only to the dead V4 handleEnvelope
            // path, which this branch's `return` makes unreachable).
            //
            // Authority order: the server's `retryable` marker on the error
            // envelope is authoritative (BoundaryError.retryable is typed +
            // required; CEE computes it per-failure, so INTERNAL_ERROR is NOT
            // uniformly retryable). The client table covers only its absence
            // (200-response error blocks / parse errors carry no envelope).
            if (target.boundaryError) {
              checkRetryableAgreement(target.boundaryError)
            }
            // extractCeeRecovery reads the typed 0.19.0 recovery shapes:
            // nested `details.recovery` ({ hints, suggestion }) on the live
            // BoundaryError wire, flat `recovery_suggestion` on
            // CeeTypedError-shaped bodies (via rawBody), plus the server
            // retryable marker. Fail closed on every field.
            const recovery = extractCeeRecovery(target.boundaryError ?? target.rawBody)
            const retryable = resolveV5Retryable(target.code, recovery.retryable)
            // Transcript honesty (trust item #3): the rehearsal's 504s carry
            // NO CEE body — the proxy timeout JSON is not a server-processing
            // fault, and "Something went wrong on our side" was a false
            // claim for that class. A parse_error-originated target with
            // zero CEE signal renders transport-honest copy instead, and
            // never invents a recovery suggestion.
            const transportFailure = isTransportFailure({
              hasBoundaryError: target.boundaryError !== undefined,
              transportMeta: target.transportMeta,
              recovery,
              rawBody: target.rawBody,
            })
            let content: string
            if (transportFailure && target.transportMeta) {
              content = buildTransportFailureCopy(target.transportMeta, retryable)
            } else {
              // CEE-class — layered content, each layer display-honest:
              //   1. canonical taxonomy text, stripped of retry instructions
              //      when the retry affordance is withheld;
              //   2. the CEE recovery suggestion (specific what-to-do) when
              //      present; otherwise the wire reason ONLY when it reads as
              //      prose — machine reasons (draft_graph_cee_timeout) never
              //      render to users;
              //   3. recovery hints as bullets;
              //   4. generic code-keyed guidance only when no specific
              //      suggestion filled the what-next slot (non-retryable codes
              //      only — the Try again chip serves that role otherwise).
              const baseCopy = resolveFailureBaseCopy(target.code, retryable)
              const reason = extractV5ErrorReason(target.boundaryError)
              const reasonLayer =
                recovery.suggestion === undefined && isDisplaySafeReason(reason) ? reason : ''
              const guidance =
                recovery.suggestion === undefined ? resolveV5ErrorGuidance(target.code) : ''
              content = [
                baseCopy,
                recovery.suggestion ?? '',
                reasonLayer,
                formatRecoveryHints(recovery.hints),
                guidance,
              ]
                .filter((s) => s.length > 0)
                .join('\n\n')
            }
            const retryChips: ActionChip[] = retryable && mode === 'user' && !hidden
              ? [{ id: 'retry', label: 'Try again', intent: 'primary' }]
              : []
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              synthetic: true,
              content,
              actionChips: retryChips,
              timestamp: new Date(),
            })
            if (inputForRestore) {
              setLastSendFailure({
                kind: transportFailure ? 'transport' : 'server',
                retryable,
                inputText: inputForRestore,
              })
            }
          }
        } catch (err) {
          clearLifecycleTimers()
          const isAbort = (err as Error).name === 'AbortError'
          // Timeout-triggered aborts render their own bubble (above). User
          // stops and concurrent cancellations are silent by design.
          if (!isAbort && mode === 'user' && !hidden) {
            // Transcript honesty: the dispatch itself threw — nothing
            // reached the server, so the bubble must not read as sent.
            if (userBubbleIdForTurn) {
              updateMessage(userBubbleIdForTurn, { deliveryState: 'failed' })
            }
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              synthetic: true,
              content: "Your message didn't reach the server, so it has not been added to the conversation. Nothing you typed was lost. Try again.",
              actionChips: [{ id: 'retry', label: 'Try again', intent: 'primary' }],
              timestamp: new Date(),
            })
            if (inputForRestore) {
              setLastSendFailure({ kind: 'transport', retryable: true, inputText: inputForRestore })
            }
          }
          if (import.meta.env.DEV && !isAbort) {
            console.warn('[sendTurn V5] Dispatch error:', err)
          }
        } finally {
          setIsThinking(false)
          useDraftStore.getState().setIsGenerating(false)
          releaseInFlightLockIfOwned()
          // 1.16i: every-exit settle for the analysing state (success
          // without an analysis_result, typed error, thrown error, abort,
          // timeout). No-ops when applyV5State already flipped 'complete'.
          // OWNERSHIP GUARD: settle only while this turn still owns the run
          // slot — a preempt-aborted run's late finally must never settle a
          // NEWER run turn's 'preparing' (that run manages its own exit).
          if (isRunAnalysisTurn && activeRunTurnIdRef.current === turnClientId) {
            activeRunTurnIdRef.current = null
            useCanvasStore.getState().resultsSettle()
          }
        }
        return
      }
      // -------------------------------------------------------------------
      // V4 path below — reachable ONLY when VITE_ENABLE_V5_ORCHESTRATOR !== 'true'.

      if (mode === 'user') {
        if (!message.trim() || isThinkingRef.current) {
          if (import.meta.env.DEV) console.warn('[sendTurn] Blocked:', !message.trim() ? 'empty message' : 'isThinking=true')
          releaseInFlightLockIfOwned(); return
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
          setLastSendFailure(null)

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
          releaseInFlightLockIfOwned(); return
        }
      }

      // Start thinking state
      setIsThinking(true)
      useDraftStore.getState().setIsGenerating(true)

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

      timeoutTimerRef.current = setTimeout(() => {
        controller.abort()
        clearTimeout(longRunningTimerRef.current)
        clearInterval(elapsedIntervalRef.current)
        setIsThinking(false)
        useDraftStore.getState().setIsGenerating(false)
        setLongRunningHint(null)
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
        // Inject opaque CEE session state into every turn request.
        if (sessionStateRef.current != null) {
          ;(request as Record<string, unknown>).session_state = sessionStateRef.current
        }
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

          // Tranche 1 hotfix item 6: the 3-second "Thinking…" toolLoadingState
          // timer was removed from this location. The composer Send→Stop swap
          // (driven by isThinking) is the canonical in-flight signal; duplicate
          // card-level text produced a confusing dual indicator. Tool-specific
          // labels ("Running simulations…") and CEE `progress` event messages
          // continue to flow through toolLoadingState — those carry useful
          // information and stay.
          //
          // DO NOT reintroduce a generic "Thinking…" sentinel here. Removal
          // condition for changing this decision: (a) user research confirms a
          // card-level indicator is needed in addition to the composer stop
          // button, AND (b) the indicator is distinguishable from tool-specific
          // labels (e.g. uses a dedicated UI surface, not the toolLoadingState
          // field). Until both hold, this path emits no placeholder.
          // See docs/ui/ai-panel-tranche-1-hotfix-implementation.md §Item 6.

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

          // A1 brief item 2 — failure recovery on screen. A non-2xx CEE turn
          // throws OrchestratorError carrying the CEE error envelope in
          // `err.body`. Read its retryable marker + specific recovery
          // suggestion (see ./ceeRecovery for wire provenance + the schema
          // ask) so we (a) surface the suggestion alongside the generic copy
          // and (b) hide "Try again" when the failure is explicitly
          // non-retryable — a retry that cannot work. The base copy is built
          // *from* that same retry decision, so we never tell the user to try
          // again while withholding the control. Fail open: absent suggestion →
          // generic copy; absent marker → keep retry + today's copy.
          const { content: errorMessage, showRetry } = buildFailureRender(
            (canRetry) => buildErrorMessage(err, { canRetry }),
            err,
          )
          const retryChips: ActionChip[] = showRetry
            ? [{ id: 'retry', label: 'Try again', intent: 'primary' as const }]
            : []

          // If the streaming path pre-created a message, reuse it instead
          // of creating a duplicate.
          if (streamingMsgIdRef.current) {
            updateMessage(streamingMsgIdRef.current, {
              content: errorMessage,
              isStreaming: false,
              isProvisional: false,
              toolLoadingState: null,
              synthetic: true,
              actionChips: retryChips,
            })
            streamingMsgIdRef.current = null
          } else {
            addMessage({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: errorMessage,
              synthetic: true,
              actionChips: retryChips,
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
        useDraftStore.getState().setIsGenerating(false)
        setLongRunningHint(null)
        releaseInFlightLockIfOwned()
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

      // Chip metadata construction lives in the pure chipMeta module (the
      // seam the spark/node-chip intent contract specs exercise). It travels
      // whenever EITHER field is present — see buildChipMeta's doc: identity
      // parameters (chip_id / spark_id) must reach the wire even when no
      // honest action_type exists (A1 meta-decision diagnosis, 2026-07-20).
      const chipMeta = buildChipMeta(opts)

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
    sessionStateRef.current = null
    setMessages([])
    setIsThinking(false)
    useDraftStore.getState().setIsGenerating(false)
    setLongRunningHint(null)
    setLastSendFailure(null)
    setPatchBlockStates(new Map())
    setPatchRejectionsMap(new Map())
    abortRef.current?.abort()
    clearTimeout(longRunningTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
  }, [])

  /**
   * T6: User-initiated cancel of the current turn. Aborts the inflight
   * AbortController, marks the streaming message as `stoppedByUser` so the UI
   * can show a "Response stopped." indicator, and tears down the timers and
   * thinking state.
   *
   * CRITICAL (N8): after updating the message, this function calls
   * `cleanupStreamRefs()` to clear `streamingMsgIdRef` BEFORE the abort
   * throws. The sendTurn finally block has a "stuck stream recovery" branch
   * that, if the ref is still set, overwrites the message content with
   * "The response was interrupted." and attaches a "Try again" chip. For a
   * user-initiated stop that's wrong on both counts — the user chose to
   * stop, so (a) we must preserve the partial content they saw, and (b)
   * "Try again" is misleading. Clearing the ref short-circuits that branch.
   *
   * No-ops when no turn is active. Does NOT touch any patch state — Stop only
   * stops the response stream; it never accepts, rejects, or mutates a patch.
   */
  const cancelTurn = useCallback(() => {
    // Idempotent guard (F). We intentionally check isThinkingRef (mirror of
    // isThinking state) and NOT abortRef, because abortRef remains set across
    // turns — after the first turn ends, abortRef.current stays non-null.
    // Using it as a gate would fail to short-circuit stale clicks. The UI
    // only renders the Stop button when isThinking is true, so this is a
    // defence-in-depth check against programmatic callers.
    if (!isThinkingRef.current) return

    // Sync the ref IMMEDIATELY so a second synchronous cancelTurn call (e.g.
    // double-click) observes the updated value and bails (G). setIsThinking(false)
    // only updates the mirror ref on the next commit phase via its useEffect.
    isThinkingRef.current = false

    // Mark the in-flight streaming message FIRST so any chunk handlers that
    // race against the abort observe stoppedByUser === true and preserve it.
    // The shallow merge in updateMessage leaves stoppedByUser set even if
    // subsequent patches don't include it, so late chunks cannot clear it.
    const stoppedMsgId = streamingMsgIdRef.current
    if (stoppedMsgId) {
      updateMessage(stoppedMsgId, {
        stoppedByUser: true,
        isStreaming: false,
        isProvisional: false,
        toolLoadingState: null,
      })
    }

    // N8: clear stream refs BEFORE aborting so the finally block's
    // stuck-stream recovery branch sees `streamingMsgIdRef.current === null`
    // and leaves our stopped-message state intact.
    cleanupStreamRefs()

    abortRef.current?.abort()
    clearTimeout(longRunningTimerRef.current)
    clearTimeout(timeoutTimerRef.current)
    clearInterval(elapsedIntervalRef.current)
    setIsThinking(false)
    useDraftStore.getState().setIsGenerating(false)
    setLongRunningHint(null)
  }, [updateMessage, cleanupStreamRefs])

  return {
    messages,
    isThinking,
    longRunningHint,
    lastSendFailure,
    sendMessage,
    sendSystemEvent,
    sendChip,
    dispatchAction,
    clearHistory,
    retryLast,
    cancelTurn,
    patchBlockStates,
    setPatchBlockState,
    patchRejections,
    setPatchRejection,
  }
}
