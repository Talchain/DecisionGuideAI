/**
 * SharpenSection — signal-backed coaching items, density-managed: the top
 * SHARPEN_DEFAULT_VISIBLE rows show by default and the rest sit behind a
 * "Show N more" reveal. Ordering is the registry's deterministic priority;
 * CEE enrichment swaps copy inside existing rows or holds its own priority
 * slot, so it never pushes the visible set beyond the cap.
 */

import { memo, useState } from 'react'
import { typography, typo } from '../../../../styles/typography'
import { PANEL_COPY, SHARPEN_DEFAULT_VISIBLE } from '../constants'
import { SignalRow } from './SignalRow'
import type { SignalView, SparkPrompt } from '../types'

interface SharpenSectionProps {
  signals: SignalView[]
  onSendPrompt: (spark: SparkPrompt) => void
  onAction: (view: SignalView) => void
}

export const SharpenSection = memo(function SharpenSection({
  signals,
  onSendPrompt,
  onAction,
}: SharpenSectionProps) {
  const [revealed, setRevealed] = useState(false)
  if (signals.length === 0) return null

  const visible = revealed ? signals : signals.slice(0, SHARPEN_DEFAULT_VISIBLE)
  const hiddenCount = signals.length - SHARPEN_DEFAULT_VISIBLE

  return (
    <div className="border-t border-panel-border px-4 py-4" data-testid="pre-analysis-v3-sharpen">
      <div className="-mx-4 -mt-4 mb-3 flex items-baseline justify-between bg-panel-hover px-4 py-2">
        <h2 className={`${typography.panelHeader} text-text-header`}>{PANEL_COPY.sharpenTitle}</h2>
        <span className={`${typography.panelMeta} text-text-light`}>
          {PANEL_COPY.sharpenMeta(signals.length)}
        </span>
      </div>
      <div>
        {visible.map(view => (
          <SignalRow
            key={view.detection.signal_id}
            view={view}
            onSendPrompt={onSendPrompt}
            onAction={onAction}
          />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={revealed}
          onClick={() => setRevealed(v => !v)}
          className={typo(
            'panelMeta',
            'mb-2 rounded text-text-light outline-none transition-colors hover:text-text-header focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid="pre-analysis-v3-sharpen-reveal"
        >
          {revealed ? PANEL_COPY.showFewer : PANEL_COPY.showMore(hiddenCount)}
        </button>
      )}
    </div>
  )
})
