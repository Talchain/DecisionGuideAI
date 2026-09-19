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
 *  · NO COMPARATIVE MAGNITUDE THE RUN HAS NOT LICENSED. The bars are a drawn
 *    comparative claim, so they render only where `comparativeClaim` is
 *    `'value'` — the glance's own three-valued answer, carried on this section
 *    and consumed rather than re-derived. The gate and its three states are set
 *    out at `mayDrawMagnitude` below; the short version is that the figure
 *    became a claim when it became legible, and a claim needs the licence that
 *    governs claims of that kind.
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
 * the shipped Strengthen panel and `ModelStrip` already use — AND
 * `openNodeInspector`, which is the half this section refused to wire.
 *
 * ⭐⭐ THE REFUSAL RESTED ON A PREMISE THAT IS NO LONGER TRUE, AND WHAT IT COST
 * WAS A WORKING AFFORDANCE. This paragraph used to read: "`openNodeInspector` was
 * considered and rejected on evidence: `InspectorRouter` wraps every panel in an
 * unconditional `<fieldset disabled>`". Re-derived at the tip rather than
 * inherited:
 *
 *  · The wrap is CONDITIONAL. `InspectorRouter.tsx:441` declares
 *    `AUTHORITY_OWNING_PANELS = new Set(['option','factor-controllable','factor-external'])`
 *    and `:541-551` renders `panelOwnsAuthority ? <PanelComponent readOnly />`
 *    against the fence. Six node panels are still wrapped; three are not, and
 *    the edge branch early-returns at `:192` with no blanket fence at all.
 *  · `'option'` is IN that set — and every row here resolves to exactly that
 *    panel type, because every row id is a canvas option node id by
 *    construction (`useResultsSectionData.ts:1726`, `:1783`).
 *  · What the unfenced panel gives a reader is what a comparison row cannot:
 *    the intervention rows, the connection rows, the coaching card and the
 *    "Add a change" trigger, all live. `OptionPanel.readOnlyFence.spec.tsx`
 *    pins that as a PAIR — every writer fenced, every non-writer reachable —
 *    so the panel cannot satisfy it by fencing everything or nothing.
 *
 * So the old tab's literal wording is now a promise the destination CAN keep,
 * and the row makes it: the camera settles on the option and its panel opens
 * onto it. The `aria-label` names BOTH halves, because a control whose name
 * covers one of its two effects is this same defect one size down.
 *
 * ⚠ THE SIBLING RE-POINT IS NOT REVERSED BY THIS, and citing it as though it
 * were would repeat the inherited-premise error in the other direction.
 * `TriageActionCardsBody`'s act is a FACTOR VALUE EDIT and its destination is
 * the Model tab; that decision stands on grounds its own comment never gave (it
 * must serve `factor-observable`, which is still fenced), and only its stated
 * reason was wrong. Two surfaces, two questions — CLAUDE.md trap 21. Do not
 * align them.
 *
 * ⚠ AND THE AFFORDANCE IS NOT NARRATED. No hint line was added: the dock floor is
 * 280px, and a sentence telling the reader what hovering does is one more thing to
 * READ on a panel whose complaint is that it cannot be OPERATED. The hover ring is
 * self-teaching, and the sentence a screen reader needs is the button's name.
 */

import { useCallback, useId, useState } from 'react'
import { Scale, Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useShowToastSafe } from '../../../../canvas/ToastContext'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { openNodeInspector } from '../../../../canvas/nodes/shared/openNodeInspector'
import { clearHighlight, highlightNode } from '../../../../canvas/utils/highlightHelpers'
import {
  BRING_INTO_COMPARISON_LABEL,
  bringIntoComparisonQuestion,
  NOT_ANALYSED_BADGE,
  NOT_COMPUTED_BADGE,
} from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
// ⚠ THE GLANCE'S OWN COPY CONSTANT, imported rather than re-typed. `AtAGlance`
// renders the identical string for the identical fact about the leading option;
// two spellings of one claim on one screen is how a reader learns to distrust
// both, and a local literal here could drift from it silently.
import { OPTION_ORIGIN_COPY } from '../optionOriginDisclosure'
import type { OptionOrigin } from '../optionOriginDisclosure'
import type { OptionsComparisonSection } from '../analysisNewTypes'
import { SectionShell } from './SectionShell'
import { PanelFigure } from '../PanelFigure'
import { action, icon } from '../panelSurfaces'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'

/**
 * ⭐ THE ARMS, IN READING ORDER, DECLARED ONCE.
 *
 * The control maps it, the arrow keys index it, and the order IS the semantics —
 * low to high across the same range. A second literal would let the keyboard
 * traverse an order the eye does not see.
 */
const RANGE_LENS_ARMS = ['cautious', 'middle', 'optimistic'] as const
type RangeLensArm = (typeof RANGE_LENS_ARMS)[number]

export interface OptionsComparisonProps {
  options: OptionsComparisonSection
  /**
   * ⭐ COMPOSED ONCE IN THE VIEW MODEL (`checks.leaderWithholdCause`), passed to
   * BOTH readers. This file's own rule for the sentence it qualifies — "one
   * wording covers one fact and the two cannot drift" — applies to its cause.
   */
  leaderWithholdCause?: string | null
  /**
   * Send a message as the user, on the surface's EXISTING writer.
   *
   * ⚠ OPTIONAL, AND ITS ABSENCE IS THE GATE, not a detail. A host with no
   * composer renders no act at all — never a control that does nothing. This is
   * the same shape and the same handler `WhatIWasGivenSection` already uses for
   * its own ask on this tab (`AnalysisNewTabBody.tsx:200`, supplied from
   * `OutputsDock.tsx:3899`), so this section joins the writer the product has
   * rather than minting a second one with its own validation and policy.
   */
  onSendMessage?: (message: string) => void
  /**
   * ⭐⭐ OPEN ON MOUNT — AND THE CALLER DECIDES, BECAUSE THE CALLER IS THE ONLY
   * ONE WHO CAN SEE THE QUESTION.
   *
   * `SectionShell`'s rule is that a section may open by default only when
   * something ABOVE it depends on the content being visible. Whether that
   * holds is a fact about the GLANCE and this section together, and this
   * component is handed only the second — so deriving it here would mean
   * re-deriving the glance from the rows, which is the re-derivation this
   * directory keeps paying for. `AnalysisNewTabBody.tsx` holds both and states
   * the condition there, exactly as it already does for
   * `StrengthenTheReasoning`.
   *
   * ⚠ A DEFAULT, NOT A LOCK, AND READ EXACTLY ONCE. `SectionShell` seeds
   * `useState(defaultOpen)`, so from the first render of this instance the
   * open state belongs to the toggle. A later `false` is not re-read and the
   * section stays where the reader left it — the same semantics, and the same
   * deliberate choice, recorded at `StrengthenTheReasoning.tsx:114`.
   *
   * ⛔ IT MOVES NOTHING BUT VISIBILITY. Every entitlement rule in this file's
   * header is evaluated the same way open or closed: no ordinal is printed,
   * no leader is marked, and `mayDrawMagnitude` reads `comparativeClaim`,
   * which is computed upstream in the view model and cannot be influenced by a
   * disclosure state that does not exist until render.
   */
  defaultOpen?: boolean
  testId?: string
}

export function OptionsComparison({
  options,
  leaderWithholdCause = null,
  onSendMessage,
  defaultOpen = false,
  testId = 'analysis-new-options',
}: OptionsComparisonProps) {
  const showToast = useShowToastSafe()

  /**
   * ⭐⭐ THE LENS ARM — WHICH END OF EACH RANGE THE DOT MARKS.
   *
   * Paul's instruction was to bring the Analysis tab's lens onto this tab. What
   * came across is the QUESTION it asks ("read this run cautiously or
   * optimistically?"), not its implementation, because that implementation
   * shipped two P1s: a control claiming a ranking `sortOptionsForDisplay` never
   * performed (ROADMAP 2.237) and a crown rendered under a sentence declaring
   * the lens had no data (2.238).
   *
   * ⛔ SO THIS ARM MOVES ONE DOT AND NOTHING ELSE. It does not reorder the
   * rows, does not crown an option, does not change a readout, and makes no
   * claim in units — the row order and every number on screen are byte-identical
   * across the three arms. That is the whole difference between a lens that
   * improves a reading and one that asserts a different answer.
   *
   * ⛔⛔ DECLARED HERE, ABOVE `if (options.totalCount === 0) return null`,
   * BECAUSE I FIRST PUT IT BELOW AND CI WAS RIGHT TO REJECT IT.
   * `react-hooks/rules-of-hooks` caught `useState` and `useId` called
   * CONDITIONALLY: a render with no options returns before them, so the hook
   * order differs between renders and React's state slots mis-align. It reads
   * like a lint nit and it is a crash waiting for the first run that goes from
   * some options to none. Hooks belong above every early return, always.
   *
   * ⚠ LOCAL, NOT LIFTED. Nothing else on the panel reads it and no producer
   * supplies it, so a store would be a second authority over a presentational
   * choice. If a sibling surface ever needs the same arm, lift it then — with a
   * reason — rather than pre-building the seam.
   */
  const [rangeAppetite, setRangeAppetite] = useState<RangeLensArm>('middle')
  const rangeLensId = useId()


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
      if (!focusModelTarget(optionId)) {
        showToast(COPY.canvas.focusFailed)
        return
      }
      /*
       * ⭐ THE PANEL, RAISED ONTO A SETTLED SELECTION — the ordering is
       * `openNodeInspector`'s own stated rule and it holds across this seam too.
       *
       * ⚠ ITS RETURN IS NOT DISCARDED CARELESSLY, which the paragraph above
       * rightly bans. It is fail-closed on the SAME question the line above just
       * answered: `focusModelTarget`'s first branch is
       * `nodes.some(n => n.id === targetId)` and `openNodeInspector`'s guard is
       * that identical predicate, so a second notice here could only fire on a
       * divergence the resolver cannot produce for these ids — an option row's
       * id is a canvas option node id by construction. One act, one notice; two
       * notices for one stale click would be the louder defect.
       */
      openNodeInspector(optionId)
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

  /**
   * ⭐⭐⭐ MAY A COMPARATIVE MAGNITUDE BE DRAWN ON THIS RUN — THE GLANCE'S
   * ANSWER, CONSUMED. Not re-derived, not widened, not combined with anything.
   *
   * ── WHY THIS GATE ONLY BECAME NECESSARY WITH THE SIZE CHANGE ──────────────
   *
   * The track below was `h-1`: a 4px hairline. Paul's reading of the deployed
   * tab is that this section shows *"three plain option names with no comparison
   * of any kind"*, and at 4px that is very nearly a literal description of the
   * figure. A hairline is decoration, and decoration makes no claim.
   *
   * At a size a reader can actually measure — which is the whole point of the
   * change — four bars on a shared baseline are READ COMPARATIVELY, whatever the
   * author intended each one to mean on its own. So the figure starts making a
   * comparative claim at exactly the moment it becomes legible, and a claim needs
   * the licence that governs claims of that kind. **The gate is required BY the
   * size change; it is not an unrelated tightening shipped alongside one.**
   *
   * ── THE THREE STATES, EACH HANDLED, NONE COLLAPSED ────────────────────────
   *
   *  · `'value'` — the run's comparative MAGNITUDE is on screen and licensed
   *    (`AtAGlance` is printing "Scored highest in N% of simulated futures").
   *    The bars draw. This is the state the size change exists for.
   *
   *  · `'order'` — a superlative or an ordering verdict is licensed, but no
   *    percentage is. What is licensed is the ORDER, and the order is ALREADY on
   *    screen: it is the array order, authored once upstream by
   *    `sortOptionsForDisplay` and withheld there when the verdict withholds
   *    (ROADMAP 1.267). So the licensed material renders and no magnitude does,
   *    and this component adds nothing — printing `rank` here would be the
   *    ordinal this file's header bans in its first rule.
   *
   *  · `'none'` — nothing set-dependent is licensed. Nothing comparative is
   *    drawn. The withheld-comparison sentence above is untouched by this gate
   *    and keeps its own authority (`noneNumbered`), because "did any row come
   *    back with a number?" and "may a magnitude be claimed?" are different
   *    questions and must not acquire one name between them.
   *
   * ⚠ `=== 'value'` AND NOT `!== 'none'`. The two are different gates and only
   * one of them is this one: `!== 'none'` would draw a magnitude at `'order'`,
   * which is precisely the state whose definition is "an ordering renders, but
   * no percentage". A three-valued authority read as a boolean loses the middle
   * state silently, and the middle state is the one that licenses the LEAST.
   *
   * ⚠ IT GATES THE FIGURE AND NOTHING ELSE. The win READOUT beside each name is
   * an own-probability statement with its own shape rule (a `null` readout and a
   * `null` fraction arrive together), the badges answer "why is there no
   * number", and the producer's per-option sentence is the producer's. None of
   * them is a comparative magnitude and none of them moves with this gate —
   * widening it to cover them would delete licensed material, which is the
   * opposite harm and cannot share this parameter (CLAUDE.md trap 22b).
   */
  /**
   * ⭐⭐ THE BARS DRAW ON EVERY RUN THAT HAS SHARES TO DRAW — PAUL'S RULING,
   * 15 Sep 2026, made deliberately against the rule it replaces.
   *
   * ── WHAT THIS OVERTURNS, STATED FAIRLY ────────────────────────────────────
   * `#1483` gated the bars on `comparativeClaim === 'value'`, reasoning that a
   * flip threshold or an ordering verdict *"licenses a SENTENCE and never a
   * magnitude"*. That is a coherent position and it was ratified with specs.
   * It is not being called a defect here; it is being changed, by the person
   * entitled to change it, on the evidence below.
   *
   * ── THE EVIDENCE ──────────────────────────────────────────────────────────
   * Witnessed on the deployed build `079d080b`, a real guest run, read off the
   * DOM: three option rows carrying **48% · 4% · 48%** and **ZERO bars**. Two
   * options tied at 48%, and the reader had to notice that by comparing
   * numerals. Paul, on being shown it: *"I think these are powerful."*
   *
   * ── WHY THIS DOES NOT MAKE A CLAIM THE RUN REFUSED ───────────────────────
   * ⚠ THE SECTION IS ALREADY PRINTING THESE NUMBERS. `winFraction` and
   * `winReadout` are set together from one `hasWin` in the view model, so a row
   * that draws is exactly a row that already prints. Nothing becomes visible
   * that was not on screen in text; what changes is whether a reader can see a
   * tie, or a dominant option, without arithmetic.
   *
   * ⚠ AND THE QUALIFIER STAYS. `ComparisonScopeNote` still renders, and still
   * takes `detail` only where the claim licenses it — so a partial comparison
   * is still qualified in words beneath the figures it qualifies. The bars did
   * not inherit the sentence's entitlement; the sentence keeps its own.
   *
   * ⛔ WHAT IS NOT TOUCHED, DELIBERATELY: no ordinal is printed, no leader is
   * marked, and the withheld-leader rules are unchanged. Drawing a magnitude
   * the run measured is a different act from NAMING the option that won, and
   * this estate has been burned twice on exactly that distinction (#709/#737).
   * A run that withholds its leader still withholds it — it just draws the
   * numbers it already prints.
   */
  /**
   * ⭐ THE PARTITION, OR `null` — derived from the rows this list DREW, never
   * from a predicate re-expressed over the producer's option array. The fork
   * that produces those rows is three-way (not analysed / not computed /
   * analysed) and restating it here would be a second copy of someone else's
   * rule, drifting the first time either moves (trap 12).
   *
   * ⛔ THREE CONDITIONS, ALL REQUIRED. At least two analysed rows (one share is
   * not a partition); every analysed row carries a share (a missing one makes
   * the picture assert a completeness the run lacks); and the shares sum to one
   * within a tolerance that admits ordinary rounding and nothing more.
   *
   * ⚠ THE TOLERANCE IS DELIBERATELY TIGHT. It exists for float error in a set
   * the producer already normalised, not to wave through a set that genuinely
   * does not add up — a 0.9 sum drawn as a full track would be a tenth of the
   * runs silently unaccounted for.
   */
  const PARTITION_TOLERANCE = 0.01
  /**
   * ⭐⭐ ONE SCALE FOR EVERY BAR, OR THE BARS LIE.
   *
   * The whole point of drawing ranges is that a reader can see two of them
   * OVERLAP. Per-row normalisation would give every option a full-width bar and
   * destroy exactly the comparison the drawing exists to make — the same defect
   * as the old tornado chart, which rescaled one option's spread per factor.
   *
   * ⚠ NULL UNLESS AT LEAST TWO ROWS CARRY A RANGE. A single bar has nothing to
   * be compared against, and a lone full-width track reads as a measurement of
   * something rather than as one option's spread.
   *
   * ⚠ A ZERO-WIDTH DOMAIN IS REFUSED rather than divided by. If every option
   * shares one p10 and one p90 the denominator is 0; there is no honest bar for
   * that, and `null` draws nothing.
   */
  const rangeScale = (() => {
    const ranges = options.rows.flatMap((r) =>
      // ⚠ `!= null`, LOOSE, AND IT IS NOT A STYLE CHOICE. `outcomeRange` is
      // REQUIRED on the type, but fixtures across the suite build these rows
      // without it, so at runtime the value is `undefined` — which passes a
      // strict `!== null` and then throws on `.p10`. CI caught exactly that:
      // "Cannot read properties of undefined (reading 'p10')", six times.
      // A field being required in TypeScript is not a guarantee about a value
      // arriving from a fixture, a cast, or an older cached view model.
      r.kind === 'analysed' && r.outcomeRange != null ? [r.outcomeRange] : [],
    )
    if (ranges.length < 2) return null
    const lo = Math.min(...ranges.map((r) => r.p10))
    const hi = Math.max(...ranges.map((r) => r.p90))
    if (!(hi > lo)) return null
    return { lo, hi, span: hi - lo }
  })()

  const partition = (() => {
    const analysed = options.rows.filter(
      (r): r is Extract<typeof r, { kind: 'analysed' }> => r.kind === 'analysed',
    )
    if (analysed.length < 2) return null
    if (analysed.some((r) => r.winFraction === null)) return null
    const fractions = analysed.map((r) => ({ id: r.id, fraction: r.winFraction as number }))
    const sum = fractions.reduce((acc, f) => acc + f.fraction, 0)
    return Math.abs(sum - 1) <= PARTITION_TOLERANCE ? fractions : null
  })()

  /**
   * ⭐⭐ THE PROVENANCE SENTENCE, SAID ONCE WHEN SEVERAL OPTIONS SHARE IT.
   *
   * Paul's screenshot of the deployed panel shows "Olumi suggested this option,
   * you did not name it" under THREE of five options: the same nine words,
   * three times, in one list.
   *
   * ⛔ AND THE PREMISE I FIRST WROTE HERE WAS FALSE, corrected in place rather
   * than quietly edited out. It said the repetition was "visible WITHOUT
   * opening anything". MEASURED on the composed tab at rest: `SectionShell`
   * rests CLOSED, so the panel states the provenance exactly ONCE at rest, in
   * the glance, and this section renders nothing at all. The repetition is real
   * in the state the screenshots show - the section open - which is the state
   * the spec renders, explicitly and by clicking the toggle. Reporting a
   * forced-open panel as the resting one has produced three wrong claims in
   * this session; this is the third.
   *
   * ⛔ A DE-DUPLICATION, NOT A REMOVAL. Each affected option keeps a marker
   * whose accessible name IS the full sentence, and the sentence itself is
   * stated once beneath the list. Nothing is hidden from a screen reader, no
   * wording is invented, and the disclosure stays at the same level it was:
   * visible at rest, not moved behind a disclosure.
   *
   * ⚠ IDENTITY ACROSS THE AFFECTED OPTIONS, and two or more of them. With one
   * there is nothing to de-duplicate and a legend would cost a line rather than
   * save one. `OptionOrigin` has a single member today, so the identity test is
   * trivially true — it is written anyway because the module's own docblock
   * says a second member may be added, and on that day a legend speaking for
   * two different origins would be the section asserting one that some option
   * does not have.
   */
  const sharedOrigin: OptionOrigin | null = (() => {
    const origins = options.rows.map((o) => o.origin).filter((x): x is OptionOrigin => x !== null)
    if (origins.length < 2) return null
    return origins.every((x) => x === origins[0]) ? origins[0] : null
  })()

  const mayDrawMagnitude = true

  return (
    <SectionShell
      title={COPY.sections.options}
      icon={Scale}
      // The count is the FULL population, and the body accounts for every one
      // of them — named rows plus the unnamed disclosure. A collapsed row is a
      // promise about what is behind it.
      count={options.totalCount}
      defaultOpen={defaultOpen}
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
          {/* ⭐ THE PRODUCER'S CAUSE, where it named one this surface can state.
              A withheld claim is not a missing one, and without the cause the
              sentence above reads as "something did not come back" — which on
              the run that produced this fix was the one thing it was not. */}
          {leaderWithholdCause !== null ? ` ${leaderWithholdCause}` : null}
        </p>
      ) : null}

      {/* ⭐⭐ THE SHARES ARE ONE WHOLE, AND THREE SEPARATE BARS CANNOT SAY SO.
          Comparative shares PARTITION the simulated runs: they are the fraction
          of runs in which each option out-ranked the others, and they sum to 1.
          A row of individual bars shows each share's size and loses the fact
          that together they account for every run — and it makes a TIE
          something the reader has to compare across rows rather than see. On
          the run witnessed tonight two options sat at 48% and 48%; side by side
          in one track that reads instantly.

          ⛔ IT RENDERS ONLY WHERE THE SHARES ACTUALLY PARTITION. If any
          analysed option carries no share, or the shares do not sum to one
          within tolerance, this picture would assert a completeness the run does
          not have — the same complete-field rule the goal figures follow, and
          the reason it is computed over the rows the list actually drew rather
          than over a predicate re-expressed here.

          ⛔ ONE COLOUR, DIVIDED BY GAPS — NEVER A GRADED FILL. A graded or
          alternating fill reads as a ranking, and #1593 is the ruling that a bar
          states magnitude and does not grade the number. The widths carry the
          information; the gaps only say how many there are.

          ⚠ AND IT IS GATED ON THE SAME MAGNITUDE LICENCE AS THE ROW BARS
          (`mayDrawMagnitude`), because unlike the goal figure this IS a
          comparative magnitude — the thing a withheld leader claim withholds. */}
      {/* ⚠ `mb-2`, NOT `mb-3`, SINCE 18 Sep 2026 — 4px reclaimed so the whole
          comparison clears the fold at 1440×860. Still on the shell spacing scale,
          and still a clear break between the bar and the rows it partitions. */}
      {mayDrawMagnitude && partition !== null ? (
        <div className="mb-2" data-testid={`${testId}-partition`}>
          <span
            className="flex h-2 w-full gap-[2px] rounded-full overflow-hidden bg-panel-hover"
            aria-hidden="true"
          >
            {partition.map((p) => (
              <span
                key={p.id}
                className="block h-full bg-info first:rounded-l-full last:rounded-r-full"
                style={{ width: `${p.fraction * 100}%`, ...(p.fraction > 0 ? { minWidth: '2px' } : {}) }}
              />
            ))}
          </span>
          <p
            className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
            data-testid={`${testId}-partition-caption`}
          >
            {COPY.optionFigures.partitionCaption}
          </p>
        </div>
      ) : null}

      {/* ⚠ `space-y-2` (8px), NOT `space-y-2.5` (10px). 10px was never on
          `SHELL_SPACING_SCALE_PX` — this both reclaims 6px and puts the row rhythm
          on the sanctioned scale, which is why it is a correction and not only a
          trim. */}
      <ul className="list-none p-0 m-0 space-y-2">
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
                /* ⭐ 24px MINIMUM, MEASURED ON THE DEPLOYED BUILD RATHER THAN
                   ASSUMED. `62879fc1`, prototype route: this control rendered
                   **20px high, six of six** — and after #1668 and #1708 repaired
                   `trust-line-open-method` (131×15 → 147×24) and
                   `model-strip-target-edit` (→ 76×24), it was the ONLY target on
                   the whole panel still under WCAG 2.2 AA's 24×24: 6 of 36
                   interactive targets, all of them this one.

                   ⛔ PADDING ALONE, AND NO `min-h-[24px]` HERE — the literal is
                   BANNED in this file. `everyInlineActIsReachableByTouch` sweeps
                   every section carrying `action('inline')` and fails on a
                   hand-rolled touch target, because the tier is meant to be the
                   single owner. This control cannot take a tier (it is the
                   option's NAME, and `inline`'s underline + `text-info` would
                   repaint it), so the 24px comes from padding, measured on the
                   deployed DOM rather than asserted: 20 → 24 on all six.

                   ⚠ 2px OF PADDING, AND EXPLICITLY NOT
                   `inline-flex items-center`. Centring the label that way was my
                   first draft and it is wrong here: this button is already a
                   flex ITEM (`flex-1`) whose CONTENTS are inline — a wrapping
                   label and an inline origin mark. Making it a flex CONTAINER
                   turns those into flex items side by side, which changes how a
                   long option name wraps. Padding reaches the same 24px and
                   leaves inline flow exactly as it was.

                   ⚠ 4px PER ROW IS THE WHOLE COST, and it is paid deliberately
                   in the block this lane is otherwise trying to SHORTEN. `min-h`
                   rather than `h` because the label wraps: a fixed height would
                   clip the second line. */
                className={`${typography.panelBody} text-text-body min-w-0 flex-1 break-words text-left rounded-md -mx-1 px-1 py-0.5 cursor-pointer transition-colors hover:bg-info/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                <span data-testid={`${testId}-label`}>{o.label}</span>
                {sharedOrigin !== null && o.origin === sharedOrigin ? (
                  /* ⚠ `role="img"` WITH THE FULL SENTENCE AS ITS NAME. A bare
                     glyph has no accessible name at all, and this one carries a
                     provenance claim — the reader who cannot see it is exactly
                     the reader who must still be told. */
                  <span
                    role="img"
                    aria-label={OPTION_ORIGIN_COPY[o.origin]}
                    title={OPTION_ORIGIN_COPY[o.origin]}
                    data-testid={`${testId}-option-origin-mark-${o.id}`}
                    data-option-origin={o.origin}
                    className="ml-1 inline-flex align-[-2px] text-text-light"
                  >
                    <Sparkles className={`${icon('inline')}`} aria-hidden="true" />
                  </span>
                ) : null}
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
                  <>
                    {/* ⭐⭐ NAMED ONLY WHEN A SECOND NUMBER SHARES THE ROW, and
                        the condition is the whole argument. Alone, a bare
                        percentage under "How the options compare" is
                        unambiguous enough to live unlabelled — which is what
                        shipped. Beside a goal figure it is not: two bare
                        percentages on one row are two numbers with no way to
                        tell which question either answers, which is worse than
                        one. So the label appears exactly when the ambiguity
                        does, and a run with no target renders byte-identically
                        to what it rendered before. */}
                    {o.goalReadout !== null ? (
                      <span
                        className={`${typography.panelMeta} text-text-light shrink-0`}
                        data-testid={`${testId}-win-label`}
                      >
                        {COPY.optionFigures.winLabel}
                      </span>
                    ) : null}
                    <span
                      className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                      data-testid={`${testId}-win`}
                    >
                      {o.winReadout}
                    </span>
                  </>
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
                claim absence does not license.

                ⭐ AND ONLY WHEN THE RUN LICENSES A COMPARATIVE MAGNITUDE AT ALL
                (`mayDrawMagnitude`, derived at the top of this component from
                the glance's own answer). The two conditions are conjoined and
                answer different questions: `winFraction !== null` asks whether
                THIS OPTION has a share to draw, and the licence asks whether
                THIS RUN may put a comparative magnitude on screen. Either one
                alone would be the wrong gate. */}
            {mayDrawMagnitude && o.kind === 'analysed' && o.winFraction !== null ? (
              <PanelFigure
                variant="share"
                className="mt-1"
                fraction={o.winFraction}
                testId={`${testId}-bar`}
              />
            ) : null}

            {/* ⭐⭐ THE RANGE THIS OPTION ACTUALLY PRODUCED.
                The share above says how OFTEN this option came top. This says
                how WIDE the outcome was when it did — and where two of these
                overlap, the ordering the shares imply is not settled. Measured
                on a real run: RudderStack p10 −0.163 / p90 0.211 against
                Segment −0.235 / 0.188, printed as "56%" beside "36%".

                ⚠ PRESENTATIONAL ONLY, AND IT MAKES NO CLAIM IN UNITS. No
                number is printed from these percentiles: the goal target may be
                in currency, a count or a normalised scale, and this section
                does not know which. The bar says WHERE and HOW WIDE relative to
                the other options, which is exactly what the reader needs to see
                an overlap, and nothing more. */}
            {o.kind === 'analysed' && o.outcomeRange != null && rangeScale !== null ? (
              (() => {
                // ⭐ THE ONLY ARITHMETIC THAT STAYS HERE: turning this option's
                // percentiles into positions on the SHARED domain. `PanelFigure`
                // is handed fractions and never sees a p10 — which is what keeps
                // its "claims nothing in units" rule true by construction rather
                // than by every call site remembering it.
                const toFraction = (v: number) => (v - rangeScale.lo) / rangeScale.span
                const markAt =
                  rangeAppetite === 'cautious'
                    ? o.outcomeRange.p10
                    : rangeAppetite === 'optimistic'
                      ? o.outcomeRange.p90
                      : o.outcomeRange.p50
                return (
                  <PanelFigure
                    variant="range"
                    className="mt-1"
                    band={{
                      start: toFraction(o.outcomeRange.p10),
                      end: toFraction(o.outcomeRange.p90),
                      // `!= null`, loose: p50 is `number | null` on the producer
                      // path but `undefined` from hand-built fixtures.
                      marker: markAt != null ? toFraction(markAt) : null,
                    }}
                    markerData={{ 'data-lens-arm': rangeAppetite, 'data-mark-at': String(markAt) }}
                    testId={`${testId}-outcome-range-${o.id}`}
                  />
                )
              })()
            ) : null}

            {/* ⭐⭐ THE OTHER QUESTION — "does this reach the target I set?"
                — AND IT IS NOT A RE-CUT OF THE SHARE ABOVE.

                The bar above is comparative: the share of simulated futures in
                which this option out-ranked the others. Those shares partition
                the runs and sum to 1. This one is absolute and per-option — the
                probability THIS option reaches the user's own target, computed
                independently for each — so they do not sum to anything and an
                option can be behind on one and ahead on the other. That is the
                whole reason it is worth drawing: it is the question the person
                actually asked, and the panel has had the number all along and
                spent it only on choosing a sentence.

                ⛔ NOT STACKED, AND NOT A SEGMENT OF THE BAR ABOVE. `WinGauge`'s
                header states the same rule from the other side: a stacked bar
                is an honest picture of a distribution that partitions, and a
                dishonest one of independent per-option probabilities. Separate
                track, separate row, same width scale.

                ⚠ EVERY GATE IS THE VIEW MODEL'S. Absent here means one of four
                real states — no user target (UI-SEM-071), the producer withheld
                or omitted this option's figure, the figure is a substituted
                joint one, or any analysed option lacks one (the complete-field
                rule). This component asks only whether there is a figure.

                ⚠ AND IT IS NOT GATED ON `mayDrawMagnitude`. That licence is
                about putting a COMPARATIVE magnitude on screen — the thing a
                withheld leader claim withholds. A per-option probability of
                reaching the user's own target ranks nothing against anything,
                so the licence it would need is a different one, and the run
                that withholds a ranking has not withheld this. */}
            {o.kind === 'analysed' && o.goalReadout !== null && o.goalFraction !== null ? (
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`${typography.panelMeta} text-text-light min-w-0 flex-1`}
                    data-testid={`${testId}-goal-label`}
                  >
                    {COPY.optionFigures.goalLabel}
                  </span>
                  <span
                    className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                    data-testid={`${testId}-goal`}
                  >
                    {o.goalReadout}
                  </span>
                </div>
                <PanelFigure
                  variant="goal"
                  className="mt-1"
                  fraction={o.goalFraction}
                  testId={`${testId}-goal-bar`}
                />
                {/* Display-honesty (ROADMAP 1.6b / PLoT #204): the figure is
                    scored from a modelled forward-propagated outcome
                    distribution rather than a directly-set starting value, and
                    the estate's rule is that the caveat renders ADJACENT to the
                    number it qualifies, never separately. The shared constant,
                    never a re-wording of it — `OptionCards`, the analysis-hero
                    detail line and the canvas goal badge all import this one. */}
                {o.goalBasisIsModelled ? (
                  <p
                    className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
                    data-testid={`${testId}-goal-basis-caveat`}
                  >
                    {GOAL_FIT_BASIS_CAVEAT_COPY}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ⭐⭐ WHOSE IDEA THIS OPTION WAS — ON EVERY ROW, NOT JUST THE
                LEADER'S.

                The measured defect: the product invented a hybrid option the
                user never named, it ranked THIRD of four, and nothing on the
                surface marked it as ours. The glance carries this sentence for
                the LEADING option only, and on that run the leader was the
                user's own — so the one honest channel correctly said nothing,
                and the invention two rows down went unremarked.

                ⛔ IT NEVER SUPPRESSES, RE-RANKS OR RE-WORDS ANYTHING. It adds a
                line under a name that is on screen regardless. Olumi inventing
                options is the product working — 10 syntheses, 3 status-quo
                baselines and 2 novel moves across the measured corpus — and the
                defect was the silence about it, not the invention.

                ⚠ SILENT UNLESS THE CLAIM IS WARRANTED, and `null` is the common
                answer: the user's own option, CEE's ambiguous
                `ai_inferred`-with-a-quote case, an unstamped node, and any host
                that passes no origin map all render nothing. There is no
                fallback wording, because every other wording attributes the
                idea to somebody.

                ⚠ THE SAME COPY CONSTANT THE GLANCE RENDERS, not a second
                phrasing of one fact — two wordings of one claim on one screen
                is how a reader learns to distrust both. */}
            {o.origin !== null && !(sharedOrigin !== null && o.origin === sharedOrigin) ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                /* BOUND BY THIS ROW'S OWN ID. A shared testid would let a spec
                   find another option's sentence and pass — the trap-19 defect
                   this disclosure exists to correct, reproduced in its guard. */
                data-testid={`${testId}-option-origin-${o.id}`}
                data-option-origin={o.origin}
              >
                {OPTION_ORIGIN_COPY[o.origin]}
              </p>
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

            {/* ⭐ THE ACT — and it ASKS. It sends a question naming this option
                and the run's own stated ground for leaving it out, and that is
                ALL it does: no add, no value change, no re-run. The adjacent
                receipt's `addAction` records why (15 arms over 5 rounds against
                the live CEE router: every add phrasing refused, every ask
                phrasing answered), and the acceptance condition for an add is
                knowledge this surface does not have. Whatever the user does
                with the answer is a later turn through the existing writers.
                Two honest steps beat one false promise.

                ⛔ NOT ON `not_computed`. That option WAS in the comparison and
                the computation failed, so there is nothing to bring in and the
                question would misdescribe the run (CLAUDE.md trap 21 — the two
                numberless rows are not two spellings of one state).

                ⚠ GATED ON THE WRITER, so a host with no composer renders
                nothing rather than a control that cannot act. */}
            {o.kind === 'not_analysed' && onSendMessage ? (
              <button
                type="button"
                data-testid={`${testId}-bring-in-${o.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  /* BOUND BY IDENTITY. The question is composed from THIS row's
                     own label and THIS row's own ground, both carried on the
                     row object — never read back off the rendered sentence and
                     never looked up by label, which another option could
                     share. */
                  onSendMessage(bringIntoComparisonQuestion(o.label, o.reason))
                }}
                className={`${typography.panelMeta} mt-1 inline-flex items-center ${action('inline')}`}
              >
                {BRING_INTO_COMPARISON_LABEL}
              </button>
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

      {/* ⭐ THE SENTENCE, ONCE, FOR EVERY OPTION THE MARK APPEARS ON. Same copy
          constant the rows used and the glance renders — not a second phrasing
          of one fact, which is how a reader learns to distrust both. */}
      {sharedOrigin !== null ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-1 mb-0 flex items-center gap-1`}
          data-testid={`${testId}-option-origin-legend`}
          data-option-origin={sharedOrigin}
        >
          <Sparkles className={`${icon('inline')} shrink-0`} aria-hidden="true" />
          {OPTION_ORIGIN_COPY[sharedOrigin]}
        </p>
      ) : null}

      {/* ⭐⭐ THE SENTENCE THE BARS EXIST FOR.
          Without it the ranges are decoration; with it they are an argument.
          "Where ranges overlap, treat the order as unsettled" is the one line
          on this section that tells a reader when NOT to trust the ordering the
          percentages above imply — which is the difference between a tool that
          ranks options and a tool that improves reasoning.

          ⚠ Rendered only alongside the bars it describes. A legend for
          something not on screen is furniture, the defect this panel has
          adjudicated out twice (the empty zone label, "Nothing addressed yet").

          ⚠ It describes the DRAWING, not the numbers. No units are claimed,
          because this section does not know the goal's units — see the bar. */}
      {/* ⭐⭐ THE CONTROL AND ITS LEGEND SHARE ONE GATE, because they describe
          the same drawing. `rangeScale === null` means fewer than two rows carry
          a range, or the domain has no width — in both states there are no dots
          to read, so an arm control would offer three views of nothing. That is
          the 2.238 defect in its general form: an affordance live while the view
          it governs is unavailable. Absent, never disabled, never defaulted. */}
      {rangeScale !== null ? (
        <div className="mt-1 flex items-center gap-1 flex-wrap">
          <span
            id={`${rangeLensId}-label`}
            className={`${typography.panelMeta} text-text-light mr-1`}
          >
            {COPY.optionFigures.rangeLensLabel}
          </span>
          {/* ⚠⚠ THE ARROW KEYS ARE IMPLEMENTED, NOT ASSUMED. `role="radio"` is a
              PROMISE to a screen-reader user about how the control behaves; ARIA
              supplies the announcement and none of the behaviour. A radiogroup
              without roving tabindex and arrow traversal tells an assistive-tech
              user to press the arrow keys and then ignores them — a control that
              announces an affordance it does not have, which is the same defect
              class this section already polices in its figures.

              ⚠ ONE TAB STOP, WHICH IS THE OTHER HALF OF THE PATTERN. Three
              separately-tabbable arms would make a keyboard user traverse the
              lens to reach the rows; the selected arm holds the only `tabIndex`
              of 0, exactly as a native radio group does.

              ⚠ 24px MINIMUM. The panel carries a measured finding that 7 of 17
              interactive targets were under WCAG 2.2 AA's 24×24; a new control
              arriving under it would re-open a defect this lane is mid-way
              through closing. */}
          <div
            role="radiogroup"
            aria-labelledby={`${rangeLensId}-label`}
            className="flex items-center gap-1"
            data-testid={`${testId}-range-lens`}
          >
            {RANGE_LENS_ARMS.map((arm, i) => {
              const selected = rangeAppetite === arm
              return (
                <button
                  key={arm}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setRangeAppetite(arm)}
                  onKeyDown={(e) => {
                    const step =
                      e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? 1
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? -1
                          : 0
                    if (step === 0) return
                    e.preventDefault()
                    // Wraps, as a native radio group does.
                    const next =
                      RANGE_LENS_ARMS[
                        (i + step + RANGE_LENS_ARMS.length) % RANGE_LENS_ARMS.length
                      ]
                    setRangeAppetite(next)
                    // Selection FOLLOWS focus here, so focus must follow with
                    // it — otherwise the arm a screen reader announces and the
                    // arm the group considers current diverge after one press.
                    e.currentTarget.parentElement
                      ?.querySelector<HTMLButtonElement>(`[data-arm="${next}"]`)
                      ?.focus()
                  }}
                  /* ⛔ THE TIER OWNS THE TOUCH TARGET. My first version spelled
                     `min-h-[24px] … inline-flex items-center` out here, which is
                     the exact arrangement `everyInlineActIsReachableByTouch`
                     bans: *"if a later call site hand-rolls its own touch
                     target, the tier is no longer the single owner and the next
                     one added will miss it again."* That is how the 133×15
                     review-estimates control happened, in this same directory.
                     `no-underline` because an underline is `quiet`'s emphasis
                     for a text link and reads wrong on a segmented control —
                     the same override the Strengthen row toggle uses. */
                  className={`${typography.panelMeta} ${action('quiet')} px-2 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                    selected ? 'bg-panel-hover text-text-header' : 'text-text-light'
                  }`}
                  data-arm={arm}
                  data-testid={`${testId}-range-lens-${arm}`}
                >
                  {COPY.optionFigures.rangeLensArms[arm]}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      {rangeScale !== null ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
          data-testid={`${testId}-outcome-range-legend`}
        >
          {COPY.optionFigures.rangeLegend(rangeAppetite)}
        </p>
      ) : null}
    </SectionShell>
  )
}
