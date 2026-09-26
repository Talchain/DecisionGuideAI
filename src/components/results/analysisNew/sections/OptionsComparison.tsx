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
 * ── V2 (24 Sep 2026): TWO LENSES, AND NO WIN SHARES AT REST ──────────────
 *
 * The section now answers through one of two lenses, chosen by the reader:
 * "Modelled outcome" (each option's own p10-p90 range and its p50 dot, on one
 * shared scale) and "Goal fit" (each option's chance of reaching the user's own
 * target). What the lenses read is decided in `../comparisonLens.ts`.
 *
 * ⛔ THE WIN SHARES ARE NO LONGER DRAWN OR PRINTED HERE AT REST. The per-option
 * share bar, its "Highest in this model N%" readout and the partition track are
 * gone from this section. Paul's staging test read 81 / 17 / 2 as a ranking,
 * and the V2 design drops them. `winReadout` / `winFraction` stay on the view
 * model, untouched, for the tab to expose in "About this analysis"; and
 * `noneNumbered` below still reads them, because "did any option come back
 * with a figure?" is still the question that sentence answers.
 *
 * ── WHAT THIS SECTION IS ENTITLED TO PUT ON SCREEN ────────────────────────
 *
 * Names, each option's own range and goal figure, and the sanctioned sentence
 * for an option the run did not analyse. That is all, and each omission below
 * is a rule this estate has already paid for:
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
 *    statements only. The reader still SEES how the options sit against each
 *    other, which is what the shared range scale is for; they are simply not
 *    handed a spurious integer for it.
 *
 *  · NO LEADER MARKER. The entitled leader is already named at the top of this
 *    surface by `AtAGlance`, under the one gate that licenses naming it. A
 *    second crown here would be a second designation channel, and an unentitled
 *    one, since `isRecommended` is set from the winner selection rather than
 *    from the leader VERDICT.
 *
 *  · NO COMPARATIVE MAGNITUDE AT REST. The win-share bars and the partition
 *    were the section's comparative magnitudes, and V2 removes them (above).
 *    Neither lens draws one: a range is each option's own spread and a goal
 *    figure is each option's own chance of reaching the user's target.
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

import { Fragment, useCallback, useId, useState } from 'react'
import { outcomeValuesAreModelScale } from '../../outcomeValuesAreModelScale'
import { ChevronRight, Crosshair, Info, Scale, Search, Sparkles } from 'lucide-react'
import { NodeMark } from '../nodeMarks'
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
import { ACTION_FOCUS, action, icon } from '../panelSurfaces'

/**
 * The lens arms, each ONE complete colour pair. Inline in the className
 * template, the per-site contrast scan (which reads a template literal whole,
 * on purpose) paired the idle arm's text colour with the selected arm's fill
 * and reported 1.00:1, though no rendered arm ever combined them. Each
 * constant is now exactly what one arm renders.
 */
const LENS_ARM_SELECTED = 'bg-primary text-text-on-color'
const LENS_ARM_IDLE = 'text-text-body hover:text-info'
import { PanelIconButton } from '../PanelIconButton'
import { PanelActRow } from '../PanelActRow'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'
import {
  COMPARISON_LENSES,
  COMPARISON_LENS_COPY as LENS_COPY,
  comparisonLensAvailability,
  initialComparisonLens,
  outcomeRangeScale,
  type ComparisonLens,
} from '../comparisonLens'

/**
 * ⭐ THE ARMS, IN READING ORDER, DECLARED ONCE.
 *
 * The control maps it, the arrow keys index it, and the order IS the semantics —
 * low to high across the same range. A second literal would let the keyboard
 * traverse an order the eye does not see.
 */
const RANGE_LENS_ARMS = ['cautious', 'middle', 'optimistic'] as const
type RangeLensArm = (typeof RANGE_LENS_ARMS)[number]

/**
 * ⭐ FOUR EVENLY-SPACED POINTS ACROSS THE SHARED DOMAIN, prototype-matched
 * (`chartHTML()` prints four ticks). `0` and `1` are the domain's own bounds,
 * so the end ticks always land on the same values the range bands are
 * fractioned against (`toFraction` in the row below).
 */
const AXIS_TICK_FRACTIONS = [0, 1 / 3, 2 / 3, 1] as const

/**
 * ⭐⭐ ONE INSET FOR THE BANDS AND FOR THE TICKS THAT READ THEM.
 *
 * Paul (25 Sep 2026): the last tick sat well short of the band end. Two causes:
 *   · the ticks shared a flex row with the range-info button, so they ended
 *     `gap-1` + 28px from the edge while the bands end at `mr-5` (20px);
 *   · `justify-between` spread the labels BY THEIR WIDTHS, so the middle two sat
 *     wherever the label lengths put them, not at 1/3 and 2/3 of the domain.
 * Now the track and the tick row take this ONE class, each tick is placed at its
 * own fraction (the end ticks anchored inward so they never overhang), and the
 * button is absolutely placed so it takes no width from the scale — the
 * prototype's own `.axis>.iconbtn{position:absolute;right:-24px}`.
 * `ml-4` clears the option's square mark and `mr-5` the row chevron (see the
 * range figure's call site).
 *
 * ⛔⛔ ON A WRAPPER, NEVER ON THE FIGURE ITSELF. PanelFigure's track is
 * `block w-full`: a margin on it SHIFTS a full-width box instead of shrinking
 * it. Measured on served `411158ad` (1440, 280px dock): every band track was
 * 246px wide at left 1181, so it ran 16px past the row (right 1427 vs 1411)
 * and `mr-5` never applied — the ticks, correctly inset, then ended 36px short
 * of the bands. The inset lives on a plain block around the figure, where a
 * margin does shrink the box (`noFigureTakesAHorizontalMargin` guards it).
 */
const RANGE_INSET = 'ml-4 mr-5'

/** An end tick is anchored inward; a middle tick is centred on its value. */
function tickTransform(fraction: number): string {
  const x = fraction <= 0 ? '0' : fraction >= 1 ? '-100%' : '-50%'
  return `translate(${x}, -50%)`
}

/**
 * ⛔ NO UNIT SYMBOL. See the call site's note: `outcomeRange` carries no unit,
 * so this prints the scale's own number and nothing else — never a `%`, `$`
 * or any other symbol this surface was not given.
 */
/**
 * ⭐⭐ THE MODEL'S OWN 0–1 SCALE IS NOT A SCALE A READER CAN HOLD (26 Sep, design
 * audit #3; contract v3.1 "no bare internal model scale", ruling "omit, never
 * invent"). Served `853feeb7`, pricing starter after one Run: the Reasoning
 * tab's axis under the "Goal only" qualifier printed **-0.487 / -0.315 /
 * -0.143 / 0.029** — four ticks 0.172 apart across the shared p10..p90 domain
 * (`results.option_comparison[].outcome`, mapped at
 * `buildAnalysisNewViewModel.ts` `outcomeRange`). The goal on that run is "NRR
 * above 110%", which the same payload places at `goal_threshold: 0.8` on the
 * model's 0–1 scale (`goal_threshold_raw: 110`, cap 137.5): the ticks are the
 * goal node's internal model value, and a negative NRR is not a reading anyone
 * can use. So where the whole domain sits inside the model's ±1 band the tick
 * labels are OMITTED — the bands, the (i) legend and every other line stay —
 * and no unit or word is put in their place. A domain outside it (the served
 * 25 Sep "190K … 890K") keeps its ticks unchanged.
 *
 * ⚠ A MAGNITUDE TEST, NAMED AS SUCH, AND ONE AUTHORITY: the domain is model
 * scale when `outcomeValuesAreModelScale` says so, the same predicate (and
 * threshold) the results hook's denormalisation pre-scan uses, so a run the hook
 * treats as model scale never keeps bare ticks here (R&C #2133 B1: a propagated
 * p10 -1.3 … p90 0.4 domain).
 */
function outcomeDomainIsModelScale(scale: { lo: number; hi: number }): boolean {
  // The SAME predicate the results hook's denormalisation pre-scan reads (R&C #2133 B1): one run, one answer.
  return outcomeValuesAreModelScale([scale.lo, scale.hi])
}

function formatAxisTick(value: number): string {
  // Three significant figures, compact for large magnitudes (190K, not
  // "423,333.33" — the served 25 Sep check). Still no unit symbol.
  return value.toLocaleString(undefined, { notation: 'compact', maximumSignificantDigits: 3 })
}

export interface OptionsComparisonProps {
  options: OptionsComparisonSection
  /**
   * ⭐ COMPOSED ONCE IN THE VIEW MODEL (`checks.leaderWithholdCause`), passed to
   * BOTH readers. This file's own rule for the sentence it qualifies — "one
   * wording covers one fact and the two cannot drift" — applies to its cause.
   */
  leaderWithholdCause?: string | null
  /** `checks.sharesExcludeLimits` — see the type. States "Goal only" above the shares. */
  sharesExcludeLimits?: boolean
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
   * no leader is marked, and the lens availability reads only rows the view
   * model built, which a disclosure state that does not exist until render
   * cannot influence.
   */
  defaultOpen?: boolean
  /**
   * ⭐⭐ BARE (V2 fidelity, gap 17): NO `SectionShell` — no heading, icon
   * circle, count or chevron, and no disclosure. Renders the same body
   * (qualifiers, lens control, rows, range detail) in a plain wrapper.
   *
   * ⚠ FOR THE ONE MOUNT WHERE THE COMPARISON IS ALREADY THE ANSWER. Nested
   * inside "Move towards commitment", `SectionShell` gave this section its
   * own 14px heading beside the zone's own, and closed it at rest whenever the
   * glance named a leader — hiding the chart on the run it is the entitled
   * account of. `defaultOpen` (above) is now IGNORED when `bare` is true: a
   * bare mount has no disclosure state to default.
   *
   * ⚠ DEFAULT `false`. Every other caller of this component — the standalone
   * specs, `collapsedIA.spec.tsx` — renders it unbare and keeps the existing
   * toggle, count and region.
   */
  bare?: boolean
  /**
   * ⭐ THE ROW ACTIONS (V2). Each is OPTIONAL and each renders only where it is
   * supplied: a host with no Model route renders no "Inspect in Model", never a
   * control that routes nowhere.
   *
   * ⚠ SUPPLYING ANY ONE CHANGES WHAT A CLICK ON THE OPTION'S NAME DOES. With
   * none, the name keeps its existing act (focus the canvas and open the
   * option's panel, below). With at least one, the name opens this row's
   * actions inline instead, and the canvas act becomes one of them
   * (`onFocusOption`). The row's hover highlight is the same either way.
   *
   * No action sends or composes a message: `onAskAboutOption` hands the host
   * the option's id and name, and what Olumi is asked is the host's decision.
   */
  onInspectOption?: (optionId: string) => void
  onFocusOption?: (optionId: string) => void
  onAskAboutOption?: (optionId: string, label: string) => void
  testId?: string
}

export function OptionsComparison({
  options,
  leaderWithholdCause = null,
  sharesExcludeLimits = false,
  onSendMessage,
  defaultOpen = false,
  bare = false,
  onInspectOption,
  onFocusOption,
  onAskAboutOption,
  testId = 'analysis-new-options',
}: OptionsComparisonProps) {
  const showToast = useShowToastSafe()

  /**
   * ⭐ THE READER'S LENS CHOICE, NOT THE LENS SHOWN. `null` until the reader
   * picks one. What renders is this choice where it still has something to
   * draw, and otherwise the default for the rows now on screen, so a run that
   * arrives after mount and drops the goal figures cannot leave the section on
   * an empty lens.
   */
  const [chosenLens, setChosenLens] = useState<ComparisonLens | null>(null)
  const lensGroupId = useId()
  /** The range explanation, behind its info button. */
  const [rangeInfoOpen, setRangeInfoOpen] = useState(false)
  /** The one row whose actions are open, by option id. */
  const [actionsOpenFor, setActionsOpenFor] = useState<string | null>(null)

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
   *
   * ⚠ V2: OFF THE RESTING VIEW. The arm control now sits behind the range info
   * button beside the axis, with the legend it governs. At rest the dot is the
   * mid-point (p50), and the info button's name says so.
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
   * ⭐ WHICH LENSES HAVE ANYTHING TO DRAW, AND WHICH ONE IS SHOWN.
   *
   * Both answers come from `../comparisonLens.ts`, which reads only what the
   * view model built. The shown lens is the reader's choice where that lens
   * still has something to draw, and otherwise the default for these rows.
   *
   * ⛔ THE WIN-SHARE GATE (`mayDrawMagnitude`) AND THE PARTITION ARE GONE WITH
   * THE FIGURES THEY GATED. Neither lens draws a comparative magnitude: a range
   * is each option's own spread, and a goal figure is each option's own chance
   * of reaching the user's target, which ranks nothing against anything.
   */
  const rangeScale = outcomeRangeScale(options.rows)
  const lensAvailability = comparisonLensAvailability(options)
  const lens: ComparisonLens | null =
    chosenLens !== null && lensAvailability[chosenLens]
      ? chosenLens
      : initialComparisonLens(lensAvailability)
  /**
   * The control is offered only where BOTH lenses have a view. With one lens
   * there is nothing to choose; with neither there is no lens at all.
   * ⛔ NO LOCKED ARM (ChatGPT's V2 ruling, #63 5806258826 §2): Goal fit without
   * figures used to render as a locked arm stating "needs a measurable target
   * and a result for every option" — a control that can never be pressed, on
   * runs whose target WAS set (served `11ed8874`). The Success row owns
   * target-setting; this section shows only what it can draw.
   */
  const offerLensControl = lensAvailability.outcome && lensAvailability.goal
  const rowActionsEnabled =
    onInspectOption !== undefined || onFocusOption !== undefined || onAskAboutOption !== undefined
  /**
   * ⭐ V2 FIDELITY (25 Sep 2026, gaps FIRST-1/SPACE-5): whether the range axis
   * row (its info button) has anything to attach to. Shared with `noneNumbered`
   * below (gap CHART-3) and with the merged legend/axis row further down, so
   * the three cannot drift onto three different readings of "is a range drawn".
   */
  const showAxis = lens === 'outcome' && rangeScale !== null

  /**
   * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): THE AXIS ROW'S OWN TICK
   * LABELS, so a withheld run's ranges can be READ rather than only seen. The
   * prototype (`Olumi_Reasoning_Prototype_V2.html`, `chartHTML()`) prints four
   * ticks — `0%`, `10%`, `20%`, `30%` — under the rows; before this the info
   * button sat alone with no scale to read the bands against.
   *
   * ⛔⛔ NOT A PERCENTAGE, AND NOT A POINT FIGURE. `outcomeRange` carries no
   * unit — PanelFigure's own rule 3 ("THE FIGURE CLAIMS NOTHING IN UNITS",
   * `PanelFigure.tsx:51-56`), this file's own range-band note ("PRESENTATIONAL
   * ONLY, AND IT MAKES NO CLAIM IN UNITS", above at the range's render site)
   * and `analysisNewTypes.ts:640-644` (a captured real run whose values are
   * `-0.163` / `0.027` / `0.211`, not percentages) all document the same
   * producer gap: the outcome may be currency, a count or a normalised scale,
   * and this surface is never told which. Printing "0% 10% 20% 30%" here would
   * be exactly the fabrication those three sites refuse — a unit invented
   * where none was sent. So these four ticks are the SCALE'S OWN VALUES,
   * spread evenly across the shared domain (`rangeScale.lo` .. `.hi`), plain
   * numbers with no appended symbol — readable against the bands without
   * claiming a unit the producer never gave. Reported, not silently narrowed:
   * see the PR description for the same finding against the per-option point
   * figure this wave does NOT add for the identical reason.
   */
  const axisTicks: readonly string[] | null =
    showAxis && rangeScale !== null && !outcomeDomainIsModelScale(rangeScale)
      ? AXIS_TICK_FRACTIONS.map((f, i) => formatAxisTick(rangeScale.ticks?.[i] ?? rangeScale.lo + f * rangeScale.span))
      : null

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

  /**
   * ⭐ V2 FIDELITY (gap 17): THE BODY, SEPARATED FROM ITS SHELL. `bare` (below)
   * needs the exact same qualifiers/lens/rows/range-detail this section has
   * always drawn — one JSX tree, built once, so a bare mount and a shelled one
   * can never quietly diverge. Each wrapper only decides the CHROME.
   */
  const body = (
    <>
      {/* ⚠ THIS SECTION'S OWN HALF OF A SENTENCE THAT USED TO SERVE TWO.
          `checks.leader_not_assessed.meaning` is "What we checked"'s — it
          answers what the run CHECKED. This answers HOW TO READ THIS LIST, and
          rendering the compound original here put the same paragraph on screen
          twice in one scroll (witnessed on served `fd992149`).

          ⚠ THIS SECTION GETS THE LEVEL-OPTIONS DENIAL AND NOT THE ORDERING
          ONE, and the division is by POPULATION rather than by length. This
          paragraph renders only where `noneNumbered` holds, so it is the only
          string that reaches a reader who can be misled into reading a silent
          list as a tie. The ordering clause stays in `meaning`, which is the
          half that renders on a withheld run whose options DO carry figures —
          the run this section says nothing on at all. The cause is still
          appended below.

          ⭐ V2 FIDELITY (25 Sep 2026, gap CHART-3): `&& lens === null`, ADDED.
          `noneNumbered` alone asks only "did any option come back with a WIN
          SHARE?" — a question about a figure this section stopped printing at
          rest. A withheld run can carry no win share and still draw every
          option's own range (the "Modelled outcome" lens): that run has rows
          FULL of figures, and calling it "a list with no figures beside it"
          was false on the very run it was meant to protect. Gating on `lens`
          too restricts the denial to a row that TRULY shows nothing — no
          range, no goal figure — which is the only population this sentence
          may address. The cause stays appended: a withheld run with figures
          keeps stating it, through the commitment synthesis's own "Still
          open" bullet, which reads `checks.leaderWithheld` independently of
          this component. */}
      {noneNumbered && lens === null ? (
        <p
          /* ⭐ V2 FIDELITY (25 Sep 2026, gap TYPE-10): body ink, not tertiary
             grey — this line states the chart's own uncertainty and reads as
             part of the argument, the same ruling as the qualifier below it. */
          className={`${typography.panelMeta} text-text-body mb-2 mt-0`}
          data-testid={`${testId}-no-figures`}
        >
          {COPY.checks.leader_not_assessed.orderingCaveat}
          {/* ⭐ THE PRODUCER'S CAUSE, where it named one this surface can state.
              A withheld claim is not a missing one, and without the cause the
              sentence above reads as "something did not come back" — which on
              the run that produced this fix was the one thing it was not. */}
          {leaderWithholdCause !== null ? ` ${leaderWithholdCause}` : null}
        </p>
      ) : null}

      {/* ⭐ THE RUN PAUL MET (RC 5803875794 P0 #3): figures ON screen, leader
          withheld because the limits could not be checked. The paragraph above
          renders only when no option has a figure, so without this line the
          shares sat there as if the whole decision had been assessed. One line,
          the producer's own cause appended, and nothing when figures are absent
          (the paragraph above already carries the cause there). */}
      {sharesExcludeLimits && !noneNumbered ? (
        <p
          /* ⭐ V2 FIDELITY (25 Sep 2026, gap TYPE-10): body ink, not tertiary
             grey — see the `-no-figures` paragraph above. */
          className={`${typography.panelMeta} text-text-body mb-2 mt-0`}
          data-testid={`${testId}-goal-only`}
        >
          {COPY.optionFigures.goalOnlyQualifier}
          {leaderWithholdCause !== null ? ` ${leaderWithholdCause}` : null}
        </p>
      ) : null}

      {/* ⭐ THE TWO LENSES (V2). A radio group because exactly one lens is
          shown at a time, with the same keyboard contract as the range-arm
          control below: one tab stop on the selected arm, arrow keys traverse
          and wrap, and focus follows the selection.

          Offered only when both lenses have figures (see `offerLensControl`),
          so every arm can be chosen and no reader lands on an empty lens.

          ⛔ A LENS REORDERS NOTHING. It changes which figure sits under each
          name and never which name comes first; the rows below are rendered in
          the order the view model gave them. */}
      {offerLensControl ? (
        <div className="mb-2" data-testid={`${testId}-lens-control`}>
          <span id={`${lensGroupId}-label`} className="sr-only">
            {LENS_COPY.groupLabel}
          </span>
          {/* ⭐ V2 FIDELITY (gap 19): PILL, NOT A SQUARED BOX. `rounded-md`
              read as ~12px on a ~30px-tall box, close to a pill already; the
              arms inside it were the squared part (`rounded` ≈ 4px against the
              prototype's 99px). `p-[3px] gap-[3px]` matches the prototype's
              own `.lens{padding:3px;gap:3px}`. */}
          <div
            role="radiogroup"
            aria-labelledby={`${lensGroupId}-label`}
            className="flex w-full items-center rounded-full border border-panel-border p-[3px] gap-[3px]"
            data-testid={`${testId}-lens`}
          >
            {COMPARISON_LENSES.map((arm, i) => {
              const selected = lens === arm
              const control = (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setChosenLens(arm)}
                  onKeyDown={(e) => {
                    const step =
                      e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? 1
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? -1
                          : 0
                    if (step === 0) return
                    e.preventDefault()
                    const next =
                      COMPARISON_LENSES[
                        (i + step + COMPARISON_LENSES.length) % COMPARISON_LENSES.length
                      ]
                    if (lensAvailability[next]) setChosenLens(next)
                    e.currentTarget
                      .closest('[role="radiogroup"]')
                      ?.querySelector<HTMLButtonElement>(`[data-lens="${next}"]`)
                      ?.focus()
                  }}
                  /* ⭐ V2 FIDELITY (gap 19): a SOLID selected state, not a
                     cream tint. `bg-panel-hover` on `bg-panel` measured at
                     1.038:1 (`SectionShell.tsx`'s own contrast note) — which
                     of the two lenses was active was barely readable, and DS
                     v5 bans a tinted background outright. `bg-primary
                     text-text-on-color` is the panel's ONE filled control
                     (`ACTION_TIER.primary`); unselected arms drop to
                     `text-text-body` so the pair reads as "chosen" vs "not",
                     never as two different intensities of one tint. Not
                     `action('quiet')` — that tier is UNDERLINED text-light
                     furniture, the opposite of a segmented control's arm. */
                  className={`${typography.panelBody} ${ACTION_FOCUS} flex-1 inline-flex items-center justify-center min-h-[28px] gap-1 rounded-full px-2 no-underline ${
                    selected ? LENS_ARM_SELECTED : LENS_ARM_IDLE
                  }`}
                  data-lens={arm}
                  data-testid={`${testId}-lens-${arm}`}
                >
                  {LENS_COPY.arms[arm]}
                </button>
              )
              return <Fragment key={arm}>{control}</Fragment>
            })}
          </div>
        </div>
      ) : null}

      {/* ⚠ `space-y-2` (8px), NOT `space-y-2.5` (10px). 10px was never on
          `SHELL_SPACING_SCALE_PX` — this both reclaims 6px and puts the row rhythm
          on the sanctioned scale, which is why it is a correction and not only a
          trim. */}
      <ul
        className="list-none p-0 m-0 space-y-2"
        data-comparison-lens={lens ?? 'none'}
        data-testid={`${testId}-rows`}
      >
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
               reachable. */
            onMouseEnter={() => highlightNode(o.id)}
            onMouseLeave={clearHighlight}
          >
            <div className="flex items-baseline gap-2">
              {/* ⚠ THE BUTTON WRAPS THE LABEL AND NOTHING ELSE, AND THAT IS AN
                  ACCESSIBILITY DECISION RATHER THAN A LAYOUT ONE. An
                  `aria-label` REPLACES an element's name with the given string,
                  so a button wrapping the whole row would put every figure and
                  reason inside a control whose name has already been decided.

                  ⭐ TWO ACTS, AND THE HOST CHOOSES WHICH BY WHAT IT SUPPLIES.
                  With no row-action handler this is the existing act (focus the
                  canvas and open the option's panel). With any, it opens this
                  row's actions inline, and says so in its name and in
                  `aria-expanded`. */}
              <button
                type="button"
                data-testid={`${testId}-focus`}
                aria-label={
                  rowActionsEnabled
                    ? LENS_COPY.rowActions(o.label)
                    : COPY.canvas.focusOption(o.label)
                }
                aria-expanded={rowActionsEnabled ? actionsOpenFor === o.id : undefined}
                onClick={() => {
                  if (rowActionsEnabled) {
                    setActionsOpenFor((current) => (current === o.id ? null : o.id))
                    return
                  }
                  activate(o.id)
                }}
                /* Keyboard parity with the row hover above. `onBlur` clears for
                   the same reason `onMouseLeave` does: the ring is a POINTER. */
                onFocus={() => highlightNode(o.id)}
                onBlur={clearHighlight}
                /* ⭐ 24px MINIMUM FROM PADDING, AND NO `min-h-[24px]` HERE — the
                   literal is banned in a file carrying `action('inline')`
                   (`everyInlineActIsReachableByTouch`). This control cannot take
                   a tier: it is the option's NAME. 2px of padding, and not
                   `inline-flex items-center`, which would change how a long
                   option name wraps. */
                className={`${typography.panelBody} text-text-body min-w-0 flex-1 break-words text-left rounded-md -ml-1 px-1 py-0.5 cursor-pointer transition-colors hover:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                {/* ⭐ V2 FIDELITY (gap 20): THE OPTION'S OWN SHAPE, before its
                    name — the row head's `.option-top` grid in the prototype
                    leads with an 8px option square; this row had no mark at
                    all, so nothing on it said "option" the way the canvas
                    already does. `aria-hidden` by construction (`NodeMark`),
                    so it adds nothing to the button's `aria-label`. */}
                <NodeMark kind="option" className={`${icon('inline')} mr-1 inline-block align-[-1px]`} />
                <span data-testid={`${testId}-label`}>{o.label}</span>
                {sharedOrigin !== null && o.origin === sharedOrigin ? (
                  /* ⚠ `role="img"` WITH THE FULL SENTENCE AS ITS NAME. A bare
                     glyph has no accessible name at all, and this one carries a
                     provenance claim. */
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

              {/* ⚠ THE BADGE NAMES WHICH NUMBERLESS STATE THIS IS, and the two
                  are not interchangeable. "Not analysed" says the option was
                  left OUT of the comparison; on an option the analysis RAN ON
                  and could not compute, that sentence is false and blames the
                  wrong party. Switched on `kind` (the union). */}
              {o.kind !== 'analysed' ? (
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
              ) : null}

              {/* ⭐ V2 FIDELITY (gap 20): AN EXPAND CUE, where the row has
                  actions to expand. The button above already toggles
                  `actionsOpenFor` and carries `aria-expanded`; nothing on
                  screen said so, so a reader met a row that opened with no
                  visible affordance for it. Decorative only — `aria-hidden`,
                  because the button's own `aria-expanded`/`aria-label` already
                  say this to assistive tech. */}
              {rowActionsEnabled ? (
                <ChevronRight
                  className={`${icon('inline')} text-text-light shrink-0 self-center transition-transform ${
                    actionsOpenFor === o.id ? 'rotate-90' : ''
                  }`}
                  aria-hidden={true}
                  data-testid={`${testId}-row-chevron-${o.id}`}
                />
              ) : null}
            </div>

            {/* ⭐⭐ MODELLED OUTCOME: THE RANGE THIS OPTION ACTUALLY PRODUCED.
                Its p10-p90 band and its dot on ONE scale shared by every row,
                so a reader sees two ranges OVERLAP, where the order between
                them is not settled.

                ⚠ PRESENTATIONAL ONLY, AND IT MAKES NO CLAIM IN UNITS. No number
                is printed from these percentiles: the outcome may be in
                currency, a count or a normalised scale, and the view model
                carries no unit for it. The band says WHERE and HOW WIDE
                relative to the other options, and nothing more. */}
            {lens === 'outcome' &&
            o.kind === 'analysed' &&
            o.outcomeRange != null &&
            rangeScale !== null ? (
              (() => {
                // The only arithmetic here: this option's percentiles as
                // positions on the SHARED domain. `PanelFigure` is handed
                // fractions and never sees a p10.
                const toFraction = (v: number) => (v - rangeScale.lo) / rangeScale.span
                const markAt =
                  rangeAppetite === 'cautious'
                    ? o.outcomeRange.p10
                    : rangeAppetite === 'optimistic'
                      ? o.outcomeRange.p90
                      : o.outcomeRange.p50
                return (
                  /* ⭐ V2 FIDELITY (25 Sep 2026, gap SPACE-3): INSET FROM THE
                     NAME AND THE CHEVRON COLUMN. `ml-4` clears the mark (`w-3`
                     plus `mr-1`, the button's `-ml-1 px-1` cancelling) and
                     `mr-5` clears the chevron (`w-3` plus `gap-2`) — on this
                     wrapper, not the figure (see RANGE_INSET). */
                  <div className={`mt-1 ${RANGE_INSET}`} data-testid={`${testId}-range-inset-${o.id}`}>
                  <PanelFigure
                    variant="range"
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
                  </div>
                )
              })()
            ) : null}

            {/* ⭐⭐ GOAL FIT: "does this reach the target I set?" — the
                probability THIS option reaches the user's own target, computed
                independently per option, so the figures do not sum to anything
                and rank nothing against anything.

                ⚠ EVERY GATE IS THE VIEW MODEL'S. Absent here means no user
                target (UI-SEM-071), the producer withheld or omitted a figure,
                the figure is a substituted joint one, or any analysed option
                lacks one (the complete-field rule). This component asks only
                whether there is a figure. */}
            {lens === 'goal' &&
            o.kind === 'analysed' &&
            o.goalReadout !== null &&
            o.goalFraction !== null ? (
              <div className="mt-1">
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
                {/* ⭐ V2 FIDELITY (25 Sep 2026, gap CHART-6): the same inset as
                    the range figure above, so switching lens does not move
                    where the bar starts and ends against the name column — on
                    a wrapper, for the same reason (RANGE_INSET). */}
                <div className={`mt-1 ${RANGE_INSET}`} data-testid={`${testId}-goal-inset-${o.id}`}>
                  <PanelFigure variant="goal" fraction={o.goalFraction} testId={`${testId}-goal-bar`} />
                </div>
                {/* Display-honesty (ROADMAP 1.6b / PLoT #204): the caveat
                    renders ADJACENT to the number it qualifies, never
                    separately. The shared constant, never a re-wording of it. */}
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
                LEADER'S. Silent unless the claim is warranted; the same copy
                constant the glance renders. */}
            {o.origin !== null && !(sharedOrigin !== null && o.origin === sharedOrigin) ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-option-origin-${o.id}`}
                data-option-origin={o.origin}
              >
                {OPTION_ORIGIN_COPY[o.origin]}
              </p>
            ) : null}

            {/* ⭐ THE PRODUCER'S OWN SENTENCE ABOUT THIS OPTION, VERBATIM. If the
                producer sent no sentence, none is shown. */}
            {o.kind === 'analysed' && o.why !== null ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-why`}
              >
                {o.why}
              </p>
            ) : null}

            {/* WHY there is no number. The sanctioned sentence, verbatim — or
                nothing, where the view model could not license the ground
                (`reasonCopy: null`: an option added after a run we cannot
                vouch is current). The badge above still names the state. */}
            {o.kind === 'not_analysed' && o.reasonCopy !== null ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-not-analysed-reason`}
              >
                {o.reasonCopy}
              </p>
            ) : null}

            {/* ⭐ THE ACT — and it ASKS. It sends a question naming this option
                and the run's own stated ground for leaving it out, and that is
                ALL it does. ⛔ NOT ON `not_computed` (trap 21). ⚠ GATED ON THE
                WRITER, so a host with no composer renders nothing.
                ⛔ AND ON A STATED GROUND. The question opens by restating the
                row's reason; with `reasonCopy: null` there is no ground this
                surface may state, and "The analysis returned no result for …"
                sent as the user's own words would carry the false premise
                the row just withheld. */}
            {o.kind === 'not_analysed' && o.reasonCopy !== null && onSendMessage ? (
              <button
                type="button"
                data-testid={`${testId}-bring-in-${o.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  // BOUND BY IDENTITY: this row's own label and ground.
                  onSendMessage(bringIntoComparisonQuestion(o.label, o.reason))
                }}
                className={`${typography.panelMeta} mt-1 inline-flex items-center ${action('inline')}`}
              >
                {BRING_INTO_COMPARISON_LABEL}
              </button>
            ) : null}

            {/* WHY the computation produced no number, as opposed to why the
                option was left out. A DISTINCT testid so the two can never be
                asserted interchangeably. */}
            {o.kind === 'not_computed' ? (
              <p
                className={`${typography.panelMeta} text-text-light mt-0.5 mb-0`}
                data-testid={`${testId}-not-computed-reason`}
              >
                {o.reasonCopy}
              </p>
            ) : null}

            {/* ⭐ THE ROW'S ACTIONS, INLINE, AT MOST THREE. Each renders only
                where the host supplied its handler, and each is named with the
                option it acts on so three rows' buttons are never three
                identical names. */}
            {rowActionsEnabled && actionsOpenFor === o.id ? (
              <PanelActRow className="mt-1" testId={`${testId}-row-actions-${o.id}`}>
                {onInspectOption ? (
                  <PanelIconButton
                    Icon={Search}
                    label={LENS_COPY.inspectInModel(o.label)}
                    onClick={() => onInspectOption(o.id)}
                    testId={`${testId}-inspect-${o.id}`}
                  />
                ) : null}
                {onFocusOption ? (
                  <PanelIconButton
                    Icon={Crosshair}
                    label={LENS_COPY.focusOnCanvas(o.label)}
                    onClick={() => onFocusOption(o.id)}
                    testId={`${testId}-canvas-${o.id}`}
                  />
                ) : null}
                {onAskAboutOption ? (
                  <PanelIconButton
                    ai
                    label={LENS_COPY.askOlumi(o.label)}
                    onClick={() => onAskAboutOption(o.id, o.label)}
                    testId={`${testId}-ask-${o.id}`}
                  />
                ) : null}
              </PanelActRow>
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

      {/* ⭐⭐ V2 FIDELITY (25 Sep 2026, gap FIRST-1): ONE ROW FOR THE LEGEND
          AND THE RANGE-INFO BUTTON, NOT TWO. The (i) button used to sit alone
          on its own 32px row below the provenance legend, adding a full row
          of height the range's own info button never earns on the prototype
          (there it hangs off the axis row's right edge). Measured cost: about
          32px, enough on its own to push "Provisional…" below the 1440 fold.
          Merged whenever EITHER has something to say — the legend keeps its
          own testid, class and text unchanged (only `mt-1` moves to the row);
          the button keeps its own testid, gated on the range alone, never on
          the row, so `optionsComparisonLens.spec` and
          `theWithheldRunShowsItsFigures.spec` see the same presence/absence
          they always did. */}
      {/* ⭐ V2 prototype (`.axis`): the scale is its OWN full-width row under the
          plots — ticks spread across the plot inset, the (i) at the end — and
          the shared-origin sentence is its own line below it. Sharing one flex
          row crushed the sentence into a 40px column at the 280px dock. */}
      {showAxis ? (
        <div className="relative mt-1 min-h-[18px]" data-testid={`${testId}-axis`}>
          {axisTicks !== null ? (
            <span
              className={`${typography.panelMeta} text-text-light relative block h-[18px] ${RANGE_INSET} tabular-nums`}
              data-testid={`${testId}-axis-ticks`}
              aria-hidden="true"
            >
              {axisTicks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 whitespace-nowrap"
                  style={{
                    left: `${AXIS_TICK_FRACTIONS[i] * 100}%`,
                    transform: tickTransform(AXIS_TICK_FRACTIONS[i]),
                  }}
                  data-fraction={AXIS_TICK_FRACTIONS[i]}
                  data-testid={`${testId}-axis-tick-${i}`}
                >
                  {tick}
                </span>
              ))}
            </span>
          ) : null}
          <span
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 [@media(pointer:coarse)]:translate-x-3"
            data-testid={`${testId}-range-info-anchor`}
          >
            <PanelIconButton
              Icon={Info}
              label={COPY.optionFigures.rangeLegend(rangeAppetite)}
              expanded={rangeInfoOpen}
              onClick={() => setRangeInfoOpen((open) => !open)}
              testId={`${testId}-range-info`}
            />
          </span>
        </div>
      ) : null}
      {/* THE SENTENCE, ONCE, FOR EVERY OPTION THE MARK APPEARS ON. Same copy
          constant the rows used and the glance renders. */}
      {sharedOrigin !== null ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-1 mb-0 flex items-start gap-1`}
          data-testid={`${testId}-option-origin-legend`}
          data-option-origin={sharedOrigin}
        >
          <Sparkles className={`${icon('inline')} shrink-0 mt-px`} aria-hidden="true" />
          {OPTION_ORIGIN_COPY[sharedOrigin]}
        </p>
      ) : null}
      {showAxis && rangeInfoOpen ? (
        <div data-testid={`${testId}-range-detail`}>
          <p
            className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
            data-testid={`${testId}-outcome-range-legend`}
          >
            {COPY.optionFigures.rangeLegend(rangeAppetite)}
          </p>
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <span
              id={`${rangeLensId}-label`}
              className={`${typography.panelMeta} text-text-light mr-1`}
            >
              {COPY.optionFigures.rangeLensLabel}
            </span>
            {/* ⚠⚠ THE ARROW KEYS ARE IMPLEMENTED, NOT ASSUMED. `role="radio"`
                is a PROMISE to a screen-reader user; ARIA supplies the
                announcement and none of the behaviour. One tab stop, on the
                selected arm. The tier owns the 24px touch target. */}
            {/* ⭐ V2 FIDELITY (gap 19): the same pill treatment as the
                comparison lens above — one segmented-control grammar, not two. */}
            <div
              role="radiogroup"
              aria-labelledby={`${rangeLensId}-label`}
              className="flex items-center rounded-full border border-panel-border p-[3px] gap-[3px]"
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
                      // Selection FOLLOWS focus, so focus must follow with it.
                      e.currentTarget.parentElement
                        ?.querySelector<HTMLButtonElement>(`[data-arm="${next}"]`)
                        ?.focus()
                    }}
                    className={`${typography.panelBody} ${ACTION_FOCUS} inline-flex items-center justify-center min-h-[28px] rounded-full px-2 no-underline ${
                      selected ? LENS_ARM_SELECTED : LENS_ARM_IDLE
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
        </div>
      ) : null}
    </>
  )

  /**
   * ⭐⭐ BARE (V2 fidelity, gap 17): NO `SectionShell`. Mounted inside "Move
   * towards commitment", the comparison IS the answer that zone promises — a
   * closed "How the options compare 3 ›" row hid the only evidence the zone
   * has, on every run that named a leader (the deployed-build measurement
   * behind this gap). `bare` renders the identical body with no heading, no
   * count, no chevron and no disclosure: the one caller that passes it
   * (`AnalysisNewTabBody.tsx`'s commitment mount) has already decided this
   * content belongs on screen at rest.
   *
   * ⚠ EVERY OTHER MOUNT IS UNCHANGED. `bare` defaults to `false`, and
   * `collapsedIA.spec.tsx` plus the standalone `OptionsComparison` specs
   * render this component with no `bare` prop, so they keep the existing
   * `SectionShell` toggle, count and region untouched.
   */
  if (bare) {
    return (
      <div data-testid={testId} data-comparison-bare="true">
        {body}
      </div>
    )
  }

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
      {body}
    </SectionShell>
  )
}
