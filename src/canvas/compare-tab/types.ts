/**
 * Compare Tab: Refinement Journey — Type Definitions
 *
 * Types for the analysis snapshot store, state machine,
 * and transition derivation.
 */

import type { DecisionVerdict } from '../../lib/decisionVerdict'
import type { GraphProjection, GraphChangeVerdict, GraphChangeKind } from './graphChangeDiff'

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface FactorSensitivitySummary {
  /** Node ID (stable, for canvas linking) */
  id: string
  label: string
  elasticity: number
  rankFlipRate: number
  /** Attribution stability label from PLoT bootstrap */
  attributionStability: string
}

/**
 * Where a snapshot came from, and — inseparably — which HASH REGIME its
 * `graphHash` belongs to. The two are one fact, so they are one field:
 * a second `graphHashFamily` field would be a hand-maintained mirror of this
 * one (CLAUDE.md trap 12).
 *
 *   • 'session'   captured in this browser session at `resultsComplete` from
 *                 the live canvas. `graphHash` is the UI's own
 *                 `generateGraphHash(nodes, edges)`.
 *   • 'persisted' rebuilt from a `v5_handler_facts` `run_analysis` row.
 *                 `graphHash` is CEE's ANALYSIS-AFFECTING hash (`aag_v1`)
 *                 as stored in `result.graph_hash_at_run`.
 *
 * ⚠ THE REGIMES NEVER COMPARE. Three different hashes over "the graph" exist
 * in this estate (UI `generateGraphHash`, CEE identity, CEE `aag_v1`); the
 * `model_versions` and `decision_records` DDL both say so explicitly. Any
 * code comparing two `graphHash` values MUST first check that both snapshots
 * share a `source` — see `detectStructureChange` in deriveTransitions.ts.
 */
export type SnapshotSource = 'session' | 'persisted'

/**
 * One option as the run scored it. ROADMAP 2.113a slice 2.
 *
 * The snapshot already kept the top TWO options (winner / runner-up); the
 * side-by-side compare needs every option, because "win probabilities per
 * option" is a per-option table. No new quantity is introduced: this is the
 * SAME `option_comparison` array `winnerId` and `runnerUpId` are already
 * taken from, kept whole instead of truncated at two.
 */
export interface SnapshotOption {
  id: string
  label: string
  /**
   * 0-100, rounded. THE tab's win-probability convention, and since ROADMAP
   * 2.835 the only one: every leader figure the Compare tab prints or plots is
   * this field, reached through the option the run's own verdict names.
   */
  winProbability: number
}

export interface AnalysisSnapshot {
  runId: string
  /** Sequential, 1-indexed */
  runNumber: number
  /** ISO 8601 */
  timestamp: string
  /**
   * Provenance AND hash regime. See {@link SnapshotSource} — comparing
   * `graphHash` across two different sources is meaningless.
   */
  source: SnapshotSource
  /**
   * 'session': `generateGraphHash(nodes, edges)`.
   * 'persisted': `result.graph_hash_at_run` (`aag_v1`).
   *
   * T2b absence-preserving: null when the run carries no hash at all. 55 of
   * the 773 live persisted runs have no `graph_hash_at_run`; a fabricated ''
   * would make two such runs compare EQUAL and silently assert "structure
   * unchanged" about two runs nobody measured.
   */
  graphHash: string | null
  /**
   * For structure-change detection alongside graphHash.
   *
   * T2b absence-preserving: null when the graph the run was computed over is
   * not available. A run rebuilt from a persisted fact has no graph — the
   * fact stores the analysis, not the model — so these are null there. A
   * fabricated 0 would report "the model lost every node" on the first
   * transition into a session snapshot.
   */
  nodeCount: number | null
  edgeCount: number | null

  /**
   * The canonical, comparable projection of the graph this run was computed
   * over (ROADMAP 2.578) — the analysis-affecting `data.*` values of every node
   * and edge, keyed by element id, derived from the SAME `analyticalNodeFields`
   * registry Staleness consumes. See `graphChangeDiff.ts`.
   *
   * This is what lets Compare report "strength 0.5 → 0.8 on THIS edge" instead
   * of inferring an edit from an event log that is never written, or inferring
   * a *structure* change from a *content* hash.
   *
   * T2b absence-preserving, and null under exactly the same rule as
   * `graphHash` / `nodeCount` / `edgeCount`: null when the graph is not
   * available (the persisted-run rebuild stores the analysis, not the model).
   * A fabricated `{ nodes: [], edges: [] }` would make two rebuilt runs compare
   * EQUAL and assert "no edits" about two models nobody looked at.
   */
  graphProjection: GraphProjection | null

  /**
   * Every option this run scored, sorted by win probability descending.
   * `[]` when the producer sent no option comparison at all (a persisted run
   * in that shape is DROPPED upstream by `parseRunFact`, so `[]` here can only
   * come from a session capture).
   */
  options: SnapshotOption[]

  /**
   * THIS RUN'S OWN leader verdict — `deriveDecisionVerdict` over the run's own
   * producer signals (`robustness.near_tie`, `decision_brief.headline_banded`,
   * `robustness.recommended_option_id`).
   *
   * ⚠ IT IS NOT `winnerId`. `winnerId` below is a client-side ARGMAX over
   * `option_comparison` — precisely the deleted "Authority 3" that
   * `src/lib/decisionVerdict.ts` exists to prevent. Any surface that says
   * "leads" / "leading option" / "winner" must read THIS field and honour
   * `hasLeadingOption`; `separation: 'unknown'` licenses silence, never a
   * denial. See that module's header for why the two are different questions.
   *
   * Turn it into a NAMEABLE claim with `deriveLeaderClaim`
   * (deriveRunPairComparison.ts) — the one derivation entitled to resolve a
   * verdict against this run's own options — never by hand at a call site.
   */
  leaderVerdict: DecisionVerdict

  /**
   * ⛔ IDENTITY ONLY. NOT A DISPLAY SOURCE, AND NOT A LEADER CLAIM.
   *
   * ROADMAP 2.835 retired the ARGMAX TRIO as a display source. `winnerLabel`
   * and `winnerProbability` are GONE — deleted rather than made nullable,
   * because a nullable argmax would have been a PARALLEL RULE standing beside
   * the canonical owner, and every surface that had reached for them would
   * have kept reaching. Deleting them makes the reach a type error instead,
   * exactly as `decisionVerdict` did by omitting `'win_probability'` from its
   * `source` union.
   *
   * `winnerProbability` was the estate's last minted zero on this tab:
   * `Math.round((winner?.win_probability ?? 0) * 100)` over an OPTIONAL wire
   * field, publishing an unscored option as a confident 0% — beside the
   * runner-up's honest "not scored in this run" (ROADMAP 2.834), inside one
   * string literal.
   *
   * `winnerId` SURVIVES because identity and entitlement are different
   * questions and `decisionVerdict`'s own doctrine keeps identity working for
   * non-claiming consumers. Its single remaining reader is `CompareFooter`,
   * which FOCUSES a node on the canvas — an action, not an assertion.
   * ⚠ If you are about to read this to say something to the user, you want
   * `deriveLeaderClaim` instead.
   */
  winnerId: string
  /** null if only 1 option */
  runnerUpId: string | null
  runnerUpLabel: string | null
  runnerUpProbability: number | null

  // Robustness
  //
  // T2b: these are absence-preserving. null means the producer sent no
  // robustness data — NOT "zero". Rendering a fabricated 0 here contradicted
  // AdvancedSection, which honestly hides the same fact when it is absent.
  /** Raw 0-1; null when the producer sent no recommendation_stability. */
  recommendationStability: number | null
  /** "fragile" | "mostly stable" | "stable"; null when stability is unknown. */
  stabilityLabel: string | null
  /** null when the producer sent no fragile_edges array. `[]` is an honest 0. */
  fragileEdgeCount: number | null

  // Evidence
  /**
   * "3/5" format — factor nodes carrying observed data, over all factor nodes.
   *
   * T2b absence-preserving: null when the run was rebuilt from a persisted
   * fact, because the quantity is derived from the GRAPH and the fact stores
   * only the analysis. "0/0" would be a fabricated verdict ("no evidence
   * anywhere"), and `coverageImproving` would then read a rise out of it.
   * Renders as "Not assessed", the same treatment `recommendationStability`
   * and `fragileEdgeCount` already get.
   */
  evidenceCoverage: string | null

  // Factor sensitivity — top 5 for transition derivation
  topFactors: FactorSensitivitySummary[]
  /** max |elasticity| / sum |elasticity|, as percentage */
  influenceConcentration: number
  /**
   * The factor the Compare hero invites the user to calibrate: the top factor
   * by |elasticity|, i.e. the same one whose influence the hero already prints.
   *
   * ⛔ Was `topEvpiFactor` / `topEvpiFactorId` / `topEvpiValue`, selected by
   * max `evpi_percentage_points` with `?? 0` fabricating absence as zero.
   * Renamed rather than left pointing at a quantity it no longer carries — a
   * field named for something it is not is the defect this estate keeps
   * paying for. `topEvpiValue` had exactly one reader (the removed hero
   * clause) and is gone entirely.
   */
  topCalibrationFactor: string
  /** Node ID for canvas linking */
  topCalibrationFactorId: string
  /** As percentage */
  topElasticity: number
  /** From top factor */
  rankFlipRate: number

  // Goal
  goalProbability: number | null
  jointGoalProbability: number | null

  // ISL fields (may be empty arrays when ISL doesn't provide them)
  inferenceWarnings: string[]
  conditionalWinners: Array<{
    factorId: string
    factorLabel: string
    winner: string
    condition: string
  }>
  edgeEValues: Array<{
    edgeId: string
    edgeLabel: string
    eValue: number
  }>

  // Meta
  /** T2b: null when the engine did not echo a usable seed — never a fabricated 0. */
  seedUsed: number | null
  responseHash: string
  /** Derived from events, max 60 chars */
  editSummary: string
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/**
 * State precedence: stale > flipped > noWinner > unclaimed > converged > improving
 *
 * ⚠ EVERY STATE EXCEPT `'stale'` AND `'unclaimed'` SELECTS COPY THAT MAKES A
 * LEADER CLAIM, so each is gated on the run's own `leaderVerdict` — never on
 * the client-side argmax (ROADMAP 2.835). The mapping, stated once:
 *
 *   `'flipped'`    both runs NAMED a leader and named different ones
 *                  (`deriveLeaderClaim(...).kind === 'named'` on both).
 *   `'noWinner'`   `separation === 'tied'` — the PRODUCER's own "no clear
 *                  leading option". Only a producer tie licenses that denial.
 *   `'unclaimed'`  the latest run named no leader. Copy makes NO claim in
 *                  either direction.
 *   `'converged'`  the last three runs all named the SAME leader and its own
 *                  probability moved < 3pp.
 *   `'improving'`  a named leader, otherwise.
 *
 * ⭐ `'unclaimed'` IS NOT A SYNONYM FOR `'noWinner'`, AND COLLAPSING THEM IS THE
 * DEFECT `src/lib/decisionVerdict.ts` EXISTS TO PREVENT. `separation: 'tied'`
 * is the producer SAYING the options are within noise; `'unknown'` is the
 * producer's SILENCE (a withheld turn drops `headline_banded` and nulls
 * `leading_option_id` while the win probabilities keep riding the wire — CEE
 * #711). Silence licenses no claim in either direction, so it must not become
 * "No clear leading option", which is a second claim we have no authority for.
 */
export type CompareState =
  | 'improving'
  | 'noWinner'
  | 'unclaimed'
  | 'converged'
  | 'flipped'
  | 'stale'

// ---------------------------------------------------------------------------
// Run selector
// ---------------------------------------------------------------------------

/**
 * `'pick'` (ROADMAP 2.113a slice 2) is the explicit A/B choice: any two runs,
 * side by side. The other three are the pre-existing presets.
 */
export type RunPreset = 'prev' | 'first' | 'all' | 'pick'

/** The two runs a `'pick'` comparison is over, by `runNumber`, from < to. */
export interface RunPair {
  from: number
  to: number
}

// ---------------------------------------------------------------------------
// Pick-two-runs comparison (ROADMAP 2.113a slice 2)
// ---------------------------------------------------------------------------

/**
 * Whether a quantity was measured on BOTH sides of the pair.
 *
 * `'only_from'` / `'only_to'` are the draft-variance case (ROADMAP 2.127): two
 * runs of the same scenario may score DIFFERENT option or factor sets. The one
 * thing that must never happen there is a numeric delta — subtracting against
 * an absent side means inventing a baseline of 0 and publishing it as a
 * measurement. Live incidence today is 0 of 83 consecutive owned run pairs;
 * this is producer-drift insurance, and it is pinned.
 */
export type PairPresence = 'both' | 'only_from' | 'only_to'

export interface OptionDelta {
  optionId: string
  /** The later run's label when both carry the option; otherwise the only one. */
  label: string
  /** Set only when both runs carry the option under DIFFERENT labels. */
  previousLabel: string | null
  /** 0-100. null ⇒ this run did not score the option. */
  fromProbability: number | null
  toProbability: number | null
  /** Percentage points. **null unless `presence === 'both'`.** */
  deltaPp: number | null
  presence: PairPresence
}

/**
 * A factor's movement between two runs, expressed as its INFLUENCE RANK.
 *
 * ⚠ NOT its elasticity, and the reason is a house rule rather than a
 * preference. `elasticity` / `sensitivity_score` are a registered claim family
 * with **no owner selector** — every surface normalises, signs and thresholds
 * them for itself — so the family's debt is FROZEN shrink-only
 * (`src/components/results/utils/elasticityClaimDebt.ts`), and the compliant
 * route for new code is stated there in so many words: *"do not add a raw read.
 * Consume an already-derived value from a surface that has one."* A new
 * `.elasticity` read here is a hard RED in `claim-ownership.drift.spec.ts`, and
 * it was — this shape is the fix, not a workaround.
 *
 * Rank IS an already-derived value: `extractTopFactors` sorts each run's
 * factors by |elasticity| descending, so a factor's position in that run's own
 * list is that run's own answer to "how influential was this?". Comparing two
 * positions makes no normalisation choice and introduces no threshold — which
 * is precisely what the unowned family cannot yet sanction.
 */
export interface FactorDelta {
  factorId: string
  label: string
  /** 1-indexed within that run's own top factors. null ⇒ not in that run's list. */
  fromRank: number | null
  toRank: number | null
  /** Places gained (positive = more influential). **null unless `presence === 'both'`.** */
  rankDelta: number | null
  presence: PairPresence
}

/**
 * Model-structure comparison between two runs.
 *
 * `'unchanged'` is only ever licensed by a SAME-REGIME hash EQUALITY. Equal
 * node/edge counts do not license it (a rewired graph keeps its counts), and a
 * cross-regime or absent-ended pair licenses nothing at all — see
 * `compareStructure` in deriveTransitions.ts.
 */
export type StructureComparison = 'changed' | 'unchanged' | 'not_comparable'

/**
 * What one run's OWN producer verdict entitles a surface to say about a leader.
 *
 *   • `'named'`     — the producer said there is a leading option, and named it
 *   • `'tied'`      — the producer said there is no clear leading option
 *   • `'unclaimed'` — no applicable producer signal ⇒ SILENCE. Not a denial:
 *                     `deriveDecisionVerdict` returns `separation: 'unknown'`
 *                     precisely so no surface asserts *or* denies a leader.
 */
export interface LeaderClaim {
  kind: 'named' | 'tied' | 'unclaimed'
  optionId: string | null
  label: string | null
  /**
   * The claimed leader's own win probability, 0-100 — taken from the SAME
   * `SnapshotOption` this claim resolved its label from, never re-derived
   * (ROADMAP 2.835).
   *
   * Non-null only on `kind: 'named'`, and that is a STRUCTURAL guarantee, not
   * a convention: `extractOptions` drops any option the producer did not score
   * (absence, NaN and Infinity alike), so an unscored option is absent from
   * `snapshot.options`, so `deriveLeaderClaim` cannot find it and returns
   * `'unclaimed'`. There is no code path that owns a probability for a leader
   * the producer never measured — which is why the old
   * `winnerProbability: Math.round((winner?.win_probability ?? 0) * 100)` could
   * not simply be made nullable: the honest value has to come from the option
   * the VERDICT names, not from a client-side argmax over the raw array.
   *
   * ⚠ A producer-sent `0` is a MEASUREMENT and survives to render as "0%". The
   * guard upstream is on ABSENCE, never on the value.
   */
  winProbability: number | null
}

export interface RunPairComparison {
  from: AnalysisSnapshot
  to: AnalysisSnapshot
  /** Union of both runs' options, ordered by the strongest probability seen. */
  options: OptionDelta[]
  /** Union of both runs' top factors, ordered by the strongest |elasticity|. */
  factors: FactorDelta[]
  /**
   * Did the model's SHAPE move? Three-valued, and a pure projection of
   * `changeKind` below — `compareStructure` holds the one mapping.
   */
  structure: StructureComparison
  /**
   * The ONE change verdict's kind for this pair (ROADMAP 2.578 F1).
   *
   * ⚠ WHY BOTH FIELDS EXIST. `structure` answers exactly one question — "did the
   * shape move?" — and three answers are enough for it. The sentence the pair
   * view prints underneath answers a different question, "why does it say that?",
   * and there are FIVE reasons. Projecting five onto three then writing copy
   * against the three is what made two sentences false the moment 2.578 widened
   * the preimages: `'unchanged'` acquired `value_only` (so "the same model" ran
   * beside a list of changed values) and `'not_comparable'` acquired same-regime
   * `uncharacterised_change` (so "incomparable identifiers" ran beside a
   * successful comparison). A surface that explains a verdict needs the verdict.
   */
  changeKind: GraphChangeKind
  fromLeader: LeaderClaim
  toLeader: LeaderClaim
  /**
   * Whether the leading option CHANGED. `'not_comparable'` unless BOTH runs
   * named one — two runs that both declined to name a leader have no leader to
   * report as unchanged.
   */
  leaderChange: 'changed' | 'unchanged' | 'not_comparable'
  /** Percentage points; null unless both runs carry a goal probability. */
  goalProbabilityDeltaPp: number | null
  /** Each side's evidence coverage, null-preserving ("Not assessed"). */
  fromEvidenceCoverage: string | null
  toEvidenceCoverage: string | null
  /** Inference warnings present in `from` and gone in `to`, and vice versa. */
  warningsResolved: string[]
  warningsIntroduced: string[]
}

// ---------------------------------------------------------------------------
// Transition types
// ---------------------------------------------------------------------------

export interface Transition {
  fromRunNumber: number
  toRunNumber: number
  /**
   * How big the leader's movement was. `null` when `winnerProbDelta` is null —
   * magnitude is a BAND OVER that delta, so it cannot be known when the delta
   * is not (ROADMAP 2.835). `classifyMagnitude(0)` would have read 'minor',
   * publishing "a small change" about two runs that were never compared.
   */
  magnitude: 'major' | 'refinement' | 'minor' | null
  edits: string[]
  /**
   * The leading option's movement in percentage points, later minus earlier.
   *
   * T2b, and the SAME both-ends-or-nothing rule `goalProbDelta` below and
   * `OptionDelta.deltaPp` already follow: null unless BOTH runs named the same
   * leader AND both scored it (ROADMAP 2.835). This was
   * `to.winnerProbability - from.winnerProbability` over the client-side
   * argmax, which had two independent failure modes and published both as
   * measurements — a run that scored nothing subtracted as 0 (measured: a
   * 70pp "collapse" against a run with no probabilities at all), and two runs
   * whose argmax was a DIFFERENT option produced a cross-option subtraction
   * presented as one option's trajectory.
   */
  winnerProbDelta: number | null
  /** T2b: false when either end was never assessed — absence is not a change. */
  robustnessChanged: boolean
  /** T2b: null when the producer sent no robustness data for that run. */
  robustnessFrom: string | null
  robustnessTo: string | null
  goalProbDelta: number | null
  /** Node IDs of affected factors */
  affectedFactorIds: string[]
  /** Labels for display */
  affectedFactorLabels: string[]
  deterministicAnchor: string
  /**
   * ROADMAP 2.578 — the ONE verdict every label on this card reads.
   *
   * `edits` and `structureChanged` below are both DERIVED from this, which is
   * the whole point: they used to have unrelated inputs (an event log and a
   * content hash) and were caught rendering "Rerun (no edits)" and "Structure
   * changed" on the same card for the same edit. Two labels with one input
   * cannot disagree.
   */
  changeVerdict: GraphChangeVerdict
  /**
   * TRUE only for a change to the model's SHAPE — an element added or removed,
   * an edge re-pointed, a node kind changed.
   *
   * ⚠ It is NOT a hash inequality. `generateGraphHash` hashes edge
   * `weight`/`confidence`/`belief`, so reading its inequality as "structure
   * changed" reported every value-only edit as structural (ROADMAP 2.578).
   */
  structureChanged: boolean
  /** Lowest E-value among affected edges */
  eValue: number | null
  /** Edge label for E-value display */
  eValueEdge: string | null
  conditionalWinner: string | null
  warningsResolved: string[]
  warningsIntroduced: string[]
  /** true for synthetic first→latest card */
  isCumulative: boolean
  /** Caveats for cumulative cards */
  cumulativeCaveats: string[]
  /** AI-generated reason (null until prompt updated) */
  reason: string | null
  /** AI-generated context (null until prompt updated) */
  aiContext: string | null
}
