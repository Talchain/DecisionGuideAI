import { buildAddConstraintParameters } from '../../v5/chipParameters'
import { statedTargetNumber } from '../domain/goalTarget'

/** The inline control explicitly asks for an absolute minimum, in stated units.
 * No parsing of goal labels, delta-to-level conversion or local graph write. */
export function buildManualGoalTarget(targetId: string, draft: string, unit: string) {
  const value = statedTargetNumber(draft)
  if (value === null || value <= 0 || unit.trim() === '') return null
  const built = buildAddConstraintParameters({
    targetId, constraintType: 'at_least', value, unit: unit.trim(),
  })
  return built.ok ? built.parameters : null
}

/** Keep the explicit consent in the existing CEE lower-bound grammar. The
 * constraint row needs this evidence separately from the goal's target frame. */
export function manualGoalTargetMessage(value: number, unit: string): string {
  const number = value.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 21 })
  const amount = /^[£$€]$/.test(unit) ? `${unit}${number}`
    : unit === '%' ? `${number}%` : `${number} ${unit}`
  return `This goal must be at least ${amount}. This is an absolute level, not a change from the current level.`
}
