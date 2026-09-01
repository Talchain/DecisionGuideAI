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
  testId?: string
}

export function NodeMetricRow({
  label,
  value,
  formatted,
  fillClass,
  phrase,
  trailing,
  testId,
}: NodeMetricRowProps) {
  // Absence is not zero. A node with no measurement renders no row rather than
  // a full-width empty track, which would read as "measured, and it is nought".
  if (value === null || !Number.isFinite(value)) return null

  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))

  return (
    <div className="mt-1 flex items-center gap-1.5" data-testid={testId}>
      {/* ⚠ SENTENCE CASE, AND THE DESIGN-SYSTEM GUARD WAS RIGHT TO INSIST.
          The first cut set a text-transform here and argued it carefully:
          transform in CSS rather than in the string, so `textContent` keeps the
          noun each node already shipped and UI-SEM-089's pinned copy survives.
          The argument was sound and answered the wrong question — the design
          system forbids that transform outright (`ci:guard:ds`), and it blocked
          this as a NET-NEW violation.

          It was also the wrong call on its own terms. `FactorNode`'s influence
          row already ships this exact shape in sentence case
          (`w-14 shrink-0 text-text-light`), and this component exists to make
          the four node types agree. Styling it differently would have made the
          row that unifies them the one that matched none of them. The classes
          below are now byte-identical to the row this replaces.

          ⚠ AND A NOTE FOR WHOEVER TRIPS THIS NEXT: the guard scans SOURCE TEXT,
          so it fired again on the first version of THIS comment, which merely
          quoted the class it was explaining. A rule that cannot tell a use from
          a mention will read your explanation as the offence. Rowed. */}
      <span
        className={`${typography.edgeLabel} w-14 shrink-0 text-text-light`}
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
