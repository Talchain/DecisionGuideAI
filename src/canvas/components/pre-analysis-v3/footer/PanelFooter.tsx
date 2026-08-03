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
import { RefreshCw } from 'lucide-react'
import { Button } from '../../../../components/ui'
import { typography, typo } from '../../../../styles/typography'
import { FOOTER_COPY } from '../constants'
import { guardCeeText } from '../signals/ceeTextGuard'
import { classifyBlockedReason } from '../../../utils/composeBlockedReason'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'

/**
 * ROADMAP 2.332 — the moment a retained verdict was taken, as a clock time.
 *
 * Deliberately time-of-day and not a "5 minutes ago" elapsed string: elapsed
 * copy goes stale the instant it is rendered unless something re-renders it on
 * a timer, and a wrong elapsed figure is a worse claim than no figure. The
 * locale format is the browser's; the SENTENCE is what the tests bind to.
 */
function formatTakenAt(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * ROADMAP 2.332 / 2.339 — what the footer says when the readiness CHECK
 * failed, as opposed to when the model was graded and found wanting.
 *
 * Three distinct states, because they are three distinct facts:
 *   · nothing timestamped stands behind the panel — either no answer has ever
 *     arrived, or what is on screen is a LOCAL fallback rather than a server
 *     answer (the 429 arm, whose behaviour is unchanged and rowed separately);
 *   · a timestamped server answer, retained, still describing this model;
 *   · a timestamped server answer the model has outgrown.
 *
 * ⚠ The discriminator is `verdictAtMs`, NOT "is there a verdict object". The
 * store stamps `verdictAtMs` only where a real answer landed and explicitly
 * NULLS it on the 429 local-fallback arm, so a surface can never cite a time
 * for a number no server produced. Discriminating on the presence of
 * `readiness` would do exactly that — it is a hand-read of a field that means
 * something else.
 *
 * Every arm names the cause. Returns null when the check completed, which is
 * what keeps this slice invisible on the healthy path.
 */
function describeReadinessCheck(
  check: PreAnalysisModel['readinessCheck'],
): { headline: string; subline: string } | null {
  if (!check) return null

  // The store's own message names WHICH failure it was (unreachable / missing
  // / could not answer / rate limited). It is composed in this repo and never
  // carries the response body, so it is safe to render verbatim.
  if (check.verdictAtMs == null) {
    return {
      headline: check.verdictRetained
        ? FOOTER_COPY.readinessRecheckFailed
        : FOOTER_COPY.readinessUnchecked,
      subline: FOOTER_COPY.readinessSub(check.message),
    }
  }

  return {
    headline: check.stale ? FOOTER_COPY.readinessStale : FOOTER_COPY.readinessRecheckFailed,
    subline: FOOTER_COPY.readinessRetainedSub(check.message, formatTakenAt(check.verdictAtMs)),
  }
}

/** See the call site for why composed copy never meets the substituting guard. */
function vetBlockedReason(blockedReason: string): string {
  switch (classifyBlockedReason(blockedReason)) {
    case 'composed-safe':
      return blockedReason
    case 'composed-unsafe':
      return FOOTER_COPY.notReadySubFallback
    default:
      return guardCeeText(blockedReason, FOOTER_COPY.notReadySubFallback).text
  }
}

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
  /**
   * ROADMAP 2.332 / 2.339 — non-null only when the readiness CHECK failed.
   * Never gates the run; it replaces the footer's claim about the check.
   */
  readinessCheck?: PreAnalysisModel['readinessCheck']
}

export const PanelFooter = memo(function PanelFooter({
  footer,
  onAnalyse,
  isAnalysing,
  canRun,
  blockedReason,
  readinessCheck = null,
}: PanelFooterProps) {
  const disabled = isAnalysing || !canRun

  // blockedReason can carry CEE-authored readiness text via OutputsDock's
  // tooltip — guard it like every other CEE-rendered string in the panel.
  //
  // ⚠ …EXCEPT when it is COMPOSED copy (utils/composeBlockedReason.ts), which is
  // built from vetted parts: a DGAI sentence frame plus the user's OWN option
  // label. `guardCeeText` prefers IN-PLACE SUBSTITUTION and enforces terms the
  // label vet does not, so it rewrote a label the user typed — an option named
  // "Move billing to edge computing" rendered here as "…to connection
  // computing" while the unguarded ⌘Enter toast and dock tooltip showed the real
  // one. Two surfaces, two option names, one state: the exact class this
  // module's copy exists to end, re-created by the guard meant to prevent it.
  // (Its own header agrees: substitution applies to coaching text, "NEVER to
  // option/factor/risk labels — those are shared graph data".)
  //
  // So composed copy is VETTED, never rewritten; if the vet fails the WHOLE
  // sentence degrades to the non-committal fallback. Foreign strings (engine
  // prose, validator messages) keep the guard's contract unchanged.
  const safeBlockedReason = blockedReason
    ? vetBlockedReason(blockedReason)
    : undefined

  // Single gate authority: dot, copy and button all derive from canRun.
  // The tooltip string is advisory while the gate is open (footer diagnosis:
  // treating it as a gate made an enabled-looking state read as disabled).
  // While a run is in flight the gate reports blocked ("analysis is
  // currently running") — say that, not "not ready".
  //
  // ROADMAP 2.332 / 2.339 — the outage arm outranks BOTH the gate copy and the
  // model's own footer, and it has to.
  //
  // Below it, `!canRun ? notReady : footer` is a total function over a boolean:
  // whichever way the gate lands, the footer makes a claim about a readiness
  // assessment. With `readiness === null` the gate stays OPEN (canRunAnalysis
  // blocks only on `readiness && !can_run_analysis`), so an unreachable service
  // rendered as "Analysis available" — the exact invisible outage #564 merged
  // on record. Deriving this state from `canRun` cannot fix that: `canRun` is a
  // fact about the run, not about whether anything was checked.
  const outage = describeReadinessCheck(readinessCheck)

  const display = outage
    ? { dot: 'warning' as const, headline: outage.headline, subline: outage.subline }
    : isAnalysing
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
      <div
        className="min-w-0 flex-1"
        {...(outage ? { 'data-testid': 'pre-analysis-v3-readiness-outage' } : {})}
      >
        <p className={typo('panelBody', 'text-text-header')}>{display.headline}</p>
        <p className={`${typography.panelMeta} text-text-light`}>{display.subline}</p>
      </div>
      {/* The check can be retried without touching the run. Deliberately NOT a
          gate: the verdict is the server's, and this asks it again — it never
          decides in its place. */}
      {outage && readinessCheck && (
        <Button
          size="sm"
          variant="secondary"
          className="flex-none"
          onClick={readinessCheck.retry}
          aria-label={FOOTER_COPY.readinessRetry}
          data-testid="pre-analysis-v3-readiness-retry"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
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
