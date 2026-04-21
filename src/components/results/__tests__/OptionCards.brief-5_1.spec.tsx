/**
 * OptionCards — Brief 5.1 Task 7 regression.
 *
 * Covers:
 * - Runner-up / baseline card title strips a trailing "(Status Quo)" only
 *   when the Baseline pill renders (hasBaselinePill === true).
 * - Non-winner chip copy unified to "What would make this lead?" — no
 *   longer renders the earlier baseline-specific "Why does this lose?".
 * - formatOptionLabelForCard helper itself: stripping rules + idempotence.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import { formatOptionLabelForCard } from '../utils/cleanFactorLabel'

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-1',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    rank: 2,
    ...overrides,
  }
}

describe('formatOptionLabelForCard (Brief 5.1 Task 7 helper)', () => {
  it('strips trailing "(Status Quo)" when baseline pill renders', () => {
    expect(
      formatOptionLabelForCard('Continue Without Dedicated Support (Status Quo)', true),
    ).toBe('Continue Without Dedicated Support')
  })

  it('preserves "(Status Quo)" when no baseline pill', () => {
    expect(
      formatOptionLabelForCard('Keep status quo (Status Quo)', false),
    ).toBe('Keep status quo (Status Quo)')
  })

  it('is case-insensitive on the trailing marker', () => {
    expect(
      formatOptionLabelForCard('Keep it simple (status quo)', true),
    ).toBe('Keep it simple')
    expect(
      formatOptionLabelForCard('Stay put (STATUS QUO)', true),
    ).toBe('Stay put')
  })

  it('strips whitespace variants around the parens', () => {
    expect(
      formatOptionLabelForCard('Maintain current  ( status  quo )', true),
    ).toBe('Maintain current')
  })

  it('only strips a trailing match — inline "(Status Quo)" is left alone', () => {
    expect(
      formatOptionLabelForCard('(Status Quo) approach continued', true),
    ).toBe('(Status Quo) approach continued')
  })

  it('composes with stripEncodingNotation (encoding suffix also removed)', () => {
    expect(
      formatOptionLabelForCard('Do Nothing (0/1) (Status Quo)', true),
    ).toBe('Do Nothing')
  })

  it('is idempotent — applying twice yields the same result', () => {
    const once = formatOptionLabelForCard('Stay put (Status Quo)', true)
    const twice = formatOptionLabelForCard(once, true)
    expect(twice).toBe(once)
  })
})

describe('OptionCards — Brief 5.1 Task 7 card integration', () => {
  it('baseline option card title strips "(Status Quo)" while the Baseline pill renders', () => {
    const options = [
      makeOption({
        id: 'opt-sq',
        label: 'Continue Without Dedicated Support (Status Quo)',
        isBaseline: true,
        isRecommended: false,
        rank: 2,
      }),
      makeOption({
        id: 'opt-a',
        label: 'Hire Tech Lead',
        isRecommended: true,
        rank: 1,
      }),
    ]
    render(<OptionCards options={options} winnerId="opt-a" />)

    // Card title no longer shows "(Status Quo)" …
    expect(
      screen.getByText('Continue Without Dedicated Support'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Continue Without Dedicated Support \(Status Quo\)/),
    ).not.toBeInTheDocument()

    // … but the Baseline pill still shows so the signal isn't lost.
    expect(screen.getByText('Baseline')).toBeInTheDocument()
  })

  it('non-baseline option retains any non-(Status Quo) suffix in the label', () => {
    const options = [
      makeOption({ id: 'opt-a', label: 'Option A (v2)', isRecommended: true, rank: 1 }),
    ]
    render(<OptionCards options={options} winnerId="opt-a" />)
    expect(screen.getByText('Option A (v2)')).toBeInTheDocument()
  })
})

describe('OptionCards — Brief 5.1 Task 7 unified chip copy', () => {
  it('non-winner (non-baseline) renders "What would make this lead?"', () => {
    const options = [
      makeOption({ id: 'opt-a', isRecommended: true, rank: 1, winProbability: 0.65 }),
      makeOption({ id: 'opt-b', label: 'Option B', isRecommended: false, rank: 2, winProbability: 0.35 }),
    ]
    // Brief 5.4 Phase 7: winner chip is tier-driven. Pass strong tier to assert the
    // definitive "What makes this lead?" label; non-winner label is tier-invariant.
    render(<OptionCards options={options} winnerId="opt-a" onSendMessage={() => {}} confidenceTier="strong" />)

    // Winner renders the strong-tier chip; non-winner always uses the forward-looking copy.
    expect(screen.getByText('What makes this lead?')).toBeInTheDocument()
    expect(screen.getByText('What would make this lead?')).toBeInTheDocument()
  })

  it('Brief 5.4 QA P4: fair tier is NOT evidence-weak — winner chip renders definitive copy', () => {
    // Brief 5.4 QA Item 4: hedging requires needs_work tier AND stability < 0.85.
    // fair is not evidence-weak; it always renders the definitive chip label.
    const options = [
      makeOption({ id: 'opt-a', isRecommended: true, rank: 1, winProbability: 0.65 }),
      makeOption({ id: 'opt-b', label: 'Option B', isRecommended: false, rank: 2, winProbability: 0.35 }),
    ]
    render(<OptionCards options={options} winnerId="opt-a" onSendMessage={() => {}} confidenceTier="fair" />)

    expect(screen.getByText('What makes this lead?')).toBeInTheDocument()
    expect(screen.queryByText('What makes this the current leader?')).not.toBeInTheDocument()
    expect(screen.getByText('What would make this lead?')).toBeInTheDocument()
  })

  it('Brief 5.4 QA P4: winner chip hedges for needs_work tier without stability (absent = weak)', () => {
    const options = [
      makeOption({ id: 'opt-a', isRecommended: true, rank: 1, winProbability: 0.65 }),
      makeOption({ id: 'opt-b', label: 'Option B', isRecommended: false, rank: 2, winProbability: 0.35 }),
    ]
    // needs_work + absent stability → evidenceIsWeak AND stabilityIsWeak → hedged
    render(<OptionCards options={options} winnerId="opt-a" onSendMessage={() => {}} confidenceTier="needs_work" />)

    expect(screen.getByText('What makes this the current leader?')).toBeInTheDocument()
    expect(screen.queryByText('What makes this lead?')).not.toBeInTheDocument()
    expect(screen.getByText('What would make this lead?')).toBeInTheDocument()
  })

  it('baseline non-winner renders "What would make this lead?" — no "Why does this lose?"', () => {
    const options = [
      makeOption({ id: 'opt-a', isRecommended: true, rank: 1 }),
      makeOption({
        id: 'opt-sq',
        label: 'Stay put',
        isBaseline: true,
        isRecommended: false,
        rank: 2,
      }),
    ]
    render(<OptionCards options={options} winnerId="opt-a" onSendMessage={() => {}} />)

    expect(screen.queryByText(/Why does this lose\?/)).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'What would make this lead?' }),
    ).toHaveLength(1)
  })
})
