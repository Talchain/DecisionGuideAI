/**
 * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): THE AXIS CARRIES ITS OWN
 * SCALE, so a withheld run's ranges can be READ, not just seen.
 *
 * ── THE GAP, MEASURED ─────────────────────────────────────────────────────
 * Paul's manual test of the provisional PA-hire run: every row drew a range
 * band with no numbers anywhere near it — no per-option figure (a deliberate
 * truth rule, see below) AND no axis. A reader could see that the bands
 * differed in width and position but had nothing to read them AGAINST.
 * `OptionsComparison.tsx`'s axis row carried only the (i) info button; this
 * file pins the fix — four tick labels, spread across the shared domain the
 * bands are already positioned on.
 *
 * ── ⛔ WHAT THIS DELIBERATELY DOES NOT ADD ──────────────────────────────
 * No per-option point figure ("+12%" beside the name). `outcomeRange` carries
 * no unit (`PanelFigure.tsx:51-56` rule 3, `OptionsComparison.tsx`'s own
 * range-band note, `analysisNewTypes.ts:640-644`'s captured real run whose
 * values are -0.163/0.027/0.211 — not percentages). Printing a fabricated "%"
 * beside a name would be exactly the invented unit those three sites refuse.
 * The case below pins the negative half of the same change: the axis reads,
 * the row still does not print a point figure.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { OptionsComparison } from '../sections/OptionsComparison'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const T = 'analysis-new-options'

/** Same shape `theWithheldRunShowsItsFigures.spec.tsx` and
 * `designChartCommitment.spec.tsx` use: real p10/p50/p90s, domain [10, 90]. */
const RANGES: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {
  opt_a: { mean: 40, p10: 10, p50: 40, p90: 70 },
  opt_b: { mean: 55, p10: 30, p50: 55, p90: 90 },
}
const withRanges = (data: ResultsSectionDataReturn): ResultsSectionDataReturn => ({
  ...data,
  recommendation: {
    ...data.recommendation,
    allOptions: data.recommendation.allOptions.map((o) =>
      RANGES[o.id] ? { ...o, outcome: RANGES[o.id] } : o,
    ),
  },
})

function vmFor(data: ResultsSectionDataReturn) {
  return buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
}

/** `OptionsComparison` mounted standalone (not `bare`) rests CLOSED behind
 * `SectionShell`; open it before reading the body, as `designChartCommitment.
 * spec.tsx` and `theComparisonSaysWhyItCannotCompare.spec.tsx` already do. */
function renderOpen(data: ResultsSectionDataReturn) {
  render(<OptionsComparison options={vmFor(data).optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${T}-toggle`))
}

function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the axis row reads the ranges it sits under', () => {
  it('PRECONDITION — the withheld fixture with ranges really does draw the outcome lens', () => {
    const vm = vmFor(withRanges(decisionWithLeaderWithheld()))
    expect(vm.atAGlance.headline, 'withheld run must show no reading').toBeNull()
    expect(vm.optionsComparison.rows.filter((r) => r.kind === 'analysed' && r.outcomeRange !== null).length).toBe(2)
  })

  it('draws four tick labels, spread across the shared domain, with no unit symbol', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))

    const ticks = screen.getByTestId(`${T}-axis-ticks`)
    const labels = screen.getAllByTestId(/^analysis-new-options-axis-tick-\d$/).map((e) => e.textContent)

    // Domain is [10, 90] (opt_a p10=10 .. opt_b p90=90): four evenly-spaced
    // ticks land on 10, 36.67, 63.33, 90 — the SCALE's own values, not the
    // prototype's fixed 0/10/20/30 (this run's data is not a percentage).
    expect(labels).toEqual(['10', '36.67', '63.33', '90'])
    // ⛔ NO FABRICATED UNIT — the whole point of using the scale's own values.
    for (const l of labels) {
      expect(l, 'no % or other unit symbol may be invented').not.toMatch(/[%$£€]/)
    }
    expect(ticks).toBeInTheDocument()
  })

  it('the ticks and the info button share the SAME axis element (FIRST-1 stays merged)', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))
    const axis = screen.getByTestId(`${T}-axis`)
    const ticks = screen.getByTestId(`${T}-axis-ticks`)
    const infoButton = screen.getByTestId(`${T}-range-info`)
    expect(axis).toContainElement(ticks)
    expect(axis).toContainElement(infoButton)
  })

  it('⛔ still prints no per-option point figure — the range stays UNIT-LESS', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))

    // The band and marker are drawn (the range itself)...
    expect(within(row('opt_a')).getByTestId(`${T}-outcome-range-opt_a-band`)).toBeInTheDocument()
    // ...but nowhere in either row does a number-with-sign-or-percent appear,
    // which is what a fabricated modelled-outcome readout would look like.
    for (const id of ['opt_a', 'opt_b']) {
      const text = row(id).textContent ?? ''
      expect(text, `row ${id} must not print a point figure with no known unit`).not.toMatch(/[+-]?\d+(\.\d+)?%/)
    }
  })

  it('no ticks when the axis itself does not show (no range to read)', () => {
    renderOpen(decisionWithLeaderWithheld())
    // Non-vacuous: the section really did open (rows are visible), so an
    // absent axis here is a real gate, not an unopened region.
    expect(screen.getAllByTestId(`${T}-row`).length).toBeGreaterThan(0)
    expect(screen.queryByTestId(`${T}-axis`)).toBeNull()
    expect(screen.queryByTestId(`${T}-axis-ticks`)).toBeNull()
  })
})
