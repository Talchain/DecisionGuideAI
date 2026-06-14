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

interface PanelHeaderProps {
  bars: BarsModel
  onAction: (label: string, prompt: string) => void
}

export const PanelHeader = memo(function PanelHeader({ bars, onAction }: PanelHeaderProps) {
  return (
    <div className="flex items-center gap-1 border-b border-panel-border px-4 py-2.5">
      <HealthBars bars={bars} />
      <ActionsMenu onAction={onAction} />
    </div>
  )
})
