/**
 * A section holding exactly one item opens itself; a section holding several
 * still does not.
 *
 * ⚠ THE PAIR IS THE CLAIM. Asserting only that one item opens would pass on a
 * component that opens EVERYTHING — which would spend the default-closed rule
 * that exists because this panel measured 1,584px against a 769px viewport.
 * The second case is what binds the change to the count.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { AnalysisNewSection } from '../sections/AnalysisNewSection'
import type { AnalysisNewFinding } from '../analysisNewTypes'

afterEach(cleanup)

/**
 * ⚠ `inspect: []` IS LOAD-BEARING AND THIS FIXTURE USED TO OMIT IT.
 * `DisclosureRow` reads `finding.inspect.length`, and its level-2 region reads
 * it again — so a fixture without the field could render the row CLOSED and
 * threw the moment the row opened. That went unnoticed for as long as nothing
 * asserted the open state, which is exactly the gap this spec now closes.
 * The sibling `DisclosureRow.spec.tsx` fixtures have always carried it.
 */
const finding = (id: string): AnalysisNewFinding =>
  ({
    id,
    title: `Finding ${id}`,
    detail: `Detail ${id}`,
    marks: [],
    inspect: [],
  }) as unknown as AnalysisNewFinding

const draw = (n: number) =>
  render(
    <AnalysisNewSection
      title="Drivers and dynamics"
      findings={Array.from({ length: n }, (_, i) => finding(`f${i}`))}
      testId="sec"
    />,
  )

const isOpen = () => screen.getByTestId('sec').getAttribute('data-section-open')

describe('disclosure earns its keep by hiding bulk', () => {
  it('one item opens on mount — the row hides nothing worth hiding', () => {
    draw(1)
    expect(isOpen()).toBe('true')
    // ⚠ `#sec-list` is an id, not a testid — the region the disclosure controls.
    expect(document.getElementById('sec-list')).not.toBeNull()
  })

  /**
   * ⭐⭐ AND THE ROW OPENS TOO — the half this spec ASSUMED and never asserted.
   *
   * The comment above says "the row hides nothing worth hiding". That was
   * aspirational: the section opened and revealed A SECOND CLOSED DOOR, so the
   * reader spent two clicks on one sentence. Measured on deployed staging —
   * "Key insights 1" open, its single insight collapsed beneath it. That is the
   * piecemeal pattern exactly: a click that buys one line.
   *
   * The same `findings.length === 1` governs both, so they can no longer
   * disagree.
   */
  it('one item opens ITS ROW too — one finding, one door, no second click', () => {
    draw(1)
    expect(isOpen()).toBe('true')
    expect(
      screen.queryByTestId('sec-detail'),
      'the section opened and the row stayed shut — two doors for one finding',
    ).not.toBeNull()
    expect(screen.getByTestId('sec-row-toggle').getAttribute('aria-expanded')).toBe('true')
  })

  /**
   * The discriminating twin, at ROW level. Without it, opening every row would
   * satisfy the case above while spending the height budget the section's own
   * default-closed rule exists to protect.
   */
  it('with two items the rows stay shut EVEN ONCE THE SECTION IS OPENED', () => {
    draw(2)
    // ⚠ The section is closed at two findings, so no row exists to assert on
    // yet — asserting here would pass on an empty query and prove nothing.
    // Open it by hand: that is what binds the ROW default to the COUNT rather
    // than to the section's own open state, which is the thing that could
    // drift.
    fireEvent.click(screen.getByTestId('sec-toggle'))
    const toggles = screen.getAllByTestId('sec-row-toggle')
    expect(toggles.length).toBe(2)
    for (const t of toggles) {
      expect(t.getAttribute('aria-expanded')).toBe('false')
    }
    expect(screen.queryByTestId('sec-detail')).toBeNull()
  })

  /** The discriminating half: it must NOT be "open everything". */
  it('two items stay closed', () => {
    draw(2)
    expect(isOpen()).toBe('false')
    expect(document.getElementById('sec-list')).toBeNull()
  })

  it('five items stay closed', () => {
    draw(5)
    expect(isOpen()).toBe('false')
  })

  /**
   * ⚠ ZERO IS NOT ONE. An empty section with no message renders nothing at all;
   * with a message it renders its sentence. Neither is the single-item case,
   * and opening on `length === 1` must not accidentally cover them.
   */
  it('an empty section with a sentence stays closed', () => {
    render(
      <AnalysisNewSection
        title="Drivers and dynamics"
        findings={[]}
        emptyMessage="This run returned no drivers."
        testId="sec"
      />,
    )
    expect(isOpen()).toBe('false')
  })
})
