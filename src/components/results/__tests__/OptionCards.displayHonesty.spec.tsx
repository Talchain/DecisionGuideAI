/**
 * OptionCards display-honesty tests.
 *
 * Covers:
 *   A. sample-resolution display (<0.1% / >99.9% / threshold scaling with N,
 *      raw winProbability preserved for bar width)
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

describe('OptionCards — display-honesty (A) sample resolution', () => {
  it('renders exact 0 winProbability as <0.1% at n_valid_samples=1000', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.65, nValidSamples: 1000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 1000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expect(screen.getByTestId('win-pct-b').textContent).toBe('<0.1%')
  })

  it('renders exact 1 winProbability as >99.9% at n_valid_samples=1000', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 1, nValidSamples: 1000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 1000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expect(screen.getByTestId('win-pct-a').textContent).toBe('>99.9%')
  })

  it('threshold scales with sample count: <0.01% at n_valid_samples=10000', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 1, nValidSamples: 10000 }),
      makeOption({ id: 'b', label: 'B', winProbability: 0, nValidSamples: 10000, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expect(screen.getByTestId('win-pct-b').textContent).toBe('<0.01%')
    expect(screen.getByTestId('win-pct-a').textContent).toBe('>99.99%')
  })

  it('falls back to legacy formatting when nValidSamples is absent', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0, nValidSamples: undefined }),
      makeOption({ id: 'b', label: 'B', winProbability: 0.5, nValidSamples: undefined, isRecommended: false }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    // Legacy formatPct path — preserves the prior 0% rendering
    expect(screen.getByTestId('win-pct-a').textContent).toBe('0%')
    expect(screen.getByTestId('win-pct-b').textContent).toBe('50%')
  })

  it('renders normal percent for mid-range probabilities even with sample count present', () => {
    const options: OptionResult[] = [
      makeOption({ id: 'a', label: 'A', winProbability: 0.58, nValidSamples: 1000 }),
    ]
    render(<OptionCards options={options} winnerId="a" />)

    expect(screen.getByTestId('win-pct-a').textContent).toBe('58%')
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
    expect(note.textContent).toContain('lower range of simulated outcomes includes meaningful downside')
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
