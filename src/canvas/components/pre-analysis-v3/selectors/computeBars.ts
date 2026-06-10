/**
 * computeBars — the four health bars. Honest fill: live signals only,
 * affordances never inflate (or deflate) fill; no invented denominators
 * beyond the documented saturation constants (UI-SEM-052 in constants.ts).
 * Colour is semantic state only (UI-SEM-051 thresholds).
 */

import { barStateFor, OPTIONS_SATURATION_COUNT, RISKS_SATURATION_COUNT } from '../constants'
import type { BarModel, BarsInput } from '../types'

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(Math.max(n, 0), 1)
}

export interface BarsModel {
  frame: BarModel
  options: BarModel
  risks: BarModel
  estimates: BarModel
}

export function computeBars(input: BarsInput): BarsModel {
  const { decisionPresent, goalPresent, successSet, optionCount, riskCount, estimates } = input

  const frameParts = [decisionPresent, goalPresent, successSet]
  const frameFill = clamp01(frameParts.filter(Boolean).length / frameParts.length)
  const frameMissing: string[] = []
  if (!decisionPresent) frameMissing.push('decision')
  if (!goalPresent) frameMissing.push('goal')
  if (!successSet) frameMissing.push('success measure')

  const optionsFill = clamp01(optionCount / OPTIONS_SATURATION_COUNT)
  const risksFill = clamp01(riskCount / RISKS_SATURATION_COUNT)

  const { coverage, estimableCount, reviewedCount } = estimates
  const estimatesFill = estimableCount > 0 ? clamp01(coverage) : 0

  return {
    frame: {
      key: 'frame',
      fill: frameFill,
      state: barStateFor(frameFill),
      tooltip:
        frameMissing.length === 0
          ? 'Decision, goal and success measure set'
          : `Still to set: ${frameMissing.join(', ')}`,
    },
    options: {
      key: 'options',
      fill: optionsFill,
      state: barStateFor(optionsFill),
      tooltip:
        optionCount === 0
          ? 'No options yet'
          : `${optionCount === 1 ? 'One option' : `${optionCount} options`} included`,
    },
    risks: {
      key: 'risks',
      fill: risksFill,
      state: barStateFor(risksFill),
      tooltip:
        riskCount === 0
          ? 'No risks captured yet'
          : `${riskCount === 1 ? 'One risk' : `${riskCount} risks`} captured`,
    },
    estimates: {
      key: 'estimates',
      fill: estimatesFill,
      // No estimates to check is neutral, not alarming.
      state: estimableCount === 0 ? 'building' : barStateFor(estimatesFill),
      tooltip:
        estimableCount === 0
          ? 'No estimates yet'
          : `${reviewedCount} of ${estimableCount} checked`,
    },
  }
}
