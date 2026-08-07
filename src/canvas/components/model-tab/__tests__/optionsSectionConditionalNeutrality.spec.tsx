/**
 * ROADMAP 2.296 C3 — a CONDITIONAL bucket winner may not be crowned "overall".
 *
 * THE DEFECT (#553, OptionsSection.tsx conditional-winner card): the section
 * attached each conditional-winner entry to `lowBucket.winnerId` as "the
 * default option" and rendered
 *
 *   "Leads overall, but when {factor} exceeds {split}, {other} takes over"
 *
 * ISL's conditional winners only establish which option wins BELOW and ABOVE a
 * median split of one factor. Neither bucket winner is necessarily the global
 * leader — "Leads overall" is a claim the producer never made, attached to
 * whichever option happened to win the LOW bucket.
 *
 * THE FIX: render the two conditional statements neutrally, one on each
 * winner's card — "Leads when {factor} is below {split}" on the low-bucket
 * winner, "Leads when {factor} is above {split}" on the high-bucket winner —
 * with no "overall" claim and no default-option attachment. Entries whose two
 * buckets name the SAME winner state nothing about leadership change and are
 * not rendered (same filter the results panel's ConditionalWinnerCards
 * applies).
 *
 * CLAIM TYPE: rendered text via jsdom — presence/absence only, never layout
 * (trap 3). The 2.263 rule (no bare conditional probability beside the name)
 * is re-pinned here so this fix cannot regress it.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { OptionsSection, type ConditionalWinner } from '../OptionsSection'

const mockUpdateNode = vi.fn()
const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector({ updateNode: mockUpdateNode })),
    { getState: () => ({ ...mockGraph, updateNode: mockUpdateNode }) },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({ focusNodeById: vi.fn() }))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/** Mapped interventions put the real OptionCard on screen (trap 13). */
function option(id: string, label: string): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, interventions: { 'f-adopt': 0.7 } },
  }
}

/** One genuine winner-flip split: Option A leads below, Option B above. */
const CROSS_WINNERS: ConditionalWinner[] = [
  {
    factorLabel: 'Adoption rate',
    factorId: 'f-adopt',
    splitValue: 0.4,
    highBucket: { winnerId: 'opt-b', winnerLabel: 'Option B', winProbability: 0.71 },
    lowBucket: { winnerId: 'opt-a', winnerLabel: 'Option A', winProbability: 0.63 },
  },
]

/** Degenerate: the same option wins BOTH buckets — no leadership change. */
const SAME_WINNER: ConditionalWinner[] = [
  {
    factorLabel: 'Adoption rate',
    factorId: 'f-adopt',
    splitValue: 0.4,
    highBucket: { winnerId: 'opt-a', winnerLabel: 'Option A', winProbability: 0.71 },
    lowBucket: { winnerId: 'opt-a', winnerLabel: 'Option A', winProbability: 0.63 },
  },
]

const options = [option('opt-a', 'Option A'), option('opt-b', 'Option B')]

function renderSection(winners: ConditionalWinner[]) {
  return render(
    <OptionsSection
      optionNodes={options}
      allNodes={[
        ...options,
        { id: 'f-adopt', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Adoption rate' } },
      ]}
      conditionalWinners={winners}
      hasAnalysisData
      isExpanded
    />,
  )
}

describe('OptionsSection — conditional winners rendered neutrally (2.296 C3)', () => {
  it('RED-first: "Leads overall" appears nowhere', () => {
    const { container } = renderSection(CROSS_WINNERS)
    expect(container.textContent).not.toContain('Leads overall')
  })

  it('RED-first: no "takes over" handover claim survives', () => {
    const { container } = renderSection(CROSS_WINNERS)
    expect(container.textContent).not.toContain('takes over')
  })

  it('RED-first: the HIGH-bucket winner gets its own conditional statement', () => {
    // At the pristine tip the card is attached to the LOW-bucket winner only,
    // so Option B — who the producer says leads above the split — showed
    // nothing at all.
    renderSection(CROSS_WINNERS)
    const cardB = screen.getByTestId('conditional-winner-opt-b')
    expect(cardB.textContent).toContain('Leads when Adoption rate is above 0.4')
  })

  it('the LOW-bucket winner gets the below-split statement, with no "overall" claim', () => {
    renderSection(CROSS_WINNERS)
    const cardA = screen.getByTestId('conditional-winner-opt-a')
    expect(cardA.textContent).toContain('Leads when Adoption rate is below 0.4')
    expect(cardA.textContent).not.toContain('overall')
  })

  it('a same-winner-both-buckets entry renders no conditional card at all', () => {
    renderSection(SAME_WINNER)
    expect(screen.queryByTestId('conditional-winner-opt-a')).toBeNull()
    expect(screen.queryByTestId('conditional-winner-opt-b')).toBeNull()
  })

  it('POSITIVE CONTROL: both option names still render', () => {
    renderSection(CROSS_WINNERS)
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('re-pins 2.263: no bucket probability appears as a bare number, and "win" appears nowhere', () => {
    const { container } = renderSection(CROSS_WINNERS)
    expect(container.textContent).not.toContain('63%')
    expect(container.textContent).not.toContain('71%')
    expect(container.textContent).not.toMatch(/\bwins?\b/i)
  })
})
