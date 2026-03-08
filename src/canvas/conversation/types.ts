/**
 * A.5+ Conversation Panel — Type Definitions
 *
 * Defines all types for the orchestrator-backed conversation surface:
 * messages, blocks, chips, turn requests/responses, and system events.
 */

import type { ScenarioStage } from '../../types/scenario'
import type { CEEAnalysisReady, CEEInterventionV3 } from '../../adapters/cee/types'

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
}

// ---------------------------------------------------------------------------
// § 2 — Inline blocks (rendered inside assistant messages)
// ---------------------------------------------------------------------------

export type ConversationBlock =
  | CommentaryBlock
  | ReviewCardBlock
  | FactBlock
  | GraphPatchBlock
  | FramingBlock
  | BriefBlock

// ---------------------------------------------------------------------------
// Citation marker (optional on CommentaryBlock)
// ---------------------------------------------------------------------------

export interface CitationRef {
  /** 1-based superscript index in the text */
  index: number
  /** Source description shown in legend / tooltip */
  source: string
}

export interface CommentaryBlock {
  type: 'commentary'
  text: string
  tone?: 'neutral' | 'warning' | 'positive'
  /** Optional citation markers; rendered as numbered legend below text */
  citations?: CitationRef[]
}

export interface ReviewCardBlock {
  type: 'review_card'
  title: string
  body: string
  /** 'info' = coaching (left 3px info border), 'alert' = danger (top 3px danger border) */
  variant: 'info' | 'alert'
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

export interface GraphPatchBlock {
  type: 'graph_patch'
  patch_id: string
  summary: string
  operations: PatchOperation[]
  target_graph_hash: string
  /**
   * When true, CEE has already applied the graph via envelope side_effects.
   * Render as applied state immediately — no Accept/Dismiss, no system event.
   */
  auto_apply?: boolean
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

// ---------------------------------------------------------------------------
// § 3 — Action chips
// ---------------------------------------------------------------------------

export interface ActionChip {
  id: string
  label: string
  intent: 'primary' | 'secondary' | 'undo'
  /** Message sent to orchestrator when chip is tapped */
  message?: string
}

/** Max chips per assistant turn (coaching + suggested actions combined) */
export const MAX_CHIPS_PER_TURN = 4

/** Max suggested-action chips within the total budget (coaching fills first) */
export const MAX_SUGGESTED_ACTIONS = 2

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
  message: string
  conversation_history: ConversationTurnPair[]
  /**
   * Full graph sent on every turn. CEE needs nodes/edges for guidance refresh
   * and validate-patch. The compact summary (node_count etc.) is insufficient.
   */
  graph_state: {
    nodes: unknown[]
    edges: unknown[]
  }
  analysis_state: {
    has_results: boolean
    last_run_hash: string | null
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
  /** System event in CEE v3 wire format (SystemEventWire). Always serialized via serializeSystemEvent(). */
  system_event?: unknown
  /** Nonce for idempotency */
  turn_nonce?: string
  client_turn_id: string
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
  /** Main response text. Null on graph-only responses (e.g. initial draft). */
  assistant_text: string | null
  blocks?: ConversationBlock[]
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
}
