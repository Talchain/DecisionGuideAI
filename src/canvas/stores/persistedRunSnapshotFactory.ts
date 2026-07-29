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
 * `buildAnalysisSnapshot` reads all three off the object handed to it in the
 * `robustness` slot, so this module FOLDS the root-level values into that
 * object — root wins, an existing nested value is preserved as a fallback so
 * a future producer that moves them cannot silently blank the fields. Had the
 * doc been implemented verbatim, all three would render permanently empty
 * with no error to notice.
 */
import type { V2RunResponse } from '../../adapters/plot/v2/types'
import type { ScenarioEvent } from '../../types/scenario'
import type { AnalysisSnapshot } from '../compare-tab/types'
import type { PersistedAnalysisRunRow } from '../../services/analysisRunHistoryService'
import { buildAnalysisSnapshot } from './analysisSnapshotFactory'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0
}

/**
 * The CEE-owned half of the fact, plus the PLoT envelope it wraps.
 * Everything here is untrusted JSONB — `null` means "this row cannot be read
 * as a completed analysis", and the caller DROPS it rather than defaulting it.
 */
interface ParsedRunFact {
  enrichment: Record<string, unknown>
  /**
   * The two arrays every DECIDING snapshot field comes from, carried out of the
   * parser already proven non-empty. They are surfaced here rather than re-read
   * downstream so that `toV2ResponseShape` has no `?? []` arm to reach for —
   * the defaulting path finding 1 exploited cannot be written back in without
   * deleting a field from this type.
   */
  optionComparison: unknown[]
  factorSensitivity: unknown[]
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

  const enrichment = asRecord(result.enrichment)
  // No envelope ⇒ nothing to render. 773/773 live rows carry one; a row that
  // does not is a producer change, and the honest response is to omit the run
  // from the journey, not to render a run with every field blank.
  if (!enrichment) return null

  // ⚠ A PRESENT ENVELOPE IS NOT A READABLE RUN. Found by the adversarial
  // review of PR #523 (finding 1) and closed here pre-merge.
  //
  // Until this guard existed, `parseRunFact` accepted any row with
  // {object, fact_type, result, enrichment} and `toV2ResponseShape` DEFAULTED a
  // missing or empty `option_comparison` to `[]`. `buildAnalysisSnapshot`'s
  // pre-existing `winner?.win_probability ?? 0` then produced a fully
  // renderable snapshot. The reviewer's probe, reproduced verbatim here before
  // the fix:
  //
  //   RESULT:  {"winnerId":"","winnerLabel":"","winnerProbability":0,
  //             "goalProbability":null,"runnerUpProbability":null}
  //   FACTORS: {"topElasticity":0,"rankFlipRate":0,
  //             "influenceConcentration":0,"topCalibrationFactor":""}
  //
  // i.e. a run plotted on the trajectory at 0% with an empty winner label, and
  // a hero inviting the user to "Calibrate " at "0% influence" — three
  // fabricated measurements in one sentence. That is the absent≠zero class, on
  // the very path this module documents as "dropped, never defaulted": the
  // original three drop tests (non-object payload / wrong fact_type / no
  // enrichment) could not see this shape.
  //
  // Both arrays are non-empty in 773/773 live facts, so this costs nothing on
  // real data — it is a guard against PRODUCER DRIFT, and it makes that drift
  // loud by omission (a run vanishes from the journey) instead of silently
  // publishing zeros the engine never measured. The write surface is
  // service-role-only, so this was never reachable by a client.
  //
  // These are the two arrays the snapshot's DECIDING fields come from —
  // `option_comparison` for winner/runner-up/probabilities/goal, and
  // `factor_sensitivity` for the whole top-factor and calibration block. Every
  // OTHER producer field stays absence-preserving rather than drop-worthy
  // (`recommendation_stability` is legitimately absent in 426/773 runs and must
  // render "Not assessed", not delete the run).
  if (!isNonEmptyArray(enrichment.option_comparison)) return null
  if (!isNonEmptyArray(enrichment.factor_sensitivity)) return null

  return {
    enrichment,
    optionComparison: enrichment.option_comparison,
    factorSensitivity: enrichment.factor_sensitivity,
    computedAt: typeof result.computed_at === 'string' ? result.computed_at : null,
    graphHashAtRun:
      typeof result.graph_hash_at_run === 'string' && result.graph_hash_at_run.length > 0
        ? result.graph_hash_at_run
        : null,
  }
}

/**
 * Fold the enrichment-ROOT robustness siblings into the `robustness` object,
 * because that is the slot `buildAnalysisSnapshot`'s three extractors read.
 * Root wins; a nested value is kept as a fallback (forward-compatible if a
 * future PLoT build ever nests them).
 */
function composeRobustness(enrichment: Record<string, unknown>): V2RunResponse['robustness'] {
  const nested = asRecord(enrichment.robustness) ?? {}
  const folded: Record<string, unknown> = { ...nested }
  for (const key of ['inference_warnings', 'conditional_winners', 'edge_e_values'] as const) {
    if (Array.isArray(enrichment[key])) folded[key] = enrichment[key]
  }
  // Double cast, deliberately: the folded object is untrusted JSONB, not a
  // validated V2RobustnessActual. The factory's extractors already re-read
  // every field off it defensively (`as Record<string, unknown>` + type
  // guards), so widening through `unknown` is honest about what is known —
  // asserting the nominal type directly would claim a validation nobody did.
  return folded as unknown as V2RunResponse['robustness']
}

/**
 * Shape the parsed fact into the `V2RunResponse` slot the factory consumes. No
 * value is invented: absent producer fields stay absent, and the factory's own
 * absence-preserving branches then fire.
 *
 * ⚠ It takes the PARSED fact, not the raw enrichment, and that is the fix for
 * finding 1 rather than a refactor. The two deciding arrays arrive already
 * proven non-empty by `parseRunFact`, so there is no `Array.isArray(...) ?? []`
 * arm here to silently manufacture an empty comparison — which is exactly what
 * turned a shape-broken fact into a 0%-winner run on the trajectory. Restoring
 * a default would now require deleting a field from `ParsedRunFact`.
 */
function toV2ResponseShape(fact: ParsedRunFact): V2RunResponse {
  return {
    ...fact.enrichment,
    option_comparison: fact.optionComparison,
    factor_sensitivity: fact.factorSensitivity,
    robustness: composeRobustness(fact.enrichment),
  } as unknown as V2RunResponse
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
    rawV2Response: toV2ResponseShape(fact),
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
