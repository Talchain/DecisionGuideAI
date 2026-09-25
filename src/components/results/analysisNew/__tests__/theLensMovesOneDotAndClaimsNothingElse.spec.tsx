/**
 * THE OUTCOME LENS — IT MOVES ONE DOT, AND THE SENTENCE MOVES WITH IT.
 *
 * ## What was asked for, and what is deliberately NOT ported
 *
 * Paul, 2026-09-18: *"take the lens toggle and range bars into the reasoning
 * tab."* The range bars arrived first. This file covers the lens.
 *
 * ⛔ THE ANALYSIS TAB'S IMPLEMENTATION IS NOT WHAT CAME ACROSS, because it
 * shipped two P1s of one shape — *the subject of the claim is not the source of
 * the number* (`lensClaimHonesty.spec.tsx`, ROADMAP 2.237 / 2.238):
 *
 *  · the control said "Rank by outcome" while `sortOptionsForDisplay` took no
 *    lens argument, so the list under the claim was byte-identical to neutral —
 *    and the lens's own pick was hidden behind "Show all (1 more)";
 *  · the crown fell back to the comparative winner when the lens pick was null,
 *    i.e. crowned an option under a sentence saying the view had no data.
 *
 * So the QUESTION came across ("read this run cautiously or optimistically?")
 * and the mechanism did not. This lens moves the marker on each option's own
 * range and changes one sentence. **It does not reorder rows, crown an option,
 * alter a readout, or claim a unit.**
 *
 * ## The three properties, and why each needs its own test
 *
 *  1. **The legend names the percentile actually drawn.** This is the one that
 *     would otherwise rot: the legend used to be a constant reading "Dots show
 *     the mid-point", and a lens that moves the dot to p90 under that constant
 *     is the same-number-two-claims defect this section has already shipped once
 *     (a "< 1%" readout beside a 0px fill, ROADMAP 2.236). Asserted per arm, in
 *     both directions — the drawn coordinate AND the words.
 *  2. **Nothing else moves.** Captured as a full-section comparison across the
 *     three arms: row order, every readout, every bar width. This is the direct
 *     guard against re-importing 2.237 — a future edit that makes the lens
 *     re-rank REDs here rather than shipping a ranking claim.
 *  3. **No view, no control.** `rangeScale === null` (fewer than two rows carry
 *     a range) must render no arms at all — not disabled arms, not a default
 *     view. That is 2.238's general form.
 *
 * ## How these fixtures avoid proving nothing
 *
 * ⚠ EVERY STATE IS DRIVEN THROUGH THE REAL VIEW MODEL. A section object written
 * here would encode my model of the producer rather than the producer (trap 16's
 * inverse), and `outcomeRange` is derived — `typeof p10 === 'number' && typeof
 * p90 === 'number'` — so a hand-built row could pair a range with a shape
 * `buildOptionsComparison` would never emit.
 *
 * ⚠ EACH TEST PINS ITS OWN PRECONDITION. The absence test asserts the rows DO
 * carry outcome data before asserting the control is gone, so the absence is
 * provably the gate's doing and not the fixture's failure (trap 13b).
 *
 * ⚠ THE THREE OPTIONS' RANGES OVERLAP AND THEIR p50 ORDER DISAGREES WITH THEIR
 * p10 ORDER. That is what makes property 2 discriminating: on a fixture where
 * every arm implies the same order, a lens that secretly re-ranked would pass.
 *
 * ⚠ jsdom cannot prove visibility (trap 3). Nothing here claims the dot is
 * visible; it asserts the marked VALUE (`data-mark-at`) and the arm attribute.
 *
 * ⛔ AND ONE PROPERTY IS DELIBERATELY NOT ASSERTED HERE, rather than asserted
 * weakly. The marker's `left` is `clamp(0px, calc(N% - 3px), calc(100% - 6px))`
 * because `rangeScale`'s domain is DEFINED BY the smallest p10 and the largest
 * p90 — so on the cautious arm exactly one option marks at 0% and on the
 * optimistic arm exactly one marks at 100%, every run, by construction, and
 * `calc(0% - 3px)` would hang half of the 6px dot outside its own track.
 * **Measured in a real browser: 3px of overhang at each extreme, 0px clamped.**
 * jsdom's CSS parser may silently DROP a value it cannot parse, so an assertion
 * on `style.left` here could fail — or pass — for reasons that have nothing to
 * do with the code. A conditional assertion ("clamped OR empty") would be a
 * guard agreeing with itself. The browser measurement is the evidence; this
 * note is where it is recorded.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { OptionResult } from '../../types'
import { makeData, makeOption } from './analysisNewFixtures'

afterEach(() => cleanup())

const TESTID = 'analysis-new-options'
const ARMS = ['cautious', 'middle', 'optimistic'] as const
/**
 * ⚠ NAMED, because `it.each` over a `readonly` tuple widens its callback
 * parameter to `string` in some vitest typings — and a `string` key cannot index
 * the per-arm literals below under `noImplicitAny`. Annotating the parameter is
 * cheaper than discovering it in a gate.
 */
type Arm = (typeof ARMS)[number]

/**
 * Three analysed options whose ranges OVERLAP, and whose p10 order
 * (C, B, A) is the reverse of their p50 order (A, B, C).
 *
 * That disagreement is deliberate: it is what lets test 2 tell "the lens moved
 * only a dot" from "the lens quietly re-ranked", which a fixture with a
 * consistent order could not.
 */
function overlappingOptions(): OptionResult[] {
  return [
    makeOption({
      id: 'opt_a', label: 'Build in-house', winProbability: 0.5, nValidSamples: 10000,
      isRecommended: true, outcome: { mean: 60, p10: 30, p50: 60, p90: 100 },
    }),
    makeOption({
      id: 'opt_b', label: 'Buy a platform', winProbability: 0.3, nValidSamples: 10000,
      outcome: { mean: 50, p10: 20, p50: 50, p90: 110 },
    }),
    makeOption({
      id: 'opt_c', label: 'Stay as we are', winProbability: 0.2, nValidSamples: 10000,
      outcome: { mean: 40, p10: 10, p50: 40, p90: 120 },
    }),
  ]
}

/** The same three options with NO percentiles — the no-view state. */
function rangelessOptions(): OptionResult[] {
  return overlappingOptions().map((o) =>
    makeOption({ id: o.id, label: o.label, winProbability: o.winProbability, nValidSamples: 10000 }),
  )
}

/**
 * ⚠ THE SECTION RESTS CLOSED (`defaultOpen = false`), so a render that did not
 * open it would assert over an empty body and every absence case would pass for
 * the wrong reason. Opening is part of arranging the state, not part of the
 * behaviour under test.
 */
function renderFor(allOptions: OptionResult[]) {
  // ⚠ THE BUILDER TAKES AN INPUTS OBJECT, NOT THE DATA. I first passed
  // `makeData(...)` straight in; `buildAnalysisNewViewModel(inputs:
  // AnalysisNewViewModelInputs)` destructures `{ data, recommendations,
  // isStale, … }`, so `data` arrived undefined and the typecheck ratchet
  // caught it (TS2345). Shaped like the sibling specs, which is where the
  // correct call already lived.
  const vm = buildAnalysisNewViewModel({
    data: makeData({
      recommendation: {
        allOptions,
        recommendedOption: allOptions.find((o) => o.isRecommended) ?? null,
      },
    }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
  const utils = render(<OptionsComparison options={vm.optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
  // ⚠ V2 (24 Sep 2026): THE ARM CONTROL AND ITS LEGEND LEFT THE RESTING VIEW.
  // They sit behind the range info button beside the axis, so opening that
  // disclosure is now part of arranging the state, exactly as opening the
  // section is. Opened only where the button exists: on the rangeless run it is
  // absent by the same gate as the arms, and property 3 asserts that absence.
  const info = screen.queryByTestId(`${TESTID}-range-info`)
  if (info !== null) fireEvent.click(info)
  return { vm, ...utils }
}

/** Bind by IDENTITY, never by position. */
function rowIds(): (string | null)[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-option-id]')).map((e) =>
    e.getAttribute('data-option-id'),
  )
}

// ⚠ RE-BOUND TO `PanelFigure`'S GRAMMAR, DELIBERATELY. The marker used to be
// `-outcome-mid-<id>` — a name that describes p50, on an element the lens moves
// to p10 and p90. `PanelFigure` names its parts `-band` and `-marker`, which is
// what they are on every variant. The rename is the point of the component, so
// the spec follows it rather than pinning the old name.
const markOf = (id: string) => screen.getByTestId(`${TESTID}-outcome-range-${id}-marker`)
const arm = (a: Arm) => screen.getByTestId(`${TESTID}-range-lens-${a}`)

describe('the outcome lens', () => {
  /**
   * ⭐ PROPERTY 1 — the words and the geometry name the same percentile.
   *
   * Both halves are asserted from the SAME render, so a change that moves the
   * dot without the sentence (or the sentence without the dot) REDs. Asserting
   * only one of them is how the constant legend survived the dot becoming
   * movable in the first place.
   */
  it.each(ARMS)('the legend names the percentile the dot is drawn at — %s', (appetite: Arm) => {
    renderFor(overlappingOptions())
    fireEvent.click(arm(appetite))

    const expected: string = { cautious: 'p10', middle: 'p50', optimistic: 'p90' }[appetite]
    expect(
      screen.getByTestId(`${TESTID}-outcome-range-legend`).textContent,
      'the sentence must name the percentile, so a reader can check the drawing against the claim',
    ).toContain(expected)
    expect(screen.getByTestId(`${TESTID}-outcome-range-legend`).textContent).toBe(
      COPY.optionFigures.rangeLegend(appetite),
    )

    // The drawn coordinate, per option, from the option's OWN range.
    const wanted: Record<string, number> = {
      opt_a: ({ cautious: 30, middle: 60, optimistic: 100 } as Record<Arm, number>)[appetite],
      opt_b: ({ cautious: 20, middle: 50, optimistic: 110 } as Record<Arm, number>)[appetite],
      opt_c: ({ cautious: 10, middle: 40, optimistic: 120 } as Record<Arm, number>)[appetite],
    }
    for (const [id, value] of Object.entries(wanted)) {
      const mark = markOf(id)
      expect(mark.getAttribute('data-lens-arm'), `${id} marks the selected arm`).toBe(appetite)
      expect(Number(mark.getAttribute('data-mark-at')), `${id} marks its own ${expected}`).toBe(value)
    }
  })

  /**
   * ⭐⭐ PROPERTY 2 — THE LENS RE-RANKS NOTHING, AND THIS IS THE 2.237 GUARD.
   *
   * The Analysis tab's lens claimed a ranking it never performed. The remedy
   * here is the opposite commitment — it performs no ranking and claims none —
   * so what must be pinned is that everything except the marker is INVARIANT.
   *
   * ⚠ COMPARED AS RENDERED TEXT AND BAR GEOMETRY, not as a prop. A future lens
   * that re-sorted `options.rows` upstream would leave the props identical and
   * the DOM different, which is exactly the direction this guards.
   */
  it('changes nothing but the marker — row order, readouts and bar widths are invariant', () => {
    renderFor(overlappingOptions())

    const snapshot = () => ({
      order: rowIds(),
      text: screen
        .getByTestId(TESTID)
        .textContent?.replace(COPY.optionFigures.rangeLegend('cautious'), '')
        .replace(COPY.optionFigures.rangeLegend('middle'), '')
        .replace(COPY.optionFigures.rangeLegend('optimistic'), ''),
      widths: Array.from(
        screen.getByTestId(TESTID).querySelectorAll('[data-testid$="-bar"] > span'),
      ).map((e) => (e as HTMLElement).style.width),
    })

    fireEvent.click(arm('middle'))
    const middle = snapshot()

    // PRECONDITION: the fixture's p10 order really does disagree with its p50
    // order, so an undetected re-rank WOULD change the order we compare.
    expect(
      Number(markOf('opt_a').getAttribute('data-mark-at')),
      'PRECONDITION: opt_a leads on p50',
    ).toBeGreaterThan(Number(markOf('opt_c').getAttribute('data-mark-at')))

    fireEvent.click(arm('cautious'))
    expect(
      Number(markOf('opt_a').getAttribute('data-mark-at')),
      'PRECONDITION: the arm genuinely changed the marked quantity',
    ).toBe(30)
    expect(snapshot(), 'the cautious arm must not re-rank or restate anything').toEqual(middle)

    fireEvent.click(arm('optimistic'))
    expect(
      Number(markOf('opt_c').getAttribute('data-mark-at')),
      'PRECONDITION: opt_c leads on p90, reversing the p50 order',
    ).toBe(120)
    expect(snapshot(), 'the optimistic arm must not re-rank or restate anything').toEqual(middle)
  })

  /**
   * ⭐ PROPERTY 3 — NO VIEW, NO CONTROL. 2.238's general form: an affordance
   * live while the view it governs is unavailable.
   *
   * ⚠ THE PRECONDITION IS THE POINT. Without it this passes on any render that
   * happens to fail, including one where the whole section is missing.
   */
  it('renders no arms at all when no range can be drawn', () => {
    renderFor(rangelessOptions())

    expect(
      screen.getByTestId(TESTID),
      'PRECONDITION: the section itself still renders',
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId(`${TESTID}-outcome-range-legend`),
      'PRECONDITION: the range view is genuinely unavailable on this run',
    ).toBeNull()

    expect(screen.queryByTestId(`${TESTID}-range-lens`)).toBeNull()
    for (const a of ARMS) {
      expect(screen.queryByTestId(`${TESTID}-range-lens-${a}`), `no ${a} arm`).toBeNull()
    }
  })

  /**
   * ⭐ THE CONTROL IS OPERABLE AND ITS STATE IS SPOKEN. A radio group whose
   * selection is not exposed announces three unrelated buttons, and the panel
   * carries a measured finding that 7 of 17 targets were under WCAG 2.2 AA's
   * 24×24 — a new control arriving under it re-opens a defect this lane is
   * closing.
   */
  it('exposes the selected arm and meets the minimum target size', () => {
    renderFor(overlappingOptions())
    expect(screen.getByTestId(`${TESTID}-range-lens`)).toHaveAttribute('role', 'radiogroup')

    fireEvent.click(arm('optimistic'))
    expect(arm('optimistic')).toHaveAttribute('aria-checked', 'true')
    expect(arm('middle')).toHaveAttribute('aria-checked', 'false')
    expect(arm('cautious')).toHaveAttribute('aria-checked', 'false')

    // ⭐ V2 FIDELITY (gap 19): `min-h-[28px]`, not `[24px]` — the arm dropped
    // `action('quiet')` (which carried the 24px floor) for the prototype's
    // own `.lens>button{min-height:28px}` pill. 28 still clears WCAG 2.2 AA's
    // 24×24 floor this case exists to guard; only the exact token changed.
    for (const a of ARMS) {
      expect(arm(a).classList.contains('min-h-[28px]'), `${a} meets the 28px pill height`).toBe(true)
    }
  })

  /**
   * ⭐⭐ `role="radio"` IS A PROMISE, AND THIS IS WHAT PAYS IT.
   *
   * ARIA supplies the announcement and none of the behaviour. A radiogroup
   * without arrow traversal tells an assistive-tech user to press the arrow keys
   * and then ignores them — a control announcing an affordance it does not have,
   * which is the defect class this whole section exists to refuse.
   *
   * ⚠ ASSERTED ON THE MARKER, NOT ONLY ON `aria-checked`. A handler that set the
   * attribute without moving the dot would pass an attribute-only test while
   * leaving the keyboard user reading a stale drawing.
   */
  it('traverses with the arrow keys, wraps, and moves the dot with the selection', () => {
    renderFor(overlappingOptions())
    expect(arm('middle'), 'PRECONDITION: the middle arm starts selected').toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.keyDown(arm('middle'), { key: 'ArrowRight' })
    expect(arm('optimistic')).toHaveAttribute('aria-checked', 'true')
    expect(Number(markOf('opt_a').getAttribute('data-mark-at'))).toBe(100)

    // Wraps forward, as a native radio group does.
    fireEvent.keyDown(arm('optimistic'), { key: 'ArrowRight' })
    expect(arm('cautious')).toHaveAttribute('aria-checked', 'true')
    expect(Number(markOf('opt_a').getAttribute('data-mark-at'))).toBe(30)

    // ...and backward.
    fireEvent.keyDown(arm('cautious'), { key: 'ArrowLeft' })
    expect(arm('optimistic')).toHaveAttribute('aria-checked', 'true')

    // A key the group does not own is left alone for the page to handle.
    fireEvent.keyDown(arm('optimistic'), { key: 'Enter' })
    expect(arm('optimistic')).toHaveAttribute('aria-checked', 'true')
  })

  /**
   * ⭐ ONE TAB STOP. Three separately-tabbable arms would make a keyboard user
   * traverse the lens to reach the rows beneath it.
   */
  it('holds a single tab stop, on the selected arm', () => {
    renderFor(overlappingOptions())
    const stops = () => ARMS.map((a) => arm(a).getAttribute('tabindex'))
    expect(stops()).toEqual(['-1', '0', '-1'])

    fireEvent.click(arm('cautious'))
    expect(stops()).toEqual(['0', '-1', '-1'])
  })
})
