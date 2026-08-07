/**
 * ROADMAP 2.263 F2 — a CONDITIONAL probability may not sit in an UNCONDITIONAL slot.
 *
 * THE DEFECT (OptionsSection.tsx:216–221 at tip d04c5a9b):
 *
 *   {hasAnalysisData && conditionalWinners?.[0]?.lowBucket.winProbability != null && (
 *     <span …>· {Math.round(conditionalWinners[0].lowBucket.winProbability * 100)}% win</span>
 *   )}
 *
 * rendered directly beside the option's NAME. `lowBucket.winProbability` is
 * conditional on the splitting factor sitting BELOW `split_value`; presented with
 * no condition attached it reads as the option's probability full stop. Plus
 * `[0]` was arbitrary among several entries, and only the low-bucket winner got
 * a number at all — so its rival read as "unknown" when it is the complement in
 * the very same bucket. It was also a 2.214 vocabulary survivor ("win", anchored
 * to neither sanctioned question).
 *
 * THE RULING: REMOVE it. An unconditional slot cannot honestly host a conditional
 * number, so relabelling was not on the table.
 *
 * CLAIM TYPE: rendered TEXT. jsdom proves the string is absent from the document,
 * not that anything is laid out or visible (trap 3).
 *
 * ⚠ POSITIVE CONTROLS INCLUDED. "No `% win` anywhere" also passes if the section
 * renders nothing at all, so every absence assertion below is paired with proof
 * that the option, and the conditional structure that legitimately carries its
 * condition, still render.
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

/**
 * ⚠ THE INTERVENTIONS ARE NOT DECORATION.
 *
 * `OptionsSectionInner` renders a coaching card INSTEAD of the option cards
 * when every option is unmapped (`allUnmapped`). An option with no
 * interventions therefore never reaches `OptionCard` at all — and a `% win`
 * absence assertion against that branch passes by testing nothing, which is
 * trap 13 in miniature. Mapping an intervention is what puts the real card,
 * and the slot the defect lived in, on the screen.
 */
function option(id: string, label: string): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, interventions: { 'f-adopt': 0.7 } },
  }
}

/** Two entries, so the arbitrariness of `[0]` is expressible. */
const winners: ConditionalWinner[] = [
  {
    factorLabel: 'Adoption rate',
    factorId: 'f-adopt',
    splitValue: 0.4,
    highBucket: { winnerId: 'opt-b', winnerLabel: 'Option B', winProbability: 0.71 },
    lowBucket: { winnerId: 'opt-a', winnerLabel: 'Option A', winProbability: 0.63 },
  },
  {
    factorLabel: 'Lead time',
    factorId: 'f-lead',
    splitValue: 0.6,
    highBucket: { winnerId: 'opt-b', winnerLabel: 'Option B', winProbability: 0.55 },
    lowBucket: { winnerId: 'opt-a', winnerLabel: 'Option A', winProbability: 0.52 },
  },
]

const options = [option('opt-a', 'Option A'), option('opt-b', 'Option B')]

function renderSection() {
  return render(
    <OptionsSection
      optionNodes={options}
      allNodes={[...options, { id: 'f-adopt', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Adoption rate' } }]}
      conditionalWinners={winners}
      hasAnalysisData
      isExpanded
    />,
  )
}

describe('OptionsSection — no unconditional probability beside the option name', () => {
  it('renders no "% win" figure anywhere', () => {
    const { container } = renderSection()
    expect(container.textContent).not.toMatch(/%\s*win/i)
  })

  it('does not render the low-bucket probability as a bare number', () => {
    // 0.63 → "63%" was the exact string beside "Option A".
    const { container } = renderSection()
    expect(container.textContent).not.toContain('63%')
    expect(container.textContent).not.toContain('52%')
  })

  it('POSITIVE CONTROL: the option names still render', () => {
    renderSection()
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('POSITIVE CONTROL: the conditional takeover card still states its condition', () => {
    // The conditional fact is not deleted — it keeps the surface that CAN carry
    // a condition. Removing the headline number must not take this with it.
    const { container } = renderSection()
    expect(container.textContent).toContain('Adoption rate')
  })

  it('uses the word "win" nowhere in the rendered output (2.214)', () => {
    const { container } = renderSection()
    expect(container.textContent).not.toMatch(/\bwins?\b/i)
  })
})
