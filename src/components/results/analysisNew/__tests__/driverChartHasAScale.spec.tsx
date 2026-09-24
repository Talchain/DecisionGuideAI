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
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'driver-chart'

const ROWS = [
  { id: 'f1', label: 'Hiring market tightness', fraction: 1, direction: 'negative' as const, targetId: 'f1' },
  { id: 'f2', label: 'Team coordination overhead', fraction: 0.79, direction: 'negative' as const, targetId: 'f2' },
  { id: 'f3', label: 'Codebase quality', fraction: 0.6, direction: 'positive' as const, targetId: 'f3' },
]

function renderChart(rows = ROWS, notes: { scaleNote?: string | null; topRowNote?: string | null } = {}) {
  cleanup()
  render(
    <DriverInfluenceChart
      rows={rows as never}
      onFocusTarget={vi.fn()}
      onCommitOutcome={vi.fn()}
      scaleNote={notes.scaleNote}
      topRowNote={notes.topRowNote}
      testId={TID}
    />,
  )
}

const SCALE_NOTE = COPY.coverage.setRelativeInfluence
const TOP_ROW_NOTE = COPY.coverage.guaranteedHundredClause(100)!

describe('the driver chart states its scale', () => {
  /*
   * ⭐⭐ DESIGN TWEAK C (24 Sep 2026): ONE AXIS LEGEND, ONE CAPTION.
   *
   * The product owner read the served chart as "a mess": above the bars it
   * printed the arrows legend ("← Lowers the goal / Raises the goal →"), a
   * SECOND legend ("lowers most / no effect / raises most"), the
   * relative-influence sentence, and under the first bar "The top driver always
   * shows 100%." Two axis legends and three explanations for two bars.
   *
   * What each piece answered, and where it lives now:
   *   · WHICH SIDE MEANS WHAT — the arrows legend. Kept, alone.
   *   · WHAT THE OUTER EDGE MEANS — "relative to the strongest factor in this
   *     run". That was the second legend's "lowers most / raises most", and the
   *     caption already says it in words, so the second legend was a restatement.
   *   · WHAT THE CENTRE MEANS — the zero line between "lowers" and "raises".
   *     Pinned below: it must still be drawn and still be distinguishable.
   *   · THE TOP BAR'S FIGURE — the 100% clause, now in the same caption.
   */
  it('names what the outer edge means, in words, in ONE caption under the bars', () => {
    renderChart(ROWS, { scaleNote: SCALE_NOTE, topRowNote: TOP_ROW_NOTE })
    const caption = screen.getByTestId(`${TID}-caption`)
    // ⚠ VISIBLE, not merely present. `toHaveTextContent` reads hidden nodes, so
    // the first cut of this test passed against a scale carrying `hidden` —
    // measured, a surviving mutant. A scale a reader cannot see is the defect
    // this file exists to close, not a lesser version of it.
    expect(caption).toBeVisible()
    expect(caption).toHaveTextContent(SCALE_NOTE)
    // The top-row clause is IN the caption, beside the scale sentence it
    // qualifies, and the caption is said once.
    expect(caption).toHaveTextContent(TOP_ROW_NOTE)
    expect(screen.getAllByTestId(`${TID}-caption`)).toHaveLength(1)
    expect(screen.getAllByTestId(`${TID}-scale-note`)).toHaveLength(1)
    expect(caption.contains(screen.getByTestId(`${TID}-top-row-note`))).toBe(true)
  })

  it('RED-FIRST (tweak C): exactly ONE axis legend — the arrows line — and no second scale legend', () => {
    renderChart(ROWS, { scaleNote: SCALE_NOTE, topRowNote: TOP_ROW_NOTE })
    expect(screen.getAllByTestId(`${TID}-axis`), 'one arrows legend').toHaveLength(1)
    expect(
      screen.queryByTestId(`${TID}-scale`),
      'the second legend ("lowers most / no effect / raises most") restated the arrows line',
    ).toBeNull()
    const chart = screen.getByTestId(TID)
    // Bound to the retired constants, not re-typed words, so a rewording of
    // them cannot make this absence pass vacuously.
    expect(chart.textContent).not.toContain(COPY.driverChart.axisEdgeLowers)
    expect(chart.textContent).not.toContain(COPY.driverChart.axisEdgeRaises)
    // CONTROL: the probe can see the legend that stays.
    expect(screen.getByTestId(`${TID}-axis`)).toHaveTextContent(COPY.driverChart.lowers)
    expect(screen.getByTestId(`${TID}-axis`)).toHaveTextContent(COPY.driverChart.raises)
  })

  it('RED-FIRST (tweak C): the top-row clause is in the caption, not under the first bar', () => {
    renderChart(ROWS, { scaleNote: SCALE_NOTE, topRowNote: TOP_ROW_NOTE })
    const note = screen.getByTestId(`${TID}-top-row-note`)
    expect(note.closest('li'), 'the clause must not sit inside a row').toBeNull()
    // The caption follows the bars: the list comes first in document order.
    const list = screen.getByTestId(TID).querySelector('ul')!
    expect(
      list.compareDocumentPosition(screen.getByTestId(`${TID}-caption`)) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the caption sits under the bars',
    ).toBeTruthy()
  })

  it('no notes, no caption — a caption with nothing to say renders no element', () => {
    renderChart(ROWS)
    expect(screen.queryByTestId(`${TID}-caption`)).toBeNull()
    // CONTRAST in the same file: the chart itself still renders.
    expect(screen.getAllByTestId(`${TID}-row`)).toHaveLength(ROWS.length)
  })

  it('DISCRIMINATOR: the axis legend is not a share of the outcome', () => {
    // The load-bearing one. A percentage axis is the easiest "improvement" to
    // reach for here and it is the one claim the basis does not license, so it
    // is asserted against rather than merely left undone.
    renderChart(ROWS, { scaleNote: SCALE_NOTE, topRowNote: TOP_ROW_NOTE })
    const text = screen.getByTestId(`${TID}-axis`).textContent ?? ''
    expect(text, `the axis must not assert a percentage: "${text}"`).not.toMatch(/\d\s*%/)
    expect(text).not.toMatch(/share|of the outcome|total/i)
    // And the caption DENIES the share reading rather than asserting one.
    expect(screen.getByTestId(`${TID}-scale-note`).textContent).toMatch(/not a share of the outcome/)
  })

  it('the axis legend and caption sit with the chart, not inside a row', () => {
    // They describe the whole chart. Rendered per row they would repeat N times
    // and read as a property of one driver.
    renderChart(ROWS, { scaleNote: SCALE_NOTE, topRowNote: TOP_ROW_NOTE })
    expect(screen.getByTestId(`${TID}-axis`).closest('li'), 'the legend must not be inside a row').toBeNull()
    expect(screen.getByTestId(`${TID}-caption`).closest('li'), 'the caption must not be inside a row').toBeNull()
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
