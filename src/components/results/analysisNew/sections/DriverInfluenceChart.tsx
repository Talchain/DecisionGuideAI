/**
 * ⭐⭐ THE INFLUENCE CHART — the tornado's idea, without the tornado's claim.
 *
 * WHAT THE OLD CHART DOES AND WHY THIS IS NOT A PORT OF IT
 * `TornadoChart.tsx` draws, per factor, an outcome LOW and an outcome HIGH.
 * Those come from `OutputsDock.tsx:1039`:
 *
 *     lowOutcome  = expected - influence * (expected - p10)
 *     highOutcome = expected + influence * (p90 - expected)
 *
 * `expected`, `p10` and `p90` are the RECOMMENDED OPTION's, read once outside
 * the loop — so both ranges are the SAME CONSTANT for every row, and each bar
 * is the influence score wearing outcome units. The component's own header
 * agrees: "a proportional presentation-layer approximation, not authoritative
 * per-factor outcome bounds from PLoT". Producer-checked at the bytes:
 * `factor_sensitivity[]` carries `{factor_id, elasticity, direction}` —
 * elasticity, not bounds — and `factorLow`/`factorHigh` appear in ZERO files
 * (contrast control: `flip_value`, 47). The bounds do not exist to draw.
 *
 * So this chart draws the quantity we ACTUALLY have — a within-run influence
 * rank — under its own name, and spends the second axis on the thing the old
 * chart has and never renders: DIRECTION.
 *
 * ⚠ AND IT FIXES A DEFECT THE OLD CHART STILL SHIPS. `TornadoRow.direction` is
 * populated and the renderer branches only on GOAL direction, so a
 * negative-direction factor (cost, churn) draws on the wrong side today. Here
 * the side comes from the factor's own direction, narrowed by
 * `isDirectionalFactor` in the builder — `mixed`/`unknown`/absent get a CENTRED
 * bar, never a guessed side.
 *
 * ⭐ WHY IT IS A TOOL AND NOT A PICTURE. The old chart's two affordances are
 * structurally dormant (`PLOT_BOUNDS_WIRED = false`): drag previews an
 * outcome-space value that cannot be written back to factor space, so "Apply
 * and rerun" can never fire. That was never buildable. What IS buildable, and
 * is new since that component was written, is a real factor-space write
 * authority — so a row here opens the SAME editor the model strip uses, on the
 * SAME `useFactorValueCommit` hook, and dispatches a real edit. Ranked by what
 * moves the answer most, editable in place: a worklist, not a diagram.
 */
/**
 * @panel-figure-opt-out a DIVERGING figure — two halves about a zero line, where
 * the SIDE carries meaning (raises vs lowers) and the track is not a single
 * proportion
 *
 * ⚠ DECLARED, NOT OVERLOOKED. `PanelFigure` is the grammar for "a proportion of
 * a track": one domain, one direction, a fill that grows from one end. This
 * chart is bidirectional — its zero line is the reference point the whole figure
 * depends on, and `row.direction` decides which half a bar occupies. Forcing it
 * into the shared component would either add a `diverging` variant that no other
 * caller wants, or flatten a distinction the chart exists to draw.
 *
 * ⭐ WHAT IT DOES SHARE, and must keep sharing: the track height, so the
 * panel's figures still read at one weight. V2 fidelity (gap 13) drops that
 * shared height from `h-2` to `PanelFigure`'s `h-[5px]` — this chart is not
 * `PanelFigure` (see the opt-out above) so the literal is repeated here, by
 * hand, kept in step rather than imported, because the height IS the grammar
 * and only the DIRECTIONALITY is the exception.
 */
import { useId, useState } from 'react'
import { ArrowLeft, ArrowRight, Minus } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useFactorValueCommit } from '../useFactorValueCommit'
import { useCanvasStore } from '../../../../canvas/store'
import { resolveValueInputSeed } from '../../../../canvas/conversation/factorValueEdit'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { DriverInfluenceRow } from '../analysisNewTypes'
import {
  NAME_OR_CLAIM_COPY,
  needsClaimDisclosure,
  truncateAtWord,
} from '../nameOrClaim'
import { action, icon } from '../panelSurfaces'

export interface DriverInfluenceChartProps {
  rows: DriverInfluenceRow[]
  /** Focus the factor on the canvas. */
  onFocusTarget?: (targetId: string) => void
  /** Report the outcome of a commit. The caller owns the toast vocabulary. */
  onCommitOutcome: (outcome: 'dispatched' | 'local_only' | 'not_encodable') => void
  /**
   * ⭐⭐ THE SCALE DENIAL, ATTACHED TO THE SCALE RATHER THAN STACKED ABOVE IT.
   *
   * It used to be the first clause of a 32-word paragraph above the chart —
   * measured on the served build, 49px of prose over two bars. Every clause in
   * that paragraph was true and was fought for, and read as a block none of
   * them was read at all.
   *
   * ⛔ IT DOES NOT MOVE BEHIND A DISCLOSURE. A caveat that does not travel with
   * its number stops being a caveat. It moves ONTO the thing it qualifies: this
   * sentence denies a reading of the SCALE, so it belongs under the scale.
   *
   * ⚠ THE CALLER OWNS THE WORDS. This component never composes the sentence —
   * it is `analysisNewCopy`'s, and `driversSeamSaysOneThing` bans a second
   * spelling of it anywhere in the tree.
   */
  scaleNote?: string | null
  /**
   * ⭐ THE CLAUSE ABOUT THE TOP BAR'S FIGURE, ATTACHED TO THE TOP BAR.
   *
   * ⚠ AND IT IS A CLAIM ABOUT ONE ROW, WHICH IS WHY IT MOVED. Above the chart
   * it read as a property of the chart; it is a property of the FIRST row, and
   * it is the row a reader is most likely to over-read. Rendered on that row
   * and nowhere else.
   */
  topRowNote?: string | null
  testId: string
}

/**
 * ⚠ THE BAR OCCUPIES ONE HALF, NEVER THE WHOLE TRACK. Both halves are always
 * drawn, so the centre line sits in the same place on every row and the eye
 * reads the sides as a comparison. A bar that grew across the full width would
 * make a strong "lowers" row look like a strong "raises" row.
 */
const HALF = 'w-1/2 flex items-center'

/**
 * ⭐⭐ ONE INK FOR BOTH BARS — BECAUSE DIRECTION IS NOT A VERDICT.
 *
 * These bars read `bg-warning` when a driver lowers the outcome and
 * `bg-success` when it raises it. That paints the STATUS palette onto a
 * DIRECTION, and the status palette means something specific everywhere else
 * on this panel: amber is "this needs your attention" (`to verify`, the
 * unconfirmed-estimate pill, a severity), green is "this is holding up"
 * (a passed check, a stable verdict). A driver that lowers the outcome is
 * none of those things. It is information, and on a risk-framed outcome
 * "lowers" may be exactly what the reader wants.
 *
 * ⛔ SO THE HUES WERE ASSERTING A GOOD/BAD VALENCE THE PRODUCER NEVER
 * SUPPLIED. `row.direction` is `'positive' | 'negative' | null` — a side, not
 * a judgement. The same defect class as every fabricated metric this panel
 * has removed, arriving through colour instead of through a number.
 *
 * ⭐ AND NOTHING IS LOST, BUT MY FIRST DRAFT OF THIS CLAUSE WAS FALSE AND AN
 * INDEPENDENT REVIEW CAUGHT IT. It said "direction is already carried twice …
 * the row states the direction in words below". At that head it did not:
 * `data-direction` carries no accessibility semantics, BOTH bars sit inside an
 * `aria-hidden` span, and the only direction sentence is the `null` arm — the
 * one arm this change does not touch. The real before was TWO VISUAL
 * encodings, and zero for assistive tech either way.
 *
 * So the sentence is now true by construction rather than by assertion: a
 * visually hidden span on the row carries the side, using the axis legend's own
 * copy constants. Direction is carried twice for a sighted reader (the side of
 * the zero line, which is what a diverging chart IS) and once for everyone
 * else. Colour was the third encoding and the only one that added a claim.
 *
 * ⚠ INK, NOT A STATUS TOKEN, and deliberately not `bg-primary` either — that
 * is `ACTION_TIER.primary`, the panel's one act, and a chart bar is not an
 * affordance.
 *
 * ⭐ V2 FIDELITY (24 Sep 2026, gap 13): WAS `text-header` (charcoal). The SAME
 * drivers render `bg-info` (blue) in "Top drivers" (`ReasoningSignals.tsx`,
 * `PanelFigure variant="influence"`) and in the flip bars on "What would
 * change your mind" (`DisclosureRow.tsx`) — so one factor's influence was
 * drawn in two different inks depending which section a reader was on. The
 * prototype's own driver figure (`.signal-item .barwrap>i`) is `--info`, so
 * `bg-info` is the one ink this panel already uses for "how much", everywhere
 * else it draws it.
 */
const BAR_INK = 'bg-info'

export function DriverInfluenceChart({
  rows,
  onFocusTarget,
  onCommitOutcome,
  scaleNote,
  topRowNote,
  testId,
}: DriverInfluenceChartProps) {
  /**
   * ⚠ THE ROW ID, NOT A BOOLEAN — the model strip's rule, for the same reason.
   * A boolean leaves the editor open over whichever row happens to be under it
   * when the list re-orders, which it does on every re-run.
   */
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [claimOpenFor, setClaimOpenFor] = useState<string | null>(null)
  const claimRegionId = useId()
  const [draft, setDraft] = useState('')
  const { commit } = useFactorValueCommit(editingFor)

  if (rows.length === 0) return null

  const submit = () => {
    const outcome = commit(draft)
    onCommitOutcome(outcome)
    // ⚠ STAYS OPEN ON `not_encodable` — nothing was written anywhere, so
    // closing would read as a success.
    if (outcome !== 'not_encodable') {
      setEditingFor(null)
      setDraft('')
    }
  }

  return (
    <div data-testid={testId} className="mb-3">
      {/* The axis legend. It names both sides ONCE, so no row has to repeat a
          direction word — the side IS the word. */}
      <div
        className={`${typography.panelMeta} text-text-light flex items-center justify-between mb-1.5 px-0.5`}
        data-testid={`${testId}-axis`}
      >
        <span className="flex items-center gap-1">
          <ArrowLeft className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
          {COPY.driverChart.lowers}
        </span>
        <span className="flex items-center gap-1">
          {COPY.driverChart.raises}
          <ArrowRight className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
        </span>
      </div>

      {/* ⚠⚠ THE SCALE, WHICH THE CHART SHIPPED WITHOUT. Direction was named and
          magnitude was not, so a bar's length and position were unreadable:
          nothing said what the outer edge or the centre meant.

          It is NOT a 0-100% axis, deliberately. The bars are scaled to the
          strongest driver in this run, so a percentage axis would assert a
          share of the outcome — the exact claim the builder refuses to make
          (`buildAnalysisNewViewModel.ts:555-557`). Naming the two real points
          is the only scale this data supports.

          `aria-hidden` for the same reason the bars are: it is a legend for a
          graphic that is itself hidden, so announcing "most" / "none" / "most"
          would name the endpoints of something assistive tech never receives.

          ⚠ A CORRECTION TO THIS COMMENT'S OWN FIRST DRAFT, which said the
          scale is "a redraw of `data-fraction` and of the sorted order, both
          of which a screen reader already has". THE `data-fraction` HALF IS
          FALSE: `data-*` attributes carry no accessibility semantics and take
          no part in accessible-name or accessible-description computation, so
          no screen reader has it. Measured on a two-row render, not inferred:
          each bar button's accessible name is the factor LABEL alone, with
          `aria-label`, `aria-valuenow`, `aria-valuetext`, `aria-describedby`
          and `role` all null, while `data-fraction` read 100 and 60. What AT
          actually receives from this chart is the label and the LIST ORDERING
          — rank, never magnitude. Hiding the scale is still right; the reason
          above is the true one. The false version mattered because it is the
          sentence a successor reads before deciding whether magnitude needs an
          `aria-valuetext` — and it says the answer is already there. It is
          not. Whether to add one is open, and is not decided here. */}
      <div
        className={`${typography.panelMeta} text-text-light flex items-center mb-1 px-0.5`}
        data-testid={`${testId}-scale`}
        aria-hidden="true"
      >
        {/* ⚠ TWO STRINGS, NOT ONE RENDERED TWICE. Both ends read "strongest
            this run" until `e15416ad`, so the scale's two poles were labelled
            identically and discriminated nothing. The words are the legend's
            own verbs, so the two rows agree by construction; the LEFT span must
            stay the lowering side, because it sits under the legend's left
            arrow and the bars extend leftwards for `negative`. */}
        <span className="w-1/2 text-left">{COPY.driverChart.axisEdgeLowers}</span>
        <span className="text-center whitespace-nowrap px-1">{COPY.driverChart.axisCentre}</span>
        <span className="w-1/2 text-right">{COPY.driverChart.axisEdgeRaises}</span>
      </div>

      {/* ⭐⭐ THE SCALE DENIAL, UNDER THE SCALE IT DENIES A READING OF.
          ⛔ NOT `aria-hidden`, and that is the one difference from the row
          above it. The scale legend is hidden because it labels the endpoints
          of a graphic assistive tech never receives; this is a sentence in
          words qualifying a claim everyone is making, so hiding it would
          withhold the qualification from exactly the readers who cannot see
          the bars at all. */}
      {scaleNote !== null && scaleNote !== undefined && scaleNote !== '' ? (
        <p
          className={`${typography.panelMeta} text-text-light mb-1.5 px-0.5`}
          data-testid={`${testId}-scale-note`}
        >
          {scaleNote}
        </p>
      ) : null}

      <ul className="space-y-1">
        {rows.map((row, rowIndex) => {
          const isEditing = editingFor === row.id
          /* ⚠ A SEPARATE DISCLOSURE FROM `isEditing`, NOT A REUSE OF IT. The
             row's own expand gesture already means "edit this value"; reading
             what a factor is called must not require entering an editor, and
             a reader on a phone had no other route to it at all. */
          /* ⚠ THE DISPLAY QUESTION, NOT THE CONTRACT ONE. `isProseNotName`
             asks whether this is a claim rather than a name; the row needs to
             know whether it can SHOW the label in full, which is a different
             threshold and does not care about spaces. Measured by a reviewer:
             the old predicate excluded a 72-character space-free token that
             rendered at 463px inside a 254px column, so its remainder was
             reachable only through `title` — the exact thing this section
             exists to escape. */
          const isProse = needsClaimDisclosure(row.label)
          const claimOpen = claimOpenFor === row.id
          const pct = Math.round(row.fraction * 100)
          const width = `${pct}%`
          return (
            <li key={row.id} data-testid={`${testId}-row`} data-node-id={row.id}>
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    setEditingFor(null)
                    return
                  }
                  setEditingFor(row.id)
                  // ⭐ OPENS HOLDING THE CURRENT NUMBER, read by the SAME
                  // `resolveValueInputSeed` the commit uses (via
                  // `useFactorValueCommit` → `proposeFactorValue` →
                  // `buildFactorValueEditEvent`, default basis), so what the
                  // field shows and how the save reads it cannot disagree. The
                  // ModelStrip editor does the same (#1955). No number → empty.
                  const nodeData = (useCanvasStore.getState().nodes ?? []).find(
                    (n) => (n as { id?: string }).id === row.id,
                  )?.data
                  const { seed } = resolveValueInputSeed(nodeData)
                  setDraft(seed != null ? String(seed) : '')
                  if (row.targetId) onFocusTarget?.(row.targetId)
                }}
                aria-expanded={isEditing}
                className="w-full text-left rounded px-1 py-0.5 hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                data-testid={`${testId}-bar`}
                data-direction={row.direction ?? 'none'}
                data-fraction={pct}
              >
                {/* ⚠ CUT AT A WORD, WITH CSS ELLIPSIS STILL BEHIND IT. The
                    JS cut removes the gross case — a 128-character sentence
                    sliced mid-word — and `truncate` remains as the backstop
                    for whatever the column cannot fit at 280px. `title` stays
                    for mouse users; it is NOT the reachability story, which is
                    the disclosure below. */}
                <span
                  className={`${typography.panelBody} text-text-body block truncate`}
                  title={row.label}
                  data-prose-name={isProse ? 'true' : undefined}
                >
                  {isProse ? truncateAtWord(row.label) : row.label}
                </span>
                {/* ⚠ `aria-hidden`: announcing a decorative div would add
                    noise, not information — the ordering already carries the
                    ranking for a screen reader, and the direction is spoken by
                    the text below.

                    ⚠ THIS COMMENT ALSO CLAIMED THE BAR IS "a redraw of
                    `data-fraction`", and the scale comment above inherited the
                    clause from here. It is false — `data-*` has no
                    accessibility semantics, so `data-fraction` reaches no
                    screen reader; see the measurement recorded on the scale.
                    The ordering half is true and is the whole justification.
                    Consequence, stated rather than hidden: AT gets the RANK of
                    each driver and never its MAGNITUDE. */}
                {/* ⭐⭐ THE SIDE, FOR EVERYONE — and it was reaching NOBODY who
                    cannot see the bar. Measured at this head by an independent
                    reviewer: `data-direction` has no accessibility semantics,
                    BOTH bars sit inside the `aria-hidden` span directly below,
                    and the only direction sentence on this surface is the
                    `direction === null` arm further down. So on a positive or
                    negative row, assistive tech received the factor's name and
                    its rank, and NEVER which way it pushes.

                    ⛔ THIS IS ALSO WHAT MAKES THE HUE REMOVAL SAFE, and my own
                    first version of that change asserted it was already true.
                    It was not: the file's axis comment says "the side IS the
                    word", which is exactly the point — the side was carried
                    only by geometry, and geometry is what `aria-hidden` hides.
                    With this span the direction is carried twice for a sighted
                    reader and once for everyone else, so dropping the third
                    encoding costs nothing BY MEASUREMENT rather than by claim.

                    ⚠ DIRECTION ONLY, NEVER THE MAGNITUDE. This chart refuses a
                    percentage axis because the bars are scaled to the strongest
                    driver in this run, so a bare "33%" would assert a share of
                    the outcome — the claim the builder declines to make. The
                    AT-magnitude gap noted below is therefore still open, and
                    deliberately: closing it needs a phrasing that is true of a
                    relative scale, which is a separate piece of work.

                    ⚠ AN ADDITION TO THE NAME, NOT A SUBSTITUTION. An
                    `aria-label` here would REPLACE the visible label and break
                    label-in-name (SC 2.5.3); a visually hidden span appends to
                    it. Same copy constants the axis legend renders, so the two
                    can never drift into two spellings of one fact. */}
                {row.direction !== null ? (
                  <span className="sr-only" data-testid={`${testId}-direction-sr`}>
                    {row.direction === 'negative' ? COPY.driverChart.lowers : COPY.driverChart.raises}
                  </span>
                ) : null}
                <span className="flex items-stretch h-[5px] mt-0.5" aria-hidden="true">
                  <span className={`${HALF} justify-end`}>
                    {row.direction === 'negative' ? (
                      <span
                        className={`h-full rounded-l-sm ${BAR_INK}`}
                        style={{ width }}
                        data-testid={`${testId}-bar-lowers`}
                      />
                    ) : null}
                  </span>
                  {/* ⚠ THE ZERO LINE. It existed before this change and was
                      invisible: 1px of `bg-panel-border`, the same token every
                      other rule on the panel uses, so the eye read the two
                      halves as one empty track with bars floating in it. The
                      line is the reference point the whole chart depends on —
                      a bar's side and length mean nothing without it — so it
                      gets a colour that separates it from ordinary furniture
                      and a little height beyond the bar. */}
                  <span className="w-px bg-text-light/70 flex-shrink-0 -my-0.5" />
                  <span className={HALF}>
                    {row.direction === 'positive' ? (
                      <span
                        className={`h-full rounded-r-sm ${BAR_INK}`}
                        style={{ width }}
                        data-testid={`${testId}-bar-raises`}
                      />
                    ) : null}
                  </span>
                </span>
                {/* ⚠⚠ THE NON-DIRECTIONAL STATE IS SAID, NOT LEFT BLANK. An
                    empty row where two neighbours have bars reads as "no
                    influence", which is the opposite of the truth: the producer
                    MEASURED this factor and declined to assert a direction. A
                    centred mark plus the sentence keeps the magnitude visible
                    and refuses the side. */}
                {row.direction === null ? (
                  <span
                    className={`${typography.panelMeta} text-text-light flex items-center gap-1 mt-0.5`}
                    data-testid={`${testId}-no-direction`}
                  >
                    <Minus className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
                    {COPY.driverChart.directionNotEstablished}
                  </span>
                ) : null}
              </button>

              {/* ⭐⭐ THE "FULL WIDTH" CLAUSE, ON THE ROW IT IS ABOUT.
                  ⚠ BOUND BY POSITION, NOT BY A VALUE PREDICATE (trap 19). The
                  claim is about whichever row is drawn FIRST — the one whose
                  bar reaches the edge because the scale is relative to it — so
                  it binds to index 0 and never to "the row whose fraction is
                  100", which a second row could satisfy after a rescale. */}
              {rowIndex === 0 && topRowNote !== null && topRowNote !== undefined && topRowNote !== '' ? (
                <p
                  className={`${typography.panelMeta} text-text-light mt-0.5`}
                  data-testid={`${testId}-top-row-note`}
                >
                  {topRowNote}
                </p>
              ) : null}

              {/* ⭐ DESIGN PICK C2 — TRUNCATE AND DISCLOSE, NEVER REWRITE.
                  Outside the row `<button>` because a nested button is invalid
                  markup, and the row's own press means "edit the value".
                  Costs one line per unnamed factor, which is the point: the
                  gap creates visible pressure rather than hiding behind a
                  hover nobody on a phone can reach. */}
              {isProse ? (
                <button
                  type="button"
                  onClick={() => setClaimOpenFor(claimOpen ? null : row.id)}
                  aria-expanded={claimOpen}
                  /* ⚠ POINTS AT THE REGION ONLY WHILE IT EXISTS — the rule
                     `SectionShell` already follows in this panel. A collapsed
                     claim is UNMOUNTED rather than CSS-hidden, so a resting
                     `aria-controls` would reference nothing. */
                  aria-controls={claimOpen ? `${claimRegionId}-${row.id}` : undefined}
                  aria-label={claimOpen ? undefined : NAME_OR_CLAIM_COPY.showFullClaimFor(row.label)}
                  className={`${typography.panelMeta} ${action('inline')}`}
                  data-testid={`${testId}-claim-toggle`}
                >
                  {claimOpen ? NAME_OR_CLAIM_COPY.hideFullClaim : NAME_OR_CLAIM_COPY.showFullClaim}
                </button>
              ) : null}

              {isProse && claimOpen ? (
                <p
                  id={`${claimRegionId}-${row.id}`}
                  /* ⚠ `break-words` IS LOAD-BEARING, AND ITS ABSENCE MADE THE
                     WHOLE FEATURE FALSE FOR THE CLASS IT WAS ADDED FOR. A
                     72-character identifier has no break opportunity, so the
                     revealed paragraph rendered as ONE 420.8px line inside a
                     264px box — escaping the dock by 152.8px. The claim was
                     "reachable"; it was off-screen.

                     ⚠⚠ AND MY OWN SPEC ASSERTED THE OPPOSITE IN A COMMENT —
                     "the disclosure is a `<p>` that WRAPS" — which was an
                     ASSUMPTION written as a finding. The spec is jsdom, which
                     performs no layout, so it could never have checked it. I
                     measured the LABEL's clipping in a browser and never the
                     revealed paragraph, then reported `anyUnreachable: false`:
                     true of what I measured, false of what I claimed. */
                  className={`${typography.panelBody} text-text-light m-0 px-1 pb-1 break-words`}
                  data-testid={`${testId}-claim`}
                >
                  {row.label}
                </p>
              ) : null}

              {isEditing ? (
                <div className="pl-1 pt-1 flex items-center gap-1.5" data-testid={`${testId}-editor`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    // Selected, so typing replaces the seeded number.
                    onFocus={(e) => e.currentTarget.select()}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submit()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditingFor(null)
                      }
                    }}
                    aria-label={COPY.modelStrip.valueInputLabel(row.label)}
                    className={`${typography.panelBody} min-w-0 flex-1 rounded-sm border border-field bg-surface px-1.5 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-input`}
                  />
                  <button
                    type="button"
                    onClick={submit}
                    className={`${typography.panelMeta} ${action('primary')}`}
                    data-testid={`${testId}-save`}
                  >
                    {COPY.modelStrip.saveValue}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
