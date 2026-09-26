/**
 * ⭐⭐ THE REASONING AXIS PRINTS NO MODEL-SCALE NUMBERS — design audit #3 (26 Sep
 * 2026), contract v3.1 "no bare internal model scale"; ruling "omit, never
 * invent".
 *
 * SERVED (`853feeb7`, pricing starter, one Run, Reasoning tab): under "Goal
 * only: these figures compare the options on the goal alone." the tab printed
 * **-0.487 / -0.315 / -0.143 / 0.029**. Those are the four axis ticks (0.172
 * apart — the evenly-spaced `AXIS_TICK_FRACTIONS` across the shared p10..p90
 * domain of `results.option_comparison[].outcome`), not per-option figures. The
 * goal is "NRR above 110%", which the same payload places at
 * `goal_threshold: 0.8` on the model's 0–1 scale — so the ticks are the goal
 * node's internal model value, and a negative NRR is no reading at all.
 *
 * Fixture: the served domain ends (-0.487, 0.029) on the existing withheld-run
 * fixture; the per-option p10/p90 of that run were not captured (UNVERIFIED),
 * so only the domain the served ticks prove is used.
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
type Outcome = { mean: number; p10: number; p50: number; p90: number }

const SERVED_DOMAIN: Record<string, Outcome> = {
  opt_a: { mean: -0.3, p10: -0.487, p50: -0.3, p90: -0.1 },
  opt_b: { mean: -0.05, p10: -0.2, p50: -0.05, p90: 0.029 },
}
const SERVED_TICKS = ['-0.487', '-0.315', '-0.143', '0.029']

function withOutcomes(outcomes: Record<string, Outcome>): ResultsSectionDataReturn {
  const data = decisionWithLeaderWithheld()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      allOptions: data.recommendation.allOptions.map((o) => (outcomes[o.id] ? { ...o, outcome: outcomes[o.id] } : o)),
    },
  }
}

function renderOpen(data: ResultsSectionDataReturn) {
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<OptionsComparison options={vm.optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${T}-toggle`))
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the served "-0.487 / -0.315 / -0.143 / 0.029" axis', () => {
  it('prints no tick numbers on a domain inside the model’s ±1 band; the axis, its (i) and the bands stay', () => {
    renderOpen(withOutcomes(SERVED_DOMAIN))
    // POSITIVE CONTROL: the outcome lens IS drawn — the axis row and both bands exist.
    const axis = screen.getByTestId(`${T}-axis`)
    expect(within(axis).getByTestId(`${T}-range-info`)).toBeInTheDocument()
    expect(screen.getByTestId(`${T}-outcome-range-opt_a`)).toBeInTheDocument()
    expect(screen.getByTestId(`${T}-outcome-range-opt_b`)).toBeInTheDocument()
    // THE FIX: no tick row, and none of the served numbers anywhere in the section.
    expect(screen.queryByTestId(`${T}-axis-ticks`)).toBeNull()
    expect(screen.queryAllByTestId(/^analysis-new-options-axis-tick-\d$/)).toHaveLength(0)
    const text = document.body.textContent ?? ''
    for (const tick of SERVED_TICKS) expect(text, `served tick ${tick}`).not.toContain(tick)
  })

  it('CONTRAST — a domain on a real magnitude keeps its four ticks unchanged', () => {
    renderOpen(withOutcomes({
      opt_a: { mean: 40, p10: 10, p50: 40, p90: 70 },
      opt_b: { mean: 55, p10: 30, p50: 55, p90: 90 },
    }))
    const labels = screen.getAllByTestId(/^analysis-new-options-axis-tick-\d$/).map((e) => e.textContent)
    expect(labels).toEqual(['10', '36.7', '63.3', '90'])
  })
})
