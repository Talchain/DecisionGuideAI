/**
 * Persisted-run snapshot factory — rebuild an `AnalysisSnapshot` from a
 * `v5_handler_facts` `run_analysis` row.
 *
 * ROADMAP 2.113a slice 1. Design of record:
 * `docs-designs/COMPARE-BRIDGE-DESIGN-2026-07-29.md` §2 (field mapping).
 *
 * ⚠ THIS MODULE DOES NOT RE-DERIVE ANYTHING. It reshapes the persisted PLoT
 * envelope into the `V2RunResponse` slot `buildAnalysisSnapshot` already
 * consumes, then hands it to that ONE factory. A second snapshot builder
 * would be a mirror of the first (CLAUDE.md trap 12), and the thing it would
 * mirror is precisely the estate's hard-won absence-preserving logic: the
 * T2b null for `recommendation_stability`, the null for absent
 * `fragile_edges`, the NaN-safe seed parse, `selectGoalProbability` as the
 * single registered owner of the goal-probability claim, and
 * `topCalibrationFactor` as max |elasticity| rather than the refuted EVPI
 * quantity. Every one of those is a defect this estate already paid for.
 *
 * ⚠⚠ DECLARED DEVIATION FROM THE DESIGN DOC (§2 mapping table, three rows).
 * The doc maps `inferenceWarnings` / `conditionalWinners` / `edgeEValues` to
 * `enrichment.robustness.*`. Measured over all 773 live non-noop
 * `run_analysis` facts on staging (2026-07-29, read-only):
 *
 *     conditional_winners   root 773/773   robustness 0/773
 *     edge_e_values         root 773/773   robustness 0/773
 *     inference_warnings    root 773/773   robustness 0/773
 *
 * They are enrichment-ROOT siblings of `robustness`, never members of it.
 * Had the doc been implemented verbatim, all three would render permanently
 * empty with no error to notice.
 *
 * HISTORY OF THE COMPENSATION (kept, not deleted — trap 14). The factory's
 * three extractors used to read ONLY the `robustness` slot, so this module
 * FOLDED the root-level values into that object (root wins, nested kept as a
 * forward-compat fallback). That compensated THIS path while the live-capture
 * caller (store.ts, raw response unfolded) stayed blank — the same Compare
 * surface was populated or `[]` depending on which caller built the snapshot.
 * ROADMAP 2.173 (PR #540, inference_warnings) and 2.177 (conditional_winners
 * / edge_e_values) moved the root-wins dual read INTO the extractors, so both
 * callers agree and the fold became redundant: `toV2ResponseShape` spreads
 * `...fact.enrichment`, so the root slot survives onto the object the factory
 * reads, and the extractors' nested arm keeps the forward-compat fallback the
 * fold used to provide. The fold was therefore DELETED, proven
 * byte-identity-preserving over every constructible shape class (root-bearing,
 * nested-only, both-absent, root-[] shadowing nested, malformed non-array
 * root, mixed slots) — see
 * PHASE0-EVIDENCE-2026-07-28/sibling-extractors-fix.md. The nested-only and
 * both-absent classes stay pinned in this module's spec.
 */
import type { ScenarioEvent } from '../../types/scenario'
import type { AnalysisSnapshot } from '../compare-tab/types'
import type { PersistedAnalysisRunRow } from '../../services/analysisRunHistoryService'
import { buildAnalysisSnapshot } from './analysisSnapshotFactory'
import {
  parseAnalysisEnrichment,
  enrichmentToV2ResponseShape,
  type ParsedAnalysisEnrichment,
} from './analysisEnrichmentShape'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * The CEE-owned half of the fact, plus the PLoT envelope it wraps.
 * Everything here is untrusted JSONB — `null` means "this row cannot be read
 * as a completed analysis", and the caller DROPS it rather than defaulting it.
 *
 * ⚠ THE ENVELOPE HALF NOW LIVES IN `analysisEnrichmentShape.ts`, SHARED WITH
 * THE LIVE V5 CAPTURE PATH (ROADMAP 2.350). A persisted fact's enrichment and
 * a live `analysis_result` block's enrichment are the same bytes at two
 * moments, so they get ONE reader — see that module's header for why a second
 * copy of these guards would be the mirror defect this estate has already paid
 * for twice (2.173 / 2.177). What stays here is only what is genuinely
 * fact-ROW-shaped: the `fact_type` filter and the two row-level timestamps.
 */
interface ParsedRunFact extends ParsedAnalysisEnrichment {
  computedAt: string | null
  graphHashAtRun: string | null
}

function parseRunFact(payload: unknown): ParsedRunFact | null {
  const root = asRecord(payload)
  if (!root) return null
  // `noop` is a COLUMN, not a payload key (CEE splits the wire shape on
  // write), so it is filtered in SQL — see analysisRunHistoryService.
  if (root.fact_type !== 'run_analysis') return null

  const result = asRecord(root.result)
  if (!result) return null

  // Envelope validation + the two deciding-array guards: ONE reader, shared
  // with the live V5 capture path. 773/773 live rows carry a readable
  // envelope; a row that does not is a producer change, and the honest
  // response is to omit the run from the journey, not to render a run with
  // every field blank.
  const parsed = parseAnalysisEnrichment(result.enrichment)
  if (!parsed) return null

  return {
    ...parsed,
    computedAt: typeof result.computed_at === 'string' ? result.computed_at : null,
    graphHashAtRun:
      typeof result.graph_hash_at_run === 'string' && result.graph_hash_at_run.length > 0
        ? result.graph_hash_at_run
        : null,
  }
}

export interface BuildPersistedSnapshotParams {
  row: PersistedAnalysisRunRow
  runNumber: number
  /** Scenario events, for the between-runs edit summary. */
  events: ScenarioEvent[]
  previousSnapshotTimestamp: string | null
}

/**
 * Rebuild one snapshot. Returns null when the row cannot be read as a
 * completed analysis — the caller omits it from the journey.
 */
export function buildSnapshotFromPersistedRun(
  params: BuildPersistedSnapshotParams,
): AnalysisSnapshot | null {
  const { row, runNumber, events, previousSnapshotTimestamp } = params

  const fact = parseRunFact(row.payload)
  if (!fact) return null

  const base = buildAnalysisSnapshot({
    rawV2Response: enrichmentToV2ResponseShape(fact),
    // No graph-at-run in a run_analysis fact. Passing null (not []) is what
    // makes graphHash / nodeCount / edgeCount / evidenceCoverage report
    // honest absence instead of a fabricated empty graph.
    nodes: null,
    edges: null,
    runNumber,
    events,
    previousSnapshotTimestamp,
  })

  return {
    ...base,
    // Durable identity: the fact row id, not a fresh uuid. Two hydrations of
    // the same history must produce the same runId, or React keys churn and
    // dedupe against session snapshots becomes impossible.
    runId: row.id,
    // `computed_at` is the moment the ANALYSIS was computed; the row's
    // `created_at` is when it was written. They differ by the persistence
    // round-trip only, but the former is the one the trajectory is about.
    timestamp: fact.computedAt ?? row.createdAt,
    source: 'persisted',
    // CEE's ANALYSIS-AFFECTING hash (`aag_v1`) — a DIFFERENT regime from the
    // UI's `generateGraphHash`. `source: 'persisted'` is what stops
    // `detectStructureChange` comparing it against a session snapshot's.
    graphHash: fact.graphHashAtRun,
  }
}

/**
 * Rebuild a whole journey, oldest-first. Rows that cannot be read are
 * dropped, and `runNumber` is stamped over the SURVIVORS so the numbering the
 * user sees is contiguous and matches what is actually rendered.
 */
export function buildSnapshotsFromPersistedRuns(
  rows: readonly PersistedAnalysisRunRow[],
  events: ScenarioEvent[],
): AnalysisSnapshot[] {
  const snapshots: AnalysisSnapshot[] = []
  for (const row of rows) {
    const previous = snapshots[snapshots.length - 1] ?? null
    const snapshot = buildSnapshotFromPersistedRun({
      row,
      runNumber: snapshots.length + 1,
      events,
      previousSnapshotTimestamp: previous?.timestamp ?? null,
    })
    if (snapshot) snapshots.push(snapshot)
  }
  return snapshots
}
