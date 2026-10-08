export type GoalChanceComparator = 'at_least' | 'above' | 'at_most' | 'below'
export interface GoalChanceTarget {
  readonly comparator: GoalChanceComparator
  readonly value: number
  readonly unit: string
  readonly by_date?: string
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
  }
}
