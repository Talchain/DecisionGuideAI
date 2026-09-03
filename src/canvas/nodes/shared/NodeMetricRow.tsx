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
  /**
   * 0..1. `null` renders no row at all — absence is not zero — UNLESS
   * `unsetText` is supplied, in which case the row states the unknown instead.
   */
  value: number | null
  /**
   * Pre-formatted display string, so each node keeps its own rounding rules.
   * Required whenever `value` is a number; unused on the `unsetText` branch,
   * which by construction has no figure to print.
   */
  formatted?: string
  /**
   * ⭐ WHAT THIS ROW SAYS WHEN NOBODY HAS SET THE QUANTITY IT CAPTIONS.
   *
   * ⛔ THE DEFECT IT CLOSES. Five cards on one canvas read `Strength 50% est.`
   * and each drew a bar EXACTLY HALF FULL — the no-information default in
   * measurement grammar, on the same visual scale an option's COMPUTED win
   * share uses two cards along. A half-full bar says "assessed, and middling".
   * Nothing had assessed it.
   *
   * ⛔ AND WHY THERE IS NO EMPTY TRACK ON THIS BRANCH. The obvious rendering —
   * keep the track, draw no fill — is refused by this component's own rule,
   * three paragraphs down in the value branch: an unfilled full-width track
   * "would read as 'measured, and it is nought'". Zero and unknown are
   * different claims, and the bar has no way to distinguish them. So the track
   * is not drawn at all, and the words take its column.
   *
   * ⚠ THE CAPTION COLUMN IS UNCHANGED, DELIBERATELY. The floor that gives every
   * node type a shared start-x applies to both branches, so a reader scanning a
   * board still meets `Strength` in the same place whether it is known or not —
   * which is the comparison this component exists to make possible.
   *
   * ⚠ NO `trailing` ON THIS BRANCH. An `est.` marker beside "Not set yet" would
   * be a second, weaker spelling of the same fact, at 7px.
   */
  unsetText?: string
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
  unsetText,
}: NodeMetricRowProps) {
  // Absence is not zero. A node with no measurement renders no row rather than
  // a full-width empty track, which would read as "measured, and it is nought".
  //
  // ⭐ UNLESS THE CALLER HAS SOMETHING TRUE TO SAY ABOUT THE ABSENCE. Silence
  // reads as "nothing to see"; a caller that knows the quantity EXISTS and is
  // merely unset can say so, in the same caption column, with no bar and no
  // figure. See `unsetText` in the props above for why there is no empty track.
  if (value === null || !Number.isFinite(value)) {
    if (unsetText === undefined || unsetText.length === 0) return null
    return (
      <div className="mt-1 flex items-center gap-1.5" data-testid={testId} title={title}>
        <span
          className={`${typography.edgeLabel} min-w-[3.5rem] shrink-0 text-text-light`}
          aria-hidden="true"
        >
          {label}
        </span>
        {/* `min-w-0` + `truncate` so a longer future wording clips inside its
            own box rather than painting over the caption beside it — the
            failure mode `nodeTextClipping.visual.spec.ts` caught on the 230px
            card at the auto-fit counter-scale. */}
        <span
          className={`${typography.edgeLabel} min-w-0 flex-1 truncate text-text-light italic`}
          aria-hidden="true"
        >
          {unsetText}
        </span>
        {phrase ? <span className={typography.screenReaderOnly}>{phrase}</span> : null}
      </div>
    )
  }

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

          ⭐ THE CAPTION COLUMN IS A FLOOR, NOT A FIXED WIDTH, AND THE WIDTH IT
          USED TO CARRY WAS MEASURED FOR TYPE THIS ROW NO LONGER RENDERS. `edgeLabel` is
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

          ⛔ AND CONTENT-SIZING — WHICH #1124 SHIPPED — IS ALSO NOT THE ANSWER,
          THOUGH IT IS A MUCH NEARER MISS. It cannot clip, and it keeps the bar
          at 33px on the narrowest card. But it gives up the shared start-x:
          the four captions differ in width ("Leads", "Chance", "strength",
          "Influence"), so EQUAL VALUES RENDER AS UNEQUAL BAR LENGTHS across node
          types — the doctrine two paragraphs up, inverted. On a data display
          that is a truthfulness problem, not a cosmetic one.

          ⭐ WHAT IS HERE INSTEAD: a FLOOR. `width = max(3.5rem, content)`, so
          each regime gets the behaviour that was right for it and neither pays
          for the other:

            content ≥ 56px  →  identical to content-sizing; the clip stays fixed
            content < 56px  →  identical to the old `w-14`; alignment holds

          MEASURED (build-vs-buy, the 230px card — the narrowest the starters
          produce — in Chromium on the hermetic visual harness):

            counter-scale   caption content   caption box   bar    vs #1124
            2 (auto-fit)         73px            73px       33px    unchanged
            1 (zoomed in)        41px            56px       86px    -15px

          So the floor costs the bar NOTHING at the tightest case, because there
          the content already exceeds it. Where it does bite, it is paid for out
          of a bar that has 101px to give, and it buys back the shared start-x.

          ⚠ AND THE LIMIT OF THAT EVIDENCE, STATED: only the outcome and risk
          rows mount in the starter fixtures, and both caption "strength". The
          alignment this restores is BETWEEN node types, so the harness cannot
          witness the thing being bought — it can only witness that the floor is
          applied and that the bar survives. `NodeMetricRow` renders five
          captions; three of them are unreachable to any starter-seeded test.
          `nodeMetricColumn.visual.spec.ts` pins both regimes on the two that
          are, at both counter-scales. */}
      <span
        className={`${typography.edgeLabel} min-w-[3.5rem] shrink-0 text-text-light`}
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
