/**
 * ChallengeSection — Brief 5.1 Task 8 fragile-edge rows.
 *
 * Covers:
 * - Task 8a layout: each row uses the shifting-phrase → alt-winner-semibold
 *   structure. "could overtake" phrasing removed; arrow carries the signal.
 * - Task 8b Review chip: per-edge "Review this relationship" button wired
 *   to onFocusNode with the edge's from_id. Honest label (not "Validate")
 *   because onFocusNode is inspect-only.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChallengeSection } from '../ChallengeSection'
import type { ChallengeFragileEdge } from '../ChallengeSection'

function makeFragileEdge(overrides: Partial<ChallengeFragileEdge> = {}): ChallengeFragileEdge {
  return {
    from_id: 'fac_a',
    from_label: 'Factor A',
    to_label: 'Factor B',
    switch_probability: 0.4,
    alternative_winner_label: 'Option B',
    alternative_winner_id: 'opt-b',
    ...overrides,
  }
}

describe('ChallengeSection — Brief 5.1 Task 8a fragile-row layout', () => {
  it('renders the alternative winner as semibold with "could win" phrasing (no "could overtake")', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({ alternative_winner_label: 'Option B' })]}
      />,
    )

    const altWinner = screen.getByTestId('fragile-alt-winner')
    expect(altWinner.textContent).toBe('Option B could win')
    expect(altWinner.className).toContain('font-semibold')

    // "could overtake" phrasing is gone — the alt-winner pullout carries
    // the semantic now.
    expect(document.body.textContent).not.toContain('could overtake')
  })

  it('falls back to neutral phrase when no alternative winner is known', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({ alternative_winner_label: undefined })]}
      />,
    )

    expect(screen.getByText(/the recommendation could change/)).toBeInTheDocument()
    expect(screen.queryByTestId('fragile-alt-winner')).not.toBeInTheDocument()
  })
})

describe('ChallengeSection — Brief 5.1 Task 8b Review chip', () => {
  it('renders a per-edge Review chip that calls onFocusNode with the edge from_id', () => {
    const onFocusNode = vi.fn()
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({ from_id: 'node-source-1' })]}
        onFocusNode={onFocusNode}
      />,
    )

    const chip = screen.getByTestId('fragile-review-chip-0')
    expect(chip.textContent).toBe('Review this relationship')
    expect(chip.tagName).toBe('BUTTON')

    fireEvent.click(chip)
    expect(onFocusNode).toHaveBeenCalledWith('node-source-1')
  })

  it('Review chip is hidden when onFocusNode is not wired (defensive)', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge()]}
      />,
    )
    expect(screen.queryByTestId('fragile-review-chip-0')).not.toBeInTheDocument()
  })

  it('chip aria-label names the relationship for screen readers', () => {
    const onFocusNode = vi.fn()
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({ from_label: 'Market Size', to_label: 'Revenue' })]}
        onFocusNode={onFocusNode}
      />,
    )

    const chip = screen.getByTestId('fragile-review-chip-0')
    const label = chip.getAttribute('aria-label') ?? ''
    expect(label).toContain('Market Size')
    expect(label).toContain('Revenue')
    // Honest label — no "validate" promise.
    expect(label.toLowerCase()).not.toContain('validate')
  })

  it('multiple edges in a group get independent Review chips, each wired to its own from_id', () => {
    const onFocusNode = vi.fn()
    const edges = [
      makeFragileEdge({ from_id: 'node-1', from_label: 'Factor A', to_label: 'Factor B' }),
      makeFragileEdge({ from_id: 'node-1', from_label: 'Factor A', to_label: 'Factor C' }),
    ]
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={edges}
        onFocusNode={onFocusNode}
      />,
    )

    const chip0 = screen.getByTestId('fragile-review-chip-0')
    const chip1 = screen.getByTestId('fragile-review-chip-1')

    fireEvent.click(chip1)
    expect(onFocusNode).toHaveBeenLastCalledWith('node-1')

    fireEvent.click(chip0)
    expect(onFocusNode).toHaveBeenLastCalledWith('node-1')
    expect(onFocusNode).toHaveBeenCalledTimes(2)
  })
})
