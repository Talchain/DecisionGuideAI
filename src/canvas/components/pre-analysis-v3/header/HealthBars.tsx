/**
 * HealthBars — the four compact setup-review meters, laid out inline so the
 * whole status sits on one row beside the Actions menu. Each item is a label
 * plus a vertical segmented gauge: discrete stacked segments make the level
 * easy to read at a glance (you count the lit segments). Colour is semantic
 * state only (warning, neutral building, success); entity colour never appears
 * here. The cue word and exact counts live in the bar's accessible name and
 * tooltip (hover/focus), not a visible caption, to keep the row compact.
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
 * Vertical segmented gauge. Rendered bottom-up (flex-col-reverse), the lowest
 * `lit` segments carry the state colour and the rest stay a quiet neutral, so
 * the meter reads like a battery/level indicator. Decorative: the parent bar
 * carries the accessible name, so the gauge is aria-hidden.
 */
const Gauge = memo(function Gauge({ bar }: { bar: BarModel }) {
  const lit = litSegments(bar.fill, GAUGE_SEGMENTS)
  return (
    <div
      className="flex flex-col-reverse gap-[2px]"
      aria-hidden="true"
      data-testid={`pre-analysis-v3-gauge-${bar.key}`}
      data-lit={lit}
    >
      {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-[3px] w-2.5 rounded-[1px] ${i < lit ? FILL_CLASSES[bar.state] : 'bg-panel-border'}`}
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
        className="flex items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-info/40"
        data-testid={`pre-analysis-v3-bar-${bar.key}`}
      >
        <span className={`${typography.panelMeta} whitespace-nowrap text-text-body`}>
          {BAR_LABELS[bar.key]}
        </span>
        <Gauge bar={bar} />
      </div>
    </Tooltip>
  )
})

export const HealthBars = memo(function HealthBars({ bars }: { bars: BarsModel }) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5"
      aria-label="Setup review"
    >
      <Bar bar={bars.frame} />
      <Bar bar={bars.options} />
      <Bar bar={bars.risks} />
      <Bar bar={bars.estimates} />
    </div>
  )
})
