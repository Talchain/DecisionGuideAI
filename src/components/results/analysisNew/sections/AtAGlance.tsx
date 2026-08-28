/**
 * Analysis (New) — "At a glance": the 5-to-10-second strategic read.
 *
 * ⭐ DESIGNED FOR A 238–320px CONTENT MEASURE — A RANGE, NOT A NUMBER.
 *
 * ⚠⚠ THIS PARAGRAPH PREVIOUSLY SAID "the dock is 416px at all three viewports,
 * so there is no wider state to design for and no responsive variant to serve".
 * THAT WAS WRONG, AND IT WAS THE CONSTRAINT THIS WHOLE COMPONENT CITES. The
 * dock is USER-RESIZABLE AND RESPONSIVE: `dockWidth.ts` sets DOCK_MIN_WIDTH 280
 * and DOCK_RESPONSIVE_MAX_WIDTH 416, an explicit user drag wins over both, and
 * the drag bounds run to 480. 416 is the CEILING of the responsive default, not
 * a fixed width — and the surface was found rendering at a dock of 333px during
 * the acceptance drive, which is how the error surfaced at all.
 *
 * Derived at the mounted build on a real completed run:
 *
 *     dock 280 → content 238    dock 333 → content 291
 *     dock 416 → content 320    dock 480 → content 320  (capped by max-w-360)
 *
 * No horizontal overflow and no clipped producer prose at any of them. The
 * design survives, so nothing here changes in behaviour — but the REASON it
 * survives is the `max-w-[360px]` cap plus fluid rows, NOT a fixed dock, and a
 * future change reasoning from "it is always 320" would be reasoning from a
 * measurement that was never true.
 *
 * ── WHAT THE CONCEPT MOCK-UPS PROPOSED AND THIS DOES NOT ───────────────────
 *  · A left-to-right `drivers → influence → outcome` diagram. Dropped. Every
 *    driver points at the same focal object, so the topology is a star and the
 *    arrows carry no information the labels do not — while costing roughly two
 *    thirds of the horizontal budget.
 *  · Percentages beside each driver (41% / 22% / 15%). Dropped. They sum to 78%
 *    against one outcome, which reads as "share of the outcome"; neither the
 *    producer's absolute influence scale nor a set-relative elasticity licenses
 *    that reading. Bars scaled to the strongest driver make it a RANK
 *    comparison, which is what both bases actually support.
 *  · Coloured icon tiles beside each driver label. Dropped. ~40px of a 320px
 *    row spent restating the label.
 *  · "Biggest leverage opportunity". Dropped — no leverage producer exists.
 *  · Per-driver "more robust / more uncertain" dots. Dropped — the candidate
 *    fields appear in no fixture, and the one always present (`confidence`) is
 *    a known placeholder the display policy exists to suppress.
 *  · "72% model health". Dropped — `useModelHealth()` returns an issue LIST,
 *    not a score. There is no percentage behind it.
 *  · A persistent "Work through with Olumi | Show in model" footer. Dropped —
 *    the shell already owns the footer region for this surface, and a GLOBAL
 *    "show in model" has no object to focus.
 *  · A primary reasoning intervention row inside the glance. Dropped, and this
 *    one is the least obvious. "Strengthen the reasoning" renders the SAME
 *    top-priority engine recommendation immediately below, inside the same
 *    viewport — so the glance row would be the identical action twice, roughly
 *    120px apart. One signal, one primary surface. The glance ends on "could
 *    change if" and hands straight to Strengthen, which is where the action,
 *    its grounding and its routes already live. `primaryInterventionId` stays
 *    on the model so a future variant can host it without re-deriving.
 *
 * ── WHAT STAYS VISIBLE, AND WHY IT CANNOT BE HOVER-ONLY ────────────────────
 * The verdict word and the influence BASIS are analytical state: the first is
 * how much to rely on the read, the second is what the bars mean. Both would
 * change a reader's interpretation, so both are visible. What sits behind
 * disclosure is the EXPLANATION — the producer's scope sentence, and the
 * definition of the basis. That is the split the brief asks for.
 */

import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ComparisonScopeNote } from '../../ComparisonScopeNote'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { AtAGlance as AtAGlanceModel } from '../analysisNewTypes'

const TONE_CLASS: Record<string, string> = {
  stable: 'text-success',
  mixed: 'text-warning',
  sensitive: 'text-warning',
}

export interface AtAGlanceProps {
  glance: AtAGlanceModel
  onFocusTarget?: (targetId: string) => void
  onOpenDrivers?: () => void
  testId?: string
}

export function AtAGlance({
  glance,
  onFocusTarget,
  onOpenDrivers,
  testId = 'analysis-new-glance',
}: AtAGlanceProps) {
  const hasAnything =
    glance.headline || glance.verdict || glance.drivers.length > 0 || glance.condition
  if (!hasAnything) return null

  return (
    <section className="space-y-2" data-testid={testId} aria-label={COPY.sections.atAGlance}>
      {/* ── THE READ ───────────────────────────────────────────────────────
          Full width, no icon gutter. Absent when no producer licenses a
          synthesis — the glance then leads with the drivers, which is the
          correct behaviour for a situation that is not a decision. */}
      {glance.headline ? (
        <p className={`${typography.panelHeader} text-text-header`} data-testid={`${testId}-headline`}>
          {glance.headline}
        </p>
      ) : null}

      {/* ── THE TRUST QUALIFICATION ────────────────────────────────────────
          One word, visible. The producer's scope sentence rides as the title
          so it is available on focus/hover without spending a row. */}
      {glance.verdict ? (
        <div data-testid={`${testId}-verdict`} data-verdict-tone={glance.verdict.tone}>
          {/* Evidence and trust share ONE line: the win share is the most
              informative number on the surface and the verdict is how much to
              rely on it, so they belong together and cost one row, not two. */}
          <p
            className={`${typography.panelMeta} ${TONE_CLASS[glance.verdict.tone]} flex items-center gap-1.5`}
            data-testid={`${testId}-verdict-line`}
          >
            {glance.verdict.tone === 'stable' ? (
              <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            {glance.winShare ? (
              <span className="text-text-body" data-testid={`${testId}-win-share`}>
                {glance.winShare} ·{' '}
              </span>
            ) : null}
            {glance.verdict.label}
          </p>
          {/* ⚠⚠ THE REASON GETS ITS OWN WRAPPING LINE, AND THIS IS A TRUTH
              REQUIREMENT, NOT A LAYOUT PREFERENCE. It was inline with a
              `truncate`. Measured on a real run at the 320px measure, the
              producer sent 131 characters into 190px of space — 696px of text
              in a 190px box, so roughly three quarters of the sentence was
              invisible, and what remained INVERTED IT:

                full     "none of the factors we could test changed which
                          option leads on its own, BUT this result scored low
                          on our other robustness checks"
                on screen "none of the factors we could te…"

              The visible fragment reads as reassurance; the sentence is a
              warning. A truncated LABEL is a cosmetic loss — the reader knows
              a name was shortened and a title attribute recovers it. A
              truncated SENTENCE is a different object: it silently produces a
              new, shorter, well-formed claim the producer never made. Never
              clip producer prose. */}
          {glance.verdict.reason ? (
            <p
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`${testId}-verdict-reason`}
            >
              {glance.verdict.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── WHAT THE SHARE RANGES OVER ─────────────────────────────────────
          ⚠⚠ BESIDE THE NUMBER, NEVER BEHIND DISCLOSURE (ROADMAP 2.1340).
          Measured at a controlled capture: this surface showed "Ahead in 60% of
          simulated futures" on a run that compared TWO of the user's THREE
          options, while the existing Analysis tab disclosed the scope on the
          same run. The percentage is not wrong; it is a true statement about a
          candidate set the reader never learns, and the reader supplies the
          wrong one. Scope and number must not be readable independently, so
          this sits directly under the trust line rather than in `Deeper`.

          `withDetail` is the shared component's own rule, not a preference: a
          win share is a set-dependent VALUE, and its header states such
          surfaces take `COMPARISON_SCOPE_COPY.detail`. The component owns the
          suppression rule too — it renders nothing on a whole-set run. */}
      {/* ⚠⚠ GATED ON A SET-DEPENDENT CLAIM BEING ON SCREEN — AND THAT IS NOT THE
          SAME AS THE PERCENTAGE BEING ON SCREEN. Two rounds of independent
          review landed here, and the intermediate answer was WORSE than the
          original:

            round 1  no gate      -> "Ranks and comparative percentages describe
                                     those 1 only" rendered with no rank and no
                                     percentage anywhere. A sentence about nothing.
            round 2  gate on the  -> a leader determined by EXPECTED OUTCOME has a
                     win share       null win probability, so the surface named a
                                     leader among 2 of 3 options and asserted the
                                     ordering held, disclosing NOTHING about the
                                     third. A REGRESSION on the very defect this
                                     change exists to fix.

          The property is "is a set-dependent claim on screen?", and this surface
          makes three: the headline superlative, the win share, and the
          robustness ordering verdict. `comparativeClaim` is derived once in the
          builder from the same fields these components render from, so the gate
          and the render cannot drift apart the way they just did.

          `withDetail` follows `ComparisonScopeNote`'s OWN rule: a set-dependent
          VALUE takes the consequence line; set-dependent ORDER takes the neutral
          sentence alone, because "comparative percentages" would then describe a
          magnitude that is not on screen. */}
      {glance.comparisonScope.kind === 'partial' && glance.comparativeClaim !== 'none' ? (
        <div data-testid={`${testId}-scope`}>
          <ComparisonScopeNote
            scope={glance.comparisonScope.scope}
            surface="analysisNew"
            withDetail={glance.comparativeClaim === 'value'}
          />
          {/* The excluded option says what it IS, in the estate's sanctioned
              words — "no rank and no probability". The scope sentence above
              names who was left out; this states the consequence for them, and
              the two are different claims. */}
          {glance.comparisonScope.excluded.map((o) => (
            <p
              key={o.id}
              className={`${typography.panelMeta} text-text-light mt-1`}
              data-testid={`${testId}-excluded-option`}
              data-option-id={o.id}
            >
              <span className="text-text-header">{o.label}</span>
              {' — '}
              {NOT_ANALYSED_BADGE}
              {'. '}
              {o.reasonCopy}
            </p>
          ))}
        </div>
      ) : null}

      {/* ── WHAT MATTERS MOST ──────────────────────────────────────────────
          Label left, fixed-width track right. A FIXED track is what makes the
          bars comparable at a glance; a proportional-width track would encode
          the same number twice and read as two different quantities. */}
      {glance.drivers.length > 0 ? (
        <div className="pt-0.5" data-testid={`${testId}-drivers`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className={`${typography.panelMeta} text-text-header`}>
              {COPY.glance.whatMattersMost}
            </span>
            {/* The BASIS is a truth claim, so it is visible — but only when it
                is the set-relative one, because that is the case a reader
                could otherwise misread as an absolute share. */}
            <span
              className={`${typography.panelMeta} text-text-light shrink-0`}
              title={
                glance.influenceIsSetRelative
                  ? COPY.glance.basisRelativeExplain
                  : COPY.glance.basisAbsoluteExplain
              }
              data-testid={`${testId}-basis`}
            >
              {glance.influenceIsSetRelative ? COPY.glance.basisRelative : COPY.glance.basisAbsolute}
            </span>
          </div>

      {/* ⚠⚠ ONE DRIVER GETS NO BAR, AND THIS IS AN HONESTY RULE, NOT A TASTE ONE.
          `fraction` is the driver's magnitude over the STRONGEST magnitude in
          the run, so with a single driver it is 1 BY CONSTRUCTION — the bar
          renders full whether the producer measured a dominant influence or a
          negligible one. Witnessed on a real run: one non-zero driver at
          contribution 0.5 drew a full-width bar. A rank comparison needs
          something to rank against; with one row the bar is a shape that
          asserts a magnitude it does not carry. The label alone is the whole
          truth available, so the label alone is what renders. */}
          <ul className="mt-1 space-y-1 list-none p-0 m-0">
            {glance.drivers.map((d) => {
              const focusable = Boolean(d.targetId && onFocusTarget)
              const comparable = glance.drivers.length > 1
              const Row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-left" title={d.label}>
                    {d.label}
                  </span>
                  {comparable ? (
                    <span
                      className="h-1.5 w-[104px] shrink-0 rounded-full bg-panel-hover overflow-hidden"
                      aria-hidden="true"
                      data-testid={`${testId}-driver-bar`}
                    >
                      <span
                        className="block h-full rounded-full bg-info"
                        style={{ width: `${Math.round(d.fraction * 100)}%` }}
                      />
                    </span>
                  ) : null}
                </>
              )
              return (
                <li key={d.id} data-testid={`${testId}-driver`} data-driver-id={d.id}>
                  {focusable ? (
                    <button
                      type="button"
                      onClick={() => onFocusTarget!(d.targetId!)}
                      className={`${typography.panelBody} text-text-body w-full flex items-center gap-2 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-driver-focus`}
                    >
                      {Row}
                    </button>
                  ) : (
                    // Fail-closed: no target, no affordance. Plain text beats a
                    // control that does nothing.
                    <span className={`${typography.panelBody} text-text-body w-full flex items-center gap-2`}>
                      {Row}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* ── COULD CHANGE IF ────────────────────────────────────────────────
          A tipping point, not a ranking. Present only when the producer
          computed one. */}
      {glance.condition ? (
        <button
          type="button"
          onClick={
            glance.condition.targetId && onFocusTarget
              ? () => onFocusTarget(glance.condition!.targetId!)
              : onOpenDrivers
          }
          className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          data-testid={`${testId}-condition`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="text-text-header">{COPY.glance.couldChangeIf}</span>{' '}
            {glance.condition.text}
          </span>
          <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  )
}
