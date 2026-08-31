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
import { compareByDisplayModel, hasClearInfluenceLeader } from '../../components/results/driverDisplayModel'
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

interface NodeDisplayMetadata {
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
      const ranked = rows
        .map((r) => ({
          key: r.key,
          elasticity: r.rawElasticity,
          value: displayModel.get(r.key)?.value ?? 0,
        }))
        .sort(compareByDisplayModel)

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
      // withholds a claim the data cannot support — it does not hide a finding:
      // the influence VALUE and its provenance are still surfaced below, so the
      // reader keeps the number and loses only the false ordering.
      const rank = ranked.findIndex(f => f.key === nodeId) + 1
      const rankIsDetermined = hasClearInfluenceLeader(
        ranked.map((f) => ({ id: f.key, value: f.value })),
      )
      sensitivityRank = rankIsDetermined && rank > 0 && rank <= 3 ? rank : null

      // VoI rank: top-3 factors by value_of_information. Keyed off the shared
      // feed's canonical key (node_id → factor_id → id → label), so a row
      // carrying several differing id fields can no longer rank under one id
      // here and another in the panel.
      const rankedByVoi = rows
        .map((r) => ({ id: r.key, voi: r.valueOfInformation ?? 0 }))
        .filter(f => typeof f.voi === 'number' && f.voi > 0)
        .sort((a, b) => b.voi - a.voi)
      const voiPos = rankedByVoi.findIndex(f => f.id === nodeId) + 1
      if (voiPos > 0 && voiPos <= 3) voiRank = voiPos

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
        const modelEntry = displayModel.get(nodeId)
        if (modelEntry && Number.isFinite(modelEntry.value)) {
          influence = modelEntry.value
          influenceProvenance = modelEntry.provenance
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
    // zero-width bar — indistinguishable from a genuine measured zero, which
    // on this same surface renders `"<0.01%"`. The two were told apart only by
    // which fallback arm a missing sample count happened to take.
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
  }, [isResultsMode, report, nodeId, nodeType])
}
