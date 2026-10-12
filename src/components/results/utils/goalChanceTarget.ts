import { formatGoalChangeBound, formatGoalTarget } from './formatGoalTarget'
import { goalTargetChangeFrameOf } from '../../../canvas/domain/goalTarget'

export type GoalChanceComparator = 'at_least' | 'above' | 'at_most' | 'below'
export interface GoalChanceTarget {
  readonly comparator: GoalChanceComparator
  readonly value: number
  readonly unit: string
  readonly by_date?: string
  /**
   * #2747 re-scope 2 (U2, finding 3): the frame CEE's licence states the target in (`change_abs` / `change_rel`), carried
   * as written so a frame this UI cannot read fails closed in the formatter. CEE writes none for a level target.
   */
  readonly frame?: string
}

/** Only a real calendar date in the producer's YYYY-MM-DD shape is carried. */
export function readGoalChanceByDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined
}

export function readGoalChanceTarget(value: unknown): GoalChanceTarget | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const target = value as Record<string, unknown>
  if (!['at_least', 'above', 'at_most', 'below'].includes(target.comparator as string)
    || typeof target.value !== 'number' || !Number.isFinite(target.value) || typeof target.unit !== 'string') return null
  const byDate = readGoalChanceByDate(target.by_date)
  return {
    comparator: target.comparator as GoalChanceComparator, value: target.value, unit: target.unit,
    ...(byDate === undefined ? {} : { by_date: byDate }),
    ...(typeof target.frame === 'string' ? { frame: target.frame } : {}),
  }
}

const COMPARATOR_WORDS: Readonly<Record<GoalChanceComparator, string>> = {
  at_least: 'at least',
  above: 'above',
  at_most: 'at most',
  below: 'below',
}
const HELD: Readonly<Record<GoalChanceComparator, '>=' | '>' | '<=' | '<'>> = { at_least: '>=', above: '>', at_most: '<=', below: '<' }

/**
 * #2747 re-scope 2 (U2, finding 3): the target as the user stated it, in ITS OWN frame — "at least 400 tickets" for a
 * level, "up at least 10% from today" for a change — never a change read as a level ("at least 10%"). The licence carries
 * no quantity frame, so a `%` absolute change, whose size cannot then be said, is `null`, as is an unread frame.
 */
export function goalChanceTargetBound(target: GoalChanceTarget): string | null {
  if (goalTargetChangeFrameOf(target.frame) !== null) {
    return formatGoalChangeBound(target.value, target.unit, target.frame, HELD[target.comparator], undefined)
  }
  const figure = formatGoalTarget(target.value, target.unit, target.frame, undefined)
  return figure === null ? null : `${COMPARATOR_WORDS[target.comparator]} ${figure}`
}
