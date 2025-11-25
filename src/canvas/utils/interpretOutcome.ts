/**
 * Outcome Interpretation Utilities
 *
 * Provides logic for verdict cards and delta interpretation based on
 * objective-anchored analysis.
 */

export type Verdict = 'supports' | 'mixed' | 'opposes'

export type VerdictStrength = 'strongly' | 'moderately' | 'slightly'

export interface VerdictResult {
  verdict: Verdict
  strength: VerdictStrength
  confidence: number // 0-1
}

export interface DeltaResult {
  direction: 'better' | 'worse' | 'similar'
  magnitude: 'significantly' | 'moderately' | 'slightly'
  deltaValue: number
  deltaPercent: number | null
}

/**
 * Derive verdict from outcome values relative to baseline
 *
 * @param params - Configuration for verdict calculation
 * @returns Verdict with strength and confidence
 *
 * @example
 * ```ts
 * const verdict = deriveVerdict({
 *   outcomeValue: 120,
 *   baselineValue: 100,
 *   goalDirection: 'maximize',
 * })
 * // => { verdict: 'supports', strength: 'moderately', confidence: 0.4 }
 * ```
 */
export function deriveVerdict(params: {
  outcomeValue: number
  baselineValue: number
  goalDirection: 'maximize' | 'minimize'
  tolerancePercent?: number // default 5%
}): VerdictResult {
  const { outcomeValue, baselineValue, goalDirection, tolerancePercent = 0.05 } = params

  const delta = outcomeValue - baselineValue
  const relativeChange =
    baselineValue === 0 ? (delta === 0 ? 0 : delta > 0 ? 1 : -1) : delta / Math.abs(baselineValue)

  // Determine if change is in desired direction
  const isPositiveChange = goalDirection === 'maximize' ? delta > 0 : delta < 0
  const isNegativeChange = goalDirection === 'maximize' ? delta < 0 : delta > 0

  // Classify by magnitude
  const absRelChange = Math.abs(relativeChange)

  let verdict: Verdict
  let strength: VerdictStrength

  if (absRelChange < tolerancePercent) {
    verdict = 'mixed'
    strength = 'slightly'
  } else if (isPositiveChange) {
    verdict = 'supports'
    strength = absRelChange > 0.2 ? 'strongly' : absRelChange > 0.1 ? 'moderately' : 'slightly'
  } else {
    verdict = 'opposes'
    strength = absRelChange > 0.2 ? 'strongly' : absRelChange > 0.1 ? 'moderately' : 'slightly'
  }

  return {
    verdict,
    strength,
    confidence: Math.min(absRelChange * 2, 1), // rough confidence proxy
  }
}

/**
 * Compute delta between two runs for comparison
 *
 * @param params - Configuration for delta calculation
 * @returns Delta with direction, magnitude, and values
 *
 * @example
 * ```ts
 * const delta = computeDelta({
 *   currentValue: 120,
 *   baselineValue: 100,
 *   goalDirection: 'maximize',
 * })
 * // => { direction: 'better', magnitude: 'moderately', deltaValue: 20, deltaPercent: 20 }
 * ```
 */
export function computeDelta(params: {
  currentValue: number
  baselineValue: number
  goalDirection: 'maximize' | 'minimize'
  epsilon?: number // default 0.02
}): DeltaResult {
  const { currentValue, baselineValue, goalDirection, epsilon = 0.02 } = params

  const deltaValue = currentValue - baselineValue
  const deltaPercent = baselineValue === 0 ? null : (deltaValue / Math.abs(baselineValue)) * 100

  // Is this delta good or bad for the goal?
  const isImprovement = goalDirection === 'maximize' ? deltaValue > 0 : deltaValue < 0
  const isDegradation = goalDirection === 'maximize' ? deltaValue < 0 : deltaValue > 0

  const absDelta = Math.abs(deltaValue)
  const absPercent = Math.abs(deltaPercent ?? 0)

  let direction: DeltaResult['direction']
  let magnitude: DeltaResult['magnitude']

  if (absDelta < epsilon && absPercent < 2) {
    direction = 'similar'
    magnitude = 'slightly'
  } else if (isImprovement) {
    direction = 'better'
    magnitude = absPercent > 20 ? 'significantly' : absPercent > 10 ? 'moderately' : 'slightly'
  } else {
    direction = 'worse'
    magnitude = absPercent > 20 ? 'significantly' : absPercent > 10 ? 'moderately' : 'slightly'
  }

  return {
    direction,
    magnitude,
    deltaValue,
    deltaPercent,
  }
}
