/**
 * PanelFooter — quiet readiness line + the single primary action.
 *
 * The button's enabled state and tooltip come exclusively from OutputsDock
 * (single run-gate authority). The dot and sublines derive from readiness
 * fields as coaching copy, never as gates ("coaching over gates").
 */

import { memo } from 'react'
import Tooltip from '../../../../components/Tooltip'
import { typography, typo } from '../../../../styles/typography'
import { FOOTER_COPY } from '../constants'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'

const DOT_CLASSES: Record<PreAnalysisModel['footer']['dot'], string> = {
  muted: 'bg-text-light',
  warning: 'bg-warning',
  success: 'bg-success',
}

interface PanelFooterProps {
  footer: PreAnalysisModel['footer']
  onAnalyse: () => void
  isAnalysing: boolean
  blockedReason?: string
}

export const PanelFooter = memo(function PanelFooter({
  footer,
  onAnalyse,
  isAnalysing,
  blockedReason,
}: PanelFooterProps) {
  const disabled = isAnalysing || Boolean(blockedReason)
  const button = (
    <button
      type="button"
      onClick={onAnalyse}
      disabled={disabled}
      className={typo(
        'panelBody',
        'ml-auto whitespace-nowrap rounded-full bg-primary px-4 py-2 text-text-on-color transition-colors hover:bg-primary-hover focus-visible:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 disabled:opacity-40',
      )}
      data-testid="pre-analysis-v3-analyse"
    >
      {isAnalysing ? 'Analysing…' : FOOTER_COPY.analyse}
    </button>
  )

  return (
    <div
      className="flex items-center gap-3 border-t border-panel-border px-4 py-3"
      data-testid="pre-analysis-v3-footer"
    >
      <span
        aria-hidden
        className={`h-2 w-2 flex-none rounded-full transition-colors ${DOT_CLASSES[footer.dot]}`}
      />
      <div className="min-w-0">
        <p className={typo('panelBody', 'text-text-header')}>{footer.headline}</p>
        <p className={`${typography.panelMeta} truncate text-text-light`}>{footer.subline}</p>
      </div>
      {blockedReason && !isAnalysing ? <Tooltip content={blockedReason}>{button}</Tooltip> : button}
    </div>
  )
})
