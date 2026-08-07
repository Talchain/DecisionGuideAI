/**
 * The normative WITHHELD / PERMITTED wire pair for the owned-leader-claim
 * contract (ROADMAP 1.223, gate G-CEE-1).
 *
 * Shared by the verdict spec (`src/lib/__tests__/ownedLeaderClaim.spec.ts`) and
 * the cross-surface spec
 * (`src/components/results/__tests__/ownedLeaderClaim.surfaces.spec.ts`) so
 * both are provably talking about the SAME run. One fixture, no mirror.
 *
 * Numbers are the live figures from the render probe that found the defect
 * (scratchpad/render-probe-710a-lane): a 0.346 win-probability gap with the
 * leader on 0.66. Deliberately the STRONGEST case for a leader — past both
 * thresholds the deleted Authority 3 used (gap 0.10, clear 0.65) — so a
 * suppression that holds here holds everywhere.
 */
import type { DecisionVerdictReportLike } from '../decisionVerdict'

export const LEADER_ID = 'opt_mac'
export const LEADER_LABEL = 'Standardise on MacBook Pro'
export const RUNNER_UP_ID = 'opt_dell'
export const RUNNER_UP_LABEL = 'Standardise on Dell XPS'

export const WIN_LEADER = 0.66
export const WIN_RUNNER_UP = 0.314
export const WIN_THIRD = 0.026
/** 0.346 */
export const WIN_GAP = WIN_LEADER - WIN_RUNNER_UP

export const OPTION_PROBABILITIES = {
  [LEADER_ID]: { win_probability: WIN_LEADER },
  [RUNNER_UP_ID]: { win_probability: WIN_RUNNER_UP },
  opt_status_quo: { win_probability: WIN_THIRD },
}

/**
 * POST-#711 WITHHELD SHAPE, as the UI reads it.
 *
 * CEE drops `decision_brief.headline` / `.headline_banded` and nulls
 * `leading_option_id` when the constraint verdict withholds; the per-option
 * win probabilities correctly still ride the wire, because the DATA is not
 * withheld — only the CLAIM.
 *
 * `robustness.near_tie` is absent on purpose and it is NOT an oversight: the
 * V5 mapper (`mapV5AnalysisToReport`) has an explicit keep-list for
 * `report.robustness` and `near_tie` is not on it, so the live UI→CEE→PLoT
 * analysis path never carries one. That is precisely why the deleted
 * win-probability authority was reachable on the live path at all.
 */
export const WITHHELD_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: { recommended_option_id: LEADER_ID },
  decision_brief: {
    // The non-comparative members CEE deliberately KEEPS. Present so the
    // fixture cannot pass merely because the brief is absent whole — the
    // defect is the absence of the three leader-ranking members specifically.
    top_drivers: [{ factor_label: 'Three-Year Total Cost of Ownership' }],
    options: [
      { option_id: LEADER_ID, win_probability: WIN_LEADER, rank: 1 },
      { option_id: RUNNER_UP_ID, win_probability: WIN_RUNNER_UP, rank: 2 },
    ],
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

/**
 * The SAME run with the claim PERMITTED. This is the over-suppression
 * control: every leader surface must keep working against it. A change that
 * silences the withheld turn by silencing everything is a failure, not a fix.
 */
export const PERMITTED_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: { recommended_option_id: LEADER_ID },
  decision_brief: {
    headline: `${LEADER_LABEL} currently leads.`,
    headline_banded: {
      band: 'clearly_ahead',
      leader_option_id: LEADER_ID,
      robustness_gated: false,
    },
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}
