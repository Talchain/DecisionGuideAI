/**
 * Analysis (New) — "At a glance": the 5-to-10-second strategic read.
 *
 * ⭐ DESIGNED NATIVELY FOR 320px, WHICH IS THE MEASURED CONTENT WIDTH (dock
 * 416 → body 414 → measure 360 → 40px gutters). Measured on the mounted build
 * at 1024 / 1440 / 1920 viewports: the dock is 416px at all three, so there is
 * no wider state to design for and no responsive variant to serve.
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
        <p
          className={`${typography.panelMeta} ${TONE_CLASS[glance.verdict.tone]} flex items-center gap-1.5`}
          data-testid={`${testId}-verdict`}
          data-verdict-tone={glance.verdict.tone}
          title={glance.verdict.reason}
        >
          {glance.verdict.tone === 'stable' ? (
            <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          {glance.verdict.label}
          {glance.verdict.reason ? (
            <span className="text-text-light truncate">— {glance.verdict.reason}</span>
          ) : null}
        </p>
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

          <ul className="mt-1 space-y-1 list-none p-0 m-0">
            {glance.drivers.map((d) => {
              const focusable = Boolean(d.targetId && onFocusTarget)
              const Row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-left" title={d.label}>
                    {d.label}
                  </span>
                  <span
                    className="h-1.5 w-[104px] shrink-0 rounded-full bg-panel-hover overflow-hidden"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-info"
                      style={{ width: `${Math.round(d.fraction * 100)}%` }}
                    />
                  </span>
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
