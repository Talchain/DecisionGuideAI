/**
 * GoalTargetNudge — post-draft coaching nudge that points the user at the
 * success-target setter when a drafted graph has a goal but no target yet.
 *
 * WHY THIS EXISTS. The Goal-fit lens (each option's probability of reaching the
 * user's success target) is the highest-value analysis view, but it is honestly
 * gated on a USER success target: `buildHeroModel` UI-SEM-071/072 and the
 * results goal lens (`buildV7Lenses` — `gate: goalThreshold == null ?
 * 'no_target' : …`) both suppress Goal fit when `goalThreshold == null`. Today
 * the only affordances that point at the target-setter are the T1 "Goal target
 * not set" checklist row and the collapsed-by-default T2 "Sharpen" framing card
 * — both gated on a CEE quantitative hint and deficiency-framed, so a plain
 * draft with no hint gets NO pointer toward the most valuable lens. This nudge
 * is the single, always-visible, value-framed affordance that fills that gap.
 *
 * PRESENCE / ABSENCE ONLY — no new UI-SEM. Nothing is transformed: the nudge
 * renders purely on existing state (a goal node exists AND no success target is
 * set) and vanishes the instant a target lands. It never blocks analysis (the
 * target stays optional) and routes into the EXISTING setter via the same seam
 * `SharpenYourThinking` uses (`selectNodeWithoutHistory` + `focusNodeById` →
 * the inspector Goal panel's `GoalThresholdEditor`) — it builds no second
 * editor of its own.
 *
 * Copy aligns with the product's canonical gate line ("Set a success target to
 * unlock Goal fit." — `v7LensCopy` / `heroCopy`). DS: complete `border`, semantic
 * tokens, `bg-panel`, sentence case, Lucide icon, no emoji.
 */

import { Target } from 'lucide-react'
import { typography } from '@/styles/typography'

interface GoalTargetNudgeProps {
  /** True when a goal node exists in the drafted graph (something to target). */
  hasGoalNode: boolean
  /** True when a success target (goal threshold) is already set. */
  hasSuccessTarget: boolean
  /** Opens / focuses the EXISTING target-setting flow (inspector Goal panel). */
  onSetTarget: () => void
}

export function GoalTargetNudge({
  hasGoalNode,
  hasSuccessTarget,
  onSetTarget,
}: GoalTargetNudgeProps) {
  // Presence gate: a goal exists to target AND no target is set yet. Absent
  // pre-draft (no goal node) and the moment a target lands. Never nags — a
  // single quiet card that removes itself once the target exists.
  if (!hasGoalNode || hasSuccessTarget) return null

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-info/30 bg-panel p-3"
      role="note"
      data-testid="goal-target-nudge"
    >
      <Target className="w-4 h-4 text-info shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex flex-col gap-1 min-w-0">
        <p className={`${typography.panelHeader} text-text-header`}>Set a success target</p>
        <p className={`${typography.panelBody} text-text-light`}>
          Unlock Goal fit — see each option's probability of reaching your target. Optional; analysis runs without one.
        </p>
        <button
          type="button"
          onClick={onSetTarget}
          className={`self-start mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelBody} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          data-testid="goal-target-nudge-cta"
        >
          <Target className="w-3 h-3 shrink-0" aria-hidden="true" />
          Set target
        </button>
      </div>
    </div>
  )
}

export default GoalTargetNudge
