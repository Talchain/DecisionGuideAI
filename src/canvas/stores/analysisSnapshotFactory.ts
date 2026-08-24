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
import {
  collectStructurallyProvenNoFlipIds,
  type FlipAttestationRowLike,
} from '../../components/results/utils/flipReasonVocabulary'

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

/**
 * The producer's stated elasticity for one wire factor, sign preserved — or
 * `null` where the producer stated none.
 *
 * ⚠ THIS IS THE ONLY PLACE IN THIS FILE THAT READS THE RAW `elasticity` FIELD,
 * and that is the point of it. Four sites here each answered "did the producer
 * score this factor?" for themselves, in four different spellings — `?? 0` in
 * the sort, `typeof` + `Number.isFinite` in the summary map, a `filter` with a
 * third spelling in the concentration denominator, and a bare `!== null` at the
 * hero's percentage. Four spellings of one question are four chances to answer
 * it differently, and `?? 0` was already answering it wrongly: it filed "not
 * measured" under "measured as exactly zero", which is the strongest claim the
 * field can make.
 *
 * The `elasticity` claim family is registered as FROZEN, SHRINK-ONLY DEBT with
 * no estate-wide owner selector
 * (`src/components/results/utils/elasticityClaimDebt.ts`). This is the
 * file-local half of that convergence — one authority inside this file, leaving
 * a single call site for the real owner to take over when it lands. It does not
 * claim to BE that owner, and deliberately registers no `CLAIM_OWNERSHIP`:
 * two modules registering one family is a hard RED in the walker's control 3a.
 */
function scoredElasticity(f: V2FactorSensitivity): number | null {
  const stated = f.elasticity
  return typeof stated === 'number' && Number.isFinite(stated) ? stated : null
}

/**
 * Magnitude of a scored elasticity; absence propagates as `null` rather than
 * collapsing to 0. The sign convention lives here once, instead of at each of
 * the three sites that used to spell `Math.abs` beside their own null test.
 */
function elasticityMagnitude(f: V2FactorSensitivity): number | null {
  const stated = scoredElasticity(f)
  return stated === null ? null : Math.abs(stated)
}

/**
 * The hero's "{n}% influence" for the top factor — `null` when there is no top
 * factor, or when the producer did not score the one there is.
 *
 * Reads the ALREADY-ADAPTED summary rather than the wire, so the scored-ness
 * decision is `scoredElasticity`'s, made once upstream, not re-litigated here.
 * The `: 0` this replaces was the same fabrication the rest of this factory had
 * already been cleaned of (`stability`, `fragileEdgeCount`, `seedUsed`,
 * `runnerUpProbability`); it survived because it sits in the FACTOR-sensitivity
 * trio rather than the robustness block, and each cleanup was scoped to the
 * block in front of it.
 */
function topInfluencePercent(top: FactorSensitivitySummary | undefined): number | null {
  const stated = top?.elasticity ?? null
  return stated === null ? null : Math.round(Math.abs(stated) * 100)
}

function extractTopFactors(
  factors: V2FactorSensitivity[],
): FactorSensitivitySummary[] {
  return [...factors]
    // D7: an UNSCORED factor sorts LAST rather than being folded in among the
    // genuinely-zero ones. `Math.abs(x ?? 0)` put "not measured" and "measured
    // as exactly zero" in the same place, so `topFactors[0]` — the factor the
    // hero invites the user to calibrate — could be a factor nobody scored.
    .sort((a, b) => {
      const av = elasticityMagnitude(a)
      const bv = elasticityMagnitude(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
    .slice(0, 5)
    .map(f => ({
      id: f.node_id ?? f.factor_id ?? '',
      label: f.factor_label ?? f.label ?? '',
      // D7 absence-preserving. `?? 0` here was the load-bearing mint: it fed
      // `topElasticity`, `influenceConcentration` and the transition sentence
      // "elasticity 0.00", all three of which read as measurements.
      elasticity: scoredElasticity(f),
      rankFlipRate: typeof f.rank_flip_rate === 'number' && Number.isFinite(f.rank_flip_rate)
        ? f.rank_flip_rate
        : null,
      attributionStability: f.attribution_stability ?? 'unknown',
    }))
}

// ---------------------------------------------------------------------------
// Influence concentration
// ---------------------------------------------------------------------------

/**
 * D7 absence-preserving. Two distinct returns of `0` were fabrications and one
 * was a real result, and the old signature could not tell them apart:
 *   · no factors at all                 → NOTHING WAS MEASURED  → null
 *   · factors present, none scored      → NOTHING WAS MEASURED  → null
 *   · every scored elasticity is 0.0    → a genuine measurement → 0
 * The third is preserved deliberately: this is the opposite-direction twin, and
 * suppressing a computed 0 would be the same defect pointing the other way.
 *
 * Unscored factors are EXCLUDED from the denominator rather than counted as
 * zero — counting them would deflate `max/sum` by exactly the number of
 * measurements the producer declined to make.
 */
function computeInfluenceConcentration(factors: V2FactorSensitivity[]): number | null {
  const absElasticities = factors
    .map(elasticityMagnitude)
    .filter((v): v is number => v !== null)
  if (absElasticities.length === 0) return null
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

  // ── D7 GATE 0: THE COHERENCE GATE'S CX5 FINDING, ACTED ON ────────────────
  // `crossSurfaceCoherence` pair CX5 detects a flip attestation beside
  // `conditional_winners.winner_flips: true` FOR THE SAME FACTOR. Until #788
  // the gate only OBSERVED it: nothing consumed the finding, so a detector with
  // no consumer is instrumentation, not a guarantee.
  //
  // This is not hypothetical. The real capture
  // `seeded-2026-08-17-w2d-analysis-turn.json` carries
  // `flip_reason: 'structurally_invariant'` for factors `71c6351d` and
  // `fcf3d740`, and `winner_flips: true` for those SAME two ids — and the
  // Compare tab rendered "…, Floating price contract takes over" for a factor
  // the same payload declares cannot flip at all.
  //
  // ⚠ D7b — NARROWED, AND THE NARROWING IS THE POINT. This gate first keyed on
  // `no_flip_in_range === true`. That boolean is stamped by PLoT from the SET
  // of BOTH attested reasons (`factor-flip-values.ts:304` over
  // `NO_EFFECT_REASONS`, `flip-threshold-status.ts:75-78`), and the two reasons
  // are epistemically different objects:
  //
  //   · `structurally_invariant` — slopes IDENTICAL (spread <= 1e-9). The
  //     per-sample winner is independent of the factor, so the median-split
  //     buckets behind `winner_flips` are two random halves of ONE sequence and
  //     their disagreement is sampling noise. SUPPRESS.
  //     ⚠ NOT "topological, so it holds under every sampled draw" — that
  //     wording is withdrawn. ISL computes a NUMERICAL spread at ONE
  //     configuration (the same MEAN one that disqualifies the token below).
  //     The invariance rests on a MECHANISM — options are alternative values of
  //     one decision node, so every option severs the same paths and the slopes
  //     are the same expression — which covers the dominant case but not slopes
  //     that merely coincide at the mean via different path products. Canonical
  //     derivation and the residual class: `results/utils/flipReasonVocabulary.ts`
  //     (`provesFactorCannotMoveWinner`). Disposition unchanged.
  //   · `no_effect_within_bounds` — slopes GENUINELY DIFFER; only the crossing
  //     sits outside the domain at the MEAN edge configuration. Sampled draws
  //     move the crossing, so a bucket disagreement can be a real finding.
  //     Suppressing it withholds science ISL computed. KEEP.
  //
  // So the gate reads the REASON, through the one module that owns the
  // producer's vocabulary — never a second local copy of the token (trap 12).
  // Reading the reason also WIDENS the gate in the direction that mattered:
  // a row carrying the proof WITHOUT the boolean used to render here while the
  // results panel's `selectFlipRisk` (which reads `flip_reason`) refused the
  // same run — a fresh instance of the sibling-surface disagreement #788 set
  // out to close.
  //
  // WHY SUPPRESS RATHER THAN RECONCILE, for the arm that is suppressed. Under
  // the algebraic proof the two statements answer the SAME question ("can this
  // factor flip the winner?") and one instrument provably cannot discriminate.
  // Rendering both is the falsehood; declining the artefact is not withholding
  // anything the producer coherently stated.
  const noFlipFactorIds = collectNoFlipFactorIds(response)

  return raw
    .filter((w: Record<string, unknown>) => w && typeof w === 'object')
    // ── D7 GATE 1: THE PRODUCER'S FLIP ATTESTATION ───────────────────────────
    // `winner_flips` is a REQUIRED boolean in the contract
    // (`EnrichmentConditionalWinnerSchema`, vendored 0.48.0) that admits
    // `false`, and the producer's own doc states it says THAT the winner
    // changes across the split, never WHICH option. This extractor read no
    // attestation at all: it took `high_bucket.winner_label` and
    // `deriveTransitions` rendered "…, {label} takes over" — a takeover claim
    // minted from a bucket label, for a row the science may have attested does
    // NOT flip. `ConditionalWinnerCards.tsx:86` (the results panel) already
    // gates on this field; the Compare tab is the sibling surface that was left
    // behind, so one payload produced a flip claim on one surface and not the
    // other.
    .filter((w: Record<string, unknown>) => w.winner_flips === true)
    .filter((w: Record<string, unknown>) =>
      !(typeof w.factor_id === 'string' && noFlipFactorIds.has(w.factor_id)))
    // ── D7 GATE 2: A CLAIM NEEDS A THRESHOLD IT CAN STATE ────────────────────
    // "flips at N" requires a finite N. A row without one cannot state the
    // condition, and the old `: ''` arm produced the bare fragment ", X takes
    // over" with no "when".
    .filter((w: Record<string, unknown>) =>
      typeof w.split_value === 'number' && Number.isFinite(w.split_value))
    // ── D7 GATE 3: IDENTITY, NOT LABEL ───────────────────────────────────────
    // When BOTH bucket identities are on the wire they are the discriminator,
    // and they outrank the labels: two options can share one display label (a
    // real flip a label filter cannot see) and a relabelled option is not a
    // flip. Equal ids beside `winner_flips: true` is a producer
    // self-contradiction (coherence pair CX5's shape) — the honest response is
    // to decline the claim, not to reconcile it. When an id is ABSENT the
    // producer has WITHHELD it, which is not a contradiction and is handled
    // below by declining to NAME the option rather than dropping the row.
    .filter((w: Record<string, unknown>) => {
      const lo = bucketMember(w.low_bucket, 'winner_id')
      const hi = bucketMember(w.high_bucket, 'winner_id')
      if (lo === null || hi === null) return true
      return lo !== hi
    })
    .map((w: Record<string, unknown>) => {
      const highId = bucketMember(w.high_bucket, 'winner_id')
      const highLabel = bucketMember(w.high_bucket, 'winner_label')
      const factorLabel = String(w.factor_label ?? w.label ?? '')
      return {
        factorId: String(w.factor_id ?? w.node_id ?? ''),
        factorLabel,
        // Absence here means WITHHELD, per the contract's stated absence
        // semantics ("It never means 'no option won'"). `String(... ?? '')`
        // turned that withholding into an empty string that was then
        // interpolated into a sentence.
        winner: highLabel,
        winnerId: highId,
        lowWinnerId: bucketMember(w.low_bucket, 'winner_id'),
        condition: `When ${factorLabel !== '' ? factorLabel : 'this factor'} exceeds ${w.split_value}${w.split_unit ? ` ${String(w.split_unit)}` : ''}`,
      }
    })
}

/**
 * Factor ids whose `flip_thresholds` row carries the ALGEBRAIC no-flip proof.
 *
 * ⚠ D7b: the membership test is `collectStructurallyProvenNoFlipIds`, in
 * `components/results/utils/flipReasonVocabulary` — the one module that owns
 * the producer's flip vocabulary, and the module `selectFlipRisk` already
 * consults for the RUN-LEVEL question. A local token literal here would be the
 * hand-maintained mirror (trap 12) and, worse, a SECOND authority on what
 * "attested" means (trap 21) — which is precisely the disagreement this gate
 * exists to end. The two questions are named apart in that module's docblock;
 * they are deliberately NOT the same predicate.
 *
 * Bound by IDENTITY, never by `factor_label`: the two arrays are joined on the
 * id in the producer's own CX5 detector (`crossSurfaceCoherence.ts`), and a
 * label join would both miss a real contradiction between two same-labelled
 * factors and invent one between two differently-labelled rows for one factor.
 *
 * An ABSENT reason is not a negative one — an unknown token, a missing reason
 * or a probe failure all fail the proof, so nothing the producer computed is
 * withheld on the strength of a row that established nothing.
 */
function collectNoFlipFactorIds(response: V2RunResponse): Set<string> {
  const root = (response as unknown as Record<string, unknown> | undefined)?.flip_thresholds
  const nested = (response?.robustness as Record<string, unknown> | undefined)?.flip_thresholds
  const rows = Array.isArray(root) ? root : nested
  return collectStructurallyProvenNoFlipIds(
    (Array.isArray(rows) ? rows : []) as FlipAttestationRowLike[],
  )
}

/** Read one string member off a conditional-winner bucket. Absent ⇒ null. */
function bucketMember(bucket: unknown, key: string): string | null {
  if (!bucket || typeof bucket !== 'object') return null
  const v = (bucket as Record<string, unknown>)[key]
  return typeof v === 'string' && v !== '' ? v : null
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

    // ⛔ IDENTITY ONLY — see types.ts. `winnerLabel` and `winnerProbability`
    // stood here until ROADMAP 2.835 and are DELETED, not made nullable.
    //
    //     winnerProbability: Math.round((winner?.win_probability ?? 0) * 100)
    //
    // `win_probability` is OPTIONAL on the wire (`adapters/plot/v2/types.ts`),
    // so that `?? 0` published an unscored option as a confident 0% — on a
    // PERSISTENCE surface, so the fabricated zero outlived the run that failed
    // to produce it, exactly as ROADMAP 2.834's runner-up did one line below.
    //
    // The convergent fix was not a nullable field. These three were the
    // client-side ARGMAX — the "Authority 3" `src/lib/decisionVerdict.ts`
    // deleted — so making one of them absence-preserving would have left a
    // parallel leader rule standing beside `leaderVerdict`, which is emitted
    // four lines above and is the canonical owner. The tab's display surfaces
    // now read `deriveLeaderClaim`, and a leader's probability comes from the
    // `options` entry the verdict NAMES; an option the producer never scored is
    // not in `options` at all, so there is nothing left to coerce.
    //
    // `winnerId` survives for `CompareFooter`, which focuses a node — identity,
    // not a claim.
    winnerId: winner?.option_id ?? '',
    runnerUpId: runnerUp?.option_id ?? null,
    runnerUpLabel: runnerUp?.option_label ?? null,
    // ROADMAP 2.834 — this line had TWO absence paths and only one was honest.
    // `runnerUp ? … : null` correctly reports "there is no runner-up", but the
    // inner `win_probability ?? 0` published a confident 0% for a runner-up
    // that EXISTS and simply was not scored. The snapshot is a persistence
    // surface, so that fabricated 0 outlived the run and replayed on the
    // compare tab in every later session.
    //
    // The type is unchanged (`number | null`) — absence was already
    // first-class here, so no consumer contract moved.
    //
    // ⭐ THIS COMMENT USED TO END: "`winnerProbability` above deliberately
    // keeps its `?? 0` … making it nullable would change which hero copy
    // fires (out of scope, ROADMAP 2.835)." That was an accurate scope note
    // and it is now CLOSED. 2.835 did not make the field nullable — it found
    // that the field should not exist, because the surfaces reading it were
    // asking a client-side argmax a question `leaderVerdict` already answers.
    // Which hero copy fires is now decided by the producer's verdict, so the
    // arithmetic that forced the `?? 0` is gone with it.
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
    // D7 absence-preserving. Both lines had the identical `: 0` fabrication the
    // rest of this factory had already been cleaned of (`stability`,
    // `fragileEdgeCount`, `seedUsed`, `runnerUpProbability`). They survived
    // because they are the FACTOR-sensitivity trio rather than the robustness
    // block, and each cleanup was scoped to the block in front of it.
    topElasticity: topInfluencePercent(topFactors[0]),
    rankFlipRate: topFactors.length > 0 ? topFactors[0].rankFlipRate : null,

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
