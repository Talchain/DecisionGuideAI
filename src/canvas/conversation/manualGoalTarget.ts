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
