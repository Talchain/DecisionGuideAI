/**
 * Shared fixtures for the leader-claim gate (`analysisClaimPolicy`).
 *
 * ⚠ WHY THIS FILE EXISTS RATHER THAN ONE SPEC HOLDING EVERYTHING.
 * `analysis-hero/__tests__/inertness.spec.ts` enforces that ONLY
 * `ResultsBody` may import anything under `analysis-hero/`. The gate's three
 * prose sites straddle that boundary — two live in `TriageActionCardsBody`,
 * one in `analysis-hero/actOnIt/rankActOnItRows` — so their specs must live on
 * opposite sides of it. Widening `AUTHORIZED_IMPORTERS` to let one spec reach
 * across would trade a real architectural guard for test convenience, so the
 * SPECS split and the FIXTURE is shared. One definition, no mirror: if the two
 * halves drifted apart, each would be testing a different run.
 *
 * Every value here is derived from a run WITNESSED on deployed staging — the
 * factor, the alternative option and the withheld verdict are the ones the
 * user actually met.
 */
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../adapters/cee/types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

export const FACTOR_ID = 'fac_tech_lead'
export const FACTOR_LABEL = 'Technical Leadership Capacity'
export const ALT_LABEL = 'Two Mid-Level Developers at £70k Each'

/**
 * Anything that asserts, or presupposes, that one option is out in front.
 *
 * ⚠ UNION, NEVER REPLACE — the rule `withheldProse.spec.tsx` learned the hard
 * way. Its own `LEADER_PRESUPPOSITION_RE` is a SIBLING of this one, not a
 * parent: this adds the two comparative VERB phrases (`could gain ground`,
 * `could overtake`) that its surfaces do not emit and these do. A verb phrase
 * saying an option closes on another presupposes something to close on, so it
 * belongs in the ban even though it contains no leader noun. Retired shapes
 * stay here permanently; they cost one token each and they are the only thing
 * standing between a reverted file and a green suite.
 *
 * ⚠ IT MATCHES THE WITHHOLDING TOO ("Leading option not assessed"), which is
 * correct copy. Callers must therefore sweep the PROSE, never the checks
 * footer — see `renderPanel` in the results-side spec for why sweeping both
 * would make the assertion satisfiable only by deleting the honest half.
 */
export const LEADER_CLAIM_RE =
  /leading option|likely leader|could gain ground|could overtake|leads instead|your recommendation|the recommendation/i

/**
 * ⚠ WHY `leads instead` AND NOT `\bleads\b`, AND WHY THE BOUND IS WRITTEN DOWN.
 *
 * `leads instead` was added after a cold review found SURFACE D
 * (`ConditionalWinnerCards`) rendering *"…{option} leads instead."* on a
 * withheld run, PAST this matcher — its verb was simply not in the list, so
 * the §6 sweep below returned false about the very sentence it was pointed at.
 * A guard that agrees with itself for a reason unrelated to the property it
 * names is this estate's most expensive defect, so the widening is recorded
 * here rather than in a commit message.
 *
 * A bare `\bleads\b` was measured and REJECTED. It matches two sentences that
 * are CORRECT on a withheld run and must survive:
 *   · the card's neutral arm — "Which option leads depends on {factor} — the
 *     analysis flips at {N}" (names no option: the claim a withheld run is
 *     entitled to make);
 *   · its header help text — "Factors that change which option leads when they
 *     shift" (generic copy, no option identity at all).
 * Banning those would make the withheld arm satisfiable only by DELETING the
 * card — over-suppression, the worse defect, and the exact failure mode
 * `renderPanel`'s footer-exclusion note already records one level up.
 *
 * So this is a BOUNDED LEXICAL TRIPWIRE with a declared bound, the shape
 * `crossSurfaceCoherence.PRESENCE_ASSERTION_PHRASES` argues for: a short list
 * of phrases the product ACTUALLY EMITTED, never a predicate over an unbounded
 * phrasing space. It is not what closes the defect. What closes it is the
 * IDENTITY assertion beside every use of this matcher — the option LABEL must
 * not appear in the withheld panel's prose at all (CLAUDE.md trap 19: bind to
 * the object, never to a predicate another object could satisfy). The regex
 * catches a rewording that keeps the label out; the identity assertion catches
 * a rewording that keeps the label in. Neither subsumes the other.
 */

/**
 * The WITNESSED verdict. `separation: 'unknown'` is exactly the state that
 * renders the footer's "Leading option not assessed"
 * (`TriageActionCardsBody` — `winnerUndetermined`), and `decisionVerdict.ts`
 * returns `hasLeadingOption: false` with it at every construction site.
 */
export const WITHHELD_VERDICT: DecisionVerdict = {
  leaderId: 'opt_a',
  separation: 'unknown',
  hasLeadingOption: false,
  gapPp: null,
  source: 'none',
}

export const PERMITTED_VERDICT: DecisionVerdict = {
  leaderId: 'opt_a',
  separation: 'clear',
  hasLeadingOption: true,
  gapPp: 40,
  source: 'producer_band',
}

export const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: [],
})

/**
 * One builder for BOTH surfaces, so the withheld arm and the permitted arm
 * cannot differ in anything but the fields under test.
 *
 * Carries live findings on purpose: a fragile edge (drives the flip callout
 * and the `risk-` row) and two influence-scored drivers separated well past
 * `INFLUENCE_TIE_EPSILON` (drives the dominant nudge). Without all three, a
 * suppression arm could pass by rendering nothing — the vacuity the
 * ANTI-VACUITY cases exist to refuse.
 */
export const SPLIT_VALUE = 3
export const LOW_BUCKET_LABEL = 'Senior Hire at £110k'

/**
 * The conditional-winner row SURFACE D renders, and the reason the cold review
 * could reproduce a leader claim inside the file this fix already edited.
 *
 * ⚠ IT IS POPULATED ON BOTH ARMS, DELIBERATELY. The original fixture left
 * `conditionalWinners` absent, so the composed §5 arm asserted "no leader claim
 * anywhere" over a panel on which the card never mounted — TWO independent
 * reasons the guard passed (a blind matcher and an empty fixture), and fixing
 * only one would leave it agreeing with itself for a new reason.
 *
 * Every field is what makes the row RENDER and DESIGNATE, so a suppression
 * cannot pass by dodging:
 *   · `winner_flips: true` + finite `split_value` — the component's own filter
 *     (`ConditionalWinnerCards.tsx:85-89`); without both, it returns null and
 *     the withheld arm passes on an unmounted component;
 *   · two DIFFERENT `winner_id`s, one of them `recommendedOptionId` — the only
 *     configuration that reaches the DIRECTIONAL arm ("{alt} leads instead")
 *     rather than the neutral one the fix falls back to;
 *   · `winner_label` on BOTH buckets — the footer designation
 *     ("Above: {name} (61%)"), which is a second, VERBLESS naming that a
 *     matcher hunting leader verbs cannot see;
 *   · `win_probability` on both — the DATA that must SURVIVE the withholding,
 *     so over-suppression fails loudly instead of scoring as a pass.
 */
export const CONDITIONAL_WINNERS = () => [
  {
    factor_label: FACTOR_LABEL,
    factor_id: FACTOR_ID,
    split_value: SPLIT_VALUE,
    winner_flips: true,
    high_bucket: { winner_id: 'opt_b', winner_label: ALT_LABEL, win_probability: 0.61 },
    low_bucket: { winner_id: 'opt_a', winner_label: LOW_BUCKET_LABEL, win_probability: 0.55 },
  },
]

/**
 * The one evidence gap that makes the TRIAGE QUEUE mount — and therefore the
 * only way `StabilityNarrative` reaches the DOM at all (it returns `null` on
 * `itemCount === 0`). Opt-in, so every arm written before the stability work
 * renders byte-identically to what it rendered then.
 */
export const STABILITY_QUEUE_GAP = {
  factorId: FACTOR_ID,
  factorLabel: FACTOR_LABEL,
  confidence: 40,
  voi: 0.5,
  suggestion: 'This estimate is the AI’s, not yours.',
  targetNodeId: FACTOR_ID,
}

export function makeLeaderClaimData(opts: {
  verdict: DecisionVerdict
  leaderDesignationPermitted: boolean
  mode?: PermittedAnalysisMode
  /**
   * Opt-in ROBUSTNESS payload: the producer's verdict, its reason, the
   * stability figure, and the queue item without which the narrative line does
   * not mount.
   *
   * ⚠ THE VERDICT IS `'robust'` ON PURPOSE in the suppression arms. A gate
   * tested against a run that had nothing to say would pass by dodging — the
   * state that discriminates is one where the producer DID return a strength
   * verdict and the admission still forbids stating it.
   */
  stability?: { verdict: 'robust' | 'moderate' | 'fragile' | 'not_assessed'; score: number }
}): ResultsSectionDataReturn {
  return {
    recommendation: {
      analysisStatus: 'computed',
      goalThreshold: null,
      allOptions: [{ id: 'opt_a' }, { id: 'opt_b' }],
      // No flip evidence either way ⇒ `attestsNoFactorFlip` is false ⇒ the
      // callout takes its STRONG branch ("could overtake" + the percentage).
      // That is the branch the witnessed defect rendered, and it is the branch
      // a suppression must survive rather than dodge.
      flipThresholds: undefined,
      verdict: opts.verdict,
      leaderDesignationPermitted: opts.leaderDesignationPermitted,
      analysisAdmission: opts.mode ? admission(opts.mode) : undefined,
      ...(opts.stability
        ? {
            robustnessVerdict: opts.stability.verdict,
            // Producer-owned reason phrase. Present so the WITHHELD arm can
            // prove the tooltip is REPLACED rather than merely empty — an
            // absent reason would let a suppression pass without showing it
            // withdrew anything.
            robustnessVerdictReason: 'held up across the ranges we varied',
            recommendationStability: opts.stability.score,
          }
        : {}),
    },
    confidence: {
      topFragileEdge: {
        edgeId: `${FACTOR_ID}->goal`,
        fromId: FACTOR_ID,
        fromLabel: FACTOR_LABEL,
        alternativeWinnerLabel: ALT_LABEL,
        switchProbability: 0.57,
      },
      challengeFragileEdges: [],
      robustnessStatus: null,
      robustnessLevel: null,
      m2BiasFindings: [],
      evidenceGaps: [],
      topEvidenceGaps: [],
      nextActions: [],
      topNextActions: [],
      // SURFACE D. `recommendedOptionId` must match exactly one bucket's
      // `winner_id` or the component takes its neutral arm for a reason that
      // has nothing to do with the fix under test — the arm would then be
      // right by accident and the anti-vacuity twin would pass vacuously too.
      conditionalWinners: CONDITIONAL_WINNERS(),
      recommendedOptionId: 'opt_a',
      ...(opts.stability
        ? { evidenceGaps: [STABILITY_QUEUE_GAP], topEvidenceGaps: [STABILITY_QUEUE_GAP] }
        : {}),
    },
    drivers: {
      dominantFactorLabel: FACTOR_LABEL,
      dominantFactorId: FACTOR_ID,
      drivers: [],
      topDrivers: [
        { factorLabel: FACTOR_LABEL, matchedNodeId: FACTOR_ID, influenceScore: 0.92 },
        { factorLabel: 'Runner up factor', matchedNodeId: 'fac_b', influenceScore: 0.31 },
      ],
      driversStatus: 'computed',
      totalCount: 2,
      hasMagnitudeData: true,
    },
  } as unknown as ResultsSectionDataReturn
}

/**
 * The witnessed run: separation unknown, leader withheld, NO ADMISSION FIELD.
 *
 * ⚠ CORRECTED. This said "pre-admission CEE", which is a claim about the
 * PRODUCER, and the PR body quotes that same run's `quantified_provisional`
 * admission — so the two disagreed about the run they describe. What is true
 * here is narrower and is a statement about THIS FIXTURE, not about staging:
 * `mode` is left undefined, which exercises the ABSENT-admission arm. That arm
 * is the one worth pinning, because it is the arm that makes this consumer
 * safe to land ahead of any producer change — the leader answer is withheld by
 * the composed field alone, with the lattice contributing nothing.
 */
export const WITHHELD = (): ResultsSectionDataReturn =>
  makeLeaderClaimData({ verdict: WITHHELD_VERDICT, leaderDesignationPermitted: false })

/** The run that licenses everything. */
export const PERMITTED = (): ResultsSectionDataReturn =>
  makeLeaderClaimData({
    verdict: PERMITTED_VERDICT,
    leaderDesignationPermitted: true,
    mode: 'comparative_leader',
  })

/**
 * ⭐ THE RUN THE **MODE** WITHHOLDS — figures licensed, leader not, ARMS
 * SEPARATED. This is the state issue #1206 witnessed on deployed `91724b01`
 * (`permitted_analysis_mode: 'quantified_provisional'`, zero user-stated
 * parameters), and it is the only fixture that can see three different defects:
 *
 *   · the footer's affirmative DENIAL ("No clear leader") — §7;
 *   · the unlicensed STRENGTH WORD ("Robust", "Stability: {n}%") — §8;
 *   · a Strengthen caller threading Q2 alone.
 *
 * ⚠ `WITHHELD()` CANNOT SUBSTITUTE, and that is the whole point of a second
 * fixture. Its separation is already `'unknown'`, so a predicate reading
 * separation alone is right about it FOR THE WRONG REASON. Discrimination
 * needs `'clear'` separation with the leader withheld by the LATTICE — the
 * exact row §1 uses to prove the three answers are not one.
 *
 * Built from `PERMITTED()` and moved DOWN the lattice so the two arms differ in
 * nothing but the admission and the composed leader answer.
 */
export const MODE_WITHHELD = (
  stability?: { verdict: 'robust' | 'moderate' | 'fragile' | 'not_assessed'; score: number },
): ResultsSectionDataReturn => {
  const d = makeLeaderClaimData({
    verdict: PERMITTED_VERDICT,
    leaderDesignationPermitted: true,
    mode: 'comparative_leader',
    ...(stability ? { stability } : {}),
  }) as unknown as { recommendation: Record<string, unknown> }
  d.recommendation.leaderDesignationPermitted = false
  d.recommendation.analysisAdmission = admission('quantified_provisional')
  return d as unknown as ResultsSectionDataReturn
}

/**
 * The fully licensed twin of `MODE_WITHHELD`, carrying the SAME robustness
 * payload. Every suppression arm below has one of these beside it: a gate that
 * is only ever tested in the withholding direction is indistinguishable from a
 * gate jammed shut, and over-suppression is the defect the original author of
 * this PR deferred the stability work to avoid.
 */
export const PERMITTED_STABILITY = (
  stability: { verdict: 'robust' | 'moderate' | 'fragile' | 'not_assessed'; score: number },
): ResultsSectionDataReturn =>
  makeLeaderClaimData({
    verdict: PERMITTED_VERDICT,
    leaderDesignationPermitted: true,
    mode: 'comparative_leader',
    stability,
  })
