/**
 * RelationshipsSection — unit tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelationshipsSection } from '../RelationshipsSection'
import type { Edge, Node } from '@xyflow/react'

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockUpdateEdge = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ updateEdge: mockUpdateEdge })
  ),
}))

vi.mock('../../../utils/focusHelpers', () => ({
  focusEdgeById: vi.fn(),
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

function makeEdge(id: string, source: string, target: string, opts: {
  weight?: number
  direction?: string
  beliefExists?: number
  provenance?: string
} = {}): Edge {
  return {
    id,
    source,
    target,
    data: {
      weight: opts.weight ?? 0.5,
      direction: opts.direction ?? 'positive',
      beliefExists: opts.beliefExists ?? 0.7,
      provenance: opts.provenance ?? 'assumption',
    },
  }
}

const nodes = [makeNode('f1', 'Factor A'), makeNode('f2', 'Factor B')]

describe('RelationshipsSection', () => {
  it('renders nothing when no edges', () => {
    const { container } = render(<RelationshipsSection edges={[]} nodes={nodes} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders edge card with label', () => {
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.getByText('Factor A')).toBeInTheDocument()
    expect(screen.getByText('Factor B')).toBeInTheDocument()
  })

  it('shows edge count badge', () => {
    const edges = [makeEdge('e1', 'f1', 'f2'), makeEdge('e2', 'f2', 'f1')]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows fragile pill when edge is in fragileEdgeIds', () => {
    const edges = [makeEdge('e1', 'f1', 'f2')]
    const fragileIds = new Set(['e1'])
    render(<RelationshipsSection edges={edges} nodes={nodes} fragileEdgeIds={fragileIds} />)
    expect(screen.getByText('fragile')).toBeInTheDocument()
  })

  it('does not show fragile pill when robustness data absent', () => {
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.queryByText('fragile')).not.toBeInTheDocument()
  })

  it('shows semantic strength label for positive effect', () => {
    const edges = [makeEdge('e1', 'f1', 'f2', { weight: 0.5, direction: 'positive' })]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.getByText('Moderate positive effect')).toBeInTheDocument()
  })

  it('shows semantic strength label for strong negative effect', () => {
    const edges = [makeEdge('e1', 'f1', 'f2', { weight: 0.8, direction: 'negative' })]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.getByText('Strong negative effect')).toBeInTheDocument()
  })

  it('shows "unset" button for edge with no weight', () => {
    const edgeNoWeight: Edge = { id: 'e-uw', source: 'f1', target: 'f2', data: { direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoWeight]} nodes={nodes} />)
    expect(screen.getByTestId('edge-e-uw-weight-unset')).toBeInTheDocument()
  })

  it('shows "unset" button for edge with no likelihood', () => {
    const edgeNoLikelihood: Edge = { id: 'e-ul', source: 'f1', target: 'f2', data: { weight: 0.5, direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoLikelihood]} nodes={nodes} />)
    expect(screen.getByTestId('edge-e-ul-likelihood-unset')).toBeInTheDocument()
  })

  it('pre-fills weight 0.5 when unset button clicked', () => {
    const edgeNoWeight: Edge = { id: 'e-uw', source: 'f1', target: 'f2', data: { direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoWeight]} nodes={nodes} />)
    fireEvent.click(screen.getByTestId('edge-e-uw-weight-unset'))
    expect(mockUpdateEdge).toHaveBeenCalledWith(
      'e-uw',
      expect.objectContaining({ data: expect.objectContaining({ weight: 0.5, direction: 'positive' }) })
    )
  })

  it('applies selection ring when edge id is in selectedEdgeIds', () => {
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<RelationshipsSection edges={edges} nodes={nodes} selectedEdgeIds={new Set(['e1'])} />)
    const card = screen.getByTestId('edge-card-e1')
    expect(card.className).toMatch(/ring-1/)
  })

  it('does not apply selection ring when edge is not selected', () => {
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<RelationshipsSection edges={edges} nodes={nodes} selectedEdgeIds={new Set()} />)
    const card = screen.getByTestId('edge-card-e1')
    expect(card.className).not.toMatch(/ring-1/)
  })

  it('shows likelihood percentage', () => {
    const edges = [makeEdge('e1', 'f1', 'f2', { beliefExists: 0.85 })]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(screen.getByTestId('edge-e1-likelihood-display')).toHaveTextContent('85')
  })

  it('calls updateEdge when likelihood is edited', () => {
    const edges = [makeEdge('e1', 'f1', 'f2', { beliefExists: 0.7 })]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)

    const displayEl = screen.getByTestId('edge-e1-likelihood-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('edge-e1-likelihood')
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.blur(input)

    expect(mockUpdateEdge).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({
        data: expect.objectContaining({ beliefExists: 0.9 }),
      })
    )
  })

  it('sorts fragile edges first', () => {
    const edges = [
      makeEdge('e1', 'f1', 'f2', { weight: 0.9 }),
      makeEdge('e2', 'f2', 'f1', { weight: 0.8 }),
    ]
    const fragileIds = new Set(['e2'])
    const switchProbMap = new Map([['e2', 0.8]])
    render(<RelationshipsSection
      edges={edges}
      nodes={nodes}
      fragileEdgeIds={fragileIds}
      fragileEdgeSwitchProbMap={switchProbMap}
    />)
    const cards = screen.getAllByTestId(/^edge-card-/)
    expect(cards[0]).toHaveAttribute('data-testid', 'edge-card-e2')
  })

  it('reads exists_probability fallback when beliefExists is absent', () => {
    const edgeWithExistsProb: Edge = {
      id: 'e-ep', source: 'f1', target: 'f2',
      data: { weight: 0.7, direction: 'positive', exists_probability: 0.73, provenance: 'assumption' },
    }
    render(<RelationshipsSection edges={[edgeWithExistsProb]} nodes={nodes} />)
    expect(screen.getByTestId('edge-e-ep-likelihood-display')).toHaveTextContent('73')
  })
})
