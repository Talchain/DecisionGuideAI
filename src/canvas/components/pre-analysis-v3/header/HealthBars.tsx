/**
 * HealthBars — the four setup-review meters, laid out inline beside the Actions
 * menu (wrapping to a second line when the panel is narrow). Each item is a
 * "Title · state" label (low / medium / good — the visible state word) followed
 * by a short segmented bar: discrete filled-vs-empty segments give the level at
 * a glance. State is shown two ways — the word and the fill colour (semantic
 * state only: warning / neutral building / success; entity colour never appears
 * here) — so it stays legible without relying on colour alone. The exact counts
 * live in the bar's accessible name and tooltip (hover/focus). When there is
 * nothing to measure (no estimates) the cue is null and the bare label shows.
 */

import { memo } from 'react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { BAR_LABELS, GAUGE_SEGMENTS, litSegments } from '../constants'
import type { BarModel, BarState } from '../types'
import type { BarsModel } from '../selectors/computeBars'

const FILL_CLASSES: Record<BarState, string> = {
  warning: 'bg-warning',
  // Solid neutral grey from the text palette — clearly distinct from the
  // lighter bg-panel-border unlit segments, deliberately not an entity colour.
  building: 'bg-text-light',
  success: 'bg-success',
}

/**
 * Compact level meter: a row of thin vertical strokes, filled left to right.
 * The leftmost `lit` strokes carry the state colour and the rest stay a quiet
 * neutral, so it reads like a segmented level indicator (count the lit
 * strokes) while staying narrow enough for all four meters to share one row.
 * Decorative: the parent bar carries the accessible name, so it is aria-hidden.
 */
const Gauge = memo(function Gauge({ bar }: { bar: BarModel }) {
  const lit = litSegments(bar.fill, GAUGE_SEGMENTS)
  return (
    <div
      className="flex items-end gap-[2px]"
      aria-hidden="true"
      data-testid={`pre-analysis-v3-gauge-${bar.key}`}
      data-lit={lit}
    >
      {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-1 rounded-[1px] ${i < lit ? FILL_CLASSES[bar.state] : 'bg-panel-border'}`}
        />
      ))}
    </div>
  )
})

const Bar = memo(function Bar({ bar }: { bar: BarModel }) {
  return (
    <Tooltip content={bar.tooltip} delay={300}>
      <div
        tabIndex={0}
        role="img"
        aria-label={bar.cue ? `${BAR_LABELS[bar.key]}: ${bar.cue}. ${bar.tooltip}` : `${BAR_LABELS[bar.key]}: ${bar.tooltip}`}
        className="flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-info/40"
        data-testid={`pre-analysis-v3-bar-${bar.key}`}
      >
        {/* Visible state word beside the label (low/medium/good), so state is
            legible without relying on the gauge colour alone. Null cue (no
            estimates to measure) shows the bare label — never a misleading
            word. */}
        <span className={`${typography.panelMeta} whitespace-nowrap text-text-body`}>
          {BAR_LABELS[bar.key]}
          {bar.cue ? ` · ${bar.cue}` : ''}
        </span>
        <Gauge bar={bar} />
      </div>
    </Tooltip>
  )
})

export const HealthBars = memo(function HealthBars({ bars }: { bars: BarsModel }) {
  return (
    <div
      // Inline gaps: this project's Tailwind scale has no 10px column-gap step
      // and won't emit gap-x-[10px]; the row sits ~6px from wrapping (with the
      // scrollbar) at the panel's working width, so 10px column / 6px row is
      // the breathing room that fits. Keep in sync if the strip layout changes.
      className="flex min-w-0 flex-1 flex-wrap items-center"
      style={{ columnGap: 10, rowGap: 6 }}
      aria-label="Setup review"
    >
      <Bar bar={bars.frame} />
      <Bar bar={bars.options} />
      <Bar bar={bars.risks} />
      <Bar bar={bars.estimates} />
    </div>
  )
})
