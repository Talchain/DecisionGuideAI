/**
 * TrustLine — ONE LINE WHERE SEVEN SECTIONS USED TO ANSWER ONE QUESTION.
 *
 * `RobustnessCaveat`, `WhatWeChecked`, uncertainty, `CritiqueWarningStrip`,
 * `InferenceWarningStrip`, `ModelHeldUp` and `WhatIWasGiven` all answer *how
 * far can I trust this?* — each under its own heading, each at full weight. A
 * reader had to assemble the answer from seven places. This states it once and
 * routes to the detail.
 *
 * ⛔⛔ IT INVENTS NO VERDICT, AND THE DISTINCTION IS THE WHOLE POINT. The word
 * is `atAGlance.verdict.label` — the producer's own, renamed once by content
 * strategy — and the sentence beside it is `robustness.display_verdict_reason`
 * VERBATIM. The two figures are COUNTS OF ROWS ALREADY ON SCREEN, which is a
 * fact about this panel, not a claim about the model.
 *
 * ⛔ WHAT IT DELIBERATELY DOES NOT DO: combine them. A single "trust score"
 * over a verdict, a check count and a gap count would be a derived claim about
 * the model — exactly what a UI must not manufacture, and unfalsifiable against
 * anything the producer said. The parts stay separate and each keeps its own
 * meaning.
 *
 * ⚠ ABSENCE IS A STATE, NOT A GAP TO FILL. No verdict ⇒ it says the basis was
 * not established and still offers the detail. It never guesses, and it never
 * renders an "everything is fine" arm.
 */
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { action, surface } from '../panelSurfaces'
import type { GlanceVerdict } from '../analysisNewTypes'

export interface TrustLineProps {
  /** The producer's verdict, already mapped by the glance. `null` ⇒ none sent. */
  verdict: GlanceVerdict | null
  /** How many checks the run actually ran — a count of rendered rows. */
  checksRan: number
  /** How many things the run could not settle — a count of rendered rows. */
  openQuestions: number
  /** Opens the method group. Wired to the same `Accordion` the link names. */
  onOpenMethod: () => void
  /** Whether that group is currently open, for `aria-expanded`. */
  methodOpen: boolean
  testId?: string
}

/**
 * ⚠ THE ICON CARRIES THE TONE, NEVER THE VERDICT — and it is never the only
 * carrier (WCAG SC 1.4.1). The producer's WORD sits beside it in every state,
 * so a reader who cannot tell the icons apart loses nothing.
 */
const VERDICT_ICON = {
  stable: ShieldCheck,
  mixed: ShieldQuestion,
  sensitive: ShieldAlert,
} as const

export function TrustLine({
  verdict,
  checksRan,
  openQuestions,
  onOpenMethod,
  methodOpen,
  testId = 'analysis-new-trust-line',
}: TrustLineProps) {
  const Icon = verdict === null ? ShieldQuestion : VERDICT_ICON[verdict.tone]
  const tone =
    verdict === null
      ? 'text-text-light'
      : verdict.tone === 'stable'
        ? 'text-success'
        : verdict.tone === 'sensitive'
          ? 'text-warning'
          : 'text-text-light'

  return (
    <section className={surface('neutral')} data-testid={testId} role="status">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-[2px] shrink-0 ${tone}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`${typography.panelBody} text-text-header font-medium`}
              data-testid={`${testId}-verdict`}
            >
              {verdict !== null ? verdict.label : COPY.trustLine.noBasis}
            </span>
            {verdict?.reason != null && (
              <span
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`${testId}-reason`}
              >
                {verdict.reason}
              </span>
            )}
          </div>
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            <span data-testid={`${testId}-counts`}>
              {COPY.trustLine.counts(checksRan, openQuestions)}
            </span>
            {' · '}
            <button
              type="button"
              className={action('inline')}
              aria-expanded={methodOpen}
              onClick={onOpenMethod}
              data-testid={`${testId}-open-method`}
            >
              {COPY.sections.howWorkedOut}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
