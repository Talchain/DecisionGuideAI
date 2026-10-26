import { z } from 'zod'

const EventRiskSchema = z.object({
  version: z.literal(1),
  occurrence: z.object({
    p_low: z.number().min(0).max(1),
    p_high: z.number().min(0).max(1),
    basis: z.enum(['user', 'olumi', 'reference']),
    meaning: z.literal('at_least_once_within_horizon').optional(),
  }).strict().refine(({ p_low, p_high }) => p_low <= p_high),
  // W3b (CEE #3799): the horizon in the model's own period. A weekly model's is a number of weeks, never converted to months.
  horizon: z.union([
    z.object({ weeks: z.number().positive().max(2600) }).strict(),
    z.object({ months: z.number().positive().max(600) }).strict(),
    z.object({ years: z.number().positive().max(50) }).strict(),
  ]),
  mitigations: z.array(z.object({
    factor_id: z.string(),
    occurrence_reduction: z.number().min(0).max(1),
  }).strict()).optional(),
}).strict()

export interface EventRiskReadout {
  pLow: number
  pHigh: number
  /** The horizon as the model states it: a number of its own periods. */
  periods: number
  periodUnit: 'week' | 'month' | 'year'
  basis: 'user' | 'olumi' | 'reference'
}

/** Read the untyped schema-0.82 event_risk block without trusting malformed wire data. */
export function readEventRisk(data: unknown): EventRiskReadout | null {
  if (data === null || typeof data !== 'object') return null
  const parsed = EventRiskSchema.safeParse((data as Record<string, unknown>).event_risk)
  if (!parsed.success) return null
  const { occurrence, horizon } = parsed.data
  const [periods, periodUnit] = 'weeks' in horizon ? [horizon.weeks, 'week' as const]
    : 'months' in horizon ? [horizon.months, 'month' as const] : [horizon.years, 'year' as const]
  return { pLow: occurrence.p_low, pHigh: occurrence.p_high, periods, periodUnit, basis: occurrence.basis }
}
