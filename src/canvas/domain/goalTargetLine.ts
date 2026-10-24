import { formatGoalTarget, TARGET_NOT_CAPTURED } from '../../components/results/utils/formatGoalTarget'
import { canCaptureGoalTarget, statedGoalTargetRaw, type GoalTargetSource } from './goalTarget'
import { heldTargetBoundWords } from './goalOwnTargetRow'

export const GOAL_TARGET_PREFIX = 'Target:'

/**
 * The goal's target as its card says it ("at most £60k"), or null with none captured. One owner, so the goal card and
 * Olumi's note beside it (`OlumiAttentionCard`) never say one target two ways.
 */
export function goalTargetDisplay(data: GoalTargetSource | null | undefined): string | null {
  if (data == null || canCaptureGoalTarget(data)) return null
  const thresholdRaw = statedGoalTargetRaw(data)
  const raw = typeof thresholdRaw === 'number' ? thresholdRaw : Number(thresholdRaw)
  const unit = typeof data.goal_threshold_unit === 'string' ? data.goal_threshold_unit : undefined
  // target-text: a non-numeric stored target is the user's own words, said verbatim
  const figure = Number.isNaN(raw) ? String(thresholdRaw) : formatGoalTarget(raw, unit, data.goal_threshold_frame, data.quantity_frame)
  if (figure === null) return TARGET_NOT_CAPTURED
  // SD-1 (DL 0df0e1, 6 Oct): a goal that HOLDS a ceiling says "at most" before its figure (`heldTargetBoundWords`).
  const held = heldTargetBoundWords(data)
  return held === null ? figure : `${held} ${figure}`
}

/** The card's target line ("Target: at most £60k"), or null with none captured. */
export function goalTargetLine(data: GoalTargetSource | null | undefined): string | null {
  const display = goalTargetDisplay(data)
  return display === null ? null : `${GOAL_TARGET_PREFIX} ${display}`
}
