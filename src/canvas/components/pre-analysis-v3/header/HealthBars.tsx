/**
 * HealthBars — the four compact setup-review bars. Colour is semantic state
 * only (warning, neutral building, success); entity colour never appears
 * here. Each bar is focusable with its tooltip available on hover and focus.
 */

import { memo } from 'react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { BAR_LABELS } from '../constants'
import type { BarModel, BarState } from '../types'
import type { BarsModel } from '../selectors/computeBars'

const FILL_CLASSES: Record<BarState, string> = {
  warning: 'bg-warning',
  // Neutral grey from the text palette — deliberately not an entity colour.
  building: 'bg-text-light/50',
  success: 'bg-success',
}

const Bar = memo(function Bar({ bar }: { bar: BarModel }) {
  return (
    <Tooltip content={bar.tooltip} delay={300}>
      <div
        tabIndex={0}
        role="img"
        aria-label={`${BAR_LABELS[bar.key]}: ${bar.tooltip}`}
        className="min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-info/40"
        data-testid={`pre-analysis-v3-bar-${bar.key}`}
      >
        <div className={`${typography.panelMeta} mb-1 truncate text-text-body`}>
          {BAR_LABELS[bar.key]}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-panel-hover">
          <div
            className={`h-full rounded-full transition-all duration-300 ${FILL_CLASSES[bar.state]}`}
            style={{ width: `${Math.round(bar.fill * 100)}%` }}
          />
        </div>
      </div>
    </Tooltip>
  )
})

export const HealthBars = memo(function HealthBars({ bars }: { bars: BarsModel }) {
  return (
    <div className="grid grid-cols-4 gap-3" aria-label="Setup review">
      <Bar bar={bars.frame} />
      <Bar bar={bars.options} />
      <Bar bar={bars.risks} />
      <Bar bar={bars.estimates} />
    </div>
  )
})
