/**
 * Analysis (New) — "Your model so far".
 *
 * The design's first element, and the only genuinely visual one on the panel:
 * marks grouped by kind, each a route to that node on canvas, under the goal or
 * decision the model is about.
 *
 * ⭐⭐ WHY IT IS NOW A SUMMARY LINE WITH THE MARKS BEHIND IT — measured, and the
 * measurement is the whole argument.
 *
 * On the deployed build at the real shipped width the panel is 278 x 702px and
 * this strip occupied 235 x 155px: 22% OF THE PANEL'S HEIGHT, permanently,
 * above everything the reader came for. Three findings settled what to do:
 *
 *   1. THE MARK ARRAY IS A UNARY RESTATEMENT OF THE NUMBER BESIDE IT. Every
 *      mark here is identical and means exactly "a node of this kind exists"
 *      (`buildModelStrip.ts`, and it is deliberate — see the provenance note
 *      there). So N identical marks say "N nodes of this kind exist", which is
 *      precisely what the tally at the end of the same row already said, more
 *      precisely, in a tenth of the space. The panel's own first-viewport
 *      census exists to catch a claim stated twice; it counts SENTENCES, so it
 *      could not see the same defect expressed as an encoding.
 *   2. WHAT THE MARKS ADD OVER THE NUMBER IS A WEAK AFFORDANCE. A 12px
 *      unlabelled shape whose accessible name lives in a screen-reader-only
 *      span, on a panel where every finding below already carries a named
 *      "Show on canvas" control, and beside a canvas that is itself the primary
 *      navigation surface. Real, worth keeping, not worth 22% of the panel.
 *   3. THE REST OF THIS PANEL IS ALREADY A LIST OF COLLAPSED ROWS.
 *      `SectionShell` makes every section below the glance mount CLOSED, and
 *      `collapsedIA.spec.tsx` pins that as the information architecture. An
 *      always-expanded block at the top was the one thing exempt from the
 *      surface's own rule.
 *
 * So the census and the vocabulary stay visible and the mark array goes behind
 * a disclosure. What survives collapse is everything the canvas does NOT say:
 * the subject, a per-kind COUNT (a spatial graph cannot be counted at a
 * glance), and one labelled mark per kind — which is a better vocabulary key
 * for the marks used on the findings below than twelve unlabelled repeats,
 * because the label is attached to it.
 *
 * ⚠ DEFAULT OPEN BEFORE A RUN. Orientation is worth most when there is nothing
 * else on the panel — pre-run this tab has a status line and empty sections,
 * and the strip was written partly because "before a run it had almost nothing
 * to show at all". Post-run the glance, the insights and the recommendations
 * are what the reader came for, and the strip is what was pushing them down.
 *
 * ⚠ THE SUBJECT'S OWN MARK IS GONE, AND NOT FOR SPACE. The header used to draw
 * the canvas goal glyph beside the label. `buildModelStrip` resolves that label
 * from the goal node OR, failing that, from the DECISION node — one field, two
 * origins — so the glyph was drawn as a goal on every model that names a
 * decision and no goal. A mark that means something it is not is the exact
 * defect `nodeMarks.tsx` exists to prevent, so it is removed rather than
 * guessed at. Restoring it needs the builder to say which node the subject came
 * from; the four tallies below carry the vocabulary in the meantime.
 *
 * ⚠⚠ NO PROVENANCE CLAIM, UNCHANGED AND NON-NEGOTIABLE. Every mark is identical
 * and means exactly "a node of this kind exists". The filled-vs-hollow
 * distinction the design draws needs per-value provenance the estate does not
 * have, and a fill this data cannot justify is the defect the strip exists to
 * expose. With no fill there is nothing to explain, so the strip needs NO
 * LEGEND — the legend was furniture bought entirely by the fill.
 */

import { useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { useCanvasStore } from '../../../../canvas/store'
import { NodeMark } from '../nodeMarks'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { typography } from '../../../../styles/typography'
import { buildModelStrip, MARK_CAP } from '../buildModelStrip'

/**
 * The subject line when the model names neither a goal nor a decision.
 *
 * Deliberately the strip's own name rather than an invented subject: with no
 * goal node there is no question to state, and a header that guessed one would
 * be a claim. It doubles as the landmark's accessible name in that case.
 */
const NO_SUBJECT_LABEL = 'Your model so far'

export interface ModelStripProps {
  testId?: string
  /**
   * Nothing has been analysed yet. Chooses the DEFAULT open state only — a
   * reader who toggles keeps their choice for as long as the panel is mounted.
   *
   * ⚠ IT IS READ ON EVERY RENDER, NOT CAPTURED ON MOUNT, and that is the point.
   * A reader who lands pre-run gets the strip open; when their run completes
   * the panel fills with the glance and four sections, and a strip captured as
   * "open" at mount would keep 155px of census above all of it at exactly the
   * moment the space is worth most. It closes on that transition — unless they
   * opened it themselves, which is recorded separately and wins.
   */
  isPreRun?: boolean
}

export function ModelStrip({
  testId = 'analysis-new-model-strip',
  isPreRun = false,
}: ModelStripProps) {
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

  /**
   * `null` until the reader touches the control, so the default can keep
   * tracking the run state. An initialiser would freeze it at mount and the
   * strip would stay open across the pre-run boundary — see `isPreRun`.
   */
  const [override, setOverride] = useState<boolean | null>(null)
  const regionId = useId()
  const subjectId = useId()

  // Nothing on the canvas: the panel's other surfaces already say so, and a
  // strip of empty rows would be furniture claiming to be information.
  if (strip.rows.length === 0) return null

  const open = override ?? isPreRun

  return (
    /* ⚠ A LABELLED LANDMARK, NAMED BY ITS OWN SUBJECT. A `section` is a
       landmark and an unnamed one is an unlabelled region for anyone navigating
       by landmark — the dock's own spec pins this, and `SectionShell` follows
       the same rule. Pointing at the subject line rather than carrying a fixed
       string means the landmark is announced as the decision it is about. */
    <section
      data-testid={testId}
      aria-labelledby={subjectId}
      data-strip-open={open ? 'true' : 'false'}
    >
      {/* ⚠ THE WHOLE BLOCK IS ONE CONTROL, per `DisclosureRow`'s rule: the
          target is large and the keyboard reaches it once rather than three
          times. The census sits INSIDE it, so a screen-reader user is told what
          the model contains without having to expand anything. */}
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        // Points at the region ONLY while it exists. A collapsed region is
        // UNMOUNTED rather than hidden, so a resting reference would dangle.
        aria-controls={open ? regionId : undefined}
        className="w-full text-left flex items-start gap-2 py-1 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        data-testid={`${testId}-toggle`}
      >
        <span className="min-w-0 flex-1">
          <span
            id={subjectId}
            // ⚠ CLAMPED TO ONE LINE WHILE CLOSED, FULL WHILE OPEN — one
            // element, not two. A second copy of the subject inside the region
            // would put the same sentence on screen twice, which is exactly
            // what the first-viewport census exists to stop.
            className={`${typography.panelBody} text-text-header block ${open ? '' : 'truncate'}`}
            data-testid={`${testId}-goal`}
            title={strip.goalLabel ?? undefined}
          >
            {strip.goalLabel ?? NO_SUBJECT_LABEL}
          </span>

          {/* ⚠ THE CENSUS, AND IT IS THE THING THE CANVAS CANNOT SAY. A reader
              can see the shapes on the canvas; they cannot count fourteen
              factors at a glance. Each tally is a mark, its kind, and its
              number — which is also the vocabulary key for the marks the
              findings below carry, with the label attached to it.

              It is replaced by the rows when open rather than shown alongside
              them: the rows carry the same label and the same number, and two
              copies of one tally is the restatement this panel keeps paying
              for. */}
          {open ? null : (
            <span
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1"
              data-testid={`${testId}-tallies`}
            >
              {strip.rows.map((row) => (
                <span
                  key={row.kind}
                  className="flex items-center gap-1"
                  data-testid={`${testId}-tally`}
                  data-kind={row.kind}
                >
                  <NodeMark kind={row.kind} />
                  <span className={`${typography.panelMeta} text-text-light`}>{row.label}</span>
                  <span className={`${typography.panelMeta} text-text-light tabular-nums`}>
                    {row.nodes.length}
                  </span>
                </span>
              ))}
            </span>
          )}
        </span>

        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 mt-0.5 text-text-light" aria-hidden={true} />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-text-light" aria-hidden={true} />
        )}
      </button>

      {/* ── THE MARKS, one per node, each a route to that node on canvas ─────
          Unchanged from the always-visible version, including the cap: this is
          the navigation layer, and moving it behind a disclosure is the only
          thing that happened to it. */}
      {open ? (
        <ul
          id={regionId}
          className="list-none p-0 m-0 flex flex-col gap-1 pb-1"
          data-testid={`${testId}-region`}
        >
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
                 * The only proportion worth showing is "how much of this have
                 * you reviewed", and that needs the provenance this strip
                 * explicitly does not have. A bar filled to 100% because there
                 * is nothing to fill it against says "complete" about a model
                 * nobody has checked. That is the advertisement-not-affordance
                 * defect, in the component built to avoid it.
                 *
                 * Over the cap the row therefore shows the first `MARK_CAP`
                 * nodes as real click targets and states plainly how many it is
                 * not showing. Nothing is implied about the remainder except
                 * that it exists, which is the only thing known.
                 */
                const shown = row.overCap ? row.nodes.slice(0, MARK_CAP) : row.nodes
                const hidden = row.nodes.length - shown.length
                return (
                  <span
                    className="flex flex-wrap items-center gap-1"
                    data-testid={`${testId}-marks`}
                  >
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
      ) : null}
    </section>
  )
}
