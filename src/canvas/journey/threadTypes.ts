/**
 * Decision Thread persistence types -- Track 2 of 3.
 *
 * Co-located with Journey types (Track 1). These types model the persisted
 * conversation thread stored in `scenarios.thread` (JSONB array).
 *
 * Design spec: Decision Journey and Decision Thread unified v2.1 (section 5.2)
 */

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export type BlockType =
  | 'framing'
  | 'graph_patch'
  | 'fact'
  | 'commentary'
  | 'review_card'
  | 'brief'
  | 'scenario'
  | 'clarification'

export type BlockState =
  | 'proposed'
  | 'accepted'
  | 'applied'
  | 'dismissed'
  | 'rejected'
  | 'stale'
  | 'superseded'

export interface PersistedBlock {
  block_id: string
  block_type: BlockType
  content_schema_version: 1
  content: Record<string, unknown>
  state: BlockState
  state_changed_at?: string
}

// ---------------------------------------------------------------------------
// Suggested actions
// ---------------------------------------------------------------------------

export interface SuggestedAction {
  action_id: string
  label: string
  taken: boolean
  taken_at?: string
}

// ---------------------------------------------------------------------------
// Tool traces
// ---------------------------------------------------------------------------

export interface ToolTrace {
  tool_name: string
  started_at: string
  completed_at: string
  status: 'success' | 'error'
  summary?: string // Human-readable only, no raw payloads
}

// ---------------------------------------------------------------------------
// System event types (thread-level, distinct from ScenarioEventType)
// ---------------------------------------------------------------------------

export type SystemEventType =
  | 'direct_graph_edit'
  | 'analysis_triggered'
  | 'session_resumed'
  | 'stage_advanced'
  | 'brief_generated'
  | 'error'

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export interface DecisionMilestone {
  milestone_type:
    | 'framing_set'
    | 'model_drafted'
    | 'key_challenge'
    | 'assumption_justified'
    | 'analysis_complete'
    | 'recommendation_changed'
    | 'brief_generated'
  summary: string
}

// ---------------------------------------------------------------------------
// Thread entry
// ---------------------------------------------------------------------------

export type ThreadEntryRole = 'user' | 'assistant' | 'system'
export type ThreadEntryOrigin = 'conversation' | 'block_action' | 'system_event' | 'session_boundary'
export type ThreadEntryStatus = 'complete' | 'partial' | 'failed'
export type RedactionState = 'full' | 'redacted' | 'hash_only'

export interface ThreadEntry {
  entry_id: string                           // UUID, idempotency key
  entry_schema_version: 1
  seq: number                                // Server-assigned
  timestamp: string                          // ISO-8601, server-assigned
  role: ThreadEntryRole
  origin: ThreadEntryOrigin
  actor_user_id?: string                     // auth.uid() for user entries
  entry_status: ThreadEntryStatus
  user_message?: string
  assistant_text?: string
  blocks?: PersistedBlock[]
  suggested_actions?: SuggestedAction[]
  tool_traces?: ToolTrace[]
  system_event_type?: SystemEventType
  system_event_detail?: string
  turn_id?: string
  related_event_ids?: string[]
  redaction_state: RedactionState
  milestone?: DecisionMilestone
}

/**
 * Shape sent to the append RPC -- seq and timestamp are server-assigned.
 */
export type ThreadEntryInput = Omit<ThreadEntry, 'seq' | 'timestamp'>
