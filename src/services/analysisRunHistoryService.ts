/**
 * Analysis run history — the persisted `run_analysis` facts for a scenario.
 *
 * ROADMAP 2.113a slice 1. This is the read seam that gives the Compare tab a
 * data source at all. Design of record:
 * `docs-designs/COMPARE-BRIDGE-DESIGN-2026-07-29.md` §3, option (b).
 *
 * WHY A DIRECT SUPABASE READ, AND WHY THAT IS NOT A DOCTRINE BREACH
 * -----------------------------------------------------------------
 * "CEE owns the compute-orchestration seam" is a statement about the
 * ANALYSE path: the UI must not commission a computation, and it does not
 * here. These rows were requested by CEE, computed by PLoT/ISL, and persisted
 * by CEE under CEE-authored RLS. Reading them back is the same relationship
 * the UI already has with `scenarios` (10 direct `.from('scenarios')` call
 * sites in `scenarioService.ts`). Slice 1 therefore ships with zero CEE
 * deploy, and the DATABASE is the authorisation boundary.
 *
 * THE AUTHORISATION BOUNDARY — derived at the live DB, not assumed
 * -----------------------------------------------------------------
 * Verified read-only against staging on 2026-07-29
 * (`has_table_privilege` + `pg_policies`; evidence in
 * PHASE0-EVIDENCE-2026-07-28/compare-slice1.md §0.1):
 *
 *   • `GRANT SELECT ON v5_handler_facts TO authenticated` — present.
 *   • POLICY "Users can read own v5 handler facts" FOR SELECT
 *     USING (auth.uid() = user_id) — present, RLS enabled.
 *
 * So this query CANNOT return another user's rows, and this module therefore
 * does NOT filter by `user_id` — re-implementing the check client-side would
 * be a second, drift-prone copy of an invariant the DB already enforces
 * (CLAUDE.md trap 12: derive, don't mirror).
 *
 * GUESTS. `v5_handler_facts.user_id` is NULLABLE (guest mode, CEE migration
 * 20260422000000). For a guest row `auth.uid() = user_id` evaluates to NULL,
 * not TRUE — so a guest reads exactly zero rows BY CONSTRUCTION. 643 of the
 * 773 live non-noop run_analysis facts are guest rows and are invisible to
 * this query for that reason. Callers must render their normal empty state
 * for that case, never an error.
 *
 * SHAPE TRUST. The row is read OUTSIDE the `@talchain/schemas` contract, so
 * nothing here asserts a shape. This module returns the raw `payload` and
 * lets `persistedRunSnapshotFactory` parse it tolerantly; a row it cannot
 * read is dropped, never defaulted.
 */
import { supabase } from '../lib/supabase'

/** The CEE handler whose facts carry a completed analysis. */
const RUN_ANALYSIS_HANDLER_ID = 'run_analysis'

/**
 * How many past runs the Compare tab hydrates. The tab's trajectory chart and
 * transition list are both read top-down by a human; beyond ~20 the journey
 * stops being legible and the payload stops being cheap. Live maximum per
 * owned scenario at the time of writing is 8.
 */
export const MAX_PERSISTED_RUNS = 20

export interface PersistedAnalysisRunRow {
  /** `v5_handler_facts.id` — the durable identity of this run. */
  id: string
  /** `v5_handler_facts.created_at`, ISO 8601. */
  createdAt: string
  /** `v5_handler_facts.payload` — `{ fact_type, fact_version, result }`, untrusted. */
  payload: unknown
  /** Parent `v5_conversation_turns.id`; null only if the column were ever absent. */
  turnId: string | null
}

interface RawFactRow {
  id?: unknown
  created_at?: unknown
  payload?: unknown
  v5_conversation_turn_id?: unknown
}

/**
 * Read this scenario's completed analysis runs, oldest-first.
 *
 * Ordering note: the QUERY orders newest-first so the `limit` keeps the most
 * RECENT runs (a `limit` on an ascending order would keep the oldest and drop
 * the ones the user just produced). The result is reversed before returning,
 * because every Compare derivation — trajectory, transitions, cumulative
 * card — walks the list chronologically.
 *
 * Throws on a read error. Callers decide how to degrade; the Compare
 * hydration hook degrades to the tab's existing empty state.
 */
export async function listPersistedAnalysisRuns(
  scenarioId: string,
  limit: number = MAX_PERSISTED_RUNS,
): Promise<PersistedAnalysisRunRow[]> {
  if (!scenarioId) return []

  const { data, error } = await supabase
    .from('v5_handler_facts')
    .select('id, created_at, payload, v5_conversation_turn_id')
    .eq('scenario_id', scenarioId)
    .eq('handler_id', RUN_ANALYSIS_HANDLER_ID)
    // `noop` is a real COLUMN, not a payload field (CEE splits the wire shape
    // on write). A noop run_analysis fact carries no `result.enrichment` and
    // would map to nothing — filter it in SQL rather than dropping it later.
    .eq('noop', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to read persisted analysis runs: ${error.message}`)
  }

  const rows = (data ?? []) as RawFactRow[]
  const mapped: PersistedAnalysisRunRow[] = []
  for (const row of rows) {
    if (typeof row?.id !== 'string' || typeof row?.created_at !== 'string') continue
    mapped.push({
      id: row.id,
      createdAt: row.created_at,
      payload: row.payload,
      turnId: typeof row.v5_conversation_turn_id === 'string' ? row.v5_conversation_turn_id : null,
    })
  }

  return mapped.reverse()
}
