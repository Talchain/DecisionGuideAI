import { z } from 'zod'

const EventRiskSchema = z.object({
  version: z.literal(1),
  occurrence: z.object({
    p_low: z.number().min(0).max(1),
    p_high: z.number().min(0).max(1),
    basis: z.enum(['user', 'olumi', 'reference']),
    meaning: z.literal('at_least_once_within_horizon').optional(),
  }).strict().refine(({ p_low, p_high }) => p_low <= p_high),
  horizon: z.object({ months: z.number().positive().max(600) }).strict(),
  mitigations: z.array(z.object({
    factor_id: z.string(),
    occurrence_reduction: z.number().min(0).max(1),
  }).strict()).optional(),
}).strict()

export interface EventRiskReadout {
  pLow: number
  pHigh: number
  months: number
  basis: 'user' | 'olumi' | 'reference'
}

/** Read the untyped schema-0.82 event_risk block without trusting malformed wire data. */
export function readEventRisk(data: unknown): EventRiskReadout | null {
  if (data === null || typeof data !== 'object') return null
  const parsed = EventRiskSchema.safeParse((data as Record<string, unknown>).event_risk)
  if (!parsed.success) return null
  const { occurrence, horizon } = parsed.data
  return { pLow: occurrence.p_low, pHigh: occurrence.p_high, months: horizon.months, basis: occurrence.basis }
}
