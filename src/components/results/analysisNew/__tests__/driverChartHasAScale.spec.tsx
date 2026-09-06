/**
 * The diverging driver chart states its scale, and its zero line is legible.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * The chart named its two directions — "← Lowers the goal | Raises the goal →" —
 * and nothing else. A bar's length and position carried the magnitude, but no
 * reference point was stated, so neither was readable: the outer edge meant
 * nothing, and the centre line was 1px of `bg-panel-border`, the same token
 * every other rule on the panel uses.
 *
 * ⚠ THE ZERO LINE WAS ALREADY THERE. I twice reported it as absent. It was
 * present and invisible, which is a different defect with a different fix, and
 * the distinction matters: adding a second line would have been wrong.
 *
 * ── WHY THE SCALE IS NOT A PERCENTAGE, AND WHY THAT IS PINNED ──────────────
 * The bars are scaled to the STRONGEST DRIVER IN THIS RUN
 * (`buildAnalysisNewViewModel.ts:558/565`), never to a sum. The builder's own
 * comment states the reason: scaling to a sum would render each bar as a share
 * of the outcome, "a claim neither basis licenses". So a 0–100% axis would be
 * exactly that unlicensed claim wearing the clothes of a helpful courtesy, and
 * the test below REDs if one is ever introduced.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'

const TID = 'driver-chart'

const ROWS = [
  { id: 'f1', label: 'Hiring market tightness', fraction: 1, direction: 'negative' as const, targetId: 'f1' },
  { id: 'f2', label: 'Team coordination overhead', fraction: 0.79, direction: 'negative' as const, targetId: 'f2' },
  { id: 'f3', label: 'Codebase quality', fraction: 0.6, direction: 'positive' as const, targetId: 'f3' },
]

function renderChart(rows = ROWS) {
  cleanup()
  render(
    <DriverInfluenceChart
      rows={rows as never}
      onFocusTarget={vi.fn()}
      onCommitOutcome={vi.fn()}
      testId={TID}
    />,
  )
}

describe('the driver chart states its scale', () => {
  it('names what the outer edge and the centre mean', () => {
    renderChart()
    const scale = screen.getByTestId(`${TID}-scale`)
    // ⚠ VISIBLE, not merely present. `toHaveTextContent` reads hidden nodes, so
    // the first cut of this test passed against a scale carrying `hidden` —
    // measured, a surviving mutant. A scale a reader cannot see is the defect
    // this file exists to close, not a lesser version of it.
    expect(scale).toBeVisible()
    // Both ends AND the centre — a chart that labels only its extremes still
    // leaves the reference point unstated, which is the defect.
    expect(scale).toHaveTextContent('strongest this run')
    expect(scale).toHaveTextContent('no effect')
  })

  it('DISCRIMINATOR: the scale is not a share of the outcome', () => {
    // The load-bearing one. A percentage axis is the easiest "improvement" to
    // reach for here and it is the one claim the basis does not license, so it
    // is asserted against rather than merely left undone.
    renderChart()
    const text = screen.getByTestId(`${TID}-scale`).textContent ?? ''
    expect(text, `the scale must not assert a percentage: "${text}"`).not.toMatch(/\d\s*%/)
    expect(text).not.toMatch(/share|of the outcome|total/i)
  })

  it('the scale sits with the direction legend, not inside a row', () => {
    // It describes the whole chart. Rendered per row it would repeat N times
    // and read as a property of one driver.
    renderChart()
    const scale = screen.getByTestId(`${TID}-scale`)
    expect(screen.getAllByTestId(`${TID}-scale`)).toHaveLength(1)
    expect(scale.closest('li'), 'the scale must not be inside a row').toBeNull()
  })

  it('the zero line is distinguishable from ordinary panel furniture', () => {
    // It was `bg-panel-border` — the same token as every rule on the panel — so
    // the reference point the whole chart depends on read as background. This
    // pins that it is NOT that token; it does not pin a particular colour,
    // because the property is "distinguishable", not "this hex".
    renderChart()
    // ⚠ `getAllByTestId(...)[0]`: `-bar` is emitted PER ROW, so `getByTestId`
    // throws on the multiple match. Caught by running it — the first cut of this
    // spec failed on its own harness, not on the property.
    const divider = screen.getAllByTestId(`${TID}-bar`)[0]!.querySelector('span.w-px')
    expect(divider, 'the chart must draw a zero line').not.toBeNull()
    expect(
      divider!.className,
      'the zero line must not use the generic border token',
    ).not.toMatch(/bg-panel-border/)
  })

  it('CONTROL: the probe can see the zero line at all', () => {
    // Without this, the assertion above could pass by finding nothing and
    // reading `null.className` as absence of the token. It cannot — the
    // not-null assertion runs first — but the control makes the detector's
    // sensitivity explicit rather than inferred.
    renderChart()
    const dividers = screen.getAllByTestId(`${TID}-bar`)[0]!.querySelectorAll('span.w-px')
    expect(dividers.length).toBeGreaterThan(0)
  })
})
