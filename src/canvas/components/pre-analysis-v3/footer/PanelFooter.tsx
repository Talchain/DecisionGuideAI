/**
 * PanelFooter — quiet readiness line + the single primary action.
 *
 * Coherence rule (footer diagnosis fix): the button's gate authority is
 * OutputsDock (`blockedReason`), so the dot, headline and subline derive
 * from the SAME authority first. Only when the gate is open does the line
 * fall back to the readiness-coaching copy from the model. The subline
 * wraps — never truncates.
 *
 * ⚠ THE LADDER ITSELF NOW LIVES IN `./readinessDisplay.ts`, AND THIS FILE IS NO
 * LONGER ITS OWNER. A second pre-run surface (the shell's `AnalysisReadinessBar`
 * on the Olumi tab) states the same line, and while the two computed it
 * separately they contradicted each other on a reachable state — this one said
 * "Readiness not checked yet", the other said "Analysis available", for the
 * same store. Both now call `deriveReadinessDisplay`. Read that module's header
 * for the ladder, the measurement, and the one arm the surfaces do NOT share.
 */

import { memo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../../../../components/ui'
import { typography, typo } from '../../../../styles/typography'
import { FOOTER_COPY } from '../constants'
import { deriveReadinessDisplay, describeReadinessCheck, gateBlockedSubline } from './readinessDisplay'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'
import type { GateBlockedListing } from '../../../utils/canRunAnalysis'

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
  /** The itemised form of `blockedReason` — see `GateBlockedListing`. */
  blockedListing?: GateBlockedListing
  /**
   * ROADMAP 2.332 / 2.339 — non-null only when the readiness CHECK failed.
   * Never gates the run; it replaces the footer's claim about the check.
   */
  readinessCheck?: PreAnalysisModel['readinessCheck']
  /**
   * `readinessNothingHasAnswered(...)` — neither the side-car nor the producer
   * has spoken. Was an arm INSIDE `usePreAnalysisModel`'s footer memo until the
   * ladder moved; it is passed explicitly now so the shell's bar, which has no
   * panel model, reaches the same arm through the same owner.
   */
  nothingHasAnswered?: boolean
}

export const PanelFooter = memo(function PanelFooter({
  footer,
  onAnalyse,
  isAnalysing,
  canRun,
  blockedReason,
  blockedListing,
  readinessCheck = null,
  nothingHasAnswered = false,
}: PanelFooterProps) {
  const disabled = isAnalysing || !canRun

  // ⭐ ONE LADDER, TWO SURFACES. Everything this used to decide inline — the
  // outage override, the in-flight arm, the gate arm with its vetted reason, and
  // the unanswered arm that used to sit inside the model's footer memo — is now
  // `deriveReadinessDisplay`. `footer` is this surface's RESTING value only: the
  // one arm a surface with a `PreAnalysisModel` can say more about than a
  // surface without one.
  const display = deriveReadinessDisplay({
    readinessCheck,
    isAnalysing,
    canRun,
    blockedReason,
    blockedListing,
    nothingHasAnswered,
    resting: footer,
  })

  // Kept as its own read so the outage TESTID below marks exactly the state the
  // outage arm fired on, rather than being inferred from the rendered copy.
  const outage = describeReadinessCheck(readinessCheck)

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
        <p
          className={typo('panelBody', 'text-text-header')}
          data-testid="pre-analysis-v3-footer-headline"
        >
          {display.headline}
        </p>
        {/* THE PRODUCER'S SENTENCES ARE A LIST, NOT A PARAGRAPH. Every blocker
            CEE names arrived here joined by spaces into one `panelMeta` line —
            the join is UNBOUNDED and nothing truncates it. Nothing is
            truncated or summarised (the contract forbids both, so we never put
            our words in the producer's mouth); the SAME bytes render one per
            line, and `display.subline` stays their exact join for the tooltip.
            ⚠ ONE sentence stays a sentence: a list of one renders a bullet
            where prose belonged, which would be a regression in the common
            small case bought with a fix for the large one. */}
        {display.sublineSentences !== undefined && display.sublineSentences.length > 1 ? (
          <ul
            className={`${typography.panelMeta} text-text-light list-disc space-y-0.5 pl-4`}
            data-testid="pre-analysis-v3-footer-subline-list"
          >
            {display.sublineSentences.map((sentence, index) => (
              <li key={`${index}:${sentence}`}>{sentence}</li>
            ))}
          </ul>
        ) : (
          // The multi-sentence branch above has carried a testid since it was written;
          // this single-sentence branch never did, so the subline was addressable only
          // when there happened to be more than one sentence. That mattered: on the
          // ready-but-success-unset arm the subline is the ONLY surface carrying the
          // qualification ("First pass will be provisional until success is defined"),
          // and E2 could not see it — so the honest state read to the suite as a
          // headline saying "Analysis available" beside an unmet requirement, and
          // nothing else.
          <p
            className={`${typography.panelMeta} text-text-light`}
            data-testid="pre-analysis-v3-footer-subline"
          >
            {display.subline}
          </p>
        )}
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
        title={!isAnalysing && !canRun ? gateBlockedSubline(blockedReason) : undefined}
        data-testid="pre-analysis-v3-analyse"
      >
        {isAnalysing ? FOOTER_COPY.analysing : FOOTER_COPY.analyse}
      </Button>
    </div>
  )
})
