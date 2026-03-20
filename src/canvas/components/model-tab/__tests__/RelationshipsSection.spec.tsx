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
  focusNodeById: vi.fn(),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: () => <input type="range" data-testid="mock-strength-slider" />,
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

  it('renders "Not set" for edge with no weight', () => {
    const edgeNoWeight: Edge = { id: 'e-uw', source: 'f1', target: 'f2', data: { direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoWeight]} nodes={nodes} />)
    expect(screen.getByTestId('edge-e-uw-strength-notset')).toHaveTextContent('Not set')
    // No actionable button — no default injection
    expect(screen.queryByTestId('edge-e-uw-weight-unset')).not.toBeInTheDocument()
  })

  it('renders "Not set" for edge with no likelihood', () => {
    const edgeNoLikelihood: Edge = { id: 'e-ul', source: 'f1', target: 'f2', data: { weight: 0.5, direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoLikelihood]} nodes={nodes} />)
    expect(screen.getByTestId('edge-e-ul-likelihood-notset')).toHaveTextContent('Not set')
    // No actionable button — no default injection
    expect(screen.queryByTestId('edge-e-ul-likelihood-unset')).not.toBeInTheDocument()
  })

  it('does not write defaults when rendering missing values', () => {
    mockUpdateEdge.mockClear()
    const edgeMissing: Edge = { id: 'e-m', source: 'f1', target: 'f2', data: { direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeMissing]} nodes={nodes} />)
    // Simply rendering should not trigger any store writes
    expect(mockUpdateEdge).not.toHaveBeenCalled()
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

// ── Contested edge integration ─────────────────────────────────────────────────

import type { ValidationMetadata } from '../../../domain/validation'

function makeContested(id: string, source: string, target: string, vmOverrides: Partial<ValidationMetadata> = {}): Edge {
  const vm: ValidationMetadata = {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35,
      strength_std: 0.12,
      exists_probability: 0.7,
      reasoning: 'Test reasoning',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...vmOverrides,
  }
  return {
    id,
    source,
    target,
    data: { weight: 0.6, direction: 'positive', beliefExists: 0.7, provenance: 'assumption', validation: vm },
  }
}

describe('RelationshipsSection — contested integration', () => {
  it('renders contested card at top of list', () => {
    const contested = makeContested('ec', 'f1', 'f2')
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[normal, contested]} nodes={nodes} />)
    expect(screen.getByTestId('contested-card-ec')).toBeInTheDocument()
    // Normal edge still rendered as EdgeCard
    expect(screen.getByTestId('edge-card-en')).toBeInTheDocument()
  })

  it('renders separator between contested and all relationships', () => {
    const contested = makeContested('ec', 'f1', 'f2')
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[normal, contested]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-separator')).toBeInTheDocument()
  })

  it('does not render separator when no contested edges', () => {
    const normal = makeEdge('en', 'f1', 'f2')
    render(<RelationshipsSection edges={[normal]} nodes={nodes} />)
    expect(screen.queryByTestId('relationships-separator')).not.toBeInTheDocument()
  })

  it('shows contested count badge in header', () => {
    const contested = makeContested('ec', 'f1', 'f2')
    render(<RelationshipsSection edges={[contested]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-contested-count')).toHaveTextContent('1 contested')
  })

  it('one-per-target-node cap: only highest-priority contested edge per target shown as ContestedEdgeCard', () => {
    // Two contested edges with the same target node (f2)
    const ec1 = makeContested('ec1', 'f1', 'f2', { max_divergence: 0.8 })
    const ec2 = makeContested('ec2', 'f1', 'f2', { max_divergence: 0.4 })
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[ec1, ec2, normal]} nodes={nodes} />)
    // ec1 has higher max_divergence → gets the contested card
    expect(screen.getByTestId('contested-card-ec1')).toBeInTheDocument()
    // ec2 is capped out → rendered as plain EdgeCard with contested pill
    expect(screen.queryByTestId('contested-card-ec2')).not.toBeInTheDocument()
    expect(screen.getByTestId('edge-card-ec2')).toBeInTheDocument()
  })

  it('one-per-target-node cap with 3 edges sharing same target — only 1 gets contested card', () => {
    // Three contested edges all targeting f2
    const ec1 = makeContested('ec1', 'f1', 'f2', { max_divergence: 0.9 })
    const ec2 = makeContested('ec2', 'f1', 'f2', { max_divergence: 0.6 })
    const ec3 = makeContested('ec3', 'f1', 'f2', { max_divergence: 0.3 })
    render(<RelationshipsSection edges={[ec1, ec2, ec3]} nodes={nodes} />)
    // Only ec1 (highest divergence) gets the contested card
    expect(screen.getByTestId('contested-card-ec1')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-card-ec2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contested-card-ec3')).not.toBeInTheDocument()
    // ec2 and ec3 rendered as plain EdgeCards
    expect(screen.getByTestId('edge-card-ec2')).toBeInTheDocument()
    expect(screen.getByTestId('edge-card-ec3')).toBeInTheDocument()
  })

  it('edges from different target nodes each get a contested card', () => {
    // f3 is a third node
    const n3 = makeNode('f3', 'Factor C')
    const ec1 = makeContested('ec1', 'f1', 'f2')
    const ec2 = makeContested('ec2', 'f2', 'f3')
    render(<RelationshipsSection edges={[ec1, ec2]} nodes={[...nodes, n3]} />)
    expect(screen.getByTestId('contested-card-ec1')).toBeInTheDocument()
    expect(screen.getByTestId('contested-card-ec2')).toBeInTheDocument()
  })

  it('resolved contested edge moves to plain card (no longer contested)', () => {
    const resolved = makeContested('ec', 'f1', 'f2', { user_action: 'accepted_pass1' })
    render(<RelationshipsSection edges={[resolved]} nodes={nodes} />)
    // Resolved edge: user_action !== 'pending', so not in contested group
    expect(screen.queryByTestId('contested-card-ec')).not.toBeInTheDocument()
    // Rendered as plain edge card instead
    expect(screen.getByTestId('edge-card-ec')).toBeInTheDocument()
  })

  it('calls onResolveContested with correct args', () => {
    const onResolve = vi.fn()
    const contested = makeContested('ec', 'f1', 'f2')
    render(
      <RelationshipsSection
        edges={[contested]}
        nodes={nodes}
        onResolveContested={onResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-dismiss-ec'))
    expect(onResolve).toHaveBeenCalledWith('ec', 'dismissed')
  })

  it('edges without validation field render normally as EdgeCards', () => {
    const plain = makeEdge('ep', 'f1', 'f2')
    render(<RelationshipsSection edges={[plain]} nodes={nodes} />)
    expect(screen.getByTestId('edge-card-ep')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-card-ep')).not.toBeInTheDocument()
  })

  it('edge with validation.status=agreed renders as EdgeCard (no contested treatment)', () => {
    const agreed: Edge = {
      id: 'ea', source: 'f1', target: 'f2',
      data: {
        weight: 0.5, direction: 'positive', beliefExists: 0.7, provenance: 'assumption',
        validation: {
          status: 'agreed', contested_reasons: [],
          pass1: { strength_mean: 0.5, strength_std: 0.1, exists_probability: 0.7 },
          pass2: { strength_mean: 0.5, strength_std: 0.1, exists_probability: 0.7, reasoning: 'Agreed', basis: 'domain_prior', needs_user_input: false },
          max_divergence: 0, distance_to_goal: 1,
          evoi_rank: null, evoi_impact: null, was_shown: true,
          user_action: 'pending', resolved_value: null, resolved_by: 'default',
        },
      },
    }
    render(<RelationshipsSection edges={[agreed]} nodes={nodes} />)
    expect(screen.getByTestId('edge-card-ea')).toBeInTheDocument()
    expect(screen.queryByTestId('contested-card-ea')).not.toBeInTheDocument()
  })

  it('post-analysis: sorts by evoi_impact desc when evoi_rank is set', () => {
    const n3 = makeNode('f3', 'Factor C')
    const highImpact = makeContested('ec1', 'f1', 'f2', { evoi_rank: 2, evoi_impact: 15, max_divergence: 0.3 })
    const lowImpact  = makeContested('ec2', 'f1', 'f3', { evoi_rank: 1, evoi_impact: 5,  max_divergence: 0.9 })
    render(<RelationshipsSection edges={[lowImpact, highImpact]} nodes={[...nodes, n3]} />)
    // Both get contested cards (different targets)
    const contestedCards = screen.getAllByTestId(/^contested-card-/)
    expect(contestedCards[0]).toHaveAttribute('data-testid', 'contested-card-ec1')
    expect(contestedCards[1]).toHaveAttribute('data-testid', 'contested-card-ec2')
  })
})
