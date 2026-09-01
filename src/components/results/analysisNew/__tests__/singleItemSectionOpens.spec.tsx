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
import { cleanup, render, screen } from '@testing-library/react'
import { AnalysisNewSection } from '../sections/AnalysisNewSection'
import type { AnalysisNewFinding } from '../analysisNewTypes'

afterEach(cleanup)

const finding = (id: string): AnalysisNewFinding =>
  ({ id, title: `Finding ${id}`, detail: `Detail ${id}`, marks: [] }) as unknown as AnalysisNewFinding

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
