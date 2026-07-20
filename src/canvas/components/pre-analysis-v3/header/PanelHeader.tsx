/**
 * PanelHeader — the four setup-review meters and the actions overflow menu on
 * a single compact row. The "before analysis" framing is carried by context
 * (this panel only mounts pre-run), so no separate eyebrow row is needed; the
 * meters sit to the left of the menu and wrap to a second line only when the
 * panel is dragged narrow.
 */

import { memo } from 'react'
import { ActionsMenu } from './ActionsMenu'
import { HealthBars } from './HealthBars'
import type { BarsModel } from '../selectors/computeBars'
import type { SparkPrompt } from '../types'

interface PanelHeaderProps {
  bars: BarsModel
  onAction: (spark: SparkPrompt) => void
}

export const PanelHeader = memo(function PanelHeader({ bars, onAction }: PanelHeaderProps) {
  return (
    <div className="flex items-center gap-1 border-b border-panel-border pl-4 pr-2 py-2.5">
      <HealthBars bars={bars} />
      <ActionsMenu onAction={onAction} />
    </div>
  )
})
