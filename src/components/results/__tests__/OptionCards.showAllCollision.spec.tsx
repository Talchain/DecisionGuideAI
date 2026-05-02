/**
 * OptionCards — Brief 5.8B hotfix: show-all / what-if layout regression.
 *
 * "Show all (N more)" and "What if I tried a different approach?" were
 * rendering as siblings in the same space-y-2 container without a flex-col
 * wrapper, colliding onto the same visual line at narrow widths.
 *
 * Fix: both buttons live inside a `flex flex-col gap-1` wrapper so they
 * always stack vertically.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

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

const THREE_OPTIONS: OptionResult[] = [
  makeOption({ id: 'opt-a', label: 'Option A', isRecommended: true, rank: 1, winProbability: 0.6 }),
  makeOption({ id: 'opt-b', label: 'Option B', rank: 2, winProbability: 0.25 }),
  makeOption({ id: 'opt-c', label: 'Option C', rank: 3, winProbability: 0.15 }),
]

describe('OptionCards — 5.8B hotfix: show-all / what-if separation', () => {
  it('both buttons are present when 3+ options and onSendMessage is provided', () => {
    render(
      <OptionCards
        options={THREE_OPTIONS}
        winnerId="opt-a"
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('option-cards-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('option-cards-different-approach')).toBeInTheDocument()
  })

  it('both buttons share a common flex-col container (never in separate sibling positions)', () => {
    render(
      <OptionCards
        options={THREE_OPTIONS}
        winnerId="opt-a"
        onSendMessage={() => {}}
      />,
    )
    const toggle = screen.getByTestId('option-cards-toggle')
    const approach = screen.getByTestId('option-cards-different-approach')
    // Both must share the same immediate parent element.
    expect(toggle.parentElement).toBe(approach.parentElement)
    // That parent must be a flex-col container.
    const container = toggle.parentElement!
    expect(container.classList.contains('flex')).toBe(true)
    expect(container.classList.contains('flex-col')).toBe(true)
  })

  it('renders only the approach link (no toggle) when fewer than 3 options', () => {
    render(
      <OptionCards
        options={THREE_OPTIONS.slice(0, 2)}
        winnerId="opt-a"
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('option-cards-toggle')).not.toBeInTheDocument()
    expect(screen.getByTestId('option-cards-different-approach')).toBeInTheDocument()
  })
})
