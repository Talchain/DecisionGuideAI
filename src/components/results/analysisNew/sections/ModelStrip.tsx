/**
 * Analysis (New) — "Your model so far".
 *
 * The design's first element, and the only genuinely visual one on the panel:
 * one mark per node, grouped by kind, each mark a route to that node on canvas.
 *
 * ⚠⚠ NO PROVENANCE CLAIM. Every mark is identical and means exactly "a node of
 * this kind exists". The reasoning is in `buildModelStrip.ts` and it is the
 * load-bearing constraint on this component: the filled-vs-hollow distinction
 * the design draws needs per-value provenance the estate does not have, and a
 * fill this data cannot justify is the defect the strip exists to expose.
 *
 * A consequence worth stating, because it removes a thing the design worried
 * about: with no fill there is nothing to explain, so the strip needs NO LEGEND.
 * The legend was a line of furniture bought entirely by the fill.
 */

import { useMemo } from 'react'

import { useCanvasStore } from '../../../../canvas/store'
import { nodeColors } from '../../../../canvas/nodes/colors'
import { NodeMark } from '../nodeMarks'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { typography } from '../../../../styles/typography'
import { buildModelStrip, MARK_CAP } from '../buildModelStrip'

export interface ModelStripProps {
  testId?: string
}

export function ModelStrip({ testId = 'analysis-new-model-strip' }: ModelStripProps) {
  /**
   * ⚠ SUBSCRIBED THROUGH A SIGNATURE, NOT THROUGH THE NODE ARRAY. React Flow
   * replaces `nodes` on every drag, so selecting the array itself would
   * re-render this component continuously while a user moves the canvas. The
   * signature changes only when a node is added, removed or retyped — which is
   * the only thing this component displays.
   *
   * ⚠ `?? []` IS NOT DEFENSIVE HABIT, IT IS SIZED TO THE BLAST RADIUS.
   * `AnalysisNewTabBody` is NOT wrapped in a `SectionErrorBoundary` — unlike
   * every section of `ResultsBody` — so a throw here does not degrade one
   * region, it takes the whole tab down. The store's initial `nodes` could not
   * be confirmed to be an array at every point in its lifecycle (the `[]` in
   * `store.ts` is a reset path, not an initialiser), and the cost of being
   * wrong is a blank surface rather than a missing strip.
   */
  const signature = useCanvasStore((s) =>
    (s.nodes ?? []).map((n) => `${n.id}:${n.type ?? ''}`).join('|'),
  )
  const strip = useMemo(
    () => buildModelStrip(useCanvasStore.getState().nodes ?? []),
    [signature],
  )

  // Nothing on the canvas: the panel's other surfaces already say so, and a
  // strip of empty rows would be furniture claiming to be information.
  if (strip.rows.length === 0) return null

  return (
    <section data-testid={testId} className="flex flex-col gap-2">
      {/* ⚠ A COUNT LINE WAS REMOVED HERE AND THE REASON IS THE CLAIM, NOT THE
          CLUTTER. It read "N elements on the canvas" from `strip.total`, which
          sums the four ROWS — options, factors, risks, outcomes — and therefore
          excludes the goal and decision nodes that are also on the canvas. The
          sentence claimed more than the number supported, and a reader counting
          nodes on screen would have found it short.

          Making it accurate was possible; making it USEFUL was not. Every row
          already carries its own tally, so the line restated them in aggregate
          on a panel whose standing criticism is that it is too textual. Dropped
          rather than corrected. */}
      {strip.goalLabel ? (
        <div
          className="flex items-start gap-2 rounded-md bg-panel-hover px-2 py-2"
          data-testid={`${testId}-goal`}
        >
          <svg viewBox="0 0 12 12" className={`w-3 h-3 mt-1 shrink-0 ${nodeColors.goal.text}`} aria-hidden={true}>
            <path d="M6 1l4.4 5-4.4 5-4.4-5z" fill="currentColor" />
          </svg>
          <span className="min-w-0">
            <span className={`${typography.panelBody} text-text-header block`}>
              {strip.goalLabel}
            </span>
          </span>
        </div>
      ) : null}

      <ul className="list-none p-0 m-0 flex flex-col gap-1">
        {strip.rows.map((row) => (
          <li
            key={row.kind}
            className="grid grid-cols-[56px_1fr_auto] items-center gap-2"
            data-testid={`${testId}-row`}
            data-kind={row.kind}
          >
            <span className={`${typography.panelMeta} text-text-light`}>{row.label}</span>

            {(() => {
              /**
               * ⚠⚠ AN EARLIER DRAFT PUT A FULL-WIDTH BAR HERE AND THAT WAS A
               * CLAIM I CANNOT MAKE. A bar reads as a proportion — of what?
               * The only proportion worth showing is "how much of this have you
               * reviewed", and that needs the provenance this strip explicitly
               * does not have. A bar filled to 100% because there is nothing to
               * fill it against says "complete" about a model nobody has
               * checked. That is the advertisement-not-affordance defect, in
               * the component built to avoid it.
               *
               * Over the cap the row therefore shows the first `MARK_CAP` nodes
               * as real click targets and states plainly how many it is not
               * showing. Nothing is implied about the remainder except that it
               * exists, which is the only thing known.
               */
              const shown = row.overCap ? row.nodes.slice(0, MARK_CAP) : row.nodes
              const hidden = row.nodes.length - shown.length
              return (
              <span className="flex flex-wrap items-center gap-1" data-testid={`${testId}-marks`}>
                {shown.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => focusModelTarget(node.id)}
                    className="rounded hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                    data-testid={`${testId}-mark`}
                    data-node-id={node.id}
                    title={node.label || undefined}
                  >
                    <NodeMark kind={row.kind} />
                    <span className="sr-only">
                      {node.label
                        ? `Show ${node.label} on the canvas`
                        : `Show this ${row.kind} on the canvas`}
                    </span>
                  </button>
                ))}
                {hidden > 0 ? (
                  <span
                    className={`${typography.panelMeta} text-text-light`}
                    data-testid={`${testId}-overflow`}
                  >
                    {`+${hidden} not shown`}
                  </span>
                ) : null}
              </span>
              )
            })()}

            <span className={`${typography.panelMeta} text-text-light tabular-nums`}>
              {row.nodes.length}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

