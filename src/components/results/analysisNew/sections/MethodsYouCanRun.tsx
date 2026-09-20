/**
 * ⭐⭐⭐ THE MOVES THE PERSON CHOOSES — VISIBLE, NOT BEHIND A MENU.
 *
 * Paul's instruction, 18 Sep 2026: "Surface the Methods menu — make it
 * prominent." And the reason, in his words: "Olumi is a reasoning enhancement
 * tool, not a generic AI and analysis answering tool. If it doesn't enhance
 * critical and creative thinking, it has no value."
 *
 * ⛔ WHAT THIS REPLACES, measured on served 5824c05b: the same seven methods
 * existed on this tab, inside `ActionsMenu` — a WAI-ARIA menu button whose
 * content is 671px of decision-science technique collapsed into a 30px trigger,
 * mounted last in ZONE: ALSO. A census of the expanded panel found it only
 * because the census opened every disclosure; a reader would not.
 *
 * ⭐ WHY THAT MATTERED MORE THAN A DENSITY POINT. `AnalysisNewTabBody` already
 * recorded the underlying finding: every method on this tab was PRODUCER-invoked
 * and none was USER-invoked — five are gated on the run emitting a particular
 * signal, and the two needing no signal at all (`reframe_problem`,
 * `explore_tradeoffs`) were NOT REACHABLE FROM THIS TAB. Those two are the most
 * generative of the seven: "is the question too narrow?" and "what does each
 * option gain and give up?". A tool for thinking has to let the thinker pick the
 * move, so the shelf has to be on the shelf, not in a drawer.
 *
 * ⚠ NO NEW METHOD, NO NEW COPY, NO NEW PAYLOAD. This renders
 * `METHOD_CATALOGUE` verbatim and routes every press through `runMethod`, the
 * single owner the dropdown also uses. If the two ever disagree, that is a bug
 * in one call site, not a difference of opinion between surfaces.
 *
 * ⚠ THE DROPDOWN IS NOT DELETED. It still carries GLOBAL_ACTIONS (re-run, edit
 * brief), which are not methods and do not belong in a list headed "methods you
 * can run". Removing it would take those with it.
 */
/**
 * @panel-act-opt-out seven of them in a row would claim seven secondary acts on the first screen; a shelf reads as one
 *
 * ⚠ DECLARED, NOT SILENT. This file renders an interactive element without an
 * `action()` tier. The geometry is therefore carried HERE and must be BOTH
 * dimensions — WCAG 2.2 AA is 24x24, and a control that passes the height and
 * fails the width is the exact shape the Strengthen row toggle shipped (22px).
 * `everyActIsReachableByTouch` reads this marker; removing it REDs the guard.
 */
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import { typography } from '../../../../styles/typography'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { runMethod } from '../runMethod'

export function MethodsYouCanRun({
  testId = 'analysis-new-methods-you-can-run',
}: {
  testId?: string
}): JSX.Element | null {
  /**
   * ⛔ AN EMPTY CATALOGUE RENDERS NOTHING, rather than a heading over a void.
   * The catalogue is a static import today, so this cannot fire — it is here so
   * that a future filtered catalogue (say, methods relevant to THIS run) cannot
   * leave an orphaned heading behind, which is the shape three sections on this
   * panel have shipped at least once.
   */
  if (METHOD_CATALOGUE.length === 0) return null

  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`}>
      <h3
        id={`${testId}-title`}
        className={`${typography.panelHeader} text-text-header m-0`}
        data-testid={`${testId}-title`}
      >
        {ANALYSIS_NEW_COPY.sections.methods}
      </h3>
      {/* ⚠ THE SUBTITLE IS THE POINT OF THE SECTION, not decoration: it says
          these do not wait to be offered. Five of the seven used to appear only
          when the run raised a matching signal, and two were unreachable. */}
      <p className={`${typography.panelMeta} text-text-light m-0 mt-0.5`}>
        Science-grounded moves you can make yourself — whether or not this run raised them.
      </p>
      {/* ⭐⭐ CHIPS, NOT A SEVEN-ROW LIST, AND THE REASON IS THE FOLD.
          Paul asked for these to be first-screen (ZONE: FOCUS), which puts them
          ABOVE the answer zone — and the answer zone alone already measures
          721px at rest against a ~729px viewport. A row-per-method with
          descriptions ran ~320px and would have pushed the options comparison
          back below the fold, undoing #1673 to make room for this.

          Titles alone carry the move: "Reframe the problem", "Consider the
          opposite", "Run a pre-mortem" are each a complete instruction. The
          description is not lost — it rides into the drawer as `context` the
          moment a chip is pressed, which is when a reader actually needs it. */}
      <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1 p-0" data-testid={`${testId}-list`}>
        {METHOD_CATALOGUE.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => runMethod(m)}
              /* ⚠ NOT AN `action()` TIER. `secondary` is the visual match, but
                 seven of them in a row would claim seven secondary acts on the
                 panel's first screen — the emphasis every control shares is the
                 emphasis none of them has, which `panelSurfaces` states as its
                 own rule. These are a SHELF, so they read as one. The 24px
                 minimum is carried explicitly because that is geometry, not
                 emphasis, and WCAG 2.2 AA §2.5.8 applies either way. */
              className="inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-2 py-0.5 text-text-body hover:border-info hover:text-info-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
              data-testid={`${testId}-method`}
              data-method-id={m.id}
              title={m.description}
            >
              <span className={typography.panelMeta}>{m.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
