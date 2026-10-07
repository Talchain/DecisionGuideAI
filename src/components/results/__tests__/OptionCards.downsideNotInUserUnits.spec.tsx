/**
 * B19-0 (DL, 7 Oct): the expert-mode tail figures are on the model's own scale until the goal band is anchored to the
 * user's units (`goalBandIsInUserUnits`, false on every run today; DL 5854887316 item 1). With the REAL switch, the card
 * withholds the figures and says the limit, by option identity. Contrast (figures shown when the switch is true):
 * `OptionCards.downsideUnits.spec.tsx`, which mocks the switch on.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import { goalBandIsInUserUnits } from '../analysisNew/goalBandUnits'
import { DOWNSIDE_NOT_IN_USER_UNITS_COPY } from '../utils/downsideCopy'

const option = (id: string, overrides: Partial<OptionResult> = {}): OptionResult => ({
  id, label: `Option ${id}`, expected: 50, outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
  p10: 20, p50: 50, p90: 80, isRecommended: id === 'a', winProbability: 0.6, goalProbability: 0.7, rank: 1,
  downside: { p05: 15320, cvar10: 9800, expectedRegret: 3 }, ...overrides,
})

describe('B19-0: tail figures are never printed as the user’s own units while the band is model-scale', () => {
  it('PREMISE: the live switch is off', () => {
    expect(goalBandIsInUserUnits()).toBe(false)
  })

  it('a £ goal: no figure, no unit, no "If it goes badly" numbers — the limit sentence instead, on that option', () => {
    render(<OptionCards options={[option('a'), option('b', { downside: undefined })]} winnerId="a" expertMode
      outcomeUnit="currency" outcomeUnitSymbol="£" isNormalised={false} />)
    const card = screen.getByTestId('option-downside-not-in-user-units-a')
    expect(card.textContent).toBe(DOWNSIDE_NOT_IN_USER_UNITS_COPY)
    expect(screen.queryByTestId('option-downside-a')).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/£15,320|15,320|£9,800|worst 1 in 20/)
    // control: an option with no tail keeps its own absence sentence, not this one
    expect(screen.queryByTestId('option-downside-not-in-user-units-b')).toBeNull()
    expect(screen.getByTestId('option-downside-unavailable-b')).toBeTruthy()
  })

  it('outside expert mode nothing about the tail renders (unchanged)', () => {
    render(<OptionCards options={[option('a')]} winnerId="a" outcomeUnit="currency" outcomeUnitSymbol="£" isNormalised={false} />)
    expect(screen.queryByTestId('option-downside-not-in-user-units-a')).toBeNull()
  })
})
