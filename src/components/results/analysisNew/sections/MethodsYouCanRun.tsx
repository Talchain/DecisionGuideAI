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
        Methods you can run
      </h3>
      {/* ⚠ THE SUBTITLE IS THE WHOLE POINT OF THE SECTION, not decoration: it
          says these do not wait to be offered. Five of the seven used to appear
          only when the run raised a matching signal. */}
      <p className={`${typography.panelMeta} text-text-light m-0 mt-0.5`}>
        Science-grounded moves you can make yourself — whether or not this run raised them.
      </p>
      <ul className="m-0 mt-2 list-none space-y-1 p-0" data-testid={`${testId}-list`}>
        {METHOD_CATALOGUE.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => runMethod(m)}
              /* ⚠ NOT AN `action()` TIER, DELIBERATELY. Every tier is
                 `inline-flex`, which would collapse this two-line block row
                 onto one line. The tiers describe INLINE acts; this is a list
                 row whose whole surface is the target. Its height comes from
                 its own content — a 12px title over an 11px description with
                 `py-1` clears WCAG 2.2 AA's 24px without geometry spelled by
                 hand, and it carries no `text-info`+`underline` pair, so it is
                 not claiming a tier it does not use. */
              className="w-full rounded-md px-2 py-1 text-left hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info" 
              data-testid={`${testId}-method`}
              data-method-id={m.id}
            >
              <span className={`${typography.panelBody} block text-text-header`}>{m.title}</span>
              <span className={`${typography.panelMeta} block text-text-light`}>{m.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
