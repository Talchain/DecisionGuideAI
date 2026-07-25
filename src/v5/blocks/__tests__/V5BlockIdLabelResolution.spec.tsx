/**
 * V5ExplanationBlock / V5FlipAnalysisBlock — id → label resolution.
 *
 * The contract harness (tests/contracts/cee-rendering-claims.contract.test.tsx)
 * proves the raw id is ABSENT from the user-facing surface. Absence alone is
 * satisfiable by rendering nothing at all, so these tests pin the other half:
 * that the human label is PRESENT, that the machine reference survives in
 * attributes, and that each component makes the no-label decision its own
 * docstring claims it makes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'

let mockNodes: Array<{ id: string; data: { label: string } }> = []

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: (selector: (s: unknown) => unknown) =>
    selector({ nodes: mockNodes, edges: [] }),
}))

import { V5ExplanationBlock } from '../V5ExplanationBlock'
import { V5FlipAnalysisBlock } from '../V5FlipAnalysisBlock'

afterEach(() => {
  cleanup()
  mockNodes = []
})

function explanation(ids: string[]) {
  return {
    type: 'v5_explanation' as const,
    narrative: 'London wins on resilience.',
    referenced_option_ids: ids,
  }
}

function flip(factorIds: string[]) {
  return {
    type: 'v5_flip_analysis' as const,
    narrative: 'Factors that could flip the result.',
    flip_scenarios: factorIds.map((factor_id) => ({
      factor_id,
      current_value: 0.5,
      flip_threshold: 0.7,
      from_option_id: null,
      to_option_id: null,
      fragile: false,
    })),
  }
}

describe('V5ExplanationBlock — referenced option ids', () => {
  it('renders the canvas label, not the id', () => {
    mockNodes = [{ id: 'opt_london', data: { label: 'Hire in London' } }]
    render(<V5ExplanationBlock block={explanation(['opt_london'])} />)

    const list = screen.getByTestId('v5-explanation-options')
    expect(within(list).getByRole('listitem')).toHaveTextContent(
      'Hire in London',
    )
    expect(list.textContent).not.toContain('opt_london')
  })

  it('keeps the id as a machine reference in the test id', () => {
    mockNodes = [{ id: 'opt_london', data: { label: 'Hire in London' } }]
    render(<V5ExplanationBlock block={explanation(['opt_london'])} />)

    // The allowlist permits exactly this use. Losing it would be a
    // regression in the opposite direction.
    expect(
      screen.getByTestId('v5-explanation-option-opt_london'),
    ).toBeInTheDocument()
  })

  it('omits a chip whose id resolves to no canvas label', () => {
    mockNodes = [{ id: 'opt_london', data: { label: 'Hire in London' } }]
    render(
      <V5ExplanationBlock block={explanation(['opt_london', 'opt_ghost'])} />,
    )

    const items = within(screen.getByTestId('v5-explanation-options')).getAllByRole(
      'listitem',
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Hire in London')
  })

  it('omits the whole list when nothing resolves', () => {
    mockNodes = []
    render(<V5ExplanationBlock block={explanation(['opt_ghost'])} />)

    expect(screen.queryByTestId('v5-explanation-options')).toBeNull()
    // The narrative still renders — the block is not blanked out.
    expect(screen.getByTestId('v5-explanation-narrative')).toHaveTextContent(
      'London wins on resilience.',
    )
  })

  it('rejects a canvas label that is itself a raw id', () => {
    // Upstream sometimes seeds a node label from its own id. Without the
    // RAW_ID_PATTERN guard the leak would just move one hop upstream.
    mockNodes = [{ id: 'opt_london', data: { label: 'opt_london' } }]
    render(<V5ExplanationBlock block={explanation(['opt_london'])} />)

    expect(screen.queryByTestId('v5-explanation-options')).toBeNull()
  })
})

describe('V5FlipAnalysisBlock — factor ids', () => {
  it('renders the canvas label as the row label, not the id', () => {
    mockNodes = [{ id: 'fac_morale', data: { label: 'Team morale' } }]
    render(<V5FlipAnalysisBlock block={flip(['fac_morale'])} />)

    const row = screen.getByTestId('v5-flip-scenario-fac_morale')
    expect(row).toHaveTextContent('Team morale:')
    expect(row.textContent).not.toContain('fac_morale')
  })

  it('KEEPS the row and its numbers when no label resolves, naming the gap', () => {
    // Deliberately different from V5ExplanationBlock: this row carries the
    // current value and the flip threshold. Dropping it would destroy a
    // measured result and contradict the narrative's scenario count.
    mockNodes = []
    render(<V5FlipAnalysisBlock block={flip(['fac_ghost'])} />)

    const row = screen.getByTestId('v5-flip-scenario-fac_ghost')
    expect(row).toHaveTextContent('Unnamed factor:')
    expect(row).toHaveTextContent('0.50')
    expect(row).toHaveTextContent('0.70')
    expect(row.textContent).not.toContain('fac_ghost')
  })

  it('resolves each row independently in a mixed set', () => {
    mockNodes = [{ id: 'fac_morale', data: { label: 'Team morale' } }]
    render(<V5FlipAnalysisBlock block={flip(['fac_morale', 'fac_ghost'])} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByTestId('v5-flip-scenario-fac_morale')).toHaveTextContent(
      'Team morale:',
    )
    expect(screen.getByTestId('v5-flip-scenario-fac_ghost')).toHaveTextContent(
      'Unnamed factor:',
    )
  })

  it('rejects a canvas label that is itself a raw id', () => {
    mockNodes = [{ id: 'fac_morale', data: { label: 'fac_morale' } }]
    render(<V5FlipAnalysisBlock block={flip(['fac_morale'])} />)

    const row = screen.getByTestId('v5-flip-scenario-fac_morale')
    expect(row).toHaveTextContent('Unnamed factor:')
    expect(row.textContent).not.toContain('fac_morale')
  })
})
