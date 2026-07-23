/**
 * OptionRangeBar + computeOptionScale — the shared p10→p90 range bar and its
 * [globalMin, globalMax] scale, extracted VERBATIM from OptionCards so the V7
 * lens bars and the option cards below cannot drift.
 *
 * OptionRangeBar renders a thin 4px bar showing the p10-to-p90 range with a dot
 * at the median. All bars sharing one scale (computeOptionScale over the same
 * option set) makes bar widths visually comparable between options. The bar fill
 * width represents each option's range within the shared scale.
 *
 * `data-testid` defaults to `option-range-bar` (OptionCards' original testid);
 * the V7 lens passes `v7-range-bar`.
 */

import { typography } from '../../../styles/typography'
import { formatRangeValue } from '../utils/formatRangeValue'
import type { OptionResult } from '../types'

/**
 * Shared [globalMin, globalMax] display scale — the exact OptionCards formula
 * (`p10 ?? mean ?? 0` / `p90 ?? mean ?? 0`) with the empty-array guard from
 * buildV7Lenses so an empty option set yields the neutral [0, 1] span instead
 * of [Infinity, -Infinity].
 */
export function computeOptionScale(options: OptionResult[]): { globalMin: number; globalMax: number } {
  return {
    globalMin: options.length
      ? Math.min(...options.map((o) => o.outcome?.p10 ?? o.outcome?.mean ?? 0))
      : 0,
    globalMax: options.length
      ? Math.max(...options.map((o) => o.outcome?.p90 ?? o.outcome?.mean ?? 0))
      : 1,
  }
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
