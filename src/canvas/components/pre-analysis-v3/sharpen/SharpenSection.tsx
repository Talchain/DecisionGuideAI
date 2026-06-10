/**
 * SharpenSection — up to three signal-backed coaching items. CEE enrichment
 * swaps copy inside existing rows (never adds rows mid-session), so coaching
 * arrival causes no layout shift.
 */

import { memo } from 'react'
import { typography } from '../../../../styles/typography'
import { PANEL_COPY } from '../constants'
import { SignalRow } from './SignalRow'
import type { SignalView } from '../types'

interface SharpenSectionProps {
  signals: SignalView[]
  onSendPrompt: (label: string, prompt: string) => void
  onAction: (view: SignalView) => void
}

export const SharpenSection = memo(function SharpenSection({
  signals,
  onSendPrompt,
  onAction,
}: SharpenSectionProps) {
  if (signals.length === 0) return null
  return (
    <div className="px-4 pb-1 pt-2.5" data-testid="pre-analysis-v3-sharpen">
      <div className="flex items-baseline justify-between">
        <h2 className={`${typography.panelHeader} text-text-header`}>{PANEL_COPY.sharpenTitle}</h2>
        <span className={`${typography.panelMeta} text-text-light`}>
          {PANEL_COPY.sharpenMeta(signals.length)}
        </span>
      </div>
      <div>
        {signals.map(view => (
          <SignalRow
            key={view.detection.signal_id}
            view={view}
            onSendPrompt={onSendPrompt}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  )
})
