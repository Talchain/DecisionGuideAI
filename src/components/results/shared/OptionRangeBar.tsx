/**
 * OptionRangeBar + computeOptionScale — the shared p10→p90 range bar and its
 * [globalMin, globalMax] scale, shared by the V7 lens bars and the option cards
 * below so the two surfaces cannot drift.
 *
 * OptionRangeBar renders a thin 4px bar showing the p10-to-p90 range with a dot
 * at the median. All bars sharing one scale (computeOptionScale over the same
 * option set) makes bar widths visually comparable between options. The bar fill
 * width represents each option's range within the shared scale.
 *
 * ⚠ `p50` IS THE MEDIAN AND NOTHING ELSE (ROADMAP 2.800a). Callers must pass the
 * producer's own p50 or `undefined` — never a mean standing in for it. The lens
 * prints a standing caption, "Dots show the median.", so every dot drawn here is
 * covered by an explicit written claim; a mean in that slot makes the surface
 * state something false in words, not merely mislabel a glyph. Absent p50 ⇒ no
 * dot and no middle label, which this component already does on its own.
 *
 * `data-testid` defaults to `option-range-bar` (OptionCards' original testid);
 * the V7 lens passes `v7-range-bar`.
 */

import { typography } from '../../../styles/typography'
import { formatRangeValue } from '../utils/formatRangeValue'
import type { OptionResult } from '../types'

/** One shared finiteness predicate, so the scale and every render gate agree. */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** The shared display axis, or `null` when there is nothing to draw one over. */
export type OptionScale = { globalMin: number; globalMax: number }

/**
 * Shared [globalMin, globalMax] display axis for the option range bars.
 *
 * ⚠ ROADMAP 2.800b — THIS USED TO FOLD `?? o.outcome?.mean ?? 0` OVER EVERY
 * OPTION, AND THAT ZERO WAS A DISPLAYED FABRICATION.
 *
 * An option the engine never scored arrives here with `outcome` present and all
 * four members `null` — a mundane, high-frequency state, not an exotic producer
 * degeneracy: `useResultsSectionData` builds its option list from EVERY option
 * node on the canvas (`nodes.filter(kind === 'option')`) and looks each one up
 * in `report.option_probabilities`, which only holds the ones the analysis
 * returned. Add an option after a run and it is in this list, unscored.
 *
 * Under the old fold that option contributed `0` to BOTH ends. With options
 * spanning 50–100 the axis became [0, 100], and every real bar was redrawn at
 * half its width, starting halfway across. Nothing on screen said so. The
 * absent value did not merely fail to appear — it silently restated the numbers
 * that WERE present, which is the more severe fault.
 *
 * THE RULE NOW: the axis spans exactly the bars drawn on it. Only options
 * carrying BOTH a finite p10 and a finite p90 contribute — those are precisely
 * the options that render a bar (see `OptionRangeBar`'s callers). An option
 * with only a `mean` renders no bar, so stretching the axis to cover its mean
 * would move every other option's geometry to make room for a value nobody can
 * see; a lone mean is therefore not a bound either.
 *
 * THE DEGENERATE CASE IS EXPLICIT, NOT ACCIDENTAL: when no option carries a
 * full range there is no axis, and this returns `null` rather than a
 * plausible-looking `[0, 0]` or `[0, 1]` that a caller could draw against.
 * Callers must render no bars — which is already what they do, since a bar
 * needs the same p10/p90 pair that would have made the axis non-null.
 */
export function computeOptionScale(options: OptionResult[]): OptionScale | null {
  const lows: number[] = []
  const highs: number[] = []
  for (const o of options) {
    const p10 = o.outcome?.p10
    const p90 = o.outcome?.p90
    if (isFiniteNumber(p10) && isFiniteNumber(p90)) {
      lows.push(p10)
      highs.push(p90)
    }
  }
  if (lows.length === 0) return null
  return { globalMin: Math.min(...lows), globalMax: Math.max(...highs) }
}

/**
 * OptionRangeBar — thin 4px bar showing p10-to-p90 range with dot at median.
 *
 * All option range bars share the same [globalMin, globalMax] scale
 * for visual comparability between options. The bar fill width
 * represents each option's range within the shared scale.
 */
export function OptionRangeBar({
  p10,
  p50,
  p90,
  globalMin,
  globalMax,
  'data-testid': dataTestId = 'option-range-bar',
}: {
  p10: number
  p50?: number
  p90: number
  globalMin: number
  globalMax: number
  'data-testid'?: string
}) {
  const span = globalMax - globalMin
  if (span <= 0) return null

  const leftPct = ((p10 - globalMin) / span) * 100
  const widthPct = ((p90 - p10) / span) * 100
  const dotPct = p50 != null ? ((p50 - globalMin) / span) * 100 : undefined

  return (
    <div data-testid={dataTestId}>
      <div className="relative" style={{ height: 4, background: 'var(--border-default)', borderRadius: 2 }}>
        <div
          className="absolute top-0 h-full rounded-sm"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(2, widthPct)}%`,
            background: 'color-mix(in srgb, var(--info) 30%, transparent)',
          }}
        />
        {dotPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${dotPct}%`,
              width: 8,
              height: 8,
              background: 'var(--info)',
              border: '1.5px solid var(--bg-panel)',
              transform: `translate(-50%, -50%)`,
            }}
          />
        )}
      </div>
      <div className={`flex justify-between mt-0.5 ${typography.panelMeta}`}>
        <span className="text-text-light">{formatRangeValue(p10)}</span>
        {p50 != null && (
          <span className="text-text-header">{formatRangeValue(p50)}</span>
        )}
        <span className="text-text-light">{formatRangeValue(p90)}</span>
      </div>
    </div>
  )
}

export default OptionRangeBar
