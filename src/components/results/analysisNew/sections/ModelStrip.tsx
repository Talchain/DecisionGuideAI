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
 *
 * ⭐⭐ AND WHAT MAKES IT A TOOL RATHER THAN A STATUS BAR (Paul, 31 Aug 2026):
 * "each one of those is meant to represent the data point within the model and
 * display an information panel or a few key data points and actionable coaching
 * below it."
 *
 * A mark now OPENS THE RUN'S OWN COACHING FOR THAT NODE. Nothing on that detail
 * is authored here: the finding's `title` and `tryThis` are the engine's own
 * sentences, the technique is the catalogue's, the driver line is the glance's.
 * The join is `targetId`, made once in `nodeInsights.ts` and handed in as a
 * prop, so the strip and any later surface cannot derive two different answers
 * to "what does this run say about node X" (CLAUDE.md trap 12).
 *
 * ⭐ AND THE OTHER HALF OF THE SAME SENTENCE — "possibly highlight the relevant
 * items in the graph". Pointing at or focusing a mark RINGS THAT NODE ON THE
 * CANVAS, through the same results-panel → canvas channel the compare tab
 * already uses and which `BaseNode` renders. The reader sees which shape the
 * mark is before deciding to move the camera to it.
 *
 * ⚠ THREE ROUTES IN, NOT ONE. Hover is a mouse affordance and nothing else:
 * touch has no hover and the keyboard has no pointer. Pointing at a mark,
 * FOCUSING a mark and ACTIVATING a mark all open the same detail, and
 * activation additionally does what it always did — routes to the node on
 * canvas. `aria-expanded` on the mark and `aria-controls` at the detail are what
 * make the disclosure legible to a screen reader rather than a visual-only
 * change of state.
 *
 * ⚠ THE DETAIL DOES NOT CLEAR ON MOUSE-OUT, DELIBERATELY. A panel that empties
 * the instant the pointer leaves cannot be READ — the reader has to travel to
 * it, and the trip erases it. It is replaced by the next mark and by nothing
 * else, which is also what the approved prototype does.
 *
 * ⚠ AND THE ABSENCE IS RENDERED. A node with no finding and no driver row says
 * so. The alternative — showing nothing, or showing a reassurance — is the
 * "advertisement, not affordance" defect: a reader who picks a mark and gets
 * silence cannot tell a node nobody flagged from a control that is broken.
 */

import { useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react'

import { useCanvasStore } from '../../../../canvas/store'
import { NodeMark, type MarkKind } from '../nodeMarks'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../../../canvas/utils/highlightHelpers'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildModelStrip, MARK_CAP } from '../buildModelStrip'
import type { NodeInsight, NodeInsightIndex } from '../nodeInsights'

/**
 * The subject line when the model names neither a goal nor a decision.
 *
 * Deliberately the strip's own name rather than an invented subject: with no
 * goal node there is no question to state, and a header that guessed one would
 * be a claim. It doubles as the landmark's accessible name in that case.
 */
const NO_SUBJECT_LABEL = 'Your model so far'

/**
 * A stable empty index, so an unwired mount does not allocate a new Map on
 * every render and re-run every memo downstream of it.
 */
const NO_INSIGHTS: NodeInsightIndex = new Map()

/** What a node's detail has to say when the run named it nowhere. */
const EMPTY_INSIGHT: NodeInsight = { driverLabel: null, findings: [], withheldFindings: 0 }

export interface ModelStripProps {
  testId?: string
  /**
   * The run's findings and drivers, indexed by the node they NAME — built once
   * by `buildNodeInsights` at the mount and passed in.
   *
   * ⚠ A PROP RATHER THAN A HOOK, AND THAT IS THE POINT. The strip has no access
   * to the view model and must not grow one: a second derivation of "what does
   * this run say about node X" is the mirror defect, and this surface already
   * carries two components that would want the same answer. Absent = the strip
   * still navigates, and every detail honestly reports that nothing on the
   * panel refers to the node.
   */
  insights?: NodeInsightIndex
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
  insights = NO_INSIGHTS,
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
  /**
   * The node whose detail is on screen, by ID.
   *
   * ⚠ AN ID, NOT THE NODE OBJECT. The strip is rebuilt whenever the canvas
   * signature moves, so a captured object would go stale against a renamed or
   * retyped node while still rendering its old label. Resolving the id against
   * the CURRENT strip on every render also makes deletion self-healing: a node
   * that is no longer there resolves to nothing and the detail closes, with no
   * effect to keep in sync.
   */
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const regionId = useId()
  const subjectId = useId()
  const detailId = useId()

  // Nothing on the canvas: the panel's other surfaces already say so, and a
  // strip of empty rows would be furniture claiming to be information.
  if (strip.rows.length === 0) return null

  const open = override ?? isPreRun

  /** Resolved against the current strip — see `activeNodeId`. */
  const active: { id: string; label: string; kind: MarkKind } | null = (() => {
    if (activeNodeId === null) return null
    for (const row of strip.rows) {
      const found = row.nodes.find((n) => n.id === activeNodeId)
      if (found) return { id: found.id, label: found.label, kind: row.kind }
    }
    return null
  })()
  const activeInsight = (active && insights.get(active.id)) || EMPTY_INSIGHT
  const activeHasNothing =
    activeInsight.driverLabel === null && activeInsight.findings.length === 0

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
        <div id={regionId} data-testid={`${testId}-region`} className="pb-1">
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
                    {shown.map((node) => {
                      const isActive = active?.id === node.id
                      return (
                      <button
                        key={node.id}
                        type="button"
                        /* Activation keeps doing what it always did — this is
                           the affordance the disclosure was moved to preserve —
                           and additionally pins the detail, which is the only
                           route a touch device has to it. */
                        onClick={() => {
                          setActiveNodeId(node.id)
                          focusModelTarget(node.id)
                        }}
                        /* ⭐ AND THE GRAPH ANSWERS. `highlightNode` is the
                           results-panel → canvas channel the compare tab
                           already uses this way, and `BaseNode` renders it as a
                           ring on the node itself — so pointing at a mark shows
                           the reader WHICH shape on the canvas it is, before
                           they commit to moving the camera.

                           ⚠ TRANSIENT, AND THE ASYMMETRY WITH THE DETAIL IS
                           DELIBERATE. The detail is a thing you READ and so it
                           persists; the ring is a POINTER and belongs to the
                           gesture. A highlight left behind by a pointer that
                           has moved on would also sit on a shared channel that
                           the applied-edit pulse and the AI's own directives
                           write to. */
                        onMouseEnter={() => {
                          setActiveNodeId(node.id)
                          highlightNode(node.id)
                        }}
                        onMouseLeave={() => clearHighlight()}
                        /* Keyboard parity. Tabbing across the row reads each
                           node's detail in turn and rings each node in turn,
                           without committing a canvas move the reader did not
                           ask for. */
                        onFocus={() => {
                          setActiveNodeId(node.id)
                          highlightNode(node.id)
                        }}
                        onBlur={() => clearHighlight()}
                        aria-expanded={isActive}
                        /* Points at the detail ONLY while this mark owns it —
                           the detail is unmounted otherwise, so a resting
                           reference on every mark would dangle on all but one. */
                        aria-controls={isActive ? detailId : undefined}
                        className={`rounded hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                          isActive ? 'ring-2 ring-info' : ''
                        }`}
                        data-testid={`${testId}-mark`}
                        data-node-id={node.id}
                        data-active={isActive ? 'true' : undefined}
                        title={node.label || undefined}
                      >
                        <NodeMark kind={row.kind} />
                        <span className="sr-only">
                          {node.label
                            ? `Show ${node.label} on the canvas`
                            : `Show this ${row.kind} on the canvas`}
                        </span>
                      </button>
                      )
                    })}
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

        {/* ── WHAT THIS RUN SAYS ABOUT THE PICKED NODE ────────────────────
            One slot, replaced rather than accumulated: a stack of open details
            in a 280px column is the density this panel was cut down from.

            ⚠ EVERY SENTENCE BELOW IS THE ENGINE'S OR THE CATALOGUE'S. The only
            strings this component contributes are the affordance line, the
            absence line and the cap disclosure — furniture and honesty, never a
            statement about the model. */}
        {active === null ? (
          <p
            className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
            data-testid={`${testId}-hint`}
          >
            {COPY.modelStrip.hint}
          </p>
        ) : (
          <div
            id={detailId}
            /* `min-w-0` on the flex children and wrapping on every producer
               string: at the 280px floor a long factor name or an engine
               sentence with no spaces must wrap inside this box rather than
               widen the panel. */
            className="mt-1 rounded bg-panel-hover p-2 space-y-1 min-w-0"
            data-testid={`${testId}-detail`}
            data-node-id={active.id}
          >
            <p
              className={`${typography.panelBody} text-text-header m-0 flex items-start gap-1 min-w-0`}
              data-testid={`${testId}-detail-title`}
            >
              <NodeMark kind={active.kind} className="w-3 h-3 mt-0.5" />
              {/* No label recorded is not an error and not a blank: the kind
                  noun is the only true name available, and it is the same
                  substitution the mark's own accessible name makes. */}
              <span className="min-w-0 break-words">
                {active.label || COPY.modelStrip.kindNoun[active.kind]}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-1">
              <span
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`${testId}-detail-kind`}
              >
                {COPY.modelStrip.kindNoun[active.kind]}
              </span>
              {/* ⚠ PRESENCE ONLY, AND THE ASYMMETRY IS DELIBERATE. The glance's
                  driver list is capped, so membership licenses "the glance named
                  this among what matters most" and non-membership licenses
                  nothing — which is why no chip renders for its absence. The
                  magnitude is deliberately not repeated here: a bar or a
                  percentage is only readable beside the basis caption the glance
                  carries, and duplicating that caption into every node's detail
                  would restate a claim this panel already makes once. */}
              {activeInsight.driverLabel !== null ? (
                <span
                  className={`${typography.panelMeta} inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-info`}
                  data-testid={`${testId}-detail-driver`}
                >
                  {COPY.glance.whatMattersMost}
                </span>
              ) : null}
            </div>

            {activeInsight.findings.map((finding) => {
              // Hoisted so the narrowing survives into the handler below; a
              // property check does not narrow inside a closure.
              const method = finding.method
              return (
              <div
                key={finding.recommendationId}
                className="space-y-1 min-w-0"
                data-testid={`${testId}-detail-finding`}
                data-recommendation-id={finding.recommendationId}
              >
                <p
                  className={`${typography.panelBody} text-text-header m-0 break-words`}
                  data-testid={`${testId}-detail-finding-title`}
                >
                  {finding.title}
                </p>
                <p className={`${typography.panelBody} text-text-body m-0 break-words`}>
                  {/* The lead-in is the Strengthen panel's own, imported rather
                      than respelled, and the emphasis is carried semantically —
                      the panel scale defines its own weights and a raw utility
                      here would be a design-system violation as well as a second
                      spelling of one label. */}
                  <strong>{STRENGTHEN_COPY.tryThisLead}</strong> {finding.tryThis}
                </p>
                {/* ⭐ THE TECHNIQUE, ON THE NODE THAT WARRANTED IT — the same
                    control `StrengthenTheReasoning` renders, reached from the
                    model rather than from a list. `null` for most findings by
                    design (`recommendationMethod.ts`): no placeholder, no
                    default technique. Identity rides the dispatch so CEE learns
                    which technique was invoked. */}
                {method ? (
                  <button
                    type="button"
                    onClick={() =>
                      openAskOlumi({
                        context: finding.context,
                        draft: method.prompt,
                        label: method.title,
                        parameters: { method_id: method.id },
                        source: 'chip',
                        targetId: active.id,
                      })
                    }
                    className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-detail-method`}
                    data-method-id={method.id}
                    title={method.description}
                  >
                    <Lightbulb className="w-3 h-3" aria-hidden={true} />
                    {method.title}
                    {/* A browser renders `title` on pointer hover only, so the
                        science content would otherwise be withheld from anyone
                        navigating by keyboard. */}
                    <span className="sr-only">{method.description}</span>
                  </button>
                ) : null}
              </div>
              )
            })}

            {activeInsight.withheldFindings > 0 ? (
              <p
                className={`${typography.panelMeta} text-text-light m-0`}
                data-testid={`${testId}-detail-more`}
              >
                {COPY.modelStrip.moreFindings(activeInsight.withheldFindings)}
              </p>
            ) : null}

            {/* ⚠ THE ABSENCE IS THE RESULT, AND IT IS RENDERED. Silence here
                would be indistinguishable from a broken control, and a
                reassurance would be a claim nothing measured. */}
            {activeHasNothing ? (
              <p
                className={`${typography.panelMeta} text-text-light m-0`}
                data-testid={`${testId}-detail-empty`}
              >
                {COPY.modelStrip.noInsight}
              </p>
            ) : null}
          </div>
        )}
        </div>
      ) : null}
    </section>
  )
}
