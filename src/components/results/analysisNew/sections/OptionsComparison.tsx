/**
 * Analysis (New) — "How the options compare".
 *
 * ⭐⭐ THE GAP THIS CLOSES, MEASURED ON A DEPLOYED RUN, NOT IMAGINED. On a real
 * completed staging run with FOUR options (Segment 89%, RudderStack 6%,
 * Snowflake 5%, Status Quo <1%) this surface rendered the leading option and
 * one win percentage and NOTHING ANYWHERE about the other three. The existing
 * Analysis tab carried the full comparison on the same run. An audit called it
 * "a TOTAL loss", and for a decision tool that is the correct word: a reader
 * who cannot see the field cannot tell a runaway leader from a coin flip, and
 * cannot see that an option they care about took no part in the comparison.
 *
 * ── WHAT THIS SECTION IS ENTITLED TO PUT ON SCREEN ────────────────────────
 *
 * Names, own win shares, and the sanctioned sentence for an option the run did
 * not analyse. That is all, and each omission below is a rule this estate has
 * already paid for:
 *
 *  · NO ORDINALS. `OptionResult.rank` exists, and printing it would put a
 *    RANKING on screen on a run whose verdict withheld one. The ordering claim
 *    lives in the ARRAY ORDER, authored once upstream by `sortOptionsForDisplay`
 *    and withheld there when the verdict withholds (ROADMAP 1.267). This
 *    component renders `rows` in the order it is given and adds no number.
 *
 *  · NO GAP BETWEEN OPTIONS. "Behind by N percentage points" was retired
 *    2026-08-10: a difference of two Monte Carlo estimates carries more
 *    uncertainty than either, and printed bare it reads as the most precise
 *    number on the panel while being the least reliable. Own-probability
 *    statements only. The reader still SEES the gap — that is what the bars are
 *    for — they are simply not handed a spurious integer for it.
 *
 *  · NO LEADER MARKER. The entitled leader is already named at the top of this
 *    surface by `AtAGlance`, under the one gate that licenses naming it. A
 *    second crown here would be a second designation channel, and an unentitled
 *    one, since `isRecommended` is set from the winner selection rather than
 *    from the leader VERDICT.
 *
 *  · NO AUTHORED SENTENCES. Every string a reader meets here is either a label
 *    the producer sent, a number the estate's own formatter produced, or one of
 *    the sanctioned constants in `utils/notAnalysedCopy.ts` — the single source
 *    for what the results panel says about an option carrying no number.
 *
 * ── ABSENCE IS NOT ZERO, AND IT IS STRUCTURAL ─────────────────────────────
 *
 * An option carrying no number is a DIFFERENT SHAPE in the view model, with no
 * `winReadout` and no `winFraction` to reach for. It renders with no bar and no
 * number, by construction rather than by this component remembering to check. An
 * ANALYSED option whose producer sent no win probability carries `null` on both
 * fields together, so the bar and the number can never disagree about whether
 * there is a share at all.
 *
 * ⚠⚠ AND THERE ARE **TWO** SUCH SHAPES, WHICH SAY DIFFERENT THINGS ABOUT WHOSE
 * GAP IT IS (CLAUDE.md trap 21):
 *
 *  · `kind: 'not_analysed'` — the option was NOT IN the comparison. Derived from
 *    the producer's OMISSION; the copy attributes the gap to configuration.
 *  · `kind: 'not_computed'` — the analysis RAN ON it and could not compute a
 *    result (`'failed'` ⇔ `n_valid === 0`). STATED by the producer; the copy
 *    attributes the gap to the run and says explicitly that it is not a verdict
 *    on the option.
 *
 * They are two shapes rather than one nullable flag because the row that used to
 * render for the second case was a fabricated `0%` with a zero-width bar — a
 * measured claim from a computation that drew no valid samples. Showing the
 * "Not analysed" badge there would be the opposite error: blaming the user's
 * configuration for an engine outcome.
 *
 * ── WIDTH (the 280px dock floor) ──────────────────────────────────────────
 *
 * The dock is 280–416 responsive and drags to 480, so the content measure runs
 * 238–320px. The row is one flex line: a wrapping label that owns the slack
 * (`min-w-0 flex-1`) and a `shrink-0` readout that never compresses, with the
 * bar on its own full-width line beneath. Nothing has an intrinsic minimum
 * wider than the floor, so the panel never scrolls horizontally.
 *
 * ── THE ROW IS OPERATED, NOT JUST READ ────────────────────────────────────
 *
 * Imported from the old Analysis tab, whose option cards have carried the
 * contract on screen since they shipped: *"Hover highlights on canvas. Click
 * opens inspector."* This section rendered the same options as inert text.
 *
 * ⚠⚠ THE OLD TAB'S SENTENCE IS HALF TRUE, AND ONLY THE TRUE HALF IS IMPORTED.
 * Derived at `OptionCards.tsx`, not inherited from the copy:
 *
 *  · HOVER — true. `:716` `onMouseEnter={() => highlightNode(option.id)}`,
 *    cleared on leave. Reproduced here exactly, plus the `onFocus`/`onBlur`
 *    twin the old tab does not have.
 *
 *  · CLICK — FALSE AS WRITTEN. The handler beside that tooltip is
 *    `:1444 onClick={lensEnabled && resultsComplete ? () => handleLensClick(...)}`
 *    — a graph LENS toggle, behind a flag, and NOT the inspector. The estate's
 *    real inspector helper is `openNodeInspector`, and `OptionCards.tsx:1084-1098`
 *    states in its own comment that it "is not on this path". With the lens flag
 *    off, `onClick` is `undefined`, which also strips `role` and `tabIndex`
 *    (`:720-721`) — so the card is not focusable and its tooltip is reachable by
 *    mouse hover alone.
 *
 * So the act here is `focusModelTarget` — the fail-closed panel→canvas primitive
 * the shipped Strengthen panel and `ModelStrip` already use, whose behaviour
 * ("centre this option in the model") is what the row's `aria-label` states.
 * ⛔ `openNodeInspector` was considered and rejected on evidence: `InspectorRouter`
 * wraps every panel in an unconditional `<fieldset disabled>`, and this estate has
 * ALREADY re-pointed one act away from it for exactly that reason
 * (`TriageActionCardsBody.tsx:278-305`). Honouring the old tab's literal wording
 * would have imported a promise the destination cannot keep.
 *
 * ⚠ AND THE AFFORDANCE IS NOT NARRATED. No hint line was added: the dock floor is
 * 280px, and a sentence telling the reader what hovering does is one more thing to
 * READ on a panel whose complaint is that it cannot be OPERATED. The hover ring is
 * self-teaching, and the sentence a screen reader needs is the button's name.
 */

import { useCallback } from 'react'
import { Scale } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useShowToastSafe } from '../../../../canvas/ToastContext'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { clearHighlight, highlightNode } from '../../../../canvas/utils/highlightHelpers'
import { NOT_ANALYSED_BADGE, NOT_COMPUTED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { OptionsComparisonSection } from '../analysisNewTypes'
import { SectionShell } from './SectionShell'

export interface OptionsComparisonProps {
  options: OptionsComparisonSection
  testId?: string
}

export function OptionsComparison({
  options,
  testId = 'analysis-new-options',
}: OptionsComparisonProps) {
  const showToast = useShowToastSafe()

  /**
   * ⭐ THE ACT, AND IT FAILS LOUDLY OR NOT AT ALL.
   *
   * `focusModelTarget` is fail-CLOSED: it returns `false` and moves nothing when
   * the id resolves to no canvas element. Discarding that boolean is what turns
   * a control into an advertisement, and it is a live shape in this very
   * directory — `StrengthenTheReasoning.tsx:705`'s "Show on canvas" button
   * throws the return value away, so on a stale target it silently does nothing.
   * Every other estate caller of this helper on a user-triggered surface pairs
   * it with a notice (`StrengthenContainer.tsx:271`, `AskOlumiDrawer.tsx:147`),
   * and this one does too.
   *
   * ⚠ WHEN IT CAN ACTUALLY FAIL, since a guard nobody can trigger is theatre.
   * NOT on `kind`: every row's `id` is a canvas option node id BY CONSTRUCTION —
   * `useResultsSectionData.ts:1726` builds the option list from
   * `nodes.filter(n => n.data?.kind === 'option')` and `:1783` maps over those
   * same nodes, so `not_analysed` and `not_computed` rows are canvas option
   * nodes the producer omitted or failed to score, not phantom rows. The real
   * failure is TIME and IDENTITY: a node deleted between render and click, or a
   * recovered session whose ids no longer match (pinned as a live condition by
   * `lib/__tests__/decisionVerdict.spec.ts:156`).
   */
  const activate = useCallback(
    (optionId: string) => {
      if (!focusModelTarget(optionId)) showToast(COPY.canvas.focusFailed)
    },
    [showToast],
  )

  // Nothing to show and nothing truthful to say about its absence — pre-run,
  // or a model with no options at all. The honest render is no render: a
  // heading is a claim that there is something under it (`AnalysisNewSection`
  // established this rule after three bare headings shipped).
  if (options.totalCount === 0) return null

  /**
   * The options this list cannot NAME — never silently dropped.
   *
   * `rows` excludes an option whose label is blank or is merely its own node
   * id, because inventing a name is the fabrication the excluded-option path
   * refuses. The collapsed row promises `totalCount`, so without this line the
   * promise and the body would report two different populations.
   */
  const unnamed = options.totalCount - options.rows.length

  /**
   * ⭐ EVERY OPTION ANALYSED AND NOT ONE OF THEM NUMBERED.
   *
   * Witnessed on deployed `a9c2e050`: this section rendered its title, its
   * count, and three option names with nothing beside them — no figure, no bar,
   * no badge, no reason. The `not_computed` and `not_analysed` kinds each carry
   * a badge and so explain themselves; an ANALYSED option whose win share did
   * not come back falls between them and renders nothing at all.
   *
   * A heading promising a comparison over a body containing none is worse than
   * an absent section: a reader concludes the panel is broken, or — the more
   * damaging reading — that the options came out level.
   *
   * ⚠ ONLY WHEN NOTHING IS NUMBERED. One numberless option among figures is an
   * ordinary mixed run and the reader can see which rows carry numbers; a
   * caveat there would contradict the percentages printed beside it.
   */
  const noneNumbered =
    options.rows.length > 0 &&
    options.rows.every((o) => o.kind !== 'analysed' || o.winReadout === null)

  return (
    <SectionShell
      title={COPY.sections.options}
      icon={Scale}
      // The count is the FULL population, and the body accounts for every one
      // of them — named rows plus the unnamed disclosure. A collapsed row is a
      // promise about what is behind it.
      count={options.totalCount}
      testId={testId}
    >
      {/* ⚠ THE SENTENCE IS `checks.leaderMeaning`, NOT A NEW ONE. It already
          states exactly this fact, is already licensed, and is already on this
          surface in "What we checked" — so one wording covers one fact and the
          two cannot drift. It is also deliberately not a claim that the options
          are level, which is the false reading a silent list invites. */}
      {noneNumbered ? (
        <p
          className={`${typography.panelMeta} text-text-light mb-2 mt-0`}
          data-testid={`${testId}-no-figures`}
        >
          {COPY.checks.leader_not_assessed.meaning}
        </p>
      ) : null}

      <ul className="list-none p-0 m-0 space-y-2.5">
        {options.rows.map((o) => (
          <li
            key={o.id}
            data-testid={`${testId}-row`}
            data-option-id={o.id}
            data-option-kind={o.kind}
            /* ⭐ POINTER-ONLY, AND ON THE WHOLE ROW ON PURPOSE. Hovering
               anywhere on the row rings that option on the canvas, which is the
               gesture that TEACHES the affordance — you point at a name and the
               model answers, before committing to a camera move. It carries no
               role, no tabIndex and no semantics: it is a mouse convenience, and
               the keyboard's equivalent lives on the button below where it is
               reachable. Putting the highlight ONLY here would be the
               hover-only defect; putting it only on the button would shrink the
               target to the width of a word. */
            onMouseEnter={() => highlightNode(o.id)}
            onMouseLeave={clearHighlight}
          >
            <div className="flex items-baseline gap-2">
              {/* ⚠ THE BUTTON WRAPS THE LABEL AND NOTHING ELSE, AND THAT IS AN
                  ACCESSIBILITY DECISION RATHER THAN A LAYOUT ONE. An
                  `aria-label` REPLACES an element's name with the given string,
                  so a button wrapping the whole row would announce "Show
                  Segment on the canvas" and put the win percentage, the bar,
                  the producer's sentence and the not-analysed reason inside a
                  control whose name has already been decided — the row's
                  content would stop being independently readable. Wrapping the
                  label alone costs nothing: the string the label carries IS the
                  option name, which the `aria-label` states in full. Everything
                  that qualifies it stays outside the control, as text. */}
              <button
                type="button"
                data-testid={`${testId}-focus`}
                aria-label={COPY.canvas.focusOption(o.label)}
                onClick={() => activate(o.id)}
                /* Keyboard parity with the row hover above — tabbing across the
                   list rings each option in turn without moving the camera the
                   reader did not ask for. `onBlur` clears for the same reason
                   `onMouseLeave` does: the ring is a POINTER and belongs to the
                   gesture, and it sits on a shared channel the applied-edit
                   pulse also writes to, so leaving one behind would be a stray
                   claim about the model. */
                onFocus={() => highlightNode(o.id)}
                onBlur={clearHighlight}
                className={`${typography.panelBody} text-text-body min-w-0 flex-1 break-words text-left rounded-md -mx-1 px-1 cursor-pointer transition-colors hover:bg-info/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <span data-testid={`${testId}-label`}>{o.label}</span>
              </button>

              {/* ⚠ THE NUMBER IS THE SMALLEST TYPE IN THE ROW, AND THAT IS A
                  RULE RATHER THAN A PREFERENCE. A win probability set larger
                  than the option it belongs to is read AS the answer, which is
                  the anchoring Olumi's alignment principle says the product
                  must mitigate — "especially anchoring on a number the AI
                  supplied", and on a fresh run every input behind this share is
                  Olumi's own estimate. The name leads; the share qualifies it. */}
              {o.kind === 'analysed' ? (
                o.winReadout !== null ? (
                  <span
                    className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                    data-testid={`${testId}-win`}
                  >
                    {o.winReadout}
                  </span>
                ) : null
              ) : (
                /* ⚠ THE BADGE NAMES WHICH NUMBERLESS STATE THIS IS, and the two
                   are not interchangeable. "Not analysed" says the option was
                   left OUT of the comparison — attributing the gap to the
                   user's configuration. On an option the analysis RAN ON and
                   could not compute, that sentence is false and blames the
                   wrong party. Switched on `kind` (the union) rather than on a
                   nullable flag, so a new numberless state cannot silently
                   inherit either badge. */
                <span
                  className={`${typography.panelMeta} text-text-light shrink-0`}
                  data-testid={
                    o.kind === 'not_computed'
                      ? `${testId}-not-computed-badge`
                      : `${testId}-not-analysed-badge`
                  }
                >
                  {o.kind === 'not_computed' ? NOT_COMPUTED_BADGE : NOT_ANALYSED_BADGE}
                </span>
              )}
            </div>

            {/* The bar exists ONLY for a measured share. An option with no
                probability — analysed or not — gets no track and no fill:
                an empty track reads as a measured zero, which is the precise
                claim absence does not license. */}
            {o.kind === 'analysed' && o.winFraction !== null ? (
              <span
                className="mt-1 block h-1 w-full rounded-full bg-panel-hover overflow-hidden"
                aria-hidden="true"
                data-testid={`${testId}-bar`}
              >
                <span
                  className="block h-full rounded-full bg-info"
                  /**
                   * ⭐⭐ THE GEOMETRY IS FLOORED BECAUSE THE READOUT IS.
                   *
                   * This was `Math.round(winFraction * 100)`, and it shipped a
                   * measured non-zero share as a 0px fill. Browser-witnessed on
                   * deployed `ce32426c`, guest, real 4-option run: the row read
                   * "< 1%" beside a 371px track with `width: 0%`. One row, one
                   * quantity, two contradictory claims — and precisely what the
                   * comment above says this component refuses.
                   *
                   * `formatProbabilityWithResolution` floors the READOUT so a
                   * measured tiny share never prints as "0%". Rounding the
                   * WIDTH re-opened that exact falsehood in the one channel the
                   * eye reads first — the defect `formatPercent.ts`'s own header
                   * documents by name (ROADMAP 2.236): the same number honest in
                   * one place and "0%" in another.
                   *
                   * ⚠ TWO DIRECTIONS, AND THEY MUST NOT COLLAPSE. A genuine
                   * measured zero MUST render an empty track — "came out ahead
                   * in 0% of simulated scenarios" is true, and the floor exists
                   * to stop a non-zero value reading as zero, never to stop zero
                   * reading as zero. So the minimum is applied ONLY when the
                   * fraction is strictly positive, and the rounding is gone so a
                   * small share keeps its own width rather than borrowing the
                   * floor's.
                   */
                  style={{
                    width: `${o.winFraction * 100}%`,
                    ...(o.winFraction > 0 ? { minWidth: '2px' } : {}),
                  }}
                />
              </span>
            ) : null}

            {/* ⭐ THE PRODUCER'S OWN SENTENCE ABOUT THIS OPTION, VERBATIM.
                `story_headlines[optionId]` carries one for NON-LEADING options
                too, which is exactly the material this section existed to be
                missing: without it a reader learns that RudderStack scored 6%
                and nothing about why. Nothing here is composed — if the
                producer sent no sentence, none is shown. */}
            {o.kind === 'analysed' && o.why !== null ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-why`}
              >
                {o.why}
              </p>
            ) : null}

            {/* WHY there is no number. The sanctioned sentence, verbatim — it
                states the consequence ("no rank and no probability") rather
                than leaving the reader to infer it from an empty row. A row
                that silently omits numbers reads as a rendering gap; a row that
                says why reads as a decision. */}
            {o.kind === 'not_analysed' ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-not-analysed-reason`}
              >
                {o.reasonCopy}
              </p>
            ) : null}

            {/* WHY the computation produced no number, as opposed to why the
                option was left out. A DISTINCT testid so a spec cannot pass by
                finding the other state's sentence, and so the two can never be
                asserted interchangeably. The copy is resolved in the view model
                (`notComputedReasonCopy`) and rendered verbatim — including the
                clause that says this is not a verdict on the option, which is
                the whole reason the state exists as its own row. */}
            {o.kind === 'not_computed' ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-not-computed-reason`}
              >
                {o.reasonCopy}
              </p>
            ) : null}
          </li>
        ))}

        {unnamed > 0 ? (
          <li
            className={`${typography.panelMeta} text-text-light`}
            data-testid={`${testId}-unnamed`}
          >
            {COPY.disclosure.unnamedOptions(unnamed)}
          </li>
        ) : null}
      </ul>
    </SectionShell>
  )
}
