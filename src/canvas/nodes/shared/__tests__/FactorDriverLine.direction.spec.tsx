/**
 * Canvas option 3 follow-on (Paul, 20 Oct 2026: the driver bar "needs to more easily and efficiently communicate"): the
 * line carries the run's own direction as an arrow, and draws none where the run did not state one.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FactorDriverLine, DRIVER_DIRECTION_WORDS } from '../FactorDriverLine'

afterEach(() => cleanup())

const renderLine = (direction: 'positive' | 'negative' | null) =>
  render(<FactorDriverLine nodeId="fac_capacity" rank={{ rank: 1, setSize: 3 }} value={1} inSlot direction={direction} />)

describe('the driver line says which way the factor moves the outcome', () => {
  it('a positive direction draws the up arrow and says so in the accessible name', () => {
    renderLine('positive')
    expect(screen.getByTestId('factor-driver-line-direction').getAttribute('data-direction')).toBe('positive')
    expect(screen.getByTestId('factor-driver-line').getAttribute('aria-label')).toContain(DRIVER_DIRECTION_WORDS.positive)
  })

  it('CONTRAST: a negative direction draws the down arrow and its own words', () => {
    renderLine('negative')
    expect(screen.getByTestId('factor-driver-line-direction').getAttribute('data-direction')).toBe('negative')
    expect(screen.getByTestId('factor-driver-line').getAttribute('aria-label')).toContain(DRIVER_DIRECTION_WORDS.negative)
  })

  it('no stated direction draws no arrow and claims none', () => {
    renderLine(null)
    expect(screen.queryByTestId('factor-driver-line-direction')).toBeNull()
    const name = screen.getByTestId('factor-driver-line').getAttribute('aria-label') ?? ''
    expect(name).not.toContain(DRIVER_DIRECTION_WORDS.positive)
    expect(name).not.toContain(DRIVER_DIRECTION_WORDS.negative)
  })
})
