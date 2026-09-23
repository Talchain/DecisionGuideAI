/**
 * Hook to provide node display metadata from analysis results
 * Decision Graph Display v2: Tasks 5, 8, 10
 *
 * Returns Results-mode specific display data:
 * - Factor sensitivity rank (#1-3)
 * - Outcome/Goal achievement probability
 * - Win rate
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { NodeType } from '../domain/nodes'
import {
  compareByDisplayModel,
  determinedRankDepth,
  hasMeaningfulMagnitude,
  rowCarriesMagnitudeMetric,
  MAX_BADGED_RANK,
} from '../../components/results/driverDisplayModel'
import type { DriverDisplayProvenance } from '../../components/results/driverDisplayModel'
import { selectDriverPolicyFeed } from '../../components/results/useResultsSectionData'
import { resolveFactorConfidenceDisplay } from '../../components/results/driverConfidenceDisplayPolicy'
import {
  selectGoalProbability,
  type GoalProbabilityInput,
  type GoalProbabilityBasis,
} from '../../components/results/utils/selectGoalProbability'
import type { ResultsReport } from '../../components/results/types'
import { optionComputationProducedResult } from '../../components/results/utils/notAnalysedOptions'
import type { OptionComputeStatus } from '../../adapters/plot/optionComputeStatus'

/**
 * The deepest ordinal the canvas badge is willing to print ("Key driver #N").
 *
 * ⚠ DECLARED IN `components/results/driverDisplayModel.ts`, beside
 * `determinedRankDepth`, and re-exported here under the name every existing
 * importer already uses. It moved when the factor row ordering became a third
 * consumer: that consumer sits in `useResultsSectionData.ts`, which is where
 * THIS file imports `selectDriverPolicyFeed` from, so importing the constant
 * back out of here would have closed a module cycle. One declaration, one
 * value, no cycle.
 */
export { MAX_BADGED_RANK } from '../../components/results/driverDisplayModel'

export interface NodeDisplayMetadata {
  /** Factor sensitivity rank (1-3 for top factors, null otherwise) */
  sensitivityRank: number | null
  /** Factor influence score (0-1, normalized) - Task 3 */
  influence: number | null
  /**
   * Lane C4 (influence-scale disclosure): which basis produced `influence`,
   * read straight off the shared display model entry ('influence_score' =
   * absolute producer scale; 'normalised_elasticity' = set-relative, top
   * driver ≡ 1.0 by construction). Surfaces rendering the number (the
   * MetricPills "I: NN%" chip) use this to disclose the scale exactly like
   * the Drivers panel. Null whenever `influence` is null.
   */
  influenceProvenance: DriverDisplayProvenance | null
  /**
   * The producer's `importance_basis` stamp for this factor's influence
   * figure, verbatim, or null. Read off the SAME shared display entry the
   * Drivers panel reads, and interpreted only by `influenceScaleCopy` — this
   * hook never decides what a basis means.
   */
  influenceImportanceBasis: string | null
  /**
   * How many DISTINCT factors the influence figure was ranked against — the
   * denominator that turns `sensitivityRank` into a claim a reader can argue
   * with ("most influential of 5") instead of a bare normalised percentage.
   *
   * ⚠ IT IS THE COMPARISON SET, NOT THE CANVAS. Counted off the SAME `ranked`
   * array `sensitivityRank` is derived from, so the rank and its denominator
   * can never be computed on different bases — which is the defect
   * `driverDisplayModel.ts` records for the rank/badge pair one level down.
   * Distinct KEYS, matching the duplicate-id collapse `determinedRankDepth`
   * already applies: two rows sharing an id are one factor.
   *
   * ⚠⚠ THE STALENESS GATE THAT WAS HERE HAS MOVED TO THE RENDER SITE, AND THAT
   * IS WHAT KEEPS THE INVARIANT BELOW TRUE. A denominator is a COUNTABLE claim —
   * `of 5` beside eight factor cards is refutable by counting — so it is
   * withheld unless the result is confirmably about the current graph. But the
   * question "may this claim be made?" is not the question "what is the size of
   * the run's comparison set?", and answering both here made the assignment
   * CONDITIONAL, which falsified the invariant that makes this field's
   * optionality safe. `FactorNode.tsx` now reads
   * `useAnalysisResultsAreCurrent()` and withholds the whole readout; this
   * producer answers only its own question. See that call site for the
   * measurement that condemned the previous gate (`graphEditedSinceLastRun` is
   * reset to `false` by `store.ts:6026`/`:6097` in the same `set()` that
   * installs a restored run).
   *
   * ⚠ OPTIONAL, following `goalFitAvailable` and `winComputationFailed` below.
   * ⛔ THE REASON RECORDED HERE FIRST WAS WRONG, AND A WRONG REASON IN A
   * DOCBLOCK IS WHAT THE NEXT SESSION INHERITS. It said the mock churn would
   * desync "the typecheck gate's IDENTITY baseline". Derived at the gate's own
   * bytes (`scripts/ci/typecheck-gate.sh`): the identity baseline is
   * explicitly NON-BLOCKING — its diffs are emitted with `note`, i.e. as
   * `::notice::`, because the union-order canonicaliser feeding it is a
   * heuristic and "a heuristic belongs where its drift costs noise in a report,
   * never a red build" (the script's own header). Desyncing it costs a notice.
   *
   * ⭐ WHAT ACTUALLY BLOCKS is the PER-FILE COUNT RATCHET, and it blocks hard.
   * Measured in this tree: `vi.mocked(useNodeDisplayMetadata).mockReturnValue`
   * has **100 call sites across 24 spec files** (contrast, same sweep:
   * `vi.mocked(useCanvasStore)` → 301, so the probe is not blind). Only four of
   * those 24 files carry a baseline entry, so making this field required
   * without editing all 100 sites turns ~20 files into NEW erroring files — the
   * gate's first blocking condition — and raises the total. Right conclusion,
   * wrong mechanism; the mechanism is recorded now so nobody re-derives it.
   *
   * ⭐⭐ AND THE OPTIONALITY IS MADE SAFE BY A PINNED PRODUCER INVARIANT, NOT BY
   * THE DEFAULT BEING CONVENIENT. An optional field whose absence silently
   * selects a different render is precisely CLAUDE.md trap 3b arriving through
   * the fixture. What removes that risk is that the state "rank present,
   * denominator absent" is UNREACHABLE FROM THIS PRODUCER: the assignment below
   * is unconditional within the factor branch and runs BEFORE the rank gate, so
   * `sensitivityRank != null` implies `influenceSetSize != null`. That
   * implication is asserted in `useNodeDisplayMetadata.influenceSetSize.spec.ts`
   * and REDs if the assignment is moved, removed or made conditional. A fixture
   * that supplies a rank without a size is therefore a KNOWN-FICTIONAL input
   * (trap 16-inverse), not an under-specified one.
   *
   * The default is still fail-closed on its own terms — `influenceRankReadout`
   * returns null on an absent size, so the row falls back to the caption it
   * renders today. Absence degrades to the status quo, never to a fabricated
   * denominator.
   */
  influenceSetSize?: number | null
  /**
   * Factor confidence score (0-1), ALREADY GATED by the shared display policy
   * (`components/results/driverConfidenceDisplayPolicy`). Null when the
   * producer sent none OR when the ruled policy says the figure is not fit to
   * show — consumers must not second-guess it or read the raw field.
   *
   * Until this lane, this returned the raw `factor_sensitivity[].confidence`
   * ungated while `DriversSection` refused to render the very same number: in
   * both real staging captures that value is a defaulted `0.25` (ISL's own
   * computed figure in the same bundle was 0.3756), and the canvas printed it
   * bare on the node pill, the Detailed-view bar, and — worse — turned it into
   * the spoken line "Low confidence."
   */
  confidence: number | null
  /**
   * True when the gated `confidence` above is a producer placeholder. Only
   * meaningful when `confidence` is non-null; surfaces MUST render the
   * "Default estimate" disclosure alongside the number when this is true, so
   * that flipping the policy gate can never re-introduce a bare figure.
   */
  confidenceIsDefaulted: boolean
  /** True when PLoT marked the confidence calibration provisional. */
  confidenceIsProvisional: boolean
  /** Whether this factor was found in the sensitivity analysis (false for root nodes like "Value") */
  inSensitivityAnalysis: boolean
  /**
   * Outcome/Goal achievement probability (0-1), as decided by
   * `components/results/utils/selectGoalProbability` — THE single source of
   * truth for which producer quantity may be shown as a goal probability.
   * This hook does not choose; it reads. The results panel reads the same
   * function, so the canvas and the panel cannot state different numbers for
   * one option in one session.
   */
  achievementProbability: number | null
  /**
   * Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): true when the
   * `achievementProbability` above IS the joint-goal figure AND the producer
   * marked it as scored from a modelled outcome distribution. Read straight
   * off the shared selector's `goalFitIsModelledBasis` — NOT mirrored from
   * it, which is how this flag previously came to disagree with the results
   * panel's identical-looking one. Surfaces rendering the number MUST render
   * `GOAL_FIT_BASIS_CAVEAT_COPY` alongside it when this is true.
   */
  achievementProbabilityIsModelledBasis: boolean
  /**
   * ROADMAP 2.283 — WHICH QUANTITY `achievementProbability` ACTUALLY IS.
   *
   * The selector publishes a `basis` precisely so no consumer has to infer the
   * identity of the number from the number. This hook used to read that basis,
   * take `goalFitIsModelledBasis` off it, and DISCARD the rest — which left
   * `GoalNode` structurally unable to tell `probability_of_goal` apart from
   * `probability_of_joint_goal` STANDING IN for it, and so it rendered the
   * substituted figure in the possessive voice ("chance of reaching target")
   * that #556 withheld on every sibling surface. The basis is the missing
   * datum, not a new decision: it is forwarded verbatim from
   * `selectGoalProbability`, never re-derived here, and never recomputed at a
   * render site.
   *
   * ⚠ CARRY THE BASIS, NOT A BOOLEAN. A `goalFitIsSubstitutedJoint` field here
   * would be a SECOND copy of a fact the selector already owns — the
   * hand-maintained-mirror defect class (CLAUDE.md trap 12), and the exact
   * shape of the two `generateGraphHash` twins. Consumers narrow it themselves
   * with the owner's exported `basisWithholdsPossessive()`, which is
   * byte-for-byte what `OptionNode`, `GoalNode` and `GoalPanel` all call, so
   * the canvas has ONE vocabulary for this test.
   *
   * ⚠ L62 (2026-08-04): that narrowing used to be an inline
   * `=== 'joint_goal_substituted'` literal at each of those four sites. The
   * basis is now `'joint_goal_withheld'` and carries NO number, so every site
   * evaluates false — and the four literals became one function precisely so
   * the next change to the rule cannot leave three of them behind.
   *
   * OPTIONAL, for the reason `goalFitAvailable` below is optional (mock churn
   * rewrites printed type strings across unrelated suites). ⚠ Note the polarity
   * honestly: absent ⇒ not substituted ⇒ the possessive is PERMITTED, which is
   * the pre-2.283 behaviour and therefore safe as a default, but it is NOT the
   * conservative direction. The real hook always populates it whenever
   * `achievementProbability` is non-null, and
   * `useNodeDisplayMetadata.goalBasis.spec.ts` PINS that invariant through the
   * real hook so "optional in the type" cannot decay into "absent in practice".
   */
  achievementProbabilityBasis?: GoalProbabilityBasis | null
  /**
   * ROADMAP 2.296 item 5 (2.282-C2) — the raw joint-goal quantity, FORWARDED
   * VERBATIM from the SAME `selectGoalProbability` decision that produced
   * `achievementProbability`. It exists because `GoalPanel` renders the joint
   * figure as its own separately-labelled claim ("Chance of hitting every
   * target") beside the goal figure; until this field the panel obtained both
   * by feeding the WHOLE report into the selector — which expects one
   * option-probability record — so on the real V5 mapper shape every read was
   * null and #556's basis gate was dark. Never re-read off the raw record and
   * never re-derived at a render site: the selector's `jointGoalProbability`
   * is the one answer, and this hook only carries it.
   *
   * OPTIONAL for the same mock-churn reason as `achievementProbabilityBasis`
   * below; the real hook populates it whenever the pointer resolves.
   * `useNodeDisplayMetadata.jointGoal.spec.ts` pins that.
   */
  jointGoalProbability?: number | null
  /**
   * ROADMAP 2.275. True when this run carries an admissible per-option goal
   * figure (per `selectGoalProbability`) even though no single probability is
   * attributable to the goal node itself — the live case where
   * `recommended_option_id` is absent.
   *
   * It exists so the goal node can stop CONTRADICTING the Goal-fit sub-tab.
   * It is a presence signal, never a number and never a designation: the node
   * may say the figures exist and where to read them, and must not invent one.
   *
   * OPTIONAL by deliberate choice, and the default is the SAFE one: absent or
   * false yields the conservative "this run did not produce a goal
   * probability" copy, never a claim that figures exist. The hook always
   * populates it. Making it required would have forced edits into unrelated
   * `NodeDisplayMetadata` test mocks, and that churn rewrites the printed type
   * strings of pre-existing diagnostics — which desyncs the typecheck gate's
   * IDENTITY baseline and trips its clean-tree self-test control. A display
   * signal whose absence is indistinguishable from `false` does not need to
   * impose that cost.
   */
  goalFitAvailable?: boolean
  /** Recommendation stability (0-1) - fallback for Goal nodes when probability unavailable */
  stabilityPercentage: number | null
  /** Win rate for options (0-1) */
  winRate: number | null
  /**
   * The producer said its computation for THIS option produced no usable
   * result (`status === 'failed'` ⇔ `n_valid === 0`, zero finite Monte Carlo
   * samples), so `winRate` above is `null` BY SUPPRESSION rather than by
   * absence — and the node must say which.
   *
   * ⚠ WHY IT IS NOT ENOUGH TO JUST NULL `winRate`. A `null` share renders as
   * NOTHING on an option card, and nothing in a row of bars reads as a
   * rendering gap, or worse as "we ran it and it came last". The producer's
   * claim is narrower and needs saying: the run happened and it yielded no
   * distribution, which is a fact about the simulation and not a verdict on the
   * option. The results panel makes exactly that distinction with a dedicated
   * card; this flag is what lets the canvas make it too, from the same field
   * (`option_probabilities[id].status`) and the same sanctioned copy.
   *
   * ⚠ OPTIONAL, following `goalFitAvailable` above and for its stated reason:
   * making it required forces edits into unrelated `NodeDisplayMetadata` test
   * mocks, and that churn rewrites the printed type strings of pre-existing
   * diagnostics — which desyncs the typecheck gate's IDENTITY baseline and
   * trips its clean-tree self-test control. A display signal whose absence is
   * indistinguishable from `false` does not need to impose that cost.
   */
  winComputationFailed?: boolean
  /**
   * The producer's own short phrase about the failure, when it sent one.
   *
   * ⚠ NEVER THE THING THAT LICENSES THE DISCLOSURE — it is ABSENT from all 12
   * live captures, so the render site must be complete without it. The STATUS
   * licenses the disclosure; this only enriches it. See
   * {@link notComputedReasonCopy}, which appends it rather than substituting.
   */
  winComputationFailedReason?: string
  /**
   * Predicted outcome range (post-analysis, outcome nodes only).
   * Currently null — PLoT does not provide per-outcome distributions.
   * Gated on per-node data; re-enable when PLoT adds per-outcome distributions.
   */
  predictedOutcome: { mean: number | null; p10: number | null; p90: number | null } | null
  /** Value of information score (0-1), post-analysis factor nodes only */
  valueOfInformation: number | null
  /** VoI rank (1-3 for top factors by VoI, null otherwise) */
  voiRank: number | null
  /** Whether we're in Results mode */
  isResultsMode: boolean
}

/**
 * Get display metadata for a node from analysis results
 * Only returns meaningful data when results.status === 'complete'
 *
 * @param nodeId - Node ID to get metadata for
 * @param nodeType - Node type (for filtering relevant data)
 * @returns Display metadata object
 */
/**
 * One factor's published rank, VoI rank and the ranked set's size, from the
 * SAME driver policy feed the panel uses. Extracted verbatim (with its
 * rationale) from `useNodeDisplayMetadata` so the canvas attention plan reads
 * the identical ranks the cards show — one derivation, never a mirror.
 */
export function rankFactor(
  rows: ReturnType<typeof selectDriverPolicyFeed>['policyRows'],
  displayModel: ReturnType<typeof selectDriverPolicyFeed>['displayModel'],
  nodeId: string,
): { influenceSetSize: number; sensitivityRank: number | null; voiRank: number | null } {
  const ranked = rows
    .map((r) => ({
      key: r.key,
      elasticity: r.rawElasticity,
      // The badge asks "what is the result most sensitive to". Elasticity is
      // that question's answer; `displayModel.value` answers "how big is this
      // factor structurally", which is why it used to disagree with the words.
      value: Number.isFinite(r.rawElasticity) ? Math.abs(r.rawElasticity) : 0,
    }))
    .sort(compareByDisplayModel)

  // The denominator for the ranked caption, taken off THIS array so it can
  // never be derived from a different set than the rank beside it. Distinct
  // keys, mirroring the duplicate-id collapse `determinedRankDepth` applies
  // — one factor, one position, one unit of the total.
  //
  // ⭐⭐ UNCONDITIONAL INSIDE THIS BRANCH, AND THAT IS A CONTRACT, NOT A
  // CONVENIENCE. It is what makes `sensitivityRank != null` imply
  // `influenceSetSize != null`, which is the whole argument for leaving the
  // field optional on `NodeDisplayMetadata` — see its docblock. A staleness
  // gate sat here for one commit and broke that implication silently: the
  // docblock claimed the state was unreachable while the spec four tests
  // later produced it. The licence to PUBLISH the denominator is a different
  // question with a different producer and it is asked at the render site
  // (`FactorNode.tsx`, `useAnalysisResultsAreCurrent`). Two questions, two
  // places, neither answering for the other (CLAUDE.md trap 21).
  const influenceSetSize = new Set(ranked.map((f) => f.key)).size

  // Find this node's rank (1-indexed).
  //
  // ⚠⚠ A RANK IS A COMPARATIVE CLAIM AND A TIE CANNOT SUPPORT ONE
  // (2026-08-30). `compareByDisplayModel` falls through value → elasticity
  // → `key.localeCompare`, so on a degenerate draft this RESOLVED the tie
  // instead of reporting it: five byte-identical factors fed in shuffled
  // order came back `#1 fac_a … #5 fac_e` — ALPHABETICAL — with one
  // distinct value and one distinct elasticity between them (measured in
  // this tree; a spread-value contrast control in the same run came back in
  // value order, so the probe was discriminating). The rank then renders as
  // `#N` at `NodeInspector.tsx`, as a "Key driver #N" canvas badge at
  // `BaseNode.tsx`, and as "Connects factor ranked #N in influence" at
  // `EdgeInspector.tsx`, so the leader node could honestly say "tied" while
  // the inspector beside it crowned one of the tied factors "#1".
  //
  // The gate ASKS THE EXISTING OWNER — `hasClearInfluenceLeader`, the same
  // function the Drivers panel's badge and the leader node's "#1 driver"
  // claim consume — rather than minting a rival tie notion here. One
  // question, one function.
  //
  // ⚠ IT IS SET-LEVEL, DELIBERATELY. Withholding only the tied factors'
  // ranks would print a "#3" with no "#1" or "#2" beside it, which is a
  // second kind of nonsense; when the top is undetermined the ordinal
  // reading of the whole set is what fails. Under the NO-HIDING ruling this
  // withholds a claim the data cannot support rather than hiding a finding.
  //
  // ⚠⚠ ON THE ORDINARY SET THE READER KEEPS THE NUMBER; ON THE
  // MAGNITUDE-LESS SET THEY KEEP NOTHING (2026-09-04, review round 2). This
  // comment used to end "the reader keeps the number and loses only the
  // false ordering", and the manufactured-zero fix a few lines below
  // falsifies it: when no factor in the set carries a real magnitude, the
  // all-zero sentinel makes `determinedRankDepth` return 0 AND the
  // influence figure is withheld as unmeasured. Measured and pinned in
  // `useNodeDisplayMetadata.rankGateBreadth.spec.ts` ("THE DEFECT
  // (set-level)"): rank, value and provenance are ALL null while
  // `inSensitivityAnalysis` is true — no rank, no number, no explanation.
  // The silence is still the honest answer (every figure available there is
  // invented), but it is a real cost to the reader and the deferred copy
  // (CANVAS-BACKLOG S47) is what owes them the reason.
  //
  // ⚠⚠ THE GATE ASKED A NARROWER QUESTION THAN THE BADGE PROMISED, AND THE
  // GAP SHIPPED (2026-09-03). This read `hasClearInfluenceLeader(...) &&
  // rank <= 3` — a gate about RANK 1 licensing THREE ordinals. On a real
  // user's model (`{1.00, 0.67 x6, 0.00}`, six factors tied) the leader
  // gate passes, so `#2` and `#3` went to two of the six tied factors,
  // chosen by `compareByDisplayModel`'s fall-through to `key.localeCompare`
  // — ALPHABETICAL NODE ID — under a tooltip that reads "ranked by
  // influence on the outcome". The numeral is not the defect and is not
  // removed: it is correct and valuable wherever the ordering is genuinely
  // determined. Claiming it where it is not, and attributing it to a
  // measurement, is. `determinedRankDepth` asks the badge's OWN question
  // ("are ranks 1..3 each clear?") at the same owner, so on that set only
  // `#1` is badged and every `#N` the canvas prints is true.
  const rank = ranked.findIndex(f => f.key === nodeId) + 1
  // MAX_BADGED_RANK is the badge's promise, so it is what the gate is
  // measured against — the depth and the cap can no longer drift apart.
  /**
   * ⛔⛔ THE TIE GATE MUST ASK ABOUT THE NUMBER THE READER SEES, NOT ONLY THE
   * ONE THE ORDER IS KEYED ON — and this PR broke that before fixing it.
   *
   * Re-keying `ranked.value` from the displayed influence onto `|elasticity|`
   * (correct for the ORDER — the badge says "most sensitive to") silently moved
   * the TIE TEST onto elasticity too, because `determinedRankDepth` reads
   * `value`. `driverPolicyFeed.parity.spec.tsx` caught it on a fixture with
   * IDENTICAL `influence_score: 0.5` and elasticities `0.3` / `-0.9`: not tied
   * on the sort key, so the canvas badged `#1` and `#2` beside two visible
   * `0.5`s. That is exactly the defect #964 exists to remove, reintroduced —
   * and that spec states the principle: "an ordinal is a COMPARATIVE claim and
   * a tie cannot support one."
   *
   * ⚠ ORDERING AND BADGING ARE DIFFERENT QUESTIONS (CLAUDE.md trap 21), so
   * they get different inputs. An ordinal needs BOTH to discriminate: the basis
   * it claims (elasticity) AND the figure printed beside it (the displayed
   * influence). Tied on either, and the reader cannot check the claim — so the
   * depth is the MINIMUM of the two, never the sort key's alone.
   *
   * ⭐ It still ASKS THE EXISTING OWNER twice rather than minting a rival tie
   * notion, which is the rule the paragraph above already set.
   */
  const depthByBasis = determinedRankDepth(
    ranked.map((f) => ({ id: f.key, value: f.value })),
    MAX_BADGED_RANK,
  )
  const depthByDisplayed = determinedRankDepth(
    ranked.map((f) => ({ id: f.key, value: displayModel.get(f.key)?.value ?? 0 })),
    MAX_BADGED_RANK,
  )
  const determinedDepth = Math.min(depthByBasis, depthByDisplayed)
  const sensitivityRank = rank > 0 && rank <= determinedDepth ? rank : null

  // VoI rank: top-3 factors by value_of_information. Keyed off the shared
  // feed's canonical key (node_id → factor_id → id → label), so a row
  // carrying several differing id fields can no longer rank under one id
  // here and another in the panel.
  const rankedByVoi = rows
    .map((r) => ({ id: r.key, voi: r.valueOfInformation ?? 0 }))
    .filter(f => typeof f.voi === 'number' && f.voi > 0)
    .sort((a, b) => b.voi - a.voi)
  const voiPos = rankedByVoi.findIndex(f => f.id === nodeId) + 1
  const voiRank = voiPos > 0 && voiPos <= 3 ? voiPos : null
  return { influenceSetSize, sensitivityRank, voiRank }
}

export function useNodeDisplayMetadata(
  nodeId: string,
  nodeType: NodeType
): NodeDisplayMetadata {
  const resultsStatus = useCanvasStore(state => state.results.status)
  const report = useCanvasStore(state => state.results.report)

  const isResultsMode = resultsStatus === 'complete'

  return useMemo(() => {
    if (!isResultsMode || !report) {
      return {
        sensitivityRank: null,
        influence: null,
        influenceProvenance: null,
        influenceImportanceBasis: null,
        influenceSetSize: null,
        confidence: null,
        confidenceIsDefaulted: false,
        confidenceIsProvisional: false,
        inSensitivityAnalysis: false,
        achievementProbability: null,
        achievementProbabilityIsModelledBasis: false,
        achievementProbabilityBasis: null,
        jointGoalProbability: null,
        goalFitAvailable: false,
        stabilityPercentage: null,
        winRate: null,
        winComputationFailed: false,
        predictedOutcome: null,
        valueOfInformation: null,
        voiRank: null,
        isResultsMode: false,
      }
    }

    // Task 5 & 3: Factor sensitivity rank (top 3 only) and influence/confidence
    let sensitivityRank: number | null = null
    let influence: number | null = null
    let influenceProvenance: DriverDisplayProvenance | null = null
    let influenceImportanceBasis: string | null = null
    let influenceSetSize: number | null = null
    let confidence: number | null = null
    let confidenceIsDefaulted = false
    let confidenceIsProvisional = false
    let inSensitivityAnalysis = false
    let valueOfInformation: number | null = null
    let voiRank: number | null = null
    if (nodeType === 'factor') {
      // C4 fix 2 (adversarial review, verifier-reproduced): read THE shared
      // row feed — the same merge the Drivers panel renders from. Sharing the
      // policy FUNCTION (selectDriverDisplayModel) was not enough: this hook
      // used to build a PRIVATE factor_sensitivity-only feed through
      // extractPolicyRow, which DROPS rows carrying no finite metric, while
      // the panel's merge KEEPS them. Because producer influence_score is
      // adopted only when EVERY row carries one, dropping a metric-less row
      // flipped coverage to complete for the canvas and left it incomplete
      // for the panel — so the pill disclosed an "absolute causal influence
      // score" while the panel disclosed "relative, top always 100%", for the
      // SAME report. One feed makes that fork unrepresentable. The feed also
      // subsumes the certified-array-first / enrichment-fallback precedence
      // this hook used to apply, and is memoised per REPORT (not per node),
      // so running it for every factor node stays O(1) after the first.
      const feed = selectDriverPolicyFeed(report as unknown as ResultsReport)
      const rows = feed.policyRows
      const displayModel = feed.displayModel
      /**
       * ⛔⛔ THE BADGE RANKED BY THE WRONG QUANTITY, AND IT SAID SO ON SCREEN.
       *
       * This sorted on `displayModel.value`, which under complete producer
       * coverage IS `influence_score` — PLoT's STRUCTURAL weight, computed from
       * authored edge strengths BEFORE the simulation. The badge's own
       * accessible name is `sensitivityRankBadgeAccessibleName`:
       * *"Key driver #N: one of the factors the result is most sensitive to"*.
       * Structural weight is not sensitivity, and on a real board they diverge.
       *
       * ── MEASURED ON PAUL'S OWN RUN, not inferred ─────────────────────────
       * `olumi-debug-1dd2133d-20260916.json`, staging `6497a251`. PLoT sent BOTH
       * ranks in `factor_sensitivity`, and they disagree:
       *
       *   factor                       importance_rank  influence_rank  elasticity
       *   Team Leadership Coverage            1               2            0.8
       *   Delivery Capacity                   2               4            0.4
       *   Hiring Speed in Current Market      3               5            0.4
       *   Tech Lead Presence                  4               1            0
       *   Hiring and Onboarding Cost          5               3            0
       *   Additional Developer Headcount      6               6            0
       *
       * The board badged #1/#2/#3 as Tech Lead Presence / Team Leadership
       * Coverage / Hiring and Onboarding Cost — EXACTLY `influence_rank` order.
       * **So the product badged "the result is most sensitive to this" onto a
       * factor whose own `elasticity` and `sensitivity_score` are both 0.**
       * `importance_rank`'s top three ARE the elasticity ordering, so the
       * badge's WORDS were right all along and the FIELD was wrong.
       *
       * ── WHY ELASTICITY AND NOT `importance_rank` ─────────────────────────
       * `importance_rank` is the producer's own answer and would be the ideal
       * key — `adapters/plot/v2/responseMapper.ts:1040` already says *"Sort by
       * importance_rank if available"* — but it is DROPPED before the shared
       * policy feed, which carries `key` and `rawElasticity` only. Threading a
       * new field through that feed is a larger change than this defect
       * warrants, and it is not needed: on this payload elasticity reproduces
       * `importance_rank`'s ordering exactly. Rowed rather than smuggled in.
       *
       * ⚠ THE TIE GATE IS UNCHANGED AND DOES REAL WORK HERE. Ranking by
       * elasticity leaves Delivery Capacity and Hiring Speed tied at 0.4, so
       * `determinedRankDepth` cuts the badged depth to 1 and Paul's board shows
       * ONE badge — on the factor the result is genuinely sensitive to —
       * instead of three led by a factor that moves nothing. Fewer badges is
       * the correct outcome, not a regression.
       *
       * ⛔ SCOPE: this changes the BADGE's ordering only. `displayModel.value`
       * still feeds the influence NUMBER, which is a different question and
       * correctly a different answer. A card may now show the highest influence
       * and carry no badge; that is the two metrics being honestly distinct
       * rather than one silently standing in for the other.
       */
      const ranks = rankFactor(rows, displayModel, nodeId)
      influenceSetSize = ranks.influenceSetSize
      sensitivityRank = ranks.sensitivityRank
      voiRank = ranks.voiRank

      // Task 3: Extract influence, confidence, and VoI for this factor
      const factorRow = rows.find((r) => r.key === nodeId)

      if (factorRow) {
        // Factor found in sensitivity analysis
        inSensitivityAnalysis = true

        // VoI: value_of_information is a direct 0-1 score
        const rawVoi = factorRow.valueOfInformation
        if (typeof rawVoi === 'number' && rawVoi >= 0 && rawVoi <= 1) {
          valueOfInformation = rawVoi
        }

        // Influence readout: the shared display model already resolved the
        // displayed value under the complete-metric-set policy (Codex R3-B1)
        // — read it back so the "I: NN%" beside the badge is the number the
        // rank used, on the same basis as the panel. Lane C4: carry the
        // model's provenance out with the value so the pill can disclose
        // the basis (set-relative top ≡ 100% vs absolute producer score).
        //
        // ⚠⚠ A MANUFACTURED ZERO IS NOT A MEASUREMENT, AND THE CANVAS IS THE
        // ONLY SURFACE THAT PRINTS IT (2026-09-03). Two distinct routes put a
        // display value of exactly 0 on a factor that measured nothing:
        //
        //   (a) SET-LEVEL. When no factor in the set carries a real magnitude,
        //       `computeNormalisedInfluences` maps EVERY factor to 0 on
        //       purpose — the all-zero sentinel that tells the Drivers panel to
        //       switch to its direction-only view "instead of misleading ~100%
        //       bars" (its words). It only applies on the fallback basis; under
        //       complete producer coverage the values are real, so this is
        //       gated on provenance and cannot swallow a genuine zero score.
        //   (b) ROW-LEVEL. The feed's normaliser ends its magnitude chain with
        //       a terminal `: 0`, so a row carrying NO metric field at all is
        //       indistinguishable downstream from one that genuinely measured
        //       zero influence.
        //
        // The panel absorbs both: a sub-threshold driver is filtered out of its
        // default view entirely (`isZeroImpact` / `hiddenZeroImpactCount` in
        // `useResultsSectionData`). The canvas cannot hide the NODE — it is the
        // user's own model — but it must not print `Influence 0%` beside it, a
        // measurement claim about a row nothing measured. Withholding the
        // figure is the canvas's form of the panel's safeguard.
        //
        // Withholding here is sufficient and touches no other lane's file:
        // `MetricPills` already requires BOTH a finite `influencePct` and a
        // non-null `influenceProvenance` to render the number, and `null` is an
        // already-handled state on this field (it is what a node outside the
        // analysis returns). A real zero — `{ elasticity: 0 }` in a set that
        // has magnitude data — still renders `Influence 0%`, because that is a
        // finding, not an absence.
        const modelEntry = displayModel.get(nodeId)
        const rawRowForNode = rows.findIndex((r) => r.key === nodeId)
        const measured =
          modelEntry != null &&
          Number.isFinite(modelEntry.value) &&
          (modelEntry.provenance === 'influence_score' ||
            (hasMeaningfulMagnitude(rows) &&
              rowCarriesMagnitudeMetric(feed.rawFactors[rawRowForNode])))
        if (measured && modelEntry) {
          influence = modelEntry.value
          influenceProvenance = modelEntry.provenance
          influenceImportanceBasis = modelEntry.importanceBasis
        }

        // Confidence: resolved through THE shared display policy, never read
        // raw. Note: intentionally NOT using value_of_information as a fallback
        // — VoI is semantically different from confidence (it measures the
        // value of learning more, not certainty).
        //
        // The policy is the same binding `DriversSection` gates on, and the
        // defaulted verdict comes off the same shared feed row, so the canvas
        // and the panel cannot disagree about this number for one report.
        const confidenceDisplay = resolveFactorConfidenceDisplay({
          confidence: factorRow.confidence,
          isDefaulted: factorRow.confidenceIsDefaulted,
          confidenceProvenance: factorRow.confidenceProvenance,
        })
        if (confidenceDisplay.show) {
          confidence = confidenceDisplay.value
          confidenceIsDefaulted = confidenceDisplay.isDefaulted
          confidenceIsProvisional = confidenceDisplay.isProvisional
        }
      }
    }

    // Task 8 & 10: Outcome/Goal achievement probability
    // Read from option_probabilities (the field the responseMapper actually populates)
    let achievementProbability: number | null = null
    let achievementProbabilityIsModelledBasis = false
    let achievementProbabilityBasis: GoalProbabilityBasis | null = null
    let jointGoalProbability: number | null = null
    let stabilityPercentage: number | null = null
    let goalFitAvailable = false

    if (nodeType === 'outcome' || nodeType === 'goal') {
      const optionProbabilities = report.option_probabilities ?? {}
      // Get the recommended option from robustness
      const recommendedOptionId = report.robustness?.recommended_option_id ??
                                  report.robustness?.recommendedOptionId

      if (recommendedOptionId) {
        const rec = optionProbabilities[recommendedOptionId] as GoalProbabilityInput | undefined
        if (rec) {
          // GOAL-PROBABILITY IDENTITY — ONE chooser, never two.
          //
          // This hook used to pick between `probability_of_joint_goal` and
          // `goal_probability` itself, with a rule that DIFFERED from the
          // results panel's: it took the joint figure only when the option
          // carried its own `constraint_analysis` (which no live V5 producer
          // populates) and otherwise returned `goal_probability ?? null`. On
          // the documented ISL-auto-derived-goal-threshold run
          // (`goal_probability` absent, `probability_of_joint_goal` present)
          // that returned null while the results panel returned the joint
          // value WITH its provenance caveat — one session, one option, the
          // panel stating a percentage and the canvas denying any figure
          // existed. `selectGoalProbability` now owns the decision outright:
          // which quantity may be shown, and with what provenance. Read it;
          // never re-derive either field here, and never add a third chooser.
          const decision = selectGoalProbability(rec)
          achievementProbability = decision.goalProbability
          achievementProbabilityIsModelledBasis = decision.goalFitIsModelledBasis
          // ROADMAP 2.283. Forwarded, not interpreted: the one place the basis
          // was previously read and thrown away.
          achievementProbabilityBasis = decision.basis
          // ROADMAP 2.296 item 5. Same discipline: the joint figure rides the
          // SAME decision — never a second read of the raw record.
          jointGoalProbability = decision.jointGoalProbability
        }
      }

      // ROADMAP 2.275 — WHY THIS EXISTS, and why it is not a fourth chooser.
      //
      // Witnessed on staging `a27cadf7` (witness-2267 §6b / §11a): the canvas
      // goal node said "Target set. This run did not produce a goal
      // probability." while the Analysis→Goal-fit sub-tab rendered "< 1%" four
      // times, simultaneously visible, from the SAME report.
      //
      // The cause is NOT the chooser — `selectGoalProbability` is correct and
      // both surfaces call it. The cause is the POINTER above: this hook can
      // only read `option_probabilities[recommendedOptionId]`, and the live V5
      // payload carries neither `robustness.recommended_option_id` nor a
      // non-null `leading_option_id` (verified in f-turn-2.json / r4-turn-2.json).
      // So the `if (recommendedOptionId)` gate never opens, the selector is
      // never called, and the node denies a figure the very same report holds
      // for every option.
      //
      // This flag reports ONLY whether the report carries an admissible
      // per-option goal figure, and it answers that by asking the SAME owner —
      // no re-derivation, no second rule. It deliberately does NOT pick an
      // option: naming a leader the producer did not designate is exactly the
      // fabrication this estate forbids.
      let goalFitAvailableForOptions = false
      if (nodeType === 'goal' && achievementProbability === null) {
        for (const entry of Object.values(optionProbabilities)) {
          if (!entry) continue
          // ⭐ THE PRODUCER'S COMPUTE STATUS, CONSULTED BEFORE THE ENTRY IS
          // READ — the same predicate, on the same field, as the win gate
          // fifty-five lines below.
          //
          // `status === 'failed'` is `n_valid === 0`: zero finite Monte Carlo
          // samples, so nothing attached to the entry is a measurement — its
          // goal figure no more than its share. This scan decides whether the
          // goal node says "this run did not produce a goal probability" or
          // points the user at the per-option figures, so an ungated failed
          // entry could, ON ITS OWN, make the node advertise figures there is
          // no distribution behind. Two readers of one field gated differently
          // would be two authorities on one question (CLAUDE.md trap 21).
          //
          // ⚠ PER ENTRY, NOT ALL-OR-NOTHING, and on the FAILING TOKEN only:
          // `'partial'` has samples and a full outcome block, an ABSENT status
          // is the legacy V1 shape, and a computed option beside a failed one
          // still makes the run's figures available.
          if (
            !optionComputationProducedResult(
              (entry as { status?: OptionComputeStatus }).status,
            )
          ) {
            continue
          }
          if (selectGoalProbability(entry as GoalProbabilityInput).goalProbability != null) {
            goalFitAvailableForOptions = true
            break
          }
        }
      }

      goalFitAvailable = goalFitAvailableForOptions

      // Task B: Fallback for Goal nodes - use recommendation_stability if probability unavailable
      if (nodeType === 'goal' && achievementProbability === null && report.robustness) {
        const stability = report.robustness.recommendation_stability ??
                         report.robustness.recommendationStability
        if (typeof stability === 'number') {
          stabilityPercentage = stability
        }
      }
    }

    // Task 8: Win rate for options
    // Read from option_probabilities[nodeId].win_probability — that's where the mapper puts it
    let winRate: number | null = null
    // ⭐ THE PRODUCER'S PER-OPTION COMPUTE STATUS, CONSULTED BEFORE THE SHARE IS
    // READ — never after, and never re-derived from the share itself.
    //
    // `status === 'failed'` means `n_valid === 0`: zero finite Monte Carlo
    // samples, so there is no distribution behind `win_probability` and the
    // number beside it is not a measurement. Until this gate existed the node
    // read the share unconditionally and rendered a hard `0%` with a
    // zero-width bar.
    //
    // ⚠ CORRECTED (#1048 review, second pass). This said the `0%` was
    // "indistinguishable from a genuine measured zero, which on this same
    // surface renders `<0.01%`". FALSE **for this surface**, and it understated
    // the harm. `formatWinProbability` hardcodes
    // `formatProbabilityWithResolution(rawProb, undefined)`
    // (`labelUtils.ts:183`), so the resolution arm is UNREACHABLE from the
    // canvas and `value <= 0` returns `'0%'` (`formatPercent.ts:114`). `<0.01%`
    // needs an `nSamples` count, which only the RESULTS PANEL supplies. So
    // before this gate the failed option and a genuine measured zero rendered
    // the SAME string on the canvas — not two strings a reader could tell
    // apart. The same sentence was corrected at `OptionNode.tsx`; it survived
    // here, in the hook the correction is about, because the first fix swept
    // the artefacts the review had named rather than every carrier of the
    // claim (trap 20).
    //
    // ⚠ THE GATE IS ON THE PRODUCER'S EMITTED TOKEN, NOT ON FALSINESS.
    // `optionComputationProducedResult` is `true` for `'partial'` — samples
    // EXIST and ISL emits a full outcome block, so it is a disclosure and not a
    // failure — and `true` for ABSENT, which is the legacy V1 shape. A
    // `status !== 'computed'` test here would discard results ISL honestly
    // computed. The predicate is shared with the results panel precisely so the
    // canvas and the panel cannot become two authorities on one question.
    let winComputationFailed = false
    let winComputationFailedReason: string | undefined
    if (nodeType === 'option') {
      // ⚠ READ THROUGH THE `ResultsReport` VIEW, not off the store's `ReportV1`.
      // `ResultsReport` re-declares `option_probabilities` as
      // `Record<string, ResultsOptionProbability>` (`types.ts:1302-1304`) —
      // `ReportV1`'s entries have no `status` at all, so reading it off the raw
      // store value would be two fresh TS2339s of the same class as the five
      // `report.robustness` errors this file already carries. That is the
      // narrowing the results panel does at its own boundary; the same field
      // deserves the same one here. Same cast the driver feed uses at :277.
      const optionProbabilities =
        (report as unknown as ResultsReport).option_probabilities ?? {}
      const optionData = optionProbabilities[nodeId]
      if (optionData) {
        if (optionComputationProducedResult(optionData.status)) {
          winRate = optionData.win_probability ?? null
        } else {
          // Left `null` deliberately: suppressing the share is the point, and
          // the flag below is what stops that suppression reading as absence.
          winComputationFailed = true
          winComputationFailedReason = optionData.status_reason
        }
      }
    }

    // T4 fix: predictedOutcome removed — the previous code read the goal-level
    // distribution (optionProbabilities[recId].outcome) which is the SAME object for
    // every outcome node, causing identical ranges on all outcome/risk nodes.
    // PLoT does not provide per-outcome distributions. When it does, re-enable this
    // code path keyed on the individual outcome node ID.
    const predictedOutcome: { mean: number | null; p10: number | null; p90: number | null } | null = null

    return {
      sensitivityRank,
      influence,
      influenceProvenance,
      influenceImportanceBasis,
      influenceSetSize,
      confidence,
      confidenceIsDefaulted,
      confidenceIsProvisional,
      inSensitivityAnalysis,
      achievementProbability,
      achievementProbabilityIsModelledBasis,
      achievementProbabilityBasis,
      jointGoalProbability,
      goalFitAvailable,
      stabilityPercentage,
      winRate,
      winComputationFailed,
      winComputationFailedReason,
      predictedOutcome,
      valueOfInformation,
      voiRank,
      isResultsMode: true,
    }
    // ⚠ THE CURRENCY SIGNAL IS DELIBERATELY NOT A DEPENDENCY HERE, because it is
    // no longer an input. It was, for one commit, and the note that stood in
    // this position explained why the memo had to re-run when the graph moved —
    // correct reasoning about a read that should not have been in this hook.
    // The memo is keyed on the REPORT, which is exactly right for a question
    // about the report; the render site re-reads its own gate on every render
    // and is not memoised on this.
  }, [isResultsMode, report, nodeId, nodeType])
}
