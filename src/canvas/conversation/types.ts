/**
 * A.5+ Conversation Panel — Type Definitions
 *
 * Defines all types for the orchestrator-backed conversation surface:
 * messages, blocks, chips, turn requests/responses, and system events.
 */

import type { ScenarioStage } from '../../types/scenario'

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

export interface CommentaryBlock {
  type: 'commentary'
  text: string
  tone?: 'neutral' | 'warning' | 'positive'
}

export interface ReviewCardBlock {
  type: 'review_card'
  title: string
  body: string
  /** 'info' = coaching (left 3px info border), 'alert' = danger (top 3px danger border) */
  variant: 'info' | 'alert'
}

export interface FactBlock {
  type: 'fact'
  label: string
  value: string
  source?: string
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

/** Max visible blocks per assistant turn before "Show more" toggle */
export const MAX_VISIBLE_BLOCKS_PER_TURN = 4

// ---------------------------------------------------------------------------
// § 4 — System events (type-defined now, wired in follow-up PR)
// ---------------------------------------------------------------------------

export type SystemEventType =
  | 'direct_graph_edit'
  | 'direct_analysis_run'
  | 'patch_accepted'
  | 'patch_dismissed'
  | 'session_resume'
  | 'undo_draft'

export interface SystemEvent {
  type: SystemEventType
  payload?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// § 5 — Orchestrator turn request
// ---------------------------------------------------------------------------

export interface OrchestratorTurnRequest {
  scenario_id: string
  message: string
  conversation_history: ConversationTurnPair[]
  graph_state?: {
    node_count: number
    edge_count: number
    has_goal: boolean
  }
  analysis_state?: {
    has_results: boolean
    last_run_hash: string | null
  }
  selected_elements?: {
    node_ids?: string[]
    edge_ids?: string[]
  }
  /** System event — not wired in this PR, field defined for forward compatibility */
  system_event?: SystemEvent
  /** Nonce for idempotency — not wired in this PR, field defined for forward compatibility */
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

export interface OrchestratorResponseEnvelopeV2 {
  assistant_text: string
  blocks?: ConversationBlock[]
  suggested_actions?: ActionChip[]
  stage_indicator?: ScenarioStage
  /** Debug/trace field — not displayed to user */
  turn_plan?: string
  /** Echoed client_turn_id for deduplication */
  client_turn_id?: string
}
