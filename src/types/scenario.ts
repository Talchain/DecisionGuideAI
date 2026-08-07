/**
 * Scenario Persistence Types — Olumi Scenario Schema v2.0
 *
 * TypeScript types mirroring the Supabase scenarios table, shared_briefs table,
 * analysis_provenance JSONB shape, and event log schema.
 *
 * JSONB columns are typed as `unknown` at the persistence layer.
 * Consumers cast to domain types (Node[], V2RunResponse, etc.) at read time —
 * per Schema v2.0 Principle 7: "DMS v2.8 is the type authority."
 */

// ---------------------------------------------------------------------------
// § 2.1 — scenarios table row
// ---------------------------------------------------------------------------

// JSONB columns are typed as `unknown` (not Supabase `Json`) intentionally.
// This forces explicit casting at read boundaries per Schema v2.0 Principle 7:
// "Consumers cast to domain types at read time."
// `unknown` is stricter than `Json` and prevents implicit structural assumptions.

export interface ScenarioRow {
  id: string                              // uuid (PK)
  user_id: string                         // uuid (FK → auth.users)
  title: string | null
  scenario_schema_version: number
  stage: ScenarioStage
  graph: unknown                          // JSONB — { nodes: Node[], edges: Edge[] }
  framing: unknown                        // JSONB — { goal?, constraints?, options?, … }
  analysis_status: AnalysisStatus
  analysis: unknown                       // JSONB — full V2RunResponse (when status = 'ready')
  analysis_error: unknown                 // JSONB — { code, message, at } (when status = 'failed')
  analysis_provenance: AnalysisProvenance | null
  events: ScenarioEvent[]                 // JSONB array (append-only via RPC)
  event_seq: number
  brief: unknown                          // JSONB — DecisionBriefV1
  is_pinned: boolean                      // Hub: pinned to top of list
  is_archived: boolean                    // Hub: hidden from Active filter
  source_scenario_id: string | null       // UUID of duplicated-from scenario
  thread: unknown                         // JSONB array — ThreadEntry[] (Track 2 persistence)
  created_at: string                      // ISO-8601 timestamptz
  updated_at: string                      // ISO-8601 timestamptz
}

/** List-view projection — only the columns needed for the scenario list page */
export type ScenarioListItem = Pick<
  ScenarioRow,
  'id' | 'title' | 'stage' | 'analysis_status' | 'updated_at' | 'events'
  | 'is_pinned' | 'is_archived' | 'created_at'
>

// ---------------------------------------------------------------------------
// § 2.1 — stage and analysis_status enums
// ---------------------------------------------------------------------------

export type ScenarioStage =
  | 'frame'
  | 'ideate'
  | 'evaluate'
  | 'decide'
  | 'optimise'

export type AnalysisStatus =
  | 'none'
  | 'running'
  | 'ready'
  | 'failed'

// ---------------------------------------------------------------------------
// § 2.2 — analysis_provenance shape (built server-side by store_analysis_and_log)
// ---------------------------------------------------------------------------

export interface AnalysisProvenance {
  graph_hash: string        // Canonical graph hash at time of analysis
  /**
   * Actual seed echoed by PLoT, or null when it echoed nothing usable (T2b).
   *
   * Receipts fail closed: this is a claim about what the engine did, so
   * "unknown" must be representable. It was typed `number` while the writer
   * fabricated a 0 to satisfy that type — the type was enforcing the lie.
   * The column is JSONB (`scenarios.analysis_provenance`), which has no
   * NOT NULL on this key, so null is a real wire value.
   */
  seed_used: number | null
  response_hash: string     // PLoT response hash
  analysed_at: string       // ISO-8601, server-assigned via to_jsonb(now())
}

// ---------------------------------------------------------------------------
// § 5 — event log schema
// ---------------------------------------------------------------------------

export interface ScenarioEvent {
  event_id: string                        // Client-generated UUID (idempotency key)
  seq: number                             // Server-assigned monotonic sequence
  event_type: ScenarioEventType
  timestamp: string                       // ISO-8601, server-assigned
  details: Record<string, unknown>
  turn_id?: string
  hashes?: {
    context_hash?: string
    response_hash?: string
    graph_hash?: string
  }
}

export type ScenarioEventType =
  // Lifecycle
  | 'scenario_created'
  | 'framing_confirmed'
  | 'stage_changed'
  // Graph
  | 'graph_drafted'
  | 'patch_accepted'
  | 'patch_dismissed'
  | 'patch_rejected'
  | 'direct_edit'
  // Persistence marker — appended by the gated autosave write
  // (saveGraphViaGatedPath). System-level: hidden from the Journey timeline and
  // excluded from the edit-count summary; carries the persisted graph_hash.
  | 'graph_saved'
  // Analysis
  | 'analysis_run'
  | 'analysis_failed'
  // Brief
  | 'brief_generated'
  | 'brief_shared'
  // Pilot outcome instrumentation (P.5)
  | 'confidence_pre'
  | 'confidence_post'
  | 'evidence_intent'
  | 'changed_thinking'
  | 'feedback_submitted'

/**
 * SINGLE SOURCE OF TRUTH for "this event is machine persistence noise, not a
 * user-facing activity".
 *
 * Events listed here are appended by the persistence layer itself (not by a
 * user action) and would otherwise drown the surfaces that summarise activity:
 * the gated autosave appends one `graph_saved` per debounced write, so it is
 * ALWAYS the trailing event after any meaningful one.
 *
 * Every surface that summarises or renders scenario activity MUST consume this
 * set rather than hand-listing members — a hand-maintained mirror of this list
 * is exactly the drift class that has bitten this codebase before. Current
 * consumers:
 *   - canvas/journey/renderTimeline.ts   (hides them from the Journey timeline)
 *   - pages/ScenarioListPage.tsx         (skips them when labelling last activity)
 *   - canvas/stores/analysisSnapshotFactory.ts (excluded from the edit set)
 *
 * Typed as ReadonlySet<ScenarioEventType>, so a member that is not a real
 * event type is a COMPILE error — the union above stays the source of truth.
 */
export const SYSTEM_MARKER_EVENT_TYPES: ReadonlySet<ScenarioEventType> = new Set<ScenarioEventType>([
  'graph_saved',
])

// ---------------------------------------------------------------------------
// § 2.3 — shared_briefs (public-access shape returned by get_shared_brief_by_slug)
// ---------------------------------------------------------------------------

export interface SharedBriefRow {
  brief: unknown
  graph_hash: string
  seed_used: number
  response_hash: string
  created_at: string
  expires_at: string | null
}

// ---------------------------------------------------------------------------
// Typed error for all persistence operations
// ---------------------------------------------------------------------------

export class ScenarioPersistenceError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(message: string, code: string, cause?: unknown) {
    super(message)
    this.name = 'ScenarioPersistenceError'
    this.code = code
    this.cause = cause
  }
}
