/**
 * PanelFooter — quiet readiness line + the single primary action.
 *
 * Coherence rule (footer diagnosis fix): the button's gate authority is
 * OutputsDock (`blockedReason`), so the dot, headline and subline derive
 * from the SAME authority first. Only when the gate is open does the line
 * fall back to the readiness-coaching copy from the model. The subline
 * wraps — never truncates.
 */

import { memo } from 'react'
import { Button } from '../../../../components/ui'
import { typography, typo } from '../../../../styles/typography'
import { FOOTER_COPY } from '../constants'
import { guardCeeText } from '../signals/ceeTextGuard'
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
  /** OutputsDock's canRunAnalysis — the run gate. */
  canRun: boolean
  /** Advisory tooltip when canRun; the blocked explanation when not. */
  blockedReason?: string
}

export const PanelFooter = memo(function PanelFooter({
  footer,
  onAnalyse,
  isAnalysing,
  canRun,
  blockedReason,
}: PanelFooterProps) {
  const disabled = isAnalysing || !canRun

  // blockedReason can carry CEE-authored readiness text via OutputsDock's
  // tooltip — guard it like every other CEE-rendered string in the panel.
  const safeBlockedReason = blockedReason
    ? guardCeeText(blockedReason, FOOTER_COPY.notReadySubFallback).text
    : undefined

  // Single gate authority: dot, copy and button all derive from canRun.
  // The tooltip string is advisory while the gate is open (footer diagnosis:
  // treating it as a gate made an enabled-looking state read as disabled).
  // While a run is in flight the gate reports blocked ("analysis is
  // currently running") — say that, not "not ready".
  const display = isAnalysing
    ? { dot: 'success' as const, headline: FOOTER_COPY.running, subline: FOOTER_COPY.runningSub }
    : !canRun
      ? {
          dot: 'muted' as const,
          headline: FOOTER_COPY.notReady,
          subline: safeBlockedReason || FOOTER_COPY.notReadySubFallback,
        }
      : footer

  return (
    <div
      className="flex items-center gap-3 border-t border-panel-border px-4 py-3"
      data-testid="pre-analysis-v3-footer"
    >
      <span
        aria-hidden
        className={`h-2 w-2 flex-none rounded-full transition-colors ${DOT_CLASSES[display.dot]}`}
      />
      <div className="min-w-0 flex-1">
        <p className={typo('panelBody', 'text-text-header')}>{display.headline}</p>
        <p className={`${typography.panelMeta} text-text-light`}>{display.subline}</p>
      </div>
      <Button
        size="sm"
        className="flex-none"
        onClick={onAnalyse}
        disabled={disabled}
        title={!isAnalysing && !canRun ? safeBlockedReason || FOOTER_COPY.notReadySubFallback : undefined}
        data-testid="pre-analysis-v3-analyse"
      >
        {isAnalysing ? 'Analysing…' : FOOTER_COPY.analyse}
      </Button>
    </div>
  )
})
