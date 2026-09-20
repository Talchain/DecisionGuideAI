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
import { action, surface, icon } from '../panelSurfaces'
import type { GlanceVerdict } from '../analysisNewTypes'

export interface TrustLineProps {
  /**
   * The producer's verdict, already mapped by the glance. `null` ⇒ none sent.
   * ⚠ Only `.label` and `.tone` are rendered — `.reason` belongs to `AtAGlance`
   * and restating it puts one claim on the surface twice.
   */
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
  /**
   * ⛔ THE ICON CARRIES SHAPE, NOT COLOUR — and that is a ruling, not a taste.
   *
   * The first version tinted this amber on `sensitive` and green on `stable`.
   * `amberIsRationed.spec.tsx` REDed it immediately: amber went 4 -> 5 on one
   * state and 5 -> 6 on another. Paul's rule, and the ratchet that enforces it:
   * "if you use it too much, it loses its value." A SUMMARY line is the worst
   * place to spend the budget, because every section it summarises already
   * carries the colour where the colour is earned.
   *
   * ⚠ NOTHING IS LOST. `ShieldCheck` / `ShieldQuestion` / `ShieldAlert` are
   * three different shapes, and the producer's own WORD sits beside them in
   * every state — so the tone is carried twice over without colour (SC 1.4.1),
   * which was already the requirement before the budget came into it.
   */
  return (
    <section className={surface('neutral')} data-testid={testId} role="status">
      <div className="flex items-start gap-2">
        <Icon className={`${icon('section')} mt-[2px] shrink-0 text-text-light`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`${typography.panelHeader} text-text-header`}
              data-testid={`${testId}-verdict`}
            >
              {verdict !== null ? verdict.label : COPY.trustLine.noBasis}
            </span>
            {/* ⛔ THE REASON IS NOT RESTATED HERE, AND `firstViewportCensus`
                CAUGHT ME DOING IT. `AtAGlance` already renders
                `robustness.display_verdict_reason` — "the ordering held across
                the simulated range." appeared TWICE on one surface the moment
                this line shipped with it.

                That is the same duplication `RobustnessCaveat` refuses via
                `duplicatesVerdictReason`, and the same rule: a claim stated
                twice reads as two findings. This line's job is the SUMMARY and
                the ROUTE — the word, the counts, and the way to the detail.
                The sentence stays where it already lives. */}
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
