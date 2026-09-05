/**
 * THE HEDGE THAT NEVER REACHED THE CANVAS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, MEASURED IN ONE PAYLOAD (founder session, deployed UI `a9c2e050`)
 * ═══════════════════════════════════════════════════════════════════════════
 * `analysis_state.robustness.aggregate_level: "very_low"` with
 * `leader_claim.permitted: true`. The prose said *"treat this as provisional…
 * not yet robust — small changes could flip it."* The canvas, in the SAME
 * payload, showed a bare `Ahead 53%` bar and a `Leading option` crown with no
 * hedge at all. Both surfaces were reading the same run. One of them was
 * telling the whole truth.
 *
 * Not an admission failure: the canvas gates the crown on BOTH admissions
 * already (`licensesComparativeLeaderClaim` for CEE's licence, and the
 * producer's leader permission through `deriveDecisionVerdict`), and on that
 * payload both correctly permitted. The defect is that the canvas implements
 * AXIS 1 (is there a leader?) and had no surface at all for AXIS 2 (how much
 * should you trust it?) beside the claim.
 *
 * ⭐ WHY THIS IS A DISCLOSURE AND NEVER A SUPPRESSION. `src/lib/decisionVerdict.ts`
 * owns axis 1 and states the rule this module obeys: *"A 52-point lead that is
 * not robust is still a 52-point lead. … What no surface may do is *deny the
 * lead* because it is fragile."* So nothing here touches `hasLeadingOption`,
 * the crown, or the win probability. It ADDS a grade beside a claim that still
 * renders in full. Collapsing the two axes is the defect `decisionVerdict`
 * exists to prevent, and a fix that closed the lie by silencing the truth
 * would be the worse defect.
 *
 * ⭐ WHY IT READS THE REPORT AND NOT `analysisStateV1`. The turn-scoped slice is
 * deliberately CLEARED on any turn that does not restate it, so a hedge read
 * from there would evaporate on the user's next chat message — the exact
 * transient-refusal / durable-claim harm recorded against deployed `113375a1`.
 * The report outlives the turn, the session and the reload. Measured equal in
 * both repo captures that carry both carriers: `analysis_state.robustness
 * .aggregate_level` === `enrichment.robustness.level` (`moderate`/`moderate`,
 * `very_low`/`very_low`).
 *
 * ⭐ ONE OWNER, IMPORTED, NEVER RE-SPELLED. Three robustness vocabularies
 * already exist on the canvas — GoalNode's inline `robustnessData`,
 * DecisionNode's `stabilityDisplay` with its own 0.85/0.70 thresholds, and the
 * shared `getStabilityClassification`. A fourth spelled inline at each new call
 * site is how two authorities drift apart (CLAUDE.md trap 21). Both new
 * consumers import THIS, and the words come from `ROBUSTNESS_BADGE_LABELS`,
 * which is already `Record<RobustnessLevel, string>` so a new union member is a
 * compile error rather than a blank badge.
 */
import {
  ROBUSTNESS_BADGE_LABELS,
  deriveStabilityLevel,
} from '../../../lib/stability'
import type { RobustnessLevel } from '../../../lib/mappers/types'

/** The grades that carry a hedge. `high`/`moderate` need no caveat beside a claim. */
export type HedgedRobustnessLevel = Extract<RobustnessLevel, 'low' | 'very_low'>

export interface LeaderRobustnessGrade {
  /** The producer's own grade, narrowed to the two that warrant disclosure. */
  level: HedgedRobustnessLevel
  /** Visible badge text, owned by `ROBUSTNESS_BADGE_LABELS`. */
  label: string
  /** Pointer/AT disclosure naming what the grade qualifies. */
  title: string
}

function isHedged(level: unknown): level is HedgedRobustnessLevel {
  return level === 'low' || level === 'very_low'
}

/**
 * The run's robustness grade, ONLY when it warrants a hedge beside a
 * comparative claim. `null` for `high`, `moderate`, an absent robustness block,
 * an unrecognised level, and a pre-analysis report.
 *
 * ⚠ FAIL-CLOSED ON ABSENCE, and that direction is deliberate. An older producer
 * that sends no grade yields `null`, i.e. exactly today's behaviour — never an
 * invented caveat on a run we were told nothing about. The opposite default
 * would hedge every legacy payload.
 *
 * Prefers the explicit categorical `robustness.level` (populated by
 * `mapV5AnalysisToReport`, and the field GoalNode already reads); falls back to
 * the numeric `recommendation_stability` through the shared classifier, which
 * is the same fallback the results panel uses for the runs where PLoT omits
 * `level`.
 */
export function leaderRobustnessGrade(report: unknown): LeaderRobustnessGrade | null {
  if (!report || typeof report !== 'object') return null
  const robustness = (report as { robustness?: unknown }).robustness
  if (!robustness || typeof robustness !== 'object') return null

  const r = robustness as { level?: unknown; recommendation_stability?: unknown }

  // Explicit categorical grade first — the producer's own verdict.
  let level: unknown = r.level
  if (!isHedged(level)) {
    // Unrecognised or absent: only a NUMERIC stability may stand in. A level
    // string we do not recognise is not silently re-derived into a grade.
    if (level != null) return null
    const stability = r.recommendation_stability
    if (typeof stability !== 'number' || !Number.isFinite(stability)) return null
    level = deriveStabilityLevel(stability)
    if (!isHedged(level)) return null
  }

  return {
    level,
    label: ROBUSTNESS_BADGE_LABELS[level],
    title:
      level === 'very_low'
        ? 'Highly sensitive: which option leads changed often across the scenarios we sampled. Small changes could flip it.'
        : 'Sensitive: which option leads changed across some of the scenarios we sampled. Small changes could flip it.',
  }
}
