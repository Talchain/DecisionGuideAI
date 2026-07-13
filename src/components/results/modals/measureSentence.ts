/**
 * Assembled-sentence preview for the Define-success modal (prototype
 * #measurePreview).
 *
 * Implements the AUTHORED sentence shape — the direction phrase split around
 * the metric ("Success means: increase Productivity by at least 20% within
 * 6 months.") — NOT the prototype's runtime template, whose word order the
 * spec flags as a bug ("increase by at least Productivity 20%...") and tells
 * engineers not to copy.
 *
 * Prototype-faithful details: fallback tokens [outcome] / [number] /
 * [timeframe] when a field is empty; the timeframe is lowercased; threshold
 * and unit concatenate with no space ("20%").
 */
import type { SuccessDirection } from './successMeasureStore'

export const DIRECTION_OPTIONS: ReadonlyArray<{
  value: SuccessDirection
  label: string
}> = [
  { value: 'increase_by_at_least', label: 'Increase by at least' },
  { value: 'reach_at_least', label: 'Reach at least' },
  { value: 'keep_below', label: 'Keep below' },
]

/** Prototype unit select options, in order (first is the default). */
export const UNIT_OPTIONS: ReadonlyArray<string> = ['%', 'projects', 'weeks', '£']

export interface MeasureSentenceFields {
  metric: string
  direction: SuccessDirection
  threshold: string
  unit: string
  timeframe: string
}

export function buildMeasureSentence(fields: MeasureSentenceFields): string {
  const metric = fields.metric.trim() || '[outcome]'
  const amount = `${fields.threshold.trim() || '[number]'}${fields.unit}`
  const timeframe = fields.timeframe.trim().toLowerCase() || '[timeframe]'

  switch (fields.direction) {
    case 'increase_by_at_least':
      return `Success means: increase ${metric} by at least ${amount} ${timeframe}.`
    case 'reach_at_least':
      return `Success means: ${metric} reaches at least ${amount} ${timeframe}.`
    case 'keep_below':
      return `Success means: keep ${metric} below ${amount} ${timeframe}.`
  }
}
