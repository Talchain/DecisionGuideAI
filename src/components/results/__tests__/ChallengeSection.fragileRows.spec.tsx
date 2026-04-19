/**
 * ChallengeSection — Brief 5.1 Task 8 + Brief 5.2 Task 6 fragile-edge rows.
 *
 * Covers (current contract):
 * - Brief 5.2 Task 6b: row structure is "If {source} shifts → {alt-winner} could overtake".
 *   Single visible arrow, no second arrow between source and target, "could overtake"
 *   unified verb (was "could win"), alt-winner stripped of "(Status Quo)" suffix.
 * - Brief 5.2 Task 6a: Stability pill rendered at the card top-right, not inline.
 * - Brief 5.2 Task 6c: Review chip renders for every row — including consolidated
 *   groups, which previously only exposed an icon-only inspector button.
 * - Brief 5.1 Task 8b carry-forward: honest chip label (not "Validate"); onFocusNode
 *   is inspect-only.
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

describe('ChallengeSection — Brief 5.2 Task 6 fragile-row layout', () => {
  it('renders alt-winner semibold with unified "could overtake" verb (not "could win")', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({ alternative_winner_label: 'Option B' })]}
      />,
    )

    const altWinner = screen.getByTestId('fragile-alt-winner')
    expect(altWinner.textContent).toBe('Option B could overtake')
    expect(altWinner.className).toContain('font-semibold')

    // The old "could win" phrasing is gone — Brief 5.2 standardises on "could overtake".
    expect(document.body.textContent).not.toContain('could win')
  })

  it('strips "(Status Quo)" suffix from the alt-winner label (Brief 5.2 Task 6b)', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({
          alternative_winner_label: 'Continue Without Dedicated Support (Status Quo)',
        })]}
      />,
    )

    const altWinner = screen.getByTestId('fragile-alt-winner')
    expect(altWinner.textContent).toBe('Continue Without Dedicated Support could overtake')
    // The suffix must not leak into the rendered row at all.
    expect(document.body.textContent).not.toContain('(Status Quo)')
  })

  it('renders a single arrow per row — the inline source → target arrow is removed (Brief 5.2 Task 6b)', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge({
          from_label: 'Factor A',
          to_label: 'Factor B',
          alternative_winner_label: 'Option B',
        })]}
      />,
    )
    // Count visible → chars (decorative) in the rendered body. Before Brief 5.2,
    // rows rendered two: the inline "Factor A → Factor B" arrow AND the decorative
    // arrow between the shifting phrase and the alt-winner. Now only the decorative
    // one remains.
    const body = document.body.textContent ?? ''
    const rightArrowCount = (body.match(/→/g) ?? []).length
    expect(rightArrowCount).toBe(1)
    // The stand-alone source factor remains in the shifting phrase.
    expect(body).toContain('Factor A shifts')
    // The target factor is no longer part of the user-facing row text.
    expect(body).not.toContain('Factor A → Factor B')
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

  it('Stability pill renders at the card top-right (Brief 5.2 Task 6a)', () => {
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[makeFragileEdge()]}
      />,
    )
    const pill = screen.getByTestId('fragile-card-stability-pill')
    expect(pill.textContent).toBe('Stability')
    // Positioned absolutely at top-right rather than flowing inline with the body.
    expect(pill.className).toContain('absolute')
    expect(pill.className).toContain('top-2')
    expect(pill.className).toContain('right-3')
  })
})

describe('ChallengeSection — Brief 5.2 Task 6c Review chip', () => {
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

  it('chip aria-label names the source factor and does not promise "validate"', () => {
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
    // Honest label — no "validate" promise.
    expect(label.toLowerCase()).not.toContain('validate')
  })

  it('Brief 5.2 Task 6c: Review chip renders for consolidated groups too (mixed-source fragile rows)', () => {
    const onFocusNode = vi.fn()
    // Consolidated groups occur when multiple single-source fragile rows
    // merge into one card. All rows get Review chips now.
    const edges = [
      makeFragileEdge({ from_id: 'node-1', from_label: 'Factor A', to_label: 'Factor X' }),
      makeFragileEdge({ from_id: 'node-2', from_label: 'Factor B', to_label: 'Factor Y' }),
    ]
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={edges}
        onFocusNode={onFocusNode}
      />,
    )
    // Both rows expose a Review chip regardless of consolidation.
    expect(screen.getByTestId('fragile-review-chip-0')).toBeInTheDocument()
    expect(screen.getByTestId('fragile-review-chip-1')).toBeInTheDocument()
  })
})
