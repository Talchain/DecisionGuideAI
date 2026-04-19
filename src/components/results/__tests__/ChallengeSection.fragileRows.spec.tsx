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

  // Brief 5.2 follow-up (ChatGPT P0 #2 + P1 #2): each row's chip must focus
  // its OWN from_id, not the group-level focusId. The earlier implementation
  // used edges[0].from_id for every row in consolidated mode, so row 2+
  // always opened row 1's source.
  it('consolidated group: each chip fires onFocusNode with its OWN edge from_id (per-row callback target)', () => {
    const onFocusNode = vi.fn()
    const edges = [
      makeFragileEdge({ from_id: 'node-alpha', from_label: 'Factor A' }),
      makeFragileEdge({ from_id: 'node-beta', from_label: 'Factor B' }),
      makeFragileEdge({ from_id: 'node-gamma', from_label: 'Factor C' }),
    ]
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={edges}
        onFocusNode={onFocusNode}
      />,
    )
    fireEvent.click(screen.getByTestId('fragile-review-chip-0'))
    expect(onFocusNode).toHaveBeenLastCalledWith('node-alpha')
    fireEvent.click(screen.getByTestId('fragile-review-chip-1'))
    expect(onFocusNode).toHaveBeenLastCalledWith('node-beta')
    fireEvent.click(screen.getByTestId('fragile-review-chip-2'))
    expect(onFocusNode).toHaveBeenLastCalledWith('node-gamma')
    expect(onFocusNode).toHaveBeenCalledTimes(3)
  })

  it('non-consolidated group (same source, multiple edges): each chip still focuses its own edge from_id', () => {
    const onFocusNode = vi.fn()
    const edges = [
      makeFragileEdge({ from_id: 'shared-source', from_label: 'Factor A', to_label: 'Factor X' }),
      makeFragileEdge({ from_id: 'shared-source', from_label: 'Factor A', to_label: 'Factor Y' }),
    ]
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={edges}
        onFocusNode={onFocusNode}
      />,
    )
    fireEvent.click(screen.getByTestId('fragile-review-chip-0'))
    fireEvent.click(screen.getByTestId('fragile-review-chip-1'))
    // Same-source rows share the from_id, so both calls map to the same
    // node — but the callback path still runs per row (not a single shared
    // closure), which is the invariant being protected.
    expect(onFocusNode).toHaveBeenCalledTimes(2)
    expect(onFocusNode).toHaveBeenNthCalledWith(1, 'shared-source')
    expect(onFocusNode).toHaveBeenNthCalledWith(2, 'shared-source')
  })

  // Brief 5.2 follow-up round 2 (ChatGPT P1 #2 / Improvement #2): when an
  // edge lacks from_id, the chip must not render — passing from_label to
  // onFocusNode would silently no-op in the inspector and mislead the
  // user into thinking the affordance works.
  it('chip is suppressed when edge.from_id is absent — onFocusNode is never called with a non-id fallback', () => {
    const onFocusNode = vi.fn()
    const edgeWithoutId: ChallengeFragileEdge = {
      from_label: 'Factor Without ID',
      to_label: 'Factor Y',
      alternative_winner_label: 'Option B',
      alternative_winner_id: 'opt-b',
      switch_probability: 0.4,
      // from_id intentionally omitted.
    }
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={[edgeWithoutId]}
        onFocusNode={onFocusNode}
      />,
    )
    // Row itself renders — the user still sees the fragility alert text —
    // but the actionable chip is hidden because the inspector would not
    // find a matching node.
    expect(screen.getByTestId('fragile-alt-winner')).toBeInTheDocument()
    expect(screen.queryByTestId('fragile-review-chip-0')).not.toBeInTheDocument()

    // Nothing in the row should be able to invoke onFocusNode with the
    // non-id fallback. Covers the whole row container.
    expect(onFocusNode).not.toHaveBeenCalled()
  })

  it('mixed group: rows with from_id show chip, rows without from_id hide it; callback receives only valid ids', () => {
    const onFocusNode = vi.fn()
    // ChallengeSection sorts edges by switch_probability desc, so testid
    // ordering is determined by score rather than input order. Use text-
    // based assertions (aria-label) so the test is robust to reordering.
    const edges: ChallengeFragileEdge[] = [
      { from_id: 'node-alpha', from_label: 'Factor Alpha', to_label: 'Factor X', switch_probability: 0.9, alternative_winner_label: 'Option B' },
      { from_label: 'Factor Orphan', to_label: 'Factor Y', switch_probability: 0.8, alternative_winner_label: 'Option B' }, // from_id missing
      { from_id: 'node-gamma', from_label: 'Factor Gamma', to_label: 'Factor Z', switch_probability: 0.7, alternative_winner_label: 'Option B' },
    ]
    render(
      <ChallengeSection
        biasFindings={[]}
        preMortemItems={[]}
        fragileEdges={edges}
        onFocusNode={onFocusNode}
      />,
    )
    // Two chips render (one per valid from_id); the orphan row shows no chip.
    const chips = screen.getAllByRole('button', { name: /Review .* in the inspector/ })
    expect(chips).toHaveLength(2)
    const chipLabels = chips.map(c => c.getAttribute('aria-label'))
    expect(chipLabels).toEqual(expect.arrayContaining([
      expect.stringContaining('Factor Alpha'),
      expect.stringContaining('Factor Gamma'),
    ]))
    // Orphan row renders its alert text (user still sees the fragility
    // signal) but its chip is suppressed. Use the panel textContent since
    // the source factor name is wrapped in a nested span within the
    // shifting-phrase sentence.
    expect(document.body.textContent).toContain('Factor Orphan')
    expect(chipLabels.some(l => l?.includes('Factor Orphan'))).toBe(false)

    // Firing each chip passes its own from_id — never the label fallback.
    for (const chip of chips) fireEvent.click(chip)
    expect(onFocusNode).toHaveBeenCalledTimes(2)
    const calledIds = onFocusNode.mock.calls.map(c => c[0])
    expect(calledIds).toEqual(expect.arrayContaining(['node-alpha', 'node-gamma']))
    expect(onFocusNode).not.toHaveBeenCalledWith('Factor Orphan')
  })
})
