/**
 * PanelHeader — "Before analysis" eyebrow, four health bars and the actions
 * overflow menu.
 */

import { memo } from 'react'
import { typography } from '../../../../styles/typography'
import { PANEL_COPY } from '../constants'
import { ActionsMenu } from './ActionsMenu'
import { HealthBars } from './HealthBars'
import type { BarsModel } from '../selectors/computeBars'

interface PanelHeaderProps {
  bars: BarsModel
  onAction: (label: string, prompt: string) => void
}

export const PanelHeader = memo(function PanelHeader({ bars, onAction }: PanelHeaderProps) {
  return (
    <div className="border-b border-panel-border px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`${typography.panelMeta} tracking-wide text-text-light`}>
          {PANEL_COPY.eyebrow}
        </span>
        <ActionsMenu onAction={onAction} />
      </div>
      <HealthBars bars={bars} />
    </div>
  )
})
