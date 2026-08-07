/**
 * Analysis Snapshot Factory
 *
 * Pure function that builds an AnalysisSnapshot from available data
 * at analysis completion time. Separated from the store for clean
 * unit testing without Zustand mocking.
 */
import type { Node, Edge } from '@xyflow/react'
import type { V2RunResponse, V2FactorSensitivity, V2OptionComparison } from '../../adapters/plot/v2/types'
import type { ReportV1 } from '../../adapters/plot/types'
import type { ScenarioEvent, ScenarioEventType } from '../../types/scenario'
import { SYSTEM_MARKER_EVENT_TYPES } from '../../types/scenario'
import type { AnalysisSnapshot, FactorSensitivitySummary, SnapshotOption } from '../compare-tab/types'
import { generateGraphHash } from '../utils/graphHash'
import { buildGraphProjection, NO_EDITS_SUMMARY } from '../compare-tab/graphChangeDiff'
import { hasObservedData } from '../utils/observedStateHelpers'
import { deriveDecisionVerdict, type DecisionVerdict } from '../../lib/decisionVerdict'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
} from '../../components/results/utils/selectGoalProbability'

export interface BuildSnapshotParams {
  rawV2Response: V2RunResponse
  /**
   * Unused by this factory (kept in the signature only because every live
   * caller already holds it and dropping it from the call sites would be
   * churn). Optional so a caller rebuilding a PAST run from a persisted fact
   * — which has no ReportV1 — is not forced to invent one.
   */
  report?: ReportV1 | null
  /**
   * The graph the analysis was computed over.
   *
   * `null` when the caller does not HAVE it — the persisted-run rebuild path
   * (`persistedRunSnapshotFactory`): a `run_analysis` fact stores the
   * analysis, not the model. Passing `[]` instead would be a fabrication with
   * three separate consequences, all silent: `generateGraphHash([], [])` is a
   * real hash of an empty graph (so two rebuilt runs would compare EQUAL and
   * assert "structure unchanged"), `nodeCount`/`edgeCount` would read 0, and
   * `evidenceCoverage` would read "0/0" — a verdict of "no evidence anywhere"
   * that nobody measured. Absence is preserved as null instead (T2b).
   */
  nodes: Node[] | null
  edges: Edge[] | null
  runNumber: number
  events: ScenarioEvent[]
  previousSnapshotTimestamp: string | null
}

// ---------------------------------------------------------------------------
// Stability label thresholds (mirrors src/lib/stability.ts / UI-SEM-006)
// Layer 3: display-only derivation
// ---------------------------------------------------------------------------

function deriveStabilityLabel(stability: number): string {
  if (stability >= 0.7) return 'stable'
  if (stability >= 0.4) return 'mostly stable'
  return 'fragile'
}

// ---------------------------------------------------------------------------
// Evidence coverage ("3/5" format)
// ---------------------------------------------------------------------------

function computeEvidenceCoverage(nodes: Node[]): string {
  let total = 0
  let withData = 0
  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined
    if (data?.kind !== 'factor') continue
    total++
    if (hasObservedData(data)) withData++
  }
  return `${withData}/${total}`
}

// ---------------------------------------------------------------------------
// Factor sensitivity summary (top 5)
// ---------------------------------------------------------------------------

function extractTopFactors(
  factors: V2FactorSensitivity[],
): FactorSensitivitySummary[] {
  return [...factors]
    .sort((a, b) => Math.abs(b.elasticity ?? 0) - Math.abs(a.elasticity ?? 0))
    .slice(0, 5)
    .map(f => ({
      id: f.node_id ?? f.factor_id ?? '',
      label: f.factor_label ?? f.label ?? '',
      elasticity: f.elasticity ?? 0,
      rankFlipRate: f.rank_flip_rate ?? 0,
      attributionStability: f.attribution_stability ?? 'unknown',
    }))
}

// ---------------------------------------------------------------------------
// Influence concentration
// ---------------------------------------------------------------------------

function computeInfluenceConcentration(factors: V2FactorSensitivity[]): number {
  if (factors.length === 0) return 0
  const absElasticities = factors.map(f => Math.abs(f.elasticity ?? 0))
  const sum = absElasticities.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0
  const max = Math.max(...absElasticities)
  return Math.round((max / sum) * 100)
}

// ---------------------------------------------------------------------------
// ISL field extraction (root-wins dual read off the full response, all
// optional — live wire puts these at the response ROOT, legacy nested under
// `robustness`)
// ---------------------------------------------------------------------------

function extractConditionalWinners(
  response: V2RunResponse,
): AnalysisSnapshot['conditionalWinners'] {
  // ROADMAP 2.177: root-wins dual read — the same precedence #540 gave
  // `extractInferenceWarnings` (see its comment below for the full story).
  // This extractor read ONLY `robustness.conditional_winners`, while the live
  // wire puts the field at the response ROOT (773/773 live facts root, 0/773
  // nested), so live-captured snapshots carried `[]` where rehydrated ones
  // carried data.
  const root = (response as unknown as Record<string, unknown> | undefined)?.conditional_winners
  const nested = (response?.robustness as Record<string, unknown> | undefined)?.conditional_winners
  const raw = Array.isArray(root) ? root : nested
  if (!Array.isArray(raw)) return []
  return raw
    .filter((w: Record<string, unknown>) => w && typeof w === 'object')
    .map((w: Record<string, unknown>) => ({
      factorId: String(w.factor_id ?? w.node_id ?? ''),
      factorLabel: String(w.factor_label ?? w.label ?? ''),
      winner: String(w.high_bucket && typeof w.high_bucket === 'object'
        ? (w.high_bucket as Record<string, unknown>).winner_label ?? ''
        : ''),
      condition: w.split_value != null
        ? `When ${String(w.factor_label ?? w.label ?? 'factor')} exceeds ${w.split_value}${w.split_unit ? ` ${w.split_unit}` : ''}`
        : '',
    }))
}

function extractEdgeEValues(
  response: V2RunResponse,
  nodes: Node[] | null,
  _edges: Edge[] | null,
): AnalysisSnapshot['edgeEValues'] {
  // ROADMAP 2.177: root-wins dual read — same defect and same fix as
  // `extractConditionalWinners` above. The nodes/edges parameters stay: label
  // resolution is this extractor's own concern, independent of which slot the
  // values arrive in.
  const root = (response as unknown as Record<string, unknown> | undefined)?.edge_e_values
  const nested = (response?.robustness as Record<string, unknown> | undefined)?.edge_e_values
  const raw = Array.isArray(root) ? root : nested
  if (!Array.isArray(raw)) return []

  // Build node label lookup. Absent nodes (persisted-run rebuild) degrade to
  // the raw edge ids below — the same fallback an unlabelled node already
  // takes, so no branch is added and no label is invented.
  const nodeLabels = new Map<string, string>()
  for (const n of nodes ?? []) {
    const data = n.data as Record<string, unknown> | undefined
    if (data?.label) nodeLabels.set(n.id, String(data.label))
  }

  return raw
    .filter((ev: Record<string, unknown>) =>
      typeof ev?.edge_id === 'string' && typeof ev?.e_value === 'number')
    .map((ev: Record<string, unknown>) => {
      const edgeId = String(ev.edge_id)
      // Edge IDs are "from_id->to_id" format — resolve labels
      const parts = edgeId.split('->')
      const fromLabel = parts[0] ? nodeLabels.get(parts[0]) ?? parts[0] : ''
      const toLabel = parts[1] ? nodeLabels.get(parts[1]) ?? parts[1] : ''
      return {
        edgeId,
        edgeLabel: `${fromLabel} → ${toLabel}`,
        eValue: Number(ev.e_value),
      }
    })
}

function extractInferenceWarnings(
  response: V2RunResponse,
): string[] {
  // ROADMAP 2.173 (Paul-ratified 2026-07-30): root-wins dual read, the same
  // precedence `persistedRunSnapshotFactory`'s `composeRobustness` fold
  // applied (that fold compensated the persisted-rebuild path only, and was
  // deleted as redundant under ROADMAP 2.177 once all three extractors here
  // adopted this read — see that module's HISTORY block). This extractor read
  // ONLY `robustness.inference_warnings` — empty on every live run (0/827
  // measured 2026-07-30; response ROOT 419/827 non-empty) — so live-captured
  // snapshots carried `[]` and rehydrated ones carried data: the same Compare
  // diff was blank or populated depending on capture path. Reading the root
  // here makes both callers agree. See the coherence pin in
  // __tests__/analysisSnapshotFactory.inferenceWarnings.spec.ts and
  // readInferenceWarnings' header for the adoption history.
  const root = (response as unknown as Record<string, unknown> | undefined)?.inference_warnings
  const nested = (response?.robustness as Record<string, unknown> | undefined)?.inference_warnings
  const raw = Array.isArray(root) ? root : nested
  if (!Array.isArray(raw)) return []
  return raw
    .map((w: unknown) => {
      if (typeof w === 'string') return w
      if (w && typeof w === 'object') {
        const obj = w as Record<string, unknown>
        return String(obj.message ?? obj.code ?? '')
      }
      return ''
    })
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Edit summary derivation
// ---------------------------------------------------------------------------

// Events that count as a user edit for the Compare-tab summary.
// Derived, not hand-kept-disjoint: any type classified as a system persistence
// marker (types/scenario SYSTEM_MARKER_EVENT_TYPES) is structurally removed
// here, so a future marker can never start inflating the edit count just
// because someone forgot this list existed.
const EDIT_EVENT_TYPES: ReadonlySet<ScenarioEventType> = new Set(
  (['direct_edit', 'patch_accepted', 'graph_drafted', 'stage_changed'] as ScenarioEventType[])
    .filter((t) => !SYSTEM_MARKER_EVENT_TYPES.has(t)),
)

function deriveEditSummary(
  events: ScenarioEvent[],
  previousTimestamp: string | null,
  runNumber: number,
): string {
  if (runNumber === 1) return 'Initial analysis'

  const relevant = previousTimestamp
    ? events.filter(e =>
        EDIT_EVENT_TYPES.has(e.event_type) &&
        e.timestamp > previousTimestamp
      )
    : []

  // ⚠ ROADMAP 2.578 — THIS SENTENCE IS NO LONGER A CLAIM COMPARE WILL PUBLISH
  // ON ITS OWN. An empty event log is evidence of nothing: on the deployed
  // build `direct_edit` events are gated behind `isJourneyTabEnabled()` (unset
  // ⇒ false), appended best-effort, and read from a load-time-only
  // `_hydratedEvents` snapshot — so "no relevant events" is the log's normal
  // state after a real edit. `buildTransition` now only surfaces this string
  // when the GRAPH PROJECTION independently says the two runs are identical.
  // An event log can witness presence; it can never witness absence.
  if (relevant.length === 0) return NO_EDITS_SUMMARY

  // Try to extract a specific label from a single edit
  if (relevant.length === 1) {
    const detail = relevant[0].details
    if (detail && typeof detail === 'object') {
      const label = (detail as Record<string, unknown>).label ??
                    (detail as Record<string, unknown>).summary
      if (typeof label === 'string' && label.length <= 60) return label
    }
    // Fallback descriptions per event type
    switch (relevant[0].event_type) {
      case 'direct_edit': return 'Edited model'
      case 'patch_accepted': return 'Accepted draft changes'
      case 'graph_drafted': return 'New graph drafted'
      case 'stage_changed': return 'Stage changed'
      default: return 'Model updated'
    }
  }

  // Multiple edits — summarise counts
  const editCount = relevant.filter(e => e.event_type === 'direct_edit').length
  const patchCount = relevant.filter(e => e.event_type === 'patch_accepted').length
  const parts: string[] = []
  if (editCount > 0) parts.push(`Edited ${editCount} factor${editCount > 1 ? 's' : ''}`)
  if (patchCount > 0) parts.push(`Accepted ${patchCount} patch${patchCount > 1 ? 'es' : ''}`)
  if (parts.length === 0) parts.push(`${relevant.length} changes`)

  const summary = parts.join(', ')
  return summary.length > 60 ? summary.slice(0, 57) + '...' : summary
}

// ---------------------------------------------------------------------------
// Per-option summary + the run's OWN leader verdict (ROADMAP 2.113a slice 2)
// ---------------------------------------------------------------------------

/**
 * Every option the run ACTUALLY SCORED, in the order the winner/runner-up pair
 * is already chosen from. No new quantity: the same array, kept whole.
 *
 * TWO DROP RULES, and they are the same rule twice.
 *
 * 1. **No usable id** — two id-less options would collide into one row in the
 *    side-by-side table and report a delta between two different options.
 *
 * 2. **No usable `win_probability`** — ⚠ ADDED BY THE ADVERSARIAL REVIEW OF
 *    #526 (finding 1), and it closes a live fabrication path. `parseRunFact`'s
 *    slice-1 guards require the option ARRAY to be non-empty; they say nothing
 *    about the ITEMS. So an item with an id and a label but no probability
 *    reached this function and `?? 0` scored it at zero. Reproduced in the pair
 *    table at `1a08cca9`:
 *
 *        ROW X RENDERS: "Option X | 55% | 0% | -55pp"
 *
 *    — a 0% the producer never sent, and a **−55pp delta measured against it**,
 *    inside the table whose own header says "no baseline, no default and no
 *    re-derivation anywhere in this file". The absence was already handled
 *    honestly twice in this same commit — rule 1 above, and
 *    `deriveRunLeaderVerdict` mapping the missing probability to `null` so the
 *    verdict never sees a fabricated number. Only this line had the `?? 0`.
 *
 * A dropped option is not silence: it becomes a MEMBERSHIP row in the pair view
 * ("Only in run N"), so producer drift is loud by omission instead of being
 * published as a measurement the engine never made. Live cost is zero —
 * 2,850/2,850 live option items carry `win_probability`.
 *
 * ⚠ A PRODUCER-SENT `0` IS AN HONEST MEASUREMENT AND SURVIVES. The guard is on
 * ABSENCE (and on NaN / Infinity / non-numbers), never on the value; a control
 * test pins that, so tightening this into "drop the losers" cannot pass.
 *
 * Order matters: a malformed item is skipped WITHOUT claiming its id, so a
 * well-shaped entry carrying the same id still lands.
 */
function extractOptions(sorted: readonly V2OptionComparison[]): SnapshotOption[] {
  const out: SnapshotOption[] = []
  const seen = new Set<string>()
  for (const o of sorted) {
    const id = typeof o?.option_id === 'string' ? o.option_id : ''
    if (id.length === 0 || seen.has(id)) continue
    const win = o.win_probability
    if (typeof win !== 'number' || !Number.isFinite(win)) continue
    seen.add(id)
    out.push({
      id,
      label: typeof o.option_label === 'string' ? o.option_label : '',
      winProbability: Math.round(win * 100),
    })
  }
  return out
}

/**
 * The run's own leader verdict, from the ONE module entitled to produce it.
 *
 * ⚠ THIS IS NOT A SECOND WINNER DERIVATION. `deriveDecisionVerdict` reads only
 * PRODUCER signals (`robustness.near_tie`, `decision_brief.headline_banded`,
 * `robustness.recommended_option_id`) and returns the no-claim verdict when
 * none applies — its whole reason for existing is that sixteen surfaces were
 * each classifying a leader for themselves. Compare must not become the
 * seventeenth, so it quotes this one.
 *
 * `option_probabilities` is the shape that module reads win probabilities out
 * of, and the PLoT envelope does not carry it (**0 of 790 live persisted
 * facts**, probed read-only 2026-07-29). It is RESHAPED here from
 * `option_comparison` — the identical move `persistedRunSnapshotFactory`
 * already makes to feed this factory — never recomputed. Options without an id
 * are omitted, so a malformed entry cannot become the `''` key and be picked
 * as a leader.
 */
function deriveRunLeaderVerdict(
  rawV2Response: V2RunResponse,
  sorted: readonly V2OptionComparison[],
): DecisionVerdict {
  const optionProbabilities: Record<string, { win_probability?: number | null }> = {}
  for (const o of sorted) {
    const id = typeof o?.option_id === 'string' ? o.option_id : ''
    if (id.length === 0 || id in optionProbabilities) continue
    optionProbabilities[id] = { win_probability: o.win_probability ?? null }
  }

  return deriveDecisionVerdict({
    option_probabilities: optionProbabilities,
    robustness: rawV2Response.robustness
      ? {
          recommended_option_id: rawV2Response.robustness.recommended_option_id ?? null,
          near_tie: rawV2Response.robustness.near_tie,
          nearTie: rawV2Response.robustness.nearTie,
        }
      : null,
    decision_brief: rawV2Response.decision_brief ?? null,
  })
}

// ---------------------------------------------------------------------------
// Main factory function
// ---------------------------------------------------------------------------

export function buildAnalysisSnapshot(params: BuildSnapshotParams): AnalysisSnapshot {
  const { rawV2Response, report: _report, nodes, edges, runNumber, events, previousSnapshotTimestamp } = params

  // Sort options by win_probability descending
  const options = [...(rawV2Response.option_comparison ?? [])]
    .sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))

  const winner = options[0] as V2OptionComparison | undefined
  const runnerUp = options.length > 1 ? options[1] : null

  // Factor sensitivity
  const factors = rawV2Response.factor_sensitivity ?? []
  const topFactors = extractTopFactors(factors)

  // The factor the Compare hero invites the user to calibrate.
  //
  // ⛔ This used to be `max evpi_percentage_points`, with `?? 0` fabricating
  // absence as a confident zero — twice (here and on `topEvpiValue`). The
  // quantity is refuted: ISL measures 0.0pp for the very factors PLoT scores
  // at 12.3 / 10.2 / 6.6 in the same payload, and the formula multiplies BY
  // the top-two win-probability gap, inverting decision theory.
  //
  // It is now `topFactors[0]` — max |elasticity| — which is the SAME quantity
  // the hero already prints one clause earlier as "{topElasticity}% influence".
  // One sentence, one source, and no new number introduced.
  const topCalibrationFactor = topFactors[0]

  // Robustness
  //
  // T2b: absence-preserving. `?? 0` here was a T2-class fabrication — a
  // default that makes a fail-closed guard pass — on a PERSISTENCE surface,
  // so the false value outlived the run that produced it. It also fabricated
  // a VERDICT, not just a number: deriveStabilityLabel(0) === 'fragile', so a
  // producer that sent no robustness data at all made the compare tab assert
  // "Model fragile". An honest producer-sent 0 still flows through.
  const robustness = rawV2Response.robustness
  const stability = typeof robustness?.recommendation_stability === 'number'
    && Number.isFinite(robustness.recommendation_stability)
    ? robustness.recommendation_stability
    : null

  // Goal probability (from winner)
  //
  // GOAL-PROBABILITY IDENTITY: read the owner's decision, never re-derive it.
  // This file held a THIRD chooser — `probability_of_goal` with no fallback for
  // `goal_probability`, and the joint figure taken straight off the wire — so a
  // snapshot could record a different number from the one the panel and the
  // canvas showed for the same run, and then outlive the run that produced it.
  // `selectGoalProbability` accepts the wire spelling (see its registration
  // header), so the whole option object goes to the owner as-is.
  const goalDecision = selectGoalProbability(winner as GoalProbabilityInput | undefined)
  const goalProbability = goalDecision.goalProbability != null
    ? Math.round(goalDecision.goalProbability * 100)
    : null
  const jointGoalProbability = goalDecision.jointGoalProbability != null
    ? Math.round(goalDecision.jointGoalProbability * 100)
    : null

  // Seed
  //
  // T2b: absence-preserving, and NaN-safe. The old `Number(...)` turned a
  // malformed echo into NaN, which survives every `!= null` guard downstream
  // and renders as "Seed NaN"; the `: 0` arm fabricated a seed outright.
  // Mirrors resolveSeedUsed (useV2Run) and hydrateAnalysis.ts:111-115.
  const rawSeed = rawV2Response.meta?.seed_used
  const parsedSeed = rawSeed != null ? Number.parseInt(String(rawSeed), 10) : Number.NaN
  const seedUsed: number | null = Number.isFinite(parsedSeed) ? parsedSeed : null

  return {
    runId: crypto.randomUUID(),
    runNumber,
    timestamp: new Date().toISOString(),
    // The graph-derived block. All four fields stand or fall together with
    // `nodes`/`edges`: they are facts ABOUT THE MODEL, and a caller rebuilding
    // a past ANALYSIS does not have the model. See BuildSnapshotParams.nodes.
    source: 'session',
    graphHash: nodes != null && edges != null ? generateGraphHash(nodes, edges) : null,
    nodeCount: nodes != null ? nodes.length : null,
    edgeCount: edges != null ? edges.length : null,
    // ROADMAP 2.578 — same absence rule as the three fields above, stated once
    // in BuildSnapshotParams.nodes: no graph ⇒ no projection ⇒ Compare says
    // "cannot characterise" rather than inventing "no edits".
    graphProjection: nodes != null && edges != null ? buildGraphProjection(nodes, edges) : null,

    options: extractOptions(options as V2OptionComparison[]),
    leaderVerdict: deriveRunLeaderVerdict(rawV2Response, options as V2OptionComparison[]),

    winnerId: winner?.option_id ?? '',
    winnerLabel: winner?.option_label ?? '',
    winnerProbability: Math.round((winner?.win_probability ?? 0) * 100),
    runnerUpId: runnerUp?.option_id ?? null,
    runnerUpLabel: runnerUp?.option_label ?? null,
    // ROADMAP 2.834 — this line had TWO absence paths and only one was honest.
    // `runnerUp ? … : null` correctly reports "there is no runner-up", but the
    // inner `win_probability ?? 0` published a confident 0% for a runner-up
    // that EXISTS and simply was not scored. The snapshot is a persistence
    // surface, so that fabricated 0 outlived the run and replayed on the
    // compare tab in every later session.
    //
    // The type is unchanged (`number | null`, types.ts:144) — absence was
    // already first-class here, so no consumer contract moves. `winnerProbability`
    // above deliberately keeps its `?? 0`: it is non-nullable and is consumed
    // ARITHMETICALLY by deriveCompareState, so making it nullable would change
    // which hero copy fires (out of scope, ROADMAP 2.835).
    runnerUpProbability:
      runnerUp?.win_probability != null ? Math.round(runnerUp.win_probability * 100) : null,

    recommendationStability: stability,
    stabilityLabel: stability != null ? deriveStabilityLabel(stability) : null,
    // T2b: absence-preserving. PR #326 made the mapper's fragile_edges /
    // robust_edges absence-preserving so AdvancedSection honestly HIDES the
    // row when the producer sent nothing — but this line re-fabricated a 0
    // into the snapshot, so the same run reported "unknown" on one surface and
    // "0 fragile" on another (compare-tab). That cross-surface incoherence is
    // what #322 was merged to prevent. An honest `fragile_edges: []` (the
    // producer measured and found none) still reports 0.
    fragileEdgeCount: robustness?.fragile_edges != null
      ? robustness.fragile_edges.length
      : null,

    evidenceCoverage: nodes != null ? computeEvidenceCoverage(nodes) : null,

    topFactors,
    influenceConcentration: computeInfluenceConcentration(factors),
    topCalibrationFactor: topCalibrationFactor?.label ?? '',
    topCalibrationFactorId: topCalibrationFactor?.id ?? '',
    topElasticity: topFactors.length > 0
      ? Math.round(Math.abs(topFactors[0].elasticity) * 100)
      : 0,
    rankFlipRate: topFactors.length > 0 ? topFactors[0].rankFlipRate : 0,

    goalProbability,
    jointGoalProbability,

    inferenceWarnings: extractInferenceWarnings(rawV2Response),
    conditionalWinners: extractConditionalWinners(rawV2Response),
    edgeEValues: extractEdgeEValues(rawV2Response, nodes, edges),

    seedUsed,
    responseHash: rawV2Response.response_hash ?? '',
    editSummary: deriveEditSummary(events, previousSnapshotTimestamp, runNumber),
  }
}
