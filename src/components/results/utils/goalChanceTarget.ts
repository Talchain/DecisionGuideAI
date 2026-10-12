export type GoalChanceComparator = 'at_least' | 'above' | 'at_most' | 'below'
export interface GoalChanceTarget {
  readonly comparator: GoalChanceComparator
  readonly value: number
  readonly unit: string
  readonly by_date?: string
  /**
   * #2747 re-scope 2 (U2, finding 3): the frame CEE's licence states the target in (`level` / `change_abs` / `change_rel`),
   * carried as written. No UI reader words the target from it (round 2, rulings C and D): CEE's chance words do.
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

/*
 * #2747 re-scope 2 round 2 (DL rules C and D, 12 Oct; Codex r1 blocking 2): `goalChanceTargetBound` is deleted. It worded
 * the licence's target itself, and a target with no frame came out as a level ("at least 10%" for a change). The hero now
 * says CEE's `chance_words` or no goal-chance sentence, so nothing in the UI words a chance's target: a missing frame
 * reaches no reader, and there is no default.
 */
