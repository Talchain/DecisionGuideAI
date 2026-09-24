/**
 * ⭐⭐ THE SECTION NAMED FOR THE QUESTION FINALLY SHOWS THE NUMBER THAT ANSWERS IT.
 *
 * ── WHAT WAS THERE ─────────────────────────────────────────────────────────
 * "What would change your mind" rendered one template with two slots — *If "X"
 * changes significantly, "Y" could become the better choice* — three times, with
 * the same "Y" in all three. Roughly two-thirds of the visible text identical,
 * the difference mid-string, no magnitude, no ordering, no visual.
 *
 * The producer sends `switch_probability`: *"P(flipping this edge switches the
 * recommended option)"*. It was already read in `useResultsSectionData` twenty
 * lines above the fragile-edge row — into `fragileEdgesMap`, for the FACTOR
 * rows — and never reached the row this section renders. The word
 * "significantly" was standing in for a number sitting one map away.
 *
 * ⭐ IT IS A PROBABILITY, WHICH IS WHY THIS COULD SHIP NOW. No unit, no scale
 * conversion: the same 0-1 track the option rows use is already the correct
 * picture of it. The tipping-point threshold — in the source factor's own units,
 * on a model whose goal may carry no unit at all — is a different problem and is
 * deliberately not in this change.
 *
 * ── THE PAIR THAT MATTERS ──────────────────────────────────────────────────
 * A MEASURED ZERO and an ABSENT MEASUREMENT must not look the same, and the
 * contract says so in its own words: absence means NOT COMPUTED, `0` is a
 * genuine measurement ("flipping this edge changes nothing"), and a consumer
 * reading absence as `0` *"fabricates the safest possible verdict"*. So:
 *
 *   · measured 0 -> "0%" and an EMPTY track. True, and drawn.
 *   · absent     -> NO number and NO track at all.
 *
 * A guard asserting only "the bar renders" would pass on a build that coalesced
 * absence to zero — which is the defect, wearing the fix's clothes.
 *
 * ⚠ BOUND BY TESTID, and the fixtures keep the flip values distinct from every
 * other number in the row so a test cannot pass by reading the wrong field.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'

/**
 * V2 RE-POINT (Reasoning V2, 24 Sep 2026). "What would change your mind" moved
 * into the "Challenge the thinking" zone and is opened here BY ITS TESTID.
 * `openAllSections` cannot converge on the V2 tab: About's detail rows are a
 * one-at-a-time accordion, so opening every closed toggle re-closes a sibling.
 * The flip readout and bar sit at row level 1, so opening the section is all
 * these assertions need; it is asserted OPEN so an absence case cannot pass on
 * an unmounted region.
 */
const openSensitivity = () => {
  const toggle = screen.getByTestId('analysis-new-sensitivity-toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(
    screen.getByTestId('analysis-new-sensitivity-toggle'),
    'the section must be open before it is read',
  ).toHaveAttribute('aria-expanded', 'true')
}

const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="flip_risk_bar"
    />,
  )
  // `SectionShell` unmounts a closed region, and an unmounted section and a
  // withheld figure produce the identical empty result.
  openSensitivity()
  return r
}

/**
 * ⚠ THE PRODUCER'S ORDER IS DELIBERATELY WRONG-WAY-ROUND so the ranking
 * assertion cannot pass by accident: the rows arrive ascending and must render
 * descending.
 */
const withFlips = (probs: ReadonlyArray<number | undefined>): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  const rows = data.confidence.uncertainties.filter((u) => u.code === 'SENSITIVE_ASSUMPTION')
  expect(rows.length, 'precondition: the fixture emits fragile-edge rows').toBeGreaterThanOrEqual(probs.length)
  let i = 0
  return {
    ...data,
    confidence: {
      ...data.confidence,
      uncertainties: data.confidence.uncertainties.map((u) => {
        if (u.code !== 'SENSITIVE_ASSUMPTION') return u
        const p = probs[i++]
        const { switchProbability: _drop, ...rest } = u as typeof u & { switchProbability?: number }
        return p === undefined ? rest : { ...rest, switchProbability: p }
      }),
    },
  } as ResultsSectionDataReturn
}

const S = 'analysis-new-sensitivity'
const readouts = () => screen.queryAllByTestId(`${S}-flip`).map((e) => e.textContent?.trim())
const widths = () =>
  screen
    .queryAllByTestId(`${S}-flip-bar`)
    .map((t) => (t.firstElementChild as HTMLElement | null)?.style.width)

afterEach(cleanup)

describe('the flip risk gets a bar', () => {
  it('⭐ MEASURED — each row shows its own number and a bar of that width', () => {
    renderBody(withFlips([0.72, 0.54, 0.38]))
    expect(readouts()).toEqual(['72%', '54%', '38%'])
    expect(widths()).toEqual(['72%', '54%', '38%'])
    /**
     * ⚠ ONE CAPTION, NOT THREE LABELS — and witnessing the build is what
     * changed this assertion. On `92b5e60e` the per-row label printed three
     * times in a three-row section; it states one fact about every bar, so it
     * moved to the section's `caveat` slot and is asserted there.
     */
    expect(screen.queryAllByTestId(`${S}-flip-label`), 'the per-row label is gone').toHaveLength(0)
    // ⚠ THE CONDITION IS THE ASSERTION. The bar draws `switch_probability`,
    // which ISL declares as the proportion of samples where the alternative
    // wins WHEN THE EDGE IS WEAK. A caption that states an unconditional rate
    // describes a quantity the producer never sent, so this pins the clause
    // that carries the condition rather than the whole sentence.
    expect(screen.getByTestId(`${S}-caveat`).textContent).toContain('in the runs where that assumption came out weak')
  })

  it('⭐ RANKED by the measured risk — the producer sends these ascending', () => {
    renderBody(withFlips([0.11, 0.93, 0.47]))
    expect(
      readouts(),
      'the producer derives severity from this same number, so ordering by it cannot disagree with its class',
    ).toEqual(['93%', '47%', '11%'])
  })

  it('⛔ ABSENT — no number and NO track, because absence means not computed', () => {
    renderBody(withFlips([undefined, undefined, undefined]))
    expect(readouts()).toEqual([])
    expect(
      screen.queryAllByTestId(`${S}-flip-bar`),
      'an empty track would read as a measured "this changes nothing"',
    ).toHaveLength(0)
    expect(
      screen.queryByTestId(`${S}-caveat`),
      'a caption describing bars must not render where no row drew one',
    ).toBeNull()
  })

  it('⛔ THE DISCRIMINATING TWIN — a MEASURED zero draws, an absent one does not', () => {
    renderBody(withFlips([0.5, 0, undefined]))
    expect(
      readouts(),
      'a measured zero is a finding — "flipping this changes nothing" — and must be said',
    ).toEqual(['50%', '0%'])
    expect(widths(), 'and its track is empty, which is what zero looks like').toEqual(['50%', '0%'])
  })

  it('⛔ UNMEASURED ROWS SIT AFTER MEASURED ONES — they are not "least risky"', () => {
    renderBody(withFlips([undefined, 0.2, 0.8]))
    expect(readouts()).toEqual(['80%', '20%'])
    // Three rows render; only two carry a measurement.
    expect(screen.getAllByTestId(`${S}-row`).length).toBeGreaterThanOrEqual(3)
  })

  it('⭐ the readout is floored — a measured tiny risk is never printed as "0%"', () => {
    /**
     * ⚠ `< 1%`, NOT `<0.01%`, AND THE DIFFERENCE IS HONEST. The shared
     * formatter's resolution floor is `1 / nSamples` when a sample count is
     * available; a fragile edge carries none, so it takes the fallback arm and
     * its floor is 1%. Claiming `<0.01%` here would assert a resolution this
     * row cannot support — my first expectation did exactly that and this test
     * caught it.
     *
     * What matters is the direction: a measured non-zero never prints "0%",
     * which is the falsehood `formatPercent.ts` exists to stop.
     */
    renderBody(withFlips([0.00001, 0.5, undefined]))
    expect(
      readouts(),
      'the shared probability formatter, not a local Math.round',
    ).toEqual(['50%', '< 1%'])
  })
})
