import type { OptionInput, ProjectionResult, ComputeProjectionOptions } from './types'

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x))

// Soft clamp to avoid extremes exactly 0 or 1 in display
const softClamp = (x: number, eps = 0.01): number => Math.max(eps, Math.min(1 - eps, x))

const defaultHalfLifeMs = 14 * 24 * 60 * 60 * 1000 // 14 days

export function decayConfidence(c: number, lastUpdatedMs: number | undefined, asOfMs: number, halfLifeMs = defaultHalfLifeMs): number {
  if (!lastUpdatedMs) return clamp01(c)
  const dt = Math.max(0, asOfMs - lastUpdatedMs)
  if (dt === 0) return clamp01(c)
  const factor = Math.pow(0.5, dt / halfLifeMs)
  return clamp01(c * factor)
}

export function computeProjection(options: OptionInput[], opts: ComputeProjectionOptions): ProjectionResult {
  const { asOfMs, decayHalfLifeMs = defaultHalfLifeMs } = opts
  if (!Array.isArray(options) || options.length === 0) {
    return { bands: { p10: 0.0, p50: 0.0, p90: 0.0 } }
  }

  // Apply confidence decay and compute weighted mean of probabilities
  let wsum = 0
  let psum = 0
  const decayed: { p: number; c: number }[] = []
  for (const o of options) {
    const p = softClamp(clamp01(o.p))
    const c = decayConfidence(clamp01(o.c), o.lastUpdatedMs, asOfMs, decayHalfLifeMs)
    decayed.push({ p, c })
    wsum += c
    psum += p * c
  }
  const avgConfidence = wsum > 0 ? wsum / options.length : 0
  const p50 = wsum > 0 ? psum / wsum : decayed.reduce((a, b) => a + b.p, 0) / decayed.length

  // Magnitude mapping: band width inversely proportional to confidence
  // Ensure a minimum width to avoid zero-width bands; cap to keep within [0,1]
  const minWidth = 0.05
  const maxWidth = 0.35
  const width = Math.max(minWidth, (1 - avgConfidence) * 0.3)
  const clampedWidth = Math.min(maxWidth, width)

  const p10 = clamp01(p50 - clampedWidth)
  const p90 = clamp01(p50 + clampedWidth)

  // Monotonicity guarantee: p10 <= p50 <= p90, applied by construction
  return { bands: { p10, p50, p90 } }
}
