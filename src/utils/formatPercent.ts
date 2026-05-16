/**
 * Centralised formatter for percentage values in the Results panel.
 * Prevents inconsistent ~, +, ± symbols across components.
 *
 * @param value - Raw value (0-1 for probabilities, or already a percentage)
 * @param options.sign - Whether to include +/- prefix (default: false)
 * @param options.fromDecimal - If true, multiply by 100 first (default: false)
 * @param options.precision - Decimal places (default: 0)
 * @returns Formatted string e.g. "58%", "+10%", "-14%"
 */
export function formatPercent(
  value: number,
  options: { sign?: boolean; fromDecimal?: boolean; precision?: number } = {},
): string {
  const { sign = false, fromDecimal = false, precision = 0 } = options

  const pct = fromDecimal ? value * 100 : value
  const rounded = precision > 0 ? pct.toFixed(precision) : String(Math.round(pct))

  if (sign && pct > 0) return `+${rounded}%`
  return `${rounded}%`
}

/**
 * Display-honesty: format a Monte Carlo win probability as a percentage,
 * acknowledging the simulation-resolution floor / ceiling rather than
 * rounding silently to "0%" or "100%".
 *
 * Threshold derives from sample count:
 *   value < 1/n         -> "<{1/n as percent}", e.g. "<0.1%" at n=1000
 *   value > 1 - 1/n     -> ">{1 - 1/n as percent}", e.g. ">99.9%" at n=1000
 *   otherwise           -> percent rendering with enough decimals to keep
 *                          the value distinct from 0% / 100% (so one win
 *                          in 1000 renders as "0.1%", not "0%", and 999
 *                          wins in 1000 as "99.9%", not "100%")
 *
 * When `nSamples` is undefined or non-positive, falls back to legacy
 * percentage formatting (via formatPercent) so existing call sites that
 * cannot supply a sample count continue to work unchanged.
 *
 * Always operates on the raw decimal probability — the displayed string
 * changes, the source numeric value does not.
 *
 * @param value - Raw probability in [0, 1]
 * @param nSamples - Per-option n_valid_samples, or fallback n_samples / meta.n_samples
 */
export function formatProbabilityWithResolution(
  value: number,
  nSamples: number | null | undefined,
): string {
  if (nSamples === null || nSamples === undefined || !Number.isFinite(nSamples) || nSamples <= 0) {
    return formatPercent(value, { fromDecimal: true })
  }

  const threshold = 1 / nSamples
  if (value < threshold) {
    return `<${thresholdAsPercent(threshold)}`
  }
  if (value > 1 - threshold) {
    return `>${thresholdAsPercent(1 - threshold)}`
  }
  // Mid-range. Use integer precision when possible; bump precision when an
  // integer render would falsely collapse to 0% / 100% (e.g. one observed
  // win in 1000 -> 0.1%, not 0%; 999 wins in 1000 -> 99.9%, not 100%).
  return inRangeAsPercent(value)
}

/**
 * Format an in-range probability so the displayed value never falsely
 * implies absolute certainty. Picks the smallest decimal precision that
 * keeps the rendered value distinctly non-zero AND non-100.
 */
function inRangeAsPercent(value: number): string {
  const pct = value * 100
  for (let precision = 0; precision <= 6; precision++) {
    const rendered = pct.toFixed(precision)
    if (Number(rendered) !== 0 && Number(rendered) !== 100) {
      return `${rendered}%`
    }
  }
  return `${pct.toFixed(6)}%`
}

/**
 * Format a sample-count-derived threshold (in [0, 1]) as a percent string.
 * Picks the smallest decimal precision that renders the value distinctly
 * from 0% / 100% — e.g. 0.01 -> "1%", 0.001 -> "0.1%", 0.0001 -> "0.01%",
 * 0.999 -> "99.9%".
 */
function thresholdAsPercent(threshold: number): string {
  const pct = threshold * 100
  for (let precision = 0; precision <= 6; precision++) {
    const rendered = pct.toFixed(precision)
    if (Number(rendered) !== 0 && Number(rendered) !== 100) {
      return `${rendered}%`
    }
  }
  return `${pct.toFixed(6)}%`
}

/**
 * Whether the given value should be reported as below the simulation
 * resolution at the given sample count. Used to gate user-facing helper
 * copy explaining why "<X%" appears.
 */
export function isBelowSimulationResolution(
  value: number,
  nSamples: number | null | undefined,
): boolean {
  if (nSamples === null || nSamples === undefined || !Number.isFinite(nSamples) || nSamples <= 0) {
    return false
  }
  return value < 1 / nSamples
}

/**
 * Whether the given value should be reported as above the simulation
 * resolution at the given sample count.
 */
export function isAboveSimulationResolution(
  value: number,
  nSamples: number | null | undefined,
): boolean {
  if (nSamples === null || nSamples === undefined || !Number.isFinite(nSamples) || nSamples <= 0) {
    return false
  }
  return value > 1 - 1 / nSamples
}
