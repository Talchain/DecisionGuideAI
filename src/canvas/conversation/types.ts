/**
 * A.5+ Conversation Panel — Type Definitions
 *
 * Defines all types for the orchestrator-backed conversation surface:
 * messages, blocks, chips, turn requests/responses, and system events.
 */

import type { ScenarioStage } from '../../types/scenario'
import type { CEEAnalysisReady, CEEGoalConstraint, CEEInterventionV3 } from '../../adapters/cee/types'

// ---------------------------------------------------------------------------
// § 1 — Conversation messages
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  blocks?: ConversationBlock[]
  actionChips?: ActionChip[]
  timestamp: Date
  /** Echoed from request for deduplication */
  clientTurnId?: string
  /** Whether this is a synthetic UI-only message (e.g. welcome, error) */
  synthetic?: boolean
  /** Track 3: Session boundary divider text (rendered as centred divider, not a chat bubble) */
  sessionDivider?: string
  /** Visible text in conversation bubble (may differ from submittedPrompt for chip-originated turns) */
  displayContent?: string
  /** Actual prompt sent to orchestrator (stored for retry). Absent on assistant messages. */
  submittedPrompt?: string
  /** Track 3: Thread hydration metadata (present only on messages hydrated from persisted thread) */
  _threadMeta?: {
    entryId: string
    origin: string
    entryStatus: string
    redactionState: string
  }
  /** True while the message is being progressively streamed (text_delta events arriving) */
  isStreaming?: boolean
  /** True during tool-backed turns until turn_complete — pre-tool prose may change */
  isProvisional?: boolean
  /** Inline status text shown during tool execution (e.g. "Running simulations...") */
  toolLoadingState?: string | null
  /** Deterministic CEE insights — rendered between assistant_text and chips */
  insights?: Insight[]
  /** Base rate elicitation chips derived from MISSING_BASE_RATE guidance items.
   *  Ephemeral — consumed on click, never persisted in conversation history. */
  baseRateChips?: BaseRateChipSet
  /** When true, this user message was initiated by a pill/chip click.
   *  Renders as a compact action indicator instead of a full user bubble. */
  chipInitiated?: boolean
  /**
   * T6 (Stop button): set on the streaming assistant message when the user
   * clicks Stop and the AbortController fires. Once set, the indicator must
   * persist — late chunks arriving after abort MUST NOT clear it.
   */
  stoppedByUser?: boolean
  /**
   * ROADMAP 1.42 (Show-reasoning progressive disclosure — verbatim, labelled):
   * CEE's `_reasoning` additive-extension sidecar field, verbatim plain text.
   * Only populated when VITE_FEATURE_REASONING_DISCLOSURE is on and the field
   * is a non-empty string (length-capped, see useConversation). Never fed into
   * `content` — rendered separately, unprocessed, behind a collapsed toggle.
   * Ephemeral: excluded from thread persistence (session-only).
   */
  reasoning?: string
}

/** A set of frequency-framed chips for a single factor's base rate elicitation */
export interface BaseRateChipSet {
  /** Factor name from guidance item target_label (fallback: "This factor") */
  factorLabel: string
  /** Guidance item_id — used to dismiss guidance after user responds */
  itemId: string
  /** Factor node ID from guidance target_object.id — used for action routing */
  factorId?: string
}

// ---------------------------------------------------------------------------
// § 2 — Inline blocks (rendered inside assistant messages)
// ---------------------------------------------------------------------------

/** Action chip rendered below an artefact block */
export interface ArtefactAction {
  label: string
  message: string
}

/** AI-generated interactive HTML content rendered in a sandboxed iframe */
export interface ArtefactBlock {
  type: 'artefact'
  artefact_type: string
  title: string
  description?: string
  /** Raw HTML string rendered inside a sandboxed iframe */
  content: string
  actions?: ArtefactAction[]
}

export type ConversationBlock =
  | CommentaryBlock
  | ReviewCardBlock
  | FactBlock
  | GraphPatchBlock
  | FramingBlock
  | BriefBlock
  | ModelReceiptBlockType
  | EvidenceBlock
  | ArtefactBlock
  | ComparisonBlock
  | PremortemBlock
  | FlipAnalysisBlock
  | ProposalBlock
  | ExerciseBlock
  | V5AnalysisResultBlock
  | V5GraphPatchBlock
  | V5ExplanationBlock
  | V5ComparisonBlock
  | V5FlipAnalysisBlock
  | V5ReviewCardBlock
  | V5CoachingBlock
  | V5EvidenceBlock
  | V5ExerciseBlock
  | V5UnsupportedBlock

/**
 * V5 block kinds (v5-ui-exclusive-path brief, Phase 5).
 *
 * These mirror the V5 OlumiResponse block types (analysis_result, graph_patch,
 * explanation, comparison, flip_analysis) so the UI can render CEE V5 output
 * without reshaping through the V4 block taxonomy. Distinct kinds avoid
 * conflicts with the V4 graph_patch / comparison / flip_analysis blocks that
 * have different shapes and state machines.
 */
export interface V5AnalysisResultBlock {
  type: 'v5_analysis_result'
  summary: string
  leading_option_id: string | null
  win_probabilities?: Record<string, number>
  enrichment?: Record<string, unknown>
}

export interface V5GraphPatchBlock {
  type: 'v5_graph_patch'
  status: 'applied' | 'noop'
  operation: 'set_factor_value' | 'add_constraint' | 'adjust_edge_strength'
  target_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface V5ExplanationBlock {
  type: 'v5_explanation'
  narrative: string
  referenced_option_ids: string[]
  enrichment?: Record<string, unknown>
}

export interface V5ComparisonBlockOption {
  option_id: string
  label: string
  win_probability?: number
  attributes?: Record<string, unknown>
}

export interface V5ComparisonBlock {
  type: 'v5_comparison'
  options: V5ComparisonBlockOption[]
  narrative?: string
}

export interface V5FlipScenario {
  factor_id: string
  current_value: number | null
  flip_threshold: number | null
  from_option_id: string | null
  to_option_id: string | null
  fragile: boolean
}

export interface V5FlipAnalysisBlock {
  type: 'v5_flip_analysis'
  narrative: string
  flip_scenarios: V5FlipScenario[]
  enrichment?: Record<string, unknown>
}

/**
 * Target reference carried on 0.13.x Phase 3 blocks (review_card /
 * coaching). Fields are the producer's typed shape verbatim; `kind` is
 * widened to string so future producer kinds pass through without a UI
 * release (unknown kinds render the label exactly the same way).
 */
export interface V5BlockTargetRef {
  id: string
  label: string
  kind: string
}

/** 0.13.x Phase 3 block freshness enum (producer-owned). */
export type V5Phase3Freshness = 'fresh' | 'stale' | 'pending' | 'failed'

/**
 * Track C slice 1 (D-5): typed review_card conversation block mirroring the
 * 0.13.x ReviewCardBlockSchema render-relevant fields EXACTLY. All copy
 * (title, body, target_refs labels, action_label) is producer-owned and
 * rendered verbatim — the UI adds no labels and no interpretation
 * (provisional_doctrine_v0). Distinct from the legacy `review_card`
 * ConversationBlock, which carries the V4-era tone/variant shape.
 */
export interface V5ReviewCardBlock {
  type: 'v5_review_card'
  block_id: string
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  card_kind: string
  target_refs: V5BlockTargetRef[]
  priority_rank: number
  freshness: V5Phase3Freshness
  action_intent?: string
  action_label?: string
}

/**
 * Track C slice 1 (D-5): typed coaching conversation block mirroring the
 * 0.13.x CoachingBlockSchema render-relevant fields EXACTLY. Same
 * verbatim-copy contract as V5ReviewCardBlock (provisional_doctrine_v0).
 *
 * priority_rank / freshness are OPTIONAL: producer-adapted blocks always
 * carry them (adaptTypedCoachingBlock fails closed without them), but the
 * UI-side draft bias-signal bridge (draftBiasSignalBlocks.ts) builds
 * v5_coaching blocks from wire coaching.bias_signals, which carry neither —
 * requiring them here forced the bridge to FABRICATE both (review-folds
 * 2026-07-17, Conv1). Absent values render nothing (no data-freshness
 * attribute) and sort after every ranked block.
 */
export interface V5CoachingBlock {
  type: 'v5_coaching'
  block_id: string
  title: string
  body: string
  coaching_kind: string
  source: string
  target_refs: V5BlockTargetRef[]
  priority_rank?: number
  freshness?: V5Phase3Freshness
  action_intent?: string
  action_label?: string
}

/**
 * Track C slice 2 (Lane UI-W4 C): typed evidence conversation block
 * mirroring the 0.13.1 EvidenceBlockSchema render-relevant fields EXACTLY.
 * Same verbatim-copy contract as V5ReviewCardBlock
 * (provisional_doctrine_v0): every rendered string is the producer's;
 * `current_confidence` is a pass-through discriminator (data-* only, not
 * enum-narrowed so future producer values ride through); `severity` drives
 * the visual channel only and stays enum-narrowed. Distinct from the
 * legacy V4-era `EvidenceBlock` ConversationBlock (different shape).
 * `factor_ref` is optional here (render-relevant naming comes from
 * `factor_label` / target_refs per §1.3 — renderers prefer the primary
 * factor target_refs label on conflict).
 */
export interface V5EvidenceBlock {
  type: 'v5_evidence'
  block_id: string
  factor_label: string
  factor_ref?: V5BlockTargetRef
  target_refs: V5BlockTargetRef[]
  current_confidence: string
  evidence_gap: string
  suggested_technique: string
  impact_if_gathered: string
  priority_rank: number
  severity: 'info' | 'warning' | 'critical'
  freshness: V5Phase3Freshness
  action_intent?: string
  action_label?: string
}

/**
 * Track C slice 2 (Lane UI-W4 C): typed exercise conversation block
 * mirroring the 0.13.1 ExerciseBlockSchema render-relevant fields EXACTLY.
 * Per the v1.3 contract the exercise block carries NO priority_rank (not
 * hero eligible) and NO title — every prose field is optional and rendered
 * producer-verbatim when present; the adapter fails closed when none is.
 * `exercise_kind` is a pass-through discriminator (data-* only). Distinct
 * from the legacy V4-era `ExerciseBlock` ConversationBlock.
 */
export interface V5ExerciseBlock {
  type: 'v5_exercise'
  block_id: string
  exercise_kind: string
  failure_scenario?: string
  warning_signs?: string[]
  mitigation?: string
  reference_class?: string
  counter_case?: string
  review_trigger?: string
  target_element_ref?: V5BlockTargetRef
  target_refs: V5BlockTargetRef[]
  freshness: V5Phase3Freshness
}

/**
 * Placeholder for V5 block kinds the UI doesn't render yet (explanation,
 * comparison, flip_analysis render full blocks; this is reserved for future
 * CEE block types to land safely without UI crashing).
 */
export interface V5UnsupportedBlock {
  type: 'v5_unsupported'
  blockType: string
  raw: unknown
}

// ---------------------------------------------------------------------------
// Citation marker (optional on CommentaryBlock)
// ---------------------------------------------------------------------------

export interface CitationRef {
  /** 1-based superscript index in the text */
  index: number
  /** Source description shown in legend / tooltip */
  source: string
}

/** Deterministic CEE structured section within a commentary block */
export interface CommentarySection {
  heading?: string
  content?: string
  items?: string[]
}

export interface CommentaryBlock {
  type: 'commentary'
  text: string
  tone?: 'neutral' | 'warning' | 'positive'
  /** Optional title — shown as header when commentary is collapsed */
  title?: string
  /** Optional citation markers; rendered as numbered legend below text */
  citations?: CitationRef[]
  /** Deterministic CEE: structured sections (heading + content + bullet items) */
  sections?: CommentarySection[]
}

export interface ReviewCardBlock {
  type: 'review_card'
  title: string
  body: string
  /** 'info' = coaching/facilitator (left 3px info border), 'alert' = challenger/danger (top 3px danger border) */
  variant: 'info' | 'alert'
  /**
   * Orchestrator tone from v2.1 prompt.
   * 'challenger' → alert variant (top danger border).
   * 'facilitator' → info variant (left info border, coaching default).
   * Takes precedence over variant when present.
   */
  tone?: 'challenger' | 'facilitator'
  /** Optional priority badge — sentence case */
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

// ---------------------------------------------------------------------------
// FactBlock — simple backward-compat shape plus optional template fields
// ---------------------------------------------------------------------------

export interface FactEntry {
  label: string
  value: string | number
  /** Reference line for bar rendering */
  baseline?: number
}

export type FactType =
  | 'simple'           // default — renders label/value/source
  | 'option_comparison'
  | 'sensitivity'
  | 'robustness'
  | 'constraint'

export interface FactLineage {
  n_samples?: number
  source?: string
}

export interface FactBlock {
  type: 'fact'
  /** Kept required for backward compat with existing tests */
  label: string
  /** Kept required for backward compat with existing tests */
  value: string
  source?: string
  /** absent = 'simple' */
  fact_type?: FactType
  /** Template data for non-simple fact_types */
  facts?: FactEntry[]
  lineage?: FactLineage
}

export interface PatchOperation {
  op: 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge' | 'update_edge'
  target_id: string
  data: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Block action (CEE-provided action buttons for graph_patch)
// ---------------------------------------------------------------------------

export interface BlockAction {
  action_type: 'accept' | 'dismiss' | 'view_details' | string
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface ProposalReviewItem {
  description: string
  elementLabel?: string
  changeLabel?: string
}

export interface RelatedElementRef {
  node_id?: string
  edge_id?: string
  label?: string
  type?: string
}

export interface GraphPatchBlock {
  type: 'graph_patch'
  patch_id: string
  summary: string
  /**
   * Past-tense summary emitted by CEE for accepted/auto-applied cards.
   * When present, supersedes `summary` once the card transitions to applied.
   */
  applied_summary?: string
  operations: PatchOperation[]
  target_graph_hash: string
  status?: string
  /**
   * When true, CEE has already applied the graph via envelope side_effects.
   * Render as applied state immediately — no Accept/Dismiss, no system event.
   */
  auto_apply?: boolean
  /** CEE patch classification — 'full_draft' for initial graph generation, 'incremental' for targeted edits */
  patch_type?: 'full_draft' | 'incremental'
  /** CEE-provided action buttons; overrides default Accept/Dismiss when present */
  actions?: BlockAction[]
  /** Canonical block identifier from CEE */
  block_id?: string
  /**
   * Graph hash captured when this block was received by the UI.
   * Used to detect staleness: if the graph changes after proposal,
   * a warning is shown before accepting.
   */
  graph_hash_at_proposal?: string
  /**
   * CEE-provided analysis_ready payload on full_draft patches.
   * When present, used directly for setCeeAnalysisReady instead of
   * edge-based synthesis fallback.
   */
  analysis_ready?: CEEAnalysisReady
  /**
   * Goal constraints from CEE response root, forwarded via graph_patch block.
   * Passed to PLoT /v2/run for multi-constraint analysis.
   */
  goal_constraints?: CEEGoalConstraint[]
  related_elements?: RelatedElementRef[]
  proposal_items?: ProposalReviewItem[]
  proposal_items_source?: 'backend' | 'derived_ops'
  /** Per-operation metadata from CEE edit_graph (impact + rationale) */
  operation_meta?: Array<{ impact: string; rationale: string }>
}

// ---------------------------------------------------------------------------
// New block types (A.1)
// ---------------------------------------------------------------------------

export interface FramingBlock {
  type: 'framing'
  goal: string
  options: string[]
  constraints?: string[]
  key_risks?: string[]
}

export interface BriefBlock {
  type: 'brief'
  title: string
  summary: string
  brief_url?: string
}

// Evidence block — research findings from orchestrator
export interface EvidenceFinding {
  text: string
  source_url?: string
  confidence?: number
}

export interface EvidenceBlock {
  type: 'evidence'
  title?: string
  findings: EvidenceFinding[]
  query: string
}

// Phase 2B: Model receipt block — structured summary after graph generation.
// F1 PR B: action-first pre-analysis card. `coachingSummary` is the CEE-owned
// (analysis_ready.coaching_summary) main content; DGAI adds only static chrome.
export interface ModelReceiptBlockType {
  type: 'model_receipt'
  factorCount: number
  edgeCount: number
  optionCount: number
  goalLabel: string | null
  coachingSummary: string | null
  topInsight: string | null
  topEvidenceGap: string | null
  readiness: 'ready' | 'blocked' | 'incomplete' | 'unknown'
  adjustments: Array<{ label: string; action: string; before?: string; after?: string; reason?: string }>
}

// ---------------------------------------------------------------------------
// Deterministic CEE block types (architecture v3)
// ---------------------------------------------------------------------------

export interface ComparisonBlock {
  type: 'comparison'
  narrative?: string
  options: Array<{
    id?: string
    label: string
    probability?: number
    rank?: number
    strengths?: string[]
    weaknesses?: string[]
    key_differentiators?: string[]
  }>
}

export interface PremortemBlock {
  type: 'premortem'
  target_option?: { id: string; label: string }
  narrative?: string
  risk_paths: Array<{
    path?: string[]
    description: string
    influence?: number
    likelihood?: string
    mitigation?: string
  }>
}

export interface FlipAnalysisBlock {
  type: 'flip_analysis'
  current_winner?: { id: string; label: string; probability?: number }
  narrative?: string
  flip_conditions: Array<{
    assumption: string
    current_value?: string
    flip_threshold: string
    direction: string
    alternative_winner?: string
  }>
}

export interface ProposalBlock {
  type: 'proposal'
  action_type: string
  description: string
  proposal_id: string
  changes: Array<{ operation: string; target: string; detail: string }>
  consequences?: string[]
  confirmation_required?: boolean
}

export interface ExerciseBlock {
  type: 'exercise'
  exercise_type: string
  title: string
  instructions: string
  content?: string
}

// ---------------------------------------------------------------------------
// Deterministic CEE insights
// ---------------------------------------------------------------------------

export interface Insight {
  type: string
  description: string
  severity?: 'info' | 'warning' | 'important'
  target_id?: string
  science_concept?: string
}

// ---------------------------------------------------------------------------
// § 3 — Action chips
// ---------------------------------------------------------------------------

export interface ActionChip {
  id: string
  label: string
  intent: 'primary' | 'secondary' | 'undo'
  /** Message sent to orchestrator when chip is tapped */
  message?: string
  /**
   * v2.1 chip role from <role> tag in orchestrator output.
   * Determines the colour dot rendered inside the chip.
   * Missing or unrecognised values render chip without a dot (graceful fallback).
   */
  role?: 'facilitator' | 'challenger' | 'scientist' | string
  /** Prompt text (deterministic format — mapped to message in validateResponse) */
  prompt?: string
  /** Action classification for deterministic routing */
  action_type?: string
  /** Structured parameters for action execution */
  parameters?: Record<string, unknown>
}

/** Max chips per assistant turn (coaching + suggested actions combined) */
export const MAX_CHIPS_PER_TURN = 4

/** Max suggested-action chips within the total budget (coaching fills first). v2.1: 0-3 default, 4 max. */
export const MAX_SUGGESTED_ACTIONS = 3

/** Max visible blocks per assistant turn before "Show more" toggle */
export const MAX_VISIBLE_BLOCKS_PER_TURN = 4

// ---------------------------------------------------------------------------
// § 4 — System events (type-defined now, wired in follow-up PR)
// ---------------------------------------------------------------------------

/** Event types accepted by CEE's v3 Zod schema — safe to send over the wire. */
export type WireSystemEventType =
  | 'direct_graph_edit'
  | 'direct_analysis_run'
  | 'patch_accepted'
  | 'patch_dismissed'
  | 'feedback_submitted'

/** Event types used only within the UI — never sent to CEE. */
export type InternalSystemEventType = 'session_resume' | 'undo_draft'

/** All system event types (wire + internal). */
export type SystemEventType = WireSystemEventType | InternalSystemEventType

/** Wire-safe system event — the only shape accepted by sendSystemEvent. */
export interface WireSystemEvent {
  type: WireSystemEventType
  payload?: Record<string, unknown>
}

/** Any system event (wire or internal). */
export interface SystemEvent {
  type: SystemEventType
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// § 5 — Orchestrator turn request
// ---------------------------------------------------------------------------

export interface AnalysisInputOption {
  id: string
  option_id: string
  label: string
  interventions: Record<string, CEEInterventionV3>
}

export interface OrchestratorTurnRequest {
  scenario_id: string
  message?: string
  conversation_history: ConversationTurnPair[]
  graph_state?: {
    nodes: unknown[]
    edges: unknown[]
  }
  analysis_state?: {
    analysis_status: string
    meta: { response_hash: string; [key: string]: unknown }
    [key: string]: unknown
  }
  selected_elements?: {
    node_ids?: string[]
    edge_ids?: string[]
  }
  /**
   * Analysis inputs from ceeAnalysisReady — options with resolved interventions
   * and goal_node_id. Present only when ceeAnalysisReady is available with options.
   * Allows the orchestrator to pass goal/options directly to PLoT for run_analysis
   * rather than inferring from graph structure alone.
   */
  analysis_inputs?: {
    options: AnalysisInputOption[]
    goal_node_id: string
  }
  /** Signal for CEE V2 deterministic draft routing. Set to true on explicit_generate turns. */
  generate_model?: boolean
  /** System event in CEE v3 wire format (SystemEventWire). Always serialized via serializeSystemEvent(). */
  system_event?: unknown
  /** Nonce for idempotency */
  turn_nonce?: string
  client_turn_id: string
  /** Request-builder turn discriminator, stripped before network send. */
  _turn_type?:
    | 'conversation'
    | 'explicit_generate'
    | 'run_analysis'
    | 'system_event'
    | 'patch_followup'
    | 'explain'
    | 'clarification_response'
}

/** A user+assistant turn pair for conversation_history (max 5 pairs sent) */
export interface ConversationTurnPair {
  role: 'user' | 'assistant'
  content: string
}

/** Max turn pairs sent in conversation_history */
export const MAX_HISTORY_PAIRS = 5

// ---------------------------------------------------------------------------
// § 6 — Orchestrator response envelope
// ---------------------------------------------------------------------------

/**
 * CEE stage_indicator wire format — may be a plain string or an object.
 * The object form includes confidence and source metadata from the orchestrator.
 */
export type StageIndicatorWire =
  | ScenarioStage
  | { stage: ScenarioStage; confidence?: string; source?: string }

export interface OrchestratorResponseEnvelopeV2 {
  /** Response format version. 2 = deterministic (plain text, typed blocks). Absent = legacy XML path. */
  response_version?: number
  /** Main response text. Null on graph-only responses (e.g. initial draft). */
  assistant_text: string | null
  /** Deterministic CEE insights — supplementary observations */
  insights?: Insight[]
  blocks?: ConversationBlock[]
  proposed_changes?: unknown[]
  suggested_actions?: ActionChip[]
  /** Plain string or object with .stage field — normalised in handleEnvelope */
  stage_indicator?: StageIndicatorWire
  /** Guidance items for cross-surface display (strip, inspector, canvas highlight) */
  guidance_items?: import('../stores/guidanceStore').GuidanceItem[]
  /** Debug/trace field — not displayed to user */
  turn_plan?: unknown
  /** Echoed client_turn_id for deduplication */
  client_turn_id?: string
  /**
   * A.9: Full V2RunResponse when the orchestrator executed run_analysis.
   * Present only on analysis turns; absent on all other turns.
   * The UI must write this to the results store so the panel updates
   * without a direct /v2/run call.
   */
  analysis_response?: import('../../adapters/plot/v2/types').V2RunResponse
  /**
   * A.9: Error produced by run_analysis on the CEE side.
   * Present only when analysis was attempted but failed.
   */
  analysis_error?: { code: string; message: string }
  /**
   * Goal constraints from CEE response root.
   * The orchestrator may forward these at the envelope root level
   * when the CEE draft includes goal_constraints outside block.data.
   */
  goal_constraints?: import('../../adapters/cee/types').CEEGoalConstraint[]
  /**
   * CEE routing metadata — present when CEE lands support.
   * Includes the resolved LLM model and provider used to serve the request.
   * Read-only debug metadata; never displayed to users.
   */
  _route_metadata?: {
    resolved_model?: string | null
    resolved_provider?: string | null
    [key: string]: unknown
  }
  /**
   * CEE diagnostic trace — present when CEE_DIAGNOSTIC_TRACE_ENABLED is on.
   * Contains LLM call details, prompt identity, provider resolution, fallback
   * traces, and streaming metrics. Passthrough only — UI must not transform.
   * Read-only debug metadata; never displayed to users or sent back to CEE.
   */
  _diagnostic_trace?: {
    llm_calls?: unknown[]
    prompt_identity?: unknown[]
    zone2_assembly?: unknown
    tool_policy?: unknown
    provider_resolution?: unknown[]
    structured_output_config?: unknown
    streaming_metrics?: unknown
    fallback_trace?: unknown[]
    [key: string]: unknown
  } | null
  /**
   * CEE pipeline outcome — present when CEE includes pipeline metadata.
   * Read-only debug metadata; passthrough to debug bundle.
   */
  _pipeline_outcome?: unknown
  /**
   * Opaque session state from CEE. Store as-is, send back on the next turn
   * request as `session_state`. Enables session-level coaching (chip
   * suppression, play deduplication, convergence detection, calibration
   * tracking). Never persist to message history or analytics — transient
   * orchestration context only.
   */
  updated_session_state?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// § 7 — Orchestrator SSE stream events
// ---------------------------------------------------------------------------

/**
 * Discriminated union of SSE events emitted by POST /orchestrate/v1/turn/stream.
 * Each event carries a monotonically increasing `seq` for ordering.
 * Canonical schema — must match CEE's streaming wire format exactly.
 */
export type OrchestratorStreamEvent =
  | { type: 'turn_start'; seq: number; turn_id: string; routing: 'deterministic' | 'llm'; stage: string }
  | { type: 'text_delta'; seq: number; delta: string }
  | { type: 'tool_start'; seq: number; tool_name: string; long_running: boolean }
  | { type: 'block'; seq: number; block: ConversationBlock }
  | { type: 'tool_result'; seq: number; tool_name: string; success: boolean; duration_ms?: number }
  | { type: 'turn_complete'; seq: number; envelope: OrchestratorResponseEnvelopeV2 }
  | { type: 'error'; seq: number; error: { code: string; message: string }; recoverable: boolean }
  | { type: 'progress'; seq: number; message?: string }
