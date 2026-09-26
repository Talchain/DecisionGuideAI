/**
 * "HOW THE OPTIONS COMPARE" — THE FIGURE IS A FIGURE, AND ONLY WHERE LICENSED.
 *
 * ## The complaint, and the derived cause
 *
 * Paul, 2026-09-11, on the deployed Reasoning tab: the lower half is *"just a
 * big lump of text with poor usability and bad design … not an actual tool for
 * enhancing critical creative thinking or visualising information."* For THIS
 * section that turned out to be a geometry finding rather than a missing
 * capability: `OptionsComparison` has drawn a proportional bar per option since
 * it shipped, at `h-1` — a 4px track behind a 4px fill. A comparison drawn at
 * four pixels reads as no comparison at all, which is exactly what the
 * screenshot shows.
 *
 * ## Why enlarging it REQUIRES a licence it did not previously need
 *
 * This is the load-bearing half of this file, and it is the reason the change is
 * not simply `h-1` → `h-2`.
 *
 * A hairline is decoration and decoration makes no claim. Four bars on a shared
 * baseline at a size a reader can MEASURE are read comparatively, whatever each
 * one means in isolation. So the figure begins making a comparative claim at the
 * moment it becomes legible — and a comparative claim on this surface is
 * governed by `glance.comparativeClaim`, the three-valued authority that already
 * decides whether `AtAGlance` may put a magnitude on screen.
 *
 * Drawing a magnitude the view model has decided is `'none'` would state
 * something the run does not license, on the DEFAULT tab. That is the #709/#737
 * shape this estate has already shipped once — two authorities answering
 * different questions, and a leader named where one was withheld (CLAUDE.md
 * trap 21). So the section CONSUMES that gate; it does not mint a second one.
 *
 * ## The three states, and why the third is the one that matters
 *
 *  · `'value'` — the magnitude is licensed and on screen. The bars draw.
 *  · `'order'` — an ordering is licensed, a percentage is not. No magnitude
 *    draws. What IS licensed is already on screen: the array order, authored
 *    upstream by `sortOptionsForDisplay` and withheld there when the verdict
 *    withholds.
 *  · `'none'` — nothing set-dependent is licensed. NOTHING comparative draws,
 *    and the withheld-comparison sentence survives verbatim.
 *
 * ## How these fixtures avoid proving nothing
 *
 * ⚠⚠ THE ABSENCE CASES CARRY FIGURES IN THE DATA. An `'order'` or `'none'` run
 * whose rows had no `winFraction` would render no bar for a reason that has
 * nothing to do with the gate, and every assertion here would pass over a
 * vacuum (trap 13). `buildOptionsComparison` derives row shares from
 * `allOptions[].winProbability` INDEPENDENTLY of the leader entitlement, so the
 * suppressed runs below genuinely have magnitudes available and decline to draw
 * them. Each test asserts that precondition IN-TEST before asserting the
 * absence — the outcome is then provably the gate's doing and not the fixture's
 * failure (trap 13b's third face).
 *
 * ⚠ EVERY STATE IS DRIVEN THROUGH THE REAL VIEW MODEL, never hand-assembled. A
 * section object I wrote myself would encode my model of the producer rather
 * than the producer (trap 16's inverse: *a fixture you wrote yourself is not
 * evidence about the wire*), and would let me pair a claim with rows the builder
 * would never emit together. Each test also ASSERTS THE STATE IT INTENDS before
 * asserting the render, so a fixture that drifts into a different state REDs on
 * its own precondition instead of quietly testing something else.
 *
 * ## What the geometry assertion can and cannot say
 *
 * ⚠ jsdom cannot prove visibility, so nothing here claims the bar is VISIBLE or
 * measures its pixels (trap 3). It asserts the height TOKEN the element carries,
 * token-exact via `classList` rather than by substring, which is what
 * distinguishes a figure from a hairline in the only layer this runner can see.
 * A regression to `h-1` REDs; a real browser is still what proves it legible.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { niceDomain } from '../comparisonLens'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

afterEach(() => cleanup())

const TESTID = 'analysis-new-options'

/**
 * THE FIGURE'S HEIGHT TOKEN, and the one it replaced.
 *
 * ⚠ `FIGURE_HEIGHT` is `DriverInfluenceChart`'s (`:227`) — the Reasoning tab's
 * OWN other bar figure, mounted one section away in the same body. The number is
 * derived from a sibling on this surface rather than copied from the Analysis
 * tab, because #1346 ruled that GEOMETRY IS GRAMMAR AND IS FIXED and importing a
 * second tab's treatment would re-open the drift it closed.
 *
 * ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 13/20): `PanelFigure`'s track
 * moved from `h-2` (8px) to `h-[5px]` — the same lightening pass that made the
 * track a visible `bg-panel-border` line instead of a barely-there
 * `bg-panel-hover` fill (measured 1.038:1). `DriverInfluenceChart` moved with
 * it (`sections/DriverInfluenceChart.tsx`), so the two bar figures on this tab
 * still share one height; only the shared NUMBER changed.
 */
const FIGURE_HEIGHT = 'h-[5px]'
const HAIRLINE_HEIGHT = 'h-1'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES — three runs that differ ONLY in what the glance is entitled to say
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Four options with real shares, every one of them analysed.
 *
 * The shares are the measured staging run this section was built for (Segment
 * 89%, RudderStack 6%, Snowflake 5%, Status Quo 0%) — a runaway leader and a
 * long tail, which is the shape a reader must be able to tell from a coin flip
 * and could not.
 */
function fourOptions(): OptionResult[] {
  return [
    makeOption({ id: 'opt_segment', label: 'Segment', winProbability: 0.89, nValidSamples: 10000, isRecommended: true }),
    makeOption({ id: 'opt_rudderstack', label: 'RudderStack', winProbability: 0.06, nValidSamples: 10000 }),
    makeOption({ id: 'opt_snowflake', label: 'Snowflake', winProbability: 0.05, nValidSamples: 10000 }),
    makeOption({ id: 'opt_status_quo', label: 'Status Quo', winProbability: 0, nValidSamples: 10000 }),
  ]
}

/** Options that carry NO share at all — the state Paul's screenshot shows. */
function fourOptionsNumberless(): OptionResult[] {
  return [
    makeOption({ id: 'opt_segment', label: 'Segment' }),
    makeOption({ id: 'opt_rudderstack', label: 'RudderStack' }),
    makeOption({ id: 'opt_snowflake', label: 'Snowflake' }),
  ]
}

type RecOverrides = Partial<ResultsSectionDataReturn['recommendation']>

function dataFor(allOptions: OptionResult[], extra: RecOverrides): ResultsSectionDataReturn {
  return makeData({
    recommendation: {
      allOptions,
      recommendedOption: allOptions.find((o) => o.isRecommended) ?? null,
      ...extra,
    },
  })
}

/**
 * ⚠ THE THREE RUNS DIFFER IN THE PRODUCER FIELDS THE GATE IS DERIVED FROM, and
 * in nothing else. `comparativeClaim` is `'value'` when a magnitude is on the
 * glance (a licensed leader AND a verdict word), `'order'` when a verdict word
 * renders without a percentage, `'none'` when neither does. Varying only those
 * two fields is what makes the three states a controlled comparison rather than
 * three unrelated fixtures.
 */
const VERDICT: RecOverrides = {
  robustnessVerdict: 'robust',
  robustnessVerdictReason: 'The ordering held across the simulated range.',
}

/**
 * `'value'` — the producer licensed the leader claim AND a robustness verdict,
 * so `AtAGlance` prints the share and the magnitude is on screen.
 */
const VALUE_RUN = () =>
  dataFor(fourOptions(), { ...VERDICT, leaderDesignationPermitted: true })

/**
 * `'order'` — a robustness verdict renders, the leader claim is WITHHELD. The
 * glance may speak about the run without naming a magnitude.
 *
 * ⚠ THE ROWS STILL CARRY SHARES. That is deliberate and is what makes the
 * absence assertion mean anything.
 */
const ORDER_RUN = () =>
  dataFor(fourOptions(), { ...VERDICT, leaderDesignationPermitted: false })

/**
 * `'none'` — no leader claim and no verdict word. Nothing set-dependent is
 * licensed anywhere on the glance.
 */
const NONE_RUN = () => dataFor(fourOptions(), { leaderDesignationPermitted: false })

/** `'none'`, AND no row carries a number — the exact state in the screenshot. */
/**
 * ⚠ V2 (24 Sep 2026): THE LICENSED RUN WITH THE FIGURES V2 DRAWS. Identical to
 * `VALUE_RUN` in every field the glance reads, plus each option's own outcome
 * percentiles (every real run carries them) or its goal figure against a user
 * target. Ranges overlap and sit on a 0..100 domain so positions are exact.
 */
const RANGES: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {
  opt_segment: { mean: 30, p10: 0, p50: 30, p90: 50 },
  opt_rudderstack: { mean: 60, p10: 25, p50: 60, p90: 100 },
  opt_snowflake: { mean: 40, p10: 10, p50: 40, p90: 70 },
  opt_status_quo: { mean: 20, p10: 5, p50: 20, p90: 45 },
}
const RANGED_VALUE_RUN = () =>
  dataFor(
    fourOptions().map((o) => ({ ...o, outcome: RANGES[o.id] })),
    { ...VERDICT, leaderDesignationPermitted: true },
  )
const GOALS: Record<string, number> = {
  opt_segment: 0.5,
  opt_rudderstack: 0.3,
  opt_snowflake: 0.004,
  opt_status_quo: 0,
}
const GOAL_VALUE_RUN = () =>
  dataFor(
    fourOptions().map((o) => ({ ...o, goalProbability: GOALS[o.id] })),
    { ...VERDICT, leaderDesignationPermitted: true, goalThreshold: 20000 },
  )

const NONE_RUN_NUMBERLESS = () =>
  dataFor(fourOptionsNumberless(), { leaderDesignationPermitted: false })

/**
 * The producer row `atAGlance.spec.tsx` and `conditionCarriesItsScope.spec.tsx`
 * both already pin as yielding the no-unit, paired-with-baseline form. Reused so
 * the fixture is one this repo has measured rather than one composed here.
 */
const FLIP_ROW = { label: 'Two-month timeframe', node_id: 'n_time', current_value: 2, flip_value: 3 }

/**
 * ⭐⭐⭐ `'condition'` — THE FOURTH STATE, AND IT DID NOT EXIST WHEN THIS FILE
 * WAS WRITTEN. It arrived on `staging` in #1482 while this branch was open.
 *
 * ── WHY THIS FIXTURE EXISTS AT ALL ────────────────────────────────────────
 *
 * This file's enumeration said "the three states" because
 * `GlanceComparativeClaim` had three members that licensed anything. #1482
 * added a FOURTH — a flip condition is derived by ISL over the candidate set,
 * so it is a set-dependent claim and must carry its scope. Both changes are
 * correct alone. The question neither PR's own tests could ask is what the
 * FIGURE does on a run that reaches the new member, because #1483 gates the
 * bars on a value of this very union and #1482 widened the union underneath it
 * (CLAUDE.md trap 21 — two correct changes, one shared concept).
 *
 * ⚠ THE RUN CARRIES SHARES ON EVERY ROW. No leader object, no verdict word,
 * no headline — and four real magnitudes in the data. So the flip condition is
 * the ONLY claim the glance makes, and any absence of bars below is
 * attributable to the licence and not to missing numbers.
 *
 * ⛔ PERMITTED, NOT WITHHELD — since 24 Sep 2026. This run used to withhold the
 * leader. The glance's condition is now LEADER-GATED (served witness, UI
 * `c3a39ae7`: "Could change if …" at rest beside a withheld leader claim — a
 * flip threshold is where the CURRENT ORDER changes, so it presupposes a
 * reading a withheld run may not state). A withheld run therefore resolves to
 * `'none'`, and `'condition'` is reached only on a PERMITTED run that names no
 * leader: permission and separation granted, `recommendedOption: null` (the
 * headline needs a leader object), no robustness verdict. No row is marked
 * recommended, matching what the hook emits when no row carries the
 * recommended id.
 */
const CONDITION_RUN = () =>
  dataFor(
    fourOptions().map((o) => ({ ...o, isRecommended: false })),
    {
      leaderDesignationPermitted: true,
      verdict: { leaderId: 'opt_segment', hasLeadingOption: true } as RecOverrides['verdict'],
      recommendedOption: null,
      robustnessVerdict: undefined,
      robustnessVerdictReason: undefined,
      flipThresholdsStatus: 'computed',
      flipThresholds: [FLIP_ROW],
    },
  )

function renderRun(data: ResultsSectionDataReturn) {
  const vm = buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
  const utils = render(<OptionsComparison options={vm.optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
  return { vm, ...utils }
}

/** Bind by IDENTITY. Never `getAllByTestId(...)[n]`, never a value predicate. */
function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

/** Every bar currently on screen, whatever row it belongs to. */
function bars(): HTMLElement[] {
  return screen.queryAllByTestId(`${TESTID}-bar`)
}

/**
 * How many rows HAVE a magnitude available to draw.
 *
 * ⚠ THE PRECONDITION EVERY ABSENCE CASE STANDS ON. A suppressed run whose rows
 * carried no shares would render no bars for a reason the gate had nothing to do
 * with, and the test would be a tautology.
 */
function rowsWithAShare(vm: ReturnType<typeof buildAnalysisNewViewModel>): number {
  return vm.optionsComparison.rows.filter(
    (r) => r.kind === 'analysed' && r.winFraction !== null,
  ).length
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the licence is the glance’s, and there is only one of it', () => {
  it('carries the SAME value the glance publishes, in every one of the FOUR states', () => {
    // ⭐ THE GUARD AGAINST A SECOND AUTHORITY. If a later edit computes a
    // licence inside `buildOptionsComparison` — from the rows, from the leader,
    // from anything — the two answers can diverge on some run and this REDs.
    // It is the cheapest possible defence against the #709/#737 shape.
    for (const [name, data] of [
      ['value', VALUE_RUN()],
      ['order', ORDER_RUN()],
      ['none', NONE_RUN()],
      ['none/numberless', NONE_RUN_NUMBERLESS()],
      // ⚠ ADDED WITH #1482's FOURTH UNION MEMBER. The one-authority guard has
      // to span every state the union can reach, or the state it omits is
      // exactly where a second authority could appear unobserved.
      ['condition', CONDITION_RUN()],
    ] as const) {
      const vm = buildAnalysisNewViewModel({
        data,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale: false,
      })
      expect(
        vm.optionsComparison.comparativeClaim,
        `${name}: the section's licence must BE the glance's, not agree with it`,
      ).toBe(vm.atAGlance.comparativeClaim)
    }
  })

  it('CONTROL: the four fixtures really do reach four DIFFERENT states', () => {
    // ⭐ THE DISCRIMINATION CONTROL. Without this, three fixtures that all
    // landed on `'none'` would satisfy every suppression test below and the
    // `'value'` test would be the only real one — and a blind instrument that
    // returns one answer for every input looks exactly like agreement
    // (CLAUDE.md trap 20's uniformity heuristic).
    const claim = (data: ResultsSectionDataReturn) =>
      buildAnalysisNewViewModel({
        data,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale: false,
      }).optionsComparison.comparativeClaim

    expect(claim(VALUE_RUN())).toBe('value')
    expect(claim(ORDER_RUN())).toBe('order')
    expect(claim(NONE_RUN())).toBe('none')
    expect(claim(CONDITION_RUN())).toBe('condition')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe("'value' — the run licenses a magnitude, so the figure is a figure", () => {
  /**
   * ⚠ V2 (24 Sep 2026): THE WIN-SHARE BAR LEFT THE RESTING VIEW. The cases
   * below that measured its track and fill are re-pointed at the figures the
   * section DOES draw on a licensed run: each option's own range (the
   * "Modelled outcome" lens) and each option's goal figure (the "Goal fit"
   * lens). Same properties, same identity binding, same geometry grammar.
   */
  it('draws NO win-share bar at rest, though every option carries a share', () => {
    const { vm } = renderRun(VALUE_RUN())
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('value')

    // POSITIVE CONTROL FIRST: the section rendered its rows, and the data
    // carries shares, so the absence below is not a vacuum.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(4)
    expect(rowsWithAShare(vm), 'PRECONDITION: the data carries shares').toBeGreaterThan(1)
    expect(bars(), 'V2: no win-share bar at rest').toHaveLength(0)
  })

  it('the range track carries the FIGURE height token and not the hairline it replaced', () => {
    const { vm } = renderRun(RANGED_VALUE_RUN())
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('value')
    const track = within(row('opt_segment')).getByTestId(`${TESTID}-outcome-range-opt_segment`)

    // ⚠ `classList`, not a substring of `className`. `h-1` is a prefix of
    // `h-1.5`, so a substring check would answer a question nobody asked.
    expect(
      track.classList.contains(FIGURE_HEIGHT),
      `the comparison's track must carry ${FIGURE_HEIGHT}; it carries "${track.className}"`,
    ).toBe(true)
    expect(
      track.classList.contains(HAIRLINE_HEIGHT),
      'the 4px hairline is the measured defect and must not come back',
    ).toBe(false)
  })

  it('each band starts at ITS OWN ROW’S p10 and marks its own p50, bound by option id', () => {
    renderRun(RANGED_VALUE_RUN())

    // ⭐ BOUND BY IDENTITY, AND THE PAIR IS THE PROOF. Two rows with different
    // ranges, each asserted against its OWN row's percentiles on the shared
    // domain (0..100 here): a band that read some other row's range would
    // satisfy neither (trap 19). `left` is asserted, not `width`: the band's
    // width is a CSS `max(...)` that jsdom may drop, which would make a width
    // assertion pass or fail for reasons unrelated to the code.
    const band = (optionId: string) =>
      within(row(optionId)).getByTestId(`${TESTID}-outcome-range-${optionId}-band`)
    const mark = (optionId: string) =>
      within(row(optionId)).getByTestId(`${TESTID}-outcome-range-${optionId}-marker`)

    // Positions are fractions of the axis's ROUND domain (niceDomain: 0..100 → 0..120, ticks 0·40·80·120),
    // derived here rather than hard-coded, so the row-identity binding is what is tested.
    const d = niceDomain(0, 100)
    const pct = (v: number) => ((v - d.lo) / d.span) * 100
    expect(parseFloat(band('opt_segment').style.left)).toBeCloseTo(pct(0), 6)
    expect(parseFloat(band('opt_rudderstack').style.left)).toBeCloseTo(pct(25), 6)
    expect(mark('opt_segment').getAttribute('data-mark-at')).toBe('30')
    expect(mark('opt_rudderstack').getAttribute('data-mark-at')).toBe('60')
    // And the two are genuinely different, so the assertions above discriminate.
    expect(band('opt_segment').style.left).not.toBe(band('opt_rudderstack').style.left)
  })

  it('a measured ZERO still draws an empty track, and keeps no minimum width', () => {
    // ⚠ THE FLOOR IS FOR SMALL-BUT-REAL, NEVER FOR ZERO. "Scored highest in 0%
    // of simulated futures" is a true statement and must look like one; the
    // 2px minimum exists so a measured tiny share does not render as nothing,
    // and collapsing the two directions would re-open the defect in the other
    // direction. Pinned here so this change cannot silently drop it.
    //
    // ⚠ V2: asserted on the GOAL figure, the bar this section still draws with
    // a fill; the win-share fill it used to measure is gone from rest.
    renderRun(GOAL_VALUE_RUN())
    const zeroFill = within(row('opt_status_quo')).getByTestId(`${TESTID}-goal-bar`)
      .firstElementChild as HTMLElement
    expect(zeroFill.style.width).toBe('0%')
    expect(zeroFill.style.minWidth).toBe('')

    // CONTRAST CONTROL in the same render: a positive figure DOES carry the floor.
    const smallFill = within(row('opt_snowflake')).getByTestId(`${TESTID}-goal-bar`)
      .firstElementChild as HTMLElement
    expect(smallFill.style.minWidth).toBe('2px')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe("'order' — an ordering is licensed, a magnitude is not", () => {
  it('draws a bar for every row with a share — the figure follows the DATA, not the sentence entitlement', () => {
    const { vm } = renderRun(ORDER_RUN())
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('order')

    // ⭐⭐ THE PRECONDITION THAT MAKES THE ABSENCE MEAN SOMETHING. The data
    // carries four magnitudes; the section declines to draw them. Without this
    // line the test would pass on a run that simply had nothing to draw.
    expect(
      rowsWithAShare(vm),
      'no shares in the data — the suppression below would be vacuous',
    ).toBeGreaterThan(1)

    // ⭐⭐ V2 (24 Sep 2026): NO WIN-SHARE BAR AT REST, IN ANY CLAIM STATE.
    // Paul's 15 Sep ruling drew the bars on every state; his staging test then
    // read the shares (81 / 17 / 2) as a ranking, and the V2 comparison drops
    // them from the resting view (they move to "About this analysis"). The
    // bars are still independent of `comparativeClaim`: they are now absent on
    // every state alike.
    //
    // ⚠ THE PRECONDITIONS ABOVE ARE UNTOUCHED AND ARE WHY THIS IS STILL A
    // DISCRIMINATION: the claim state is pinned, and the data is pinned to
    // carry shares, so the absence is the section's and not the fixture's.
    expect(bars(), 'V2: no win-share bar at rest').toHaveLength(0)

    // CONTRAST CONTROL, same render: the section is alive and rendering rows,
    // so this is a discrimination and not a blank mount.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(4)
    expect(within(row('opt_segment')).getByTestId(`${TESTID}-label`)).toHaveTextContent('Segment')
  })

  it('and the ordering the run DOES license is still on screen — as the array order', () => {
    // The licensed claim at `'order'` is the ORDER, and the order is the array
    // order, authored once upstream by `sortOptionsForDisplay`. This section
    // renders `rows` as given and adds no ordinal — so "whatever is licensed
    // renders" is satisfied by the list itself, not by anything new.
    const { vm } = renderRun(ORDER_RUN())
    const rendered = screen
      .getAllByTestId(`${TESTID}-row`)
      .map((li) => li.getAttribute('data-option-id'))
    expect(rendered).toEqual(vm.optionsComparison.rows.map((r) => r.id))

    // ⚠ AND NO RANK NUMBER APPEARS. An ordinal here would be a second
    // designation channel — the first rule in this component's header.
    for (const li of screen.getAllByTestId(`${TESTID}-row`)) {
      expect(li.textContent ?? '').not.toMatch(/(^|\s)#?[1-4](st|nd|rd|th)\b/i)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⭐⭐⭐ THE COMPOSITION CASE — A CONDITION IS NOT A LICENCE FOR A MAGNITUDE.
 *
 * This whole block exists because of an interaction, not because of either
 * change on its own, and it is the case neither PR could have written:
 *
 *  · #1483 (this branch) gates the drawn bars on `comparativeClaim === 'value'`.
 *  · #1482 (landed on `staging` underneath it) added `'condition'` to that very
 *    union, so a run whose only claim is a flip threshold now resolves to a
 *    LICENSED member where it previously resolved to `'none'`.
 *
 * A flip threshold is a statement about WHEN an ordering would change. It puts
 * no percentage and no rank on screen — #1482's own type comment says exactly
 * that, which is why a condition takes `ComparisonScopeNote`'s neutral sentence
 * and not its `detail` line. So a condition licenses a SENTENCE and never a
 * magnitude, and the bars must stay withheld.
 *
 * ⚠⚠ AND THE GATE'S SHAPE IS WHAT MAKES THIS SAFE — `=== 'value'`, NOT
 * `!== 'none'`. The component's header already argued the two are different
 * gates, on the `'order'` state. #1482 turned that argument into a load-bearing
 * one: under `!== 'none'` a condition-only run would have flipped from drawing
 * NOTHING to drawing four measurable bars the moment #1482 merged — a
 * comparative magnitude on a run whose only claim is a threshold, reintroduced
 * by a neighbour, invisible to both PRs' suites because each is correct alone.
 * The mutant pair in `the gate's SHAPE is load-bearing` below proves that is a
 * real counterfactual and not a rhetorical one.
 */
describe("'condition' — a flip threshold licenses a sentence, never a magnitude", () => {
  it('draws a bar for every row with a share — the figure follows the DATA, not the sentence entitlement', () => {
    const { vm } = renderRun(CONDITION_RUN())

    // ⭐ PIN THE PRECONDITION. Without this the test could silently be another
    // `'none'` case — and a fixture that stopped reaching the new state would
    // keep passing while testing nothing (CLAUDE.md trap 13b).
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('condition')

    // ⭐⭐ AND THE CONDITION IS GENUINELY ON SCREEN'S WORTH OF CONTENT. If
    // `glanceCondition` returned null the run would be `'none'` and this whole
    // block would be a duplicate of its neighbour.
    expect(vm.atAGlance.condition, 'the claim under test must exist').not.toBeNull()

    // ⭐⭐ THE PRECONDITION THAT MAKES THE ABSENCE MEAN SOMETHING — four
    // magnitudes in the data, and the section declines to draw them.
    expect(
      rowsWithAShare(vm),
      'no shares in the data — the suppression below would be vacuous',
    ).toBeGreaterThan(1)

    // ⭐⭐ V2 (24 Sep 2026): NO WIN-SHARE BAR AT REST, IN ANY CLAIM STATE.
    // Paul's 15 Sep ruling drew the bars on every state; his staging test then
    // read the shares (81 / 17 / 2) as a ranking, and the V2 comparison drops
    // them from the resting view (they move to "About this analysis"). The
    // bars are still independent of `comparativeClaim`: they are now absent on
    // every state alike.
    //
    // ⚠ THE PRECONDITIONS ABOVE ARE UNTOUCHED AND ARE WHY THIS IS STILL A
    // DISCRIMINATION: the claim state is pinned, and the data is pinned to
    // carry shares, so the absence is the section's and not the fixture's.
    expect(bars(), 'V2: no win-share bar at rest').toHaveLength(0)

    // CONTRAST CONTROL, same render: the section mounted and is naming rows, so
    // this is a discrimination rather than a blank tree.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(4)
    expect(within(row('opt_segment')).getByTestId(`${TESTID}-label`)).toHaveTextContent('Segment')
  })

  /**
   * ⭐⭐⭐ THE GATE'S SHAPE IS LOAD-BEARING, AND THIS IS THE PROOF.
   *
   * The first list is the gate as written; the second is the gate a reasonable
   * edit might substitute, evaluated over the same four states. They must
   * DISAGREE, and they must disagree on exactly one state: `'condition'`.
   *
   * This is what stops a future reader "simplifying" `=== 'value'` into
   * `!== 'none'` — the two are not equivalent, they differ on a state that is
   * live on `staging` today, and the difference is a fabricated magnitude.
   *
   * ⚠⚠ WHAT THIS TEST DOES **NOT** GUARD, STATED BECAUSE IT SURVIVED THE
   * MUTANTS THAT PROVED IT. This test reads the VIEW MODEL and computes both
   * candidate gates here; it never renders. So it is a proof about the STATES —
   * that the four fixtures really do separate, and that the two gate shapes
   * really do disagree on `'condition'` — and it stayed GREEN under all three
   * mutations of the component's own `mayDrawMagnitude`. It is NOT a guard on
   * the component.
   *
   * The component-level guard is its sibling above ('draws NO bar'), which was
   * measured to RED under `!== 'none'` and under `=== 'value' || ===
   * 'condition'`, and to stay GREEN under `=== 'value' || === 'order'` — a
   * discriminating pair (CLAUDE.md trap 19), so it binds to THIS state rather
   * than being sensitive to any loosening at all. Read as a pair the two cover
   * the interaction; read alone, neither does.
   */
  it("the gate's SHAPE is load-bearing: `!== 'none'` would draw here and `=== 'value'` does not", () => {
    const states = [
      ['value', VALUE_RUN()],
      ['order', ORDER_RUN()],
      ['none', NONE_RUN()],
      ['condition', CONDITION_RUN()],
    ] as const

    const asWritten: string[] = []
    const asWidened: string[] = []
    for (const [name, data] of states) {
      const vm = buildAnalysisNewViewModel({
        data,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale: false,
      })
      const claim = vm.optionsComparison.comparativeClaim
      if (claim === 'value') asWritten.push(name)
      if (claim !== 'none') asWidened.push(name)
    }

    // The gate as shipped licenses a magnitude on exactly one state.
    expect(asWritten).toEqual(['value'])

    // The widened gate would license three — and `'condition'` is among them.
    expect(asWidened).toEqual(['value', 'order', 'condition'])

    // ⚠ THE DISCRIMINATION, STATED AS AN ASSERTION RATHER THAN LEFT TO A READER.
    expect(asWidened).toContain('condition')
    expect(asWritten).not.toContain('condition')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe("'none' — nothing comparative is drawn, and the withholding survives", () => {
  it('draws a bar for every row with a share — the figure follows the DATA, not the sentence entitlement', () => {
    const { vm } = renderRun(NONE_RUN())
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('none')
    expect(
      rowsWithAShare(vm),
      'no shares in the data — the suppression below would be vacuous',
    ).toBeGreaterThan(1)

    // ⭐⭐ V2 (24 Sep 2026): NO WIN-SHARE BAR AT REST, IN ANY CLAIM STATE.
    // Paul's 15 Sep ruling drew the bars on every state; his staging test then
    // read the shares (81 / 17 / 2) as a ranking, and the V2 comparison drops
    // them from the resting view (they move to "About this analysis"). The
    // bars are still independent of `comparativeClaim`: they are now absent on
    // every state alike.
    //
    // ⚠ THE PRECONDITIONS ABOVE ARE UNTOUCHED AND ARE WHY THIS IS STILL A
    // DISCRIMINATION: the claim state is pinned, and the data is pinned to
    // carry shares, so the absence is the section's and not the fixture's.
    expect(bars(), 'V2: no win-share bar at rest').toHaveLength(0)

    // CONTRAST CONTROL: rows are present, so the section mounted.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(4)
  })

  /**
   * ⭐⭐⭐ THE LOAD-BEARING CASE — the state in Paul's own screenshot.
   *
   * Nothing comparative is drawn AND the honest sentence is still there, word
   * for word. A change that made the figure prominent by weakening this would be
   * worse than leaving the hairline alone: it would state a magnitude on the
   * DEFAULT tab that the run explicitly declined to confirm.
   *
   * ⚠⚠ AND THE TWO HALVES CANNOT BE PROVED IN ONE FIXTURE — stated here rather
   * than papered over, because a reader who assumes they can will mis-read what
   * this test establishes.
   *
   * The withholding sentence is gated on `noneNumbered` ("did any row come back
   * with a readout?"), and the view model nulls `winReadout` and `winFraction`
   * TOGETHER on an analysed option — deliberately, so the number and the bar can
   * never disagree about whether a share exists. So a run that shows the
   * sentence necessarily has NO fractions, and its `bars().toHaveLength(0)` is
   * guaranteed by the data shape rather than by the gate. That half of this test
   * is a REGRESSION GUARD on the sentence, not a demonstration of the gate.
   *
   * The gate's bite at `'none'` is proved by its sibling above, which runs a
   * `'none'` verdict over rows that DO carry four magnitudes and draws none of
   * them. Read as a pair, the two cover the brief's third case completely; read
   * alone, neither does.
   */
  it('renders the withheld-comparison sentence VERBATIM, and still no figure', () => {
    const { vm } = renderRun(NONE_RUN_NUMBERLESS())
    expect(vm.optionsComparison.comparativeClaim, 'precondition').toBe('none')

    const caveat = screen.getByTestId(`${TESTID}-no-figures`)

    // ⚠⚠ THE LITERAL SENTENCE, NOT THE CONSTANT THE COMPONENT EMITS. Asserting
    // `COPY.checks.leader_not_assessed.orderingCaveat` would pass against ANY future
    // rewording, including one that dropped the denial — the component and the
    // assertion would simply agree with each other. This is the string a reader
    // meets, typed out, so a reword REDs here and has to be a decision.
    expect(caveat).toHaveTextContent(
      'A list with no figures beside it is not a finding that the options are level.',
    )

    // And the owning constant still IS that sentence — so this file cannot rot
    // into asserting a string the product no longer uses.
    expect(COPY.checks.leader_not_assessed.orderingCaveat).toBe(
      'A list with no figures beside it is not a finding that the options are level.',
    )

    // ⭐⭐ AND THE OTHER HALF IS SOMEWHERE ELSE, WHICH IS THE POINT OF THE SPLIT.
    // This section used to render the compound sentence that "What we checked"
    // also renders, so the same paragraph appeared twice in one scroll. The
    // check-inventory clause is asserted here as an ABSENCE from this section,
    // so a future merge back into one string REDs rather than quietly
    // reinstating the repetition.
    expect(COPY.checks.leader_not_assessed.meaning).toBe(
      'Olumi could not confirm which option is most likely on this run, so any ordering you see is unconfirmed.',
    )
    // ⚠ THE ORDERING CLAUSE BELONGS TO `meaning`, NOT HERE, AND THE REASON IS A
    // POPULATION. `orderingCaveat` renders only where `noneNumbered` holds;
    // `meaning` renders on the checklist row for EVERY withheld run. So the
    // clause that tells a reader what a visible ordering is worth has to sit in
    // the half that the run WITH figures renders — the first attempt at this
    // split moved it here and deleted it for that population, and
    // `withheldIsNotUnassessed.spec.ts` caught it.
    expect(caveat).not.toHaveTextContent('Olumi could not confirm which option is most likely')

    // ⭐⭐ THE BARS ARE INDEPENDENT OF `comparativeClaim` — PAUL'S RULING,
    // 15 Sep 2026, and this case now PINS that independence rather than the
    // suppression it replaced.
    //
    // What it used to assert: `'order'` licenses an ordering and never a
    // magnitude, so the bars stay withheld. Coherent, ratified, and changed on
    // evidence — the deployed build showed 48% / 4% / 48% with nothing drawn
    // and two options tied, which a reader had to spot by comparing numerals.
    //
    // ⚠ THE PRECONDITIONS ABOVE ARE UNTOUCHED AND ARE WHY THIS IS STILL A
    // DISCRIMINATION: the claim state is pinned, and the data is pinned to
    // carry shares. The assertion is now that the bars follow THE DATA and not
    // the sentence entitlement.
    expect(bars()).toHaveLength(rowsWithAShare(vm))
    // The rows are still named — the section did not go silent, it went honest.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(3)
  })
})
