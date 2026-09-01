import type { ReactNode } from 'react'
import { typography } from '../../../styles/typography'

/**
 * ⭐ ONE METRIC ROW FOR EVERY NODE TYPE.
 *
 * The canvas had THREE presentations of the same idea, and they diverged
 * because each was written where it was needed rather than shared:
 *
 *   option  →  "Ahead ▬▬▬▬▬▬ 18%"        anchored row with a bar
 *   factor  →  "Influence score 72%"      a pill, no bar
 *   risk    →  "40% strength · est."      inline text, value first, no bar
 *
 * OptionNode's own comment records the mechanism: its `w-14` column "matches
 * FactorNode's rows exactly" — i.e. it was HAND-COPIED. So the two that were
 * copied stayed roughly aligned and the two that were not (risk, outcome) never
 * got a bar at all. A shared component is the only thing that stops that
 * happening again (CLAUDE.md trap 12: derive, do not mirror).
 *
 * ⚠ THE BAR IS THE CONSTANT; ONLY THE CAPTION CHANGES. A reader should be able
 * to compare two nodes of different types at a glance without first working out
 * which of three formats each is using. That comparison is the whole point of
 * putting numbers on a graph.
 *
 * ⚠ THE CAPTION IS VISIBLE TEXT, NEVER A `title`. Two rules already established
 * on this canvas and both are load-bearing here:
 *   · UI-SEM-089 — an unlabelled percentage beside a goal reads as a computed
 *     contribution, so the noun stays on every branch.
 *   · A `title` is unreachable by keyboard on a non-focusable row and absent on
 *     touch, so hiding the anchor there serves neither input class.
 */
export interface NodeMetricRowProps {
  /** The noun: "Ahead", "Influence", "Strength". Rendered, never a tooltip. */
  label: string
  /** 0..1. `null` renders no row at all — absence is not zero. */
  value: number | null
  /** Pre-formatted display string, so each node keeps its own rounding rules. */
  formatted: string
  /** Tailwind background class for the bar fill, e.g. `bg-option`. */
  fillClass: string
  /** Full sentence for assistive tech — what the number MEANS, not just its value. */
  phrase?: string
  /** Rendered after the value: an estimate marker, a confidence dot. */
  trailing?: ReactNode
  /**
   * Pointer-facing disclosure for a figure whose BASIS a reader could misread.
   *
   * ⚠ ADDED FOR THE FACTOR ROW, AND IT IS NOT OPTIONAL THERE. A factor's
   * influence on the fallback basis is per-set normalised, so the top driver
   * shows 100% BY CONSTRUCTION — a number that means "highest here", not
   * "total". `MetricPills` disclosed that through a native `title`, and a
   * conversion that dropped it would have moved a figure onto a more prominent
   * row while quietly removing the sentence that stops it being read as an
   * absolute. Same shape as the type-description tooltip that died when the
   * glyph moved: a visual change taking an explanation away with nothing on
   * screen to notice it.
   *
   * ⚠ A `title` IS NOT ENOUGH ON ITS OWN and is not offered as one — it is
   * unreachable by keyboard on a non-focusable row and absent on touch, which
   * is why `phrase` carries the meaning for assistive tech independently.
   * Callers that need a basis disclosed should pass BOTH.
   */
  title?: string
  testId?: string
}

export function NodeMetricRow({
  label,
  value,
  formatted,
  fillClass,
  phrase,
  trailing,
  title,
  testId,
}: NodeMetricRowProps) {
  // Absence is not zero. A node with no measurement renders no row rather than
  // a full-width empty track, which would read as "measured, and it is nought".
  if (value === null || !Number.isFinite(value)) return null

  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))

  return (
    <div className="mt-1 flex items-center gap-1.5" data-testid={testId} title={title}>
      {/* ⚠ SENTENCE CASE, AND THE DESIGN-SYSTEM GUARD WAS RIGHT TO INSIST.
          The first cut set a text-transform here and argued it carefully:
          transform in CSS rather than in the string, so `textContent` keeps the
          noun each node already shipped and UI-SEM-089's pinned copy survives.
          The argument was sound and answered the wrong question — the design
          system forbids that transform outright (`ci:guard:ds`), and it blocked
          this as a NET-NEW violation.

          It was also the wrong call on its own terms. `FactorNode`'s influence
          row already ships this exact shape in sentence case, and this component
          exists to make the four node types agree. Styling it differently would
          have made the row that unifies them the one that matched none of them.

          ⚠ AND A NOTE FOR WHOEVER TRIPS THIS NEXT: the guard scans SOURCE TEXT,
          so it fired again on the first version of THIS comment, which merely
          quoted the class it was explaining. A rule that cannot tell a use from
          a mention will read your explanation as the offence. Rowed.

          ⭐ THE FIXED CAPTION COLUMN IS GONE, AND THE WIDTH IT USED TO CARRY WAS
          MEASURED FOR TYPE THIS ROW NO LONGER RENDERS. `edgeLabel` is
          `calc(10px * var(--canvas-label-scale))`: it counter-scales so a canvas
          caption stays legible as the view zooms out. The old `w-14` (56px) did
          NOT counter-scale, so at the auto-fit floor the caption rendered at 20px
          inside a box measured for 10px — `clientWidth 56 / scrollWidth 73` at
          `labelScale 2`, measured in Chromium, so ~17px of "strength" painted
          ON TOP OF the bar beside it. `nodeTextClipping.visual.spec.ts` reported
          it on three starters; it has been red since #1067 introduced this row.

          ⛔ THE OBVIOUS FIX IS WRONG AND I SHIPPED IT BEFORE MEASURING IT. Scaling
          the column with the type (`w-[calc(3.5rem*var(--canvas-label-scale,1))]`)
          makes the caption fit and reads as the principled change — the container
          tracking the same scale as its contents. Measured, it DESTROYS THE BAR:
          on the 230px card the caption takes 112px of a 202px row and the track
          collapses to 0px (from 51px). This component's own rule two paragraphs
          up is that the bar is the constant, and its `max(4px, …)` fill exists
          precisely so a real value is never reported as an absence. A fix that
          silently deletes the bar to save the caption trades one visible defect
          for a worse one. The numbers are the only reason I know that.

          WHAT IS HERE INSTEAD: the caption is sized to its CONTENT. It cannot
          clip, and the bar keeps 33px on the narrowest card (against 51px before,
          and 0px under the scaled-column version). Measured across three
          starters at the auto-fit zoom.

          ⚠ AND THE COST, STATED RATHER THAN BURIED: bars no longer begin at the
          same x across node TYPES, because the four captions differ in width
          ("Leads", "Chance", "strength", "Influence"). Within a type they still
          align exactly. This is a real reduction in the at-a-glance comparison
          this component was built for, and it is a DESIGN judgement, not a
          mechanical one — flagged in the PR for a ruling rather than settled
          here. The alternative that preserves alignment is a wider card floor at
          the counter-scale, which is canvas geometry and belongs to that lane. */}
      <span
        className={`${typography.edgeLabel} shrink-0 text-text-light`}
        aria-hidden="true"
      >
        {label}
      </span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-panel-border" aria-hidden="true">
        {/* `max(4px, …)` so a small-but-real value stays visible as a mark
            rather than rounding away to nothing — a 1% influence is a fact, and
            an invisible bar reports it as an absence. */}
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillClass}`}
          style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0%' }}
        />
      </div>
      <span
        className={`${typography.nodeLabel} text-text-body shrink-0 tabular-nums`}
        aria-hidden="true"
      >
        {formatted}
      </span>
      {trailing}
      {phrase ? <span className={typography.screenReaderOnly}>{phrase}</span> : null}
    </div>
  )
}
