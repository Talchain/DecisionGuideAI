/**
 * OptionCards display-honesty tests.
 *
 * Covers:
 *   A. no win share at any sample resolution (#2747 re-scope 2, DL ruling (A): the
 *      card's former <0.1% / >99.9% / N-scaled share readout and fill bar are gone)
 *   C. high-variance leading-option qualification (renders only when the
 *      leading option's outcome.p10 < 0)
 *
 * Banned wording check ensures the new copy never introduces "winner",
 * "winning", "recommended", or "recommendation" — UI uses "leading option".
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-a',
    label: 'Option A',
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    p10: 20,
    p50: 50,
    p90: 80,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.7,
    rank: 1,
    ...overrides,
  }
}

// #2747 re-scope 2 (U0, DL ruling (A)): the card shows no win share in C, so each sample-resolution row now pins, by
// identity, that no win readout (`win-pct-<id>`), no share figure and no share fill bar is drawn at that resolution.
function expectNoWinShare(id: string, printed: string[]) {
  expect(screen.queryByTestId(`win-pct-${id}`)).not.toBeInTheDocument()
  const card = screen.getByTestId(`option-card-${id}`)
  for (const figure of printed) expect(card.textContent).not.toContain(figure)
  expect(card.querySelector('[title^="Supported in"]')).toBeNull()
}

describe('OptionCards — display-honesty (A) no win share at any sample resolution', () => {
  it('an exact 0 winProbability at n_valid_samples=1000 prints no win share (no <0.1%)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.65, nValidSamples: 1000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 1000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expectNoWinShare('b', ['<0.1%'])
  })

  it('an exact 1 winProbability at n_valid_samples=1000 prints no win share (no >99.9%)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 1, nValidSamples: 1000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 1000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expectNoWinShare('a', ['>99.9%'])
  })

  it('at n_valid_samples=10000 neither bound is printed (no <0.01%, no >99.99%)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 1, nValidSamples: 10000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 10000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expectNoWinShare('b', ['<0.01%'])
    expectNoWinShare('a', ['>99.99%'])
  })

  it('with nValidSamples absent, no legacy share figure is printed (no 0%, no 50%)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0, nValidSamples: undefined }),
      makeOption({ id: 'b', label: 'B', winProbability: 0.5, nValidSamples: undefined, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expectNoWinShare('a', ['0%'])
    expectNoWinShare('b', ['50%'])
  })

  it('a mid-range winProbability with a sample count present prints no share figure (no 58%)', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.58, nValidSamples: 1000 }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expectNoWinShare('a', ['58%'])
  })
})

describe('OptionCards — display-honesty (C) leading-option downside qualification', () => {
  it('renders the qualification sentence only when leadingOptionDownsideFlag is true and option is the leader', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.7, outcome: { mean: 10, p10: -50, p50: 10, p90: 80 } }),
    ]
    render(
      <OptionCards
        options={options}
        winnerId="a"
        leadingOptionDownsideFlag={true}
      />,
    )

    const note = screen.getByTestId('leading-option-downside-a')
    expect(note).toBeInTheDocument()
    expect(note.textContent).toContain(
      'In this model, the most runs supported this option, but the lower range of its simulated outcomes includes meaningful downside.',
    )
  })

  it('does not render the qualification sentence when the flag is false', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.7, outcome: { mean: 50, p10: 5, p50: 50, p90: 95 } }),
    ]
    render(
      <OptionCards
        options={options}
        winnerId="a"
        leadingOptionDownsideFlag={false}
      />,
    )

    expect(screen.queryByTestId('leading-option-downside-a')).not.toBeInTheDocument()
  })

  it('does not render the qualification sentence when the flag is undefined', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.7 }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expect(screen.queryByTestId('leading-option-downside-a')).not.toBeInTheDocument()
  })

  it('does not render the qualification sentence on a non-leading option even when the flag is true', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.7 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0.3, isRecommended: false }),
    ]
    render(
      <OptionCards
        options={options}
        winnerId="a"
        leadingOptionDownsideFlag={true}
      />,
    )

    // Only the leader carries the qualification
    expect(screen.getByTestId('leading-option-downside-a')).toBeInTheDocument()
    expect(screen.queryByTestId('leading-option-downside-b')).not.toBeInTheDocument()
  })
})

describe('OptionCards — display-honesty: copy never uses banned wording', () => {
  it('the downside qualification copy avoids "winner" / "winning" / "recommended" / "recommendation"', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.7 }),
    ]
    render(
      <OptionCards
        options={options}
        winnerId="a"
        leadingOptionDownsideFlag={true}
      />,
    )

    const note = screen.getByTestId('leading-option-downside-a')
    const text = note.textContent ?? ''
    expect(text.toLowerCase()).not.toMatch(/\bwinner\b|\bwinning\b|\brecommend(ed|ation)\b/)
  })
})
