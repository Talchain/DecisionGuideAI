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
  raisedMethodIds,
}: {
  testId?: string
  /**
   * ⭐ THE METHODS THIS RUN ACTUALLY RAISED — `methodIdsRaisedBy`, the existing
   * owner of "is this finding and this technique the same move?".
   *
   * ⚠ OPTIONAL, AND ABSENCE RENDERS TODAY'S FLAT SHELF. A host that cannot say
   * which methods the run raised must not get a "Raised by this run" heading
   * over a guess — that is the orphaned-heading shape this file already guards
   * against one gate up, and the empty SET has the same reading as the absent
   * prop by construction.
   */
  raisedMethodIds?: ReadonlySet<string>
}): JSX.Element | null {
  /**
   * ⛔ AN EMPTY CATALOGUE RENDERS NOTHING, rather than a heading over a void.
   * The catalogue is a static import today, so this cannot fire — it is here so
   * that a future filtered catalogue (say, methods relevant to THIS run) cannot
   * leave an orphaned heading behind, which is the shape three sections on this
   * panel have shipped at least once.
   */
  if (METHOD_CATALOGUE.length === 0) return null

  /**
   * ⚠ PARTITION, NOT SORT. Both groups keep `METHOD_CATALOGUE`'s own order —
   * nothing on the wire ranks these seven, so an ordering invented here would
   * be a UI claim wearing a finding's clothes.
   */
  const raised = raisedMethodIds ?? new Set<string>()
  const thisRun = METHOD_CATALOGUE.filter((m) => raised.has(m.id))
  const others = METHOD_CATALOGUE.filter((m) => !raised.has(m.id))
  /**
   * ⛔ ONE GROUP OR TWO, DECIDED ONCE. Two headings are only honest when BOTH
   * have members: a "Raised by this run" heading over nothing is the orphaned
   * heading, and an "Other methods" heading over all seven says less than the
   * plain shelf did while taking a line to say it.
   */
  const grouped = thisRun.length > 0 && others.length > 0

  const chips = (entries: typeof METHOD_CATALOGUE, listTestId: string): JSX.Element => (
    <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-1 p-0" data-testid={listTestId}>
      {entries.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => runMethod(m)}
            /* ⚠ NOT AN `action()` TIER — unchanged, and the reason is unchanged:
               seven of them in a row would claim seven secondary acts on the
               panel's first screen. The 24px minimum stays carried explicitly
               because that is geometry, not emphasis (WCAG 2.2 AA §2.5.8). */
            className="inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-2 py-0.5 text-text-body hover:border-info hover:text-info-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            data-testid={`${testId}-method`}
            data-method-id={m.id}
            data-raised={raised.has(m.id) ? 'true' : undefined}
            title={m.description}
          >
            <span className={typography.panelMeta}>{m.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`}>
      <h3
        id={`${testId}-title`}
        className={`${typography.panelHeader} text-text-header m-0`}
        data-testid={`${testId}-title`}
      >
        {ANALYSIS_NEW_COPY.sections.methods}
      </h3>
      {/* ⛔⛔ THE EM DASH CAME OUT, AND THIS CHANGE IS WHY IT COULD BE SEEN.
          The ruling is "no em dashes in product content".
          `noEmDashesInRenderedCopy.spec.ts` scans STRING LITERALS — and until
          this change the sentence was JSX TEXT CONTENT, which that scan does
          not reach. It had been rendering with an em dash, unseen, since the
          section shipped. Lifting it into a ternary made it a literal and the
          guard fired on its first sight of it.

          ⚠ SO THE GUARD HAS A BLIND SPOT WORTH KNOWING: JSX text is invisible
          to it. That is not fixed here — it is recorded so the next author does
          not read a green run as proof the ruling holds on this surface.

          Split into two sentences, which is what the guard's own failure
          message prescribes ("Split it into two sentences, or cut the clause.
          Do not add an exemption."). Both facts survive: these are yours to
          run, and they do not wait to be offered.
       */}
      {/* ⚠ THE SUBTITLE IS THE POINT OF THE SECTION, not decoration: it says
          these do not wait to be offered. Five of the seven used to appear only
          when the run raised a matching signal, and two were unreachable.

          ⭐ AND IT IS NOW TRUE OF THE SECOND GROUP RATHER THAN THE SECTION.
          "whether or not this run raised them" was an honest disclaimer while
          the shelf was one undifferentiated list, and it is exactly the
          sentence that made the panel's prime slot read as reference material.
          Where the run DID raise methods, the groups carry that fact and the
          disclaimer would contradict the heading above it, so it renders only
          on the flat shelf — the state it was written for, unchanged. */}
      <p className={`${typography.panelMeta} text-text-light m-0 mt-0.5`}>
        {grouped
          ? 'Science-grounded moves you can make yourself.'
          : 'Science-grounded moves you can make yourself. Run any of them, whether or not this run raised them.'}
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
          moment a chip is pressed, which is when a reader actually needs it.

          ⚠ THE GROUP LABELS COST ONE LINE EACH AND ONLY WHERE BOTH EXIST. They
          are `panelMeta`, the quietest of the panel's three sizes and the same
          grammar as the "Focus now" zone label one level up — furniture that
          looked like a block would add the weight this section fought to
          avoid. */}
      {grouped ? (
        <>
          <p
            className={`${typography.panelMeta} text-text-light m-0 mt-2`}
            data-testid={`${testId}-group-this-run`}
          >
            Raised by this run
          </p>
          {chips(thisRun, `${testId}-list-this-run`)}
          <p
            className={`${typography.panelMeta} text-text-light m-0 mt-2`}
            data-testid={`${testId}-group-other`}
          >
            Other methods
          </p>
          {chips(others, `${testId}-list-other`)}
        </>
      ) : (
        chips(METHOD_CATALOGUE, `${testId}-list`)
      )}
    </section>
  )
}
