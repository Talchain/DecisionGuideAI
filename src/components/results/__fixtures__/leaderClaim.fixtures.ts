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
  /leading option|likely leader|could gain ground|could overtake|your recommendation|the recommendation/i

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
export function makeLeaderClaimData(opts: {
  verdict: DecisionVerdict
  leaderDesignationPermitted: boolean
  mode?: PermittedAnalysisMode
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

/** The witnessed run: separation unknown, leader withheld, pre-admission CEE. */
export const WITHHELD = (): ResultsSectionDataReturn =>
  makeLeaderClaimData({ verdict: WITHHELD_VERDICT, leaderDesignationPermitted: false })

/** The run that licenses everything. */
export const PERMITTED = (): ResultsSectionDataReturn =>
  makeLeaderClaimData({
    verdict: PERMITTED_VERDICT,
    leaderDesignationPermitted: true,
    mode: 'comparative_leader',
  })
