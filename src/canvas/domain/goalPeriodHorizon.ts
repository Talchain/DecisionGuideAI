/**
 * ⭐ THE GOAL'S PERIOD AND HORIZON, AS STATED (T12 row 2; MG F1 spec §1; schemas 0.69.0 `goal_period`, `goal_horizon`).
 *
 * - **Period:** what the goal's figures are per. "per quarter"; `none` (a level: a headcount, a balance) says nothing.
 * - **Horizon:** when the goal must be met. A calendar date reads "by 31 Mar 2027"; a number of months reads
 *   "within 6 months".
 * - **Absent says nothing.** An absent period is UNATTESTED: it may still sit inside the unit string ("GBP per month"),
 *   and the contract forbids inferring one, so this module never reads the unit.
 * - **Unrecognised values say nothing**, as with every 0.69.0 reader: a new period word renders no line until someone
 *   adds it here deliberately.
 */
export type GoalPeriodWord = 'day' | 'week' | 'month' | 'quarter' | 'year'

export const GOAL_PERIOD_COPY: Readonly<Record<GoalPeriodWord, string>> = Object.freeze({
  day: 'per day',
  week: 'per week',
  month: 'per month',
  quarter: 'per quarter',
  year: 'per year',
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "per quarter", or `null` for `none`, absent and unrecognised values. */
export function goalPeriodText(data: unknown): string | null {
  const period = (data as { goal_period?: unknown } | null | undefined)?.goal_period
  return typeof period === 'string' && Object.prototype.hasOwnProperty.call(GOAL_PERIOD_COPY, period)
    ? GOAL_PERIOD_COPY[period as GoalPeriodWord]
    : null
}

/** "by 31 Mar 2027" / "within 6 months", or `null` when no horizon is stated or it is malformed. */
export function goalHorizonText(data: unknown): string | null {
  const source = data as { goal_horizon?: unknown; goal_horizon_months?: unknown } | null | undefined
  const horizon = source?.goal_horizon
  if (horizon === undefined) {
    const months = source?.goal_horizon_months
    const validMonths = typeof months === 'number'
      && Number.isFinite(months)
      && Number.isInteger(months)
      && months >= 1
      && months <= 120
    if (!validMonths) {
      return null
    }
    return `within ${months} ${months === 1 ? 'month' : 'months'}`
  }
  if (horizon === null || typeof horizon !== 'object') return null
  const h = horizon as { deadline?: unknown; months?: unknown }
  if (typeof h.deadline === 'string') {
    // The contract's YYYY-MM-DD, read as a calendar date (no time zone can move it a day).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h.deadline)
    if (!m) return null
    const month = Number(m[2])
    const day = Number(m[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `by ${day} ${MONTHS[month - 1]} ${m[1]}`
  }
  if (typeof h.months === 'number' && Number.isInteger(h.months) && h.months >= 1) {
    return `within ${h.months} ${h.months === 1 ? 'month' : 'months'}`
  }
  return null
}

/** The goal card's one muted line: period and horizon joined, or `null` when neither is stated. */
export function goalPeriodHorizonLine(data: unknown): string | null {
  const parts = [goalPeriodText(data), goalHorizonText(data)].filter((p): p is string => p !== null)
  return parts.length === 0 ? null : parts.join(' · ')
}
