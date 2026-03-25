/**
 * FactorsSection — unit tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FactorsSection } from '../FactorsSection'
import type { Node } from '@xyflow/react'

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockUpdateNode = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ updateNode: mockUpdateNode })
  ),
}))

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock sessionStorage for CoachingCard
const mockStorage = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  length: 0,
  key: () => null,
})

function makeFactorNode(
  id: string,
  label: string,
  opts: { source?: string; value?: number; raw_value?: number; unit?: string; category?: string } = {}
): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: opts.category ?? 'observable',
      observedState: {
        value: opts.value ?? 0.5,
        raw_value: opts.raw_value,
        unit: opts.unit,
        source: opts.source,
      },
    },
  }
}

function makeExternalNode(id: string, label: string, priorMin?: number, priorMax?: number): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'external',
      ...(priorMin !== undefined && priorMax !== undefined
        ? { prior: { range_min: priorMin, range_max: priorMax } }
        : {}),
    },
  }
}

describe('FactorsSection', () => {
  it('renders nothing when no factor nodes', () => {
    const { container } = render(<FactorsSection factorNodes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders factor cards', () => {
    const nodes = [makeFactorNode('f1', 'Market size')]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByText('Market size')).toBeInTheDocument()
  })

  it('shows count badge', () => {
    const nodes = [makeFactorNode('f1', 'A'), makeFactorNode('f2', 'B')]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('sorts alphabetically when no factorInfluence provided', () => {
    const nodes = [
      makeFactorNode('f1', 'Zebra factor'),
      makeFactorNode('f2', 'Alpha factor'),
    ]
    render(<FactorsSection factorNodes={nodes} />)
    const cards = screen.getAllByTestId(/^factor-card-/)
    expect(cards[0]).toHaveAttribute('data-testid', 'factor-card-f2')
    expect(cards[1]).toHaveAttribute('data-testid', 'factor-card-f1')
  })

  it('sorts by influence descending when factorInfluence provided', () => {
    const nodes = [
      makeFactorNode('f1', 'Low influence'),
      makeFactorNode('f2', 'High influence'),
    ]
    const influence = new Map([['f1', 0.1], ['f2', 0.9]])
    render(<FactorsSection factorNodes={nodes} factorInfluence={influence} />)
    const cards = screen.getAllByTestId(/^factor-card-/)
    expect(cards[0]).toHaveAttribute('data-testid', 'factor-card-f2')
    expect(cards[1]).toHaveAttribute('data-testid', 'factor-card-f1')
  })

  it('shows source provenance pill for brief_extraction', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'brief_extraction' })]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByText('From brief')).toBeInTheDocument()
  })

  it('shows source provenance pill for cee_inference', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'cee_inference' })]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('auto-tags source: user when value is edited', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { value: 0.5 })]
    render(<FactorsSection factorNodes={nodes} />)

    const displayEl = screen.getByTestId('factor-f1-value-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-value')
    fireEvent.change(input, { target: { value: '0.7' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({
        data: expect.objectContaining({
          observedState: expect.objectContaining({ value: 0.7, source: 'user' }),
        }),
      })
    )
  })

  it('shows category badge for controllable factor', () => {
    const nodes = [makeFactorNode('f1', 'Price', { category: 'controllable' })]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByText('Controllable')).toBeInTheDocument()
  })

  it('shows prior range for external factor with explicit prior', () => {
    const nodes = [makeExternalNode('ef1', 'Market growth', 0.01, 0.15)]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByTestId('factor-ef1-prior-min-display')).toBeInTheDocument()
  })

  it('shows default range and Refine range button for external factor without prior', () => {
    const nodes = [makeExternalNode('ef2', 'Inflation rate')]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.getByTestId('factor-ef2-default-range')).toBeInTheDocument()
    expect(screen.getByTestId('factor-ef2-refine-range')).toBeInTheDocument()
  })

  it('shows influence bar when factorInfluence has data for the factor', () => {
    const nodes = [makeFactorNode('f1', 'Market size')]
    const influence = new Map([['f1', 0.75]])
    render(<FactorsSection factorNodes={nodes} factorInfluence={influence} />)
    expect(screen.getByTestId('influence-bar')).toBeInTheDocument()
  })

  it('does not show influence bar when factorInfluence is undefined', () => {
    const nodes = [makeFactorNode('f1', 'Market size')]
    render(<FactorsSection factorNodes={nodes} />)
    expect(screen.queryByTestId('influence-bar')).not.toBeInTheDocument()
  })

  it('shows synthesised prior from synthesisedPriorMap', () => {
    const nodes = [makeExternalNode('ef3', 'Customer churn')]
    const priorMap = new Map([['ef3', { rangeMin: 0, rangeMax: 0.14 }]])
    render(<FactorsSection factorNodes={nodes} synthesisedPriorMap={priorMap} />)
    expect(screen.getByTestId('factor-ef3-prior-min-display')).toBeInTheDocument()
    expect(screen.getByText(/from model repair/)).toBeInTheDocument()
  })

  it('applies selection ring when node id is in selectedNodeIds', () => {
    const nodes = [makeFactorNode('f1', 'Selected')]
    render(<FactorsSection factorNodes={nodes} selectedNodeIds={new Set(['f1'])} />)
    const card = screen.getByTestId('factor-card-f1')
    expect(card.className).toMatch(/ring-1/)
  })

  it('does not apply selection ring when node is not selected', () => {
    const nodes = [makeFactorNode('f1', 'Not selected')]
    render(<FactorsSection factorNodes={nodes} selectedNodeIds={new Set()} />)
    const card = screen.getByTestId('factor-card-f1')
    expect(card.className).not.toMatch(/ring-1/)
  })

  // ── EVPI chip tests ─────────────────────────────────────────────────────────

  it('renders EVPI chip when evpiMap has data and hasAnalysisData is true', () => {
    const nodes = [makeFactorNode('f1', 'Ad spend')]
    const evpiMap = new Map([['f1', 8]])
    render(<FactorsSection factorNodes={nodes} evpiMap={evpiMap} hasAnalysisData />)
    expect(screen.getByTestId('factor-f1-evpi')).toBeInTheDocument()
    expect(screen.getByText(/Worth 8pp if resolved/)).toBeInTheDocument()
  })

  it('does not render EVPI chip when evpiMap is empty', () => {
    const nodes = [makeFactorNode('f1', 'Ad spend')]
    render(<FactorsSection factorNodes={nodes} evpiMap={new Map()} hasAnalysisData />)
    expect(screen.queryByTestId('factor-f1-evpi')).not.toBeInTheDocument()
  })

  it('does not render EVPI chip pre-analysis', () => {
    const nodes = [makeFactorNode('f1', 'Ad spend')]
    const evpiMap = new Map([['f1', 8]])
    render(<FactorsSection factorNodes={nodes} evpiMap={evpiMap} hasAnalysisData={false} />)
    expect(screen.queryByTestId('factor-f1-evpi')).not.toBeInTheDocument()
  })

  it('sorts by EVPI descending when evpiMap has data', () => {
    const nodes = [
      makeFactorNode('f1', 'Low EVPI'),
      makeFactorNode('f2', 'High EVPI'),
    ]
    const evpiMap = new Map([['f1', 3], ['f2', 12]])
    render(<FactorsSection factorNodes={nodes} evpiMap={evpiMap} hasAnalysisData />)
    const cards = screen.getAllByTestId(/^factor-card-/)
    expect(cards[0]).toHaveAttribute('data-testid', 'factor-card-f2')
    expect(cards[1]).toHaveAttribute('data-testid', 'factor-card-f1')
  })

  // ── Attribution stability tests ─────────────────────────────────────────────

  it('renders attribution stability pill when data is present post-analysis', () => {
    const nodes = [makeFactorNode('f1', 'Ad spend')]
    const influence = new Map([['f1', 0.5]])
    const stabilityMap = new Map([['f1', 'high']])
    render(
      <FactorsSection
        factorNodes={nodes}
        factorInfluence={influence}
        attributionStabilityMap={stabilityMap}
        hasAnalysisData
      />
    )
    expect(screen.getByText('High stability')).toBeInTheDocument()
  })

  it('does not render stability pill when attributionStabilityMap is empty', () => {
    const nodes = [makeFactorNode('f1', 'Ad spend')]
    const influence = new Map([['f1', 0.5]])
    render(<FactorsSection factorNodes={nodes} factorInfluence={influence} hasAnalysisData />)
    expect(screen.queryByTestId('attribution-stability-pill')).not.toBeInTheDocument()
  })

  // ── Range derivation badge tests ────────────────────────────────────────────

  it('shows Estimated range badge for inferred_baseline source', () => {
    const node: Node = {
      id: 'f1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test factor',
        kind: 'factor',
        category: 'observable',
        observedState: {
          value: 0.5,
          source: 'cee_inference',
          range_derivation_source: 'inferred_baseline',
        },
      },
    }
    render(<FactorsSection factorNodes={[node]} />)
    expect(screen.getByTestId('range-derivation-badge')).toBeInTheDocument()
    expect(screen.getByText('Estimated range')).toBeInTheDocument()
  })

  it('does not show range badge for explicit source', () => {
    const node: Node = {
      id: 'f1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Test factor',
        kind: 'factor',
        category: 'observable',
        observedState: {
          value: 0.5,
          source: 'user',
          range_derivation_source: 'explicit',
        },
      },
    }
    render(<FactorsSection factorNodes={[node]} />)
    expect(screen.queryByTestId('range-derivation-badge')).not.toBeInTheDocument()
  })
})
