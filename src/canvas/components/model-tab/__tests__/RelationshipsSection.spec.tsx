/**
 * RelationshipsSection — unit tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RelationshipsSection } from '../RelationshipsSection'
import type { Edge, Node } from '@xyflow/react'
import { USER_EDGE_DEFAULTS } from '../../../domain/edges'
import { edgeValueSourcePatch } from '../../../domain/edgeValueProvenance'

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const { mockUpdateEdge, mockStoreState } = vi.hoisted(() => {
  const updateEdge = vi.fn()
  const setHighlightedEdges = vi.fn()
  const setHighlightedNodes = vi.fn()
  const highlightedEdges = new Set<string>()
  return {
    mockUpdateEdge: updateEdge,
    mockStoreState: {
      updateEdge,
      setHighlightedEdges,
      setHighlightedNodes,
      highlightedEdges,
      // ROADMAP 2.121 slice 1: edge edits commit through
      // `useEdgeMutations`, which reads the edge back out of
      // `useCanvasStore.getState().edges` before writing — that read is what
      // stops a commit resurrecting a stale render-time `data` blob. Any test
      // that drives an edge edit must put the edge here.
      edges: [] as unknown[],
    },
  }
})

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState },
  )
  return { useCanvasStore }
})

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

/**
 * An edge whose strength and likelihood were actually CHARACTERISED.
 *
 * The stamps are not decoration — they are what makes this fixture a model of
 * a real edge. The card is provenance-gated, so an unstamped edge renders
 * "Not set" no matter what numbers `data` carries. Before the F1 fix these
 * tests passed WITHOUT the stamps, which is precisely the bug: the component
 * could not tell a value somebody set from one that fell through a default,
 * and the tests inherited that blindness.
 *
 * For the unstamped case — a freshly drawn edge — see the
 * `USER_EDGE_DEFAULTS` describe block below.
 */
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
      ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user' }),
    },
  }
}

const nodes = [makeNode('f1', 'Factor A'), makeNode('f2', 'Factor B')]

/** An edge exactly as a user drag produces it: numbers present, no stamps. */
function makeUnstampedEdge(id: string, source: string, target: string, weight: number): Edge {
  return {
    id,
    source,
    target,
    data: { ...USER_EDGE_DEFAULTS, weight, provenance: 'assumption' },
  } as Edge
}

/**
 * ORDER is a channel too, and it was the last one leaking here.
 *
 * #473 gated this section's colour, width, StrengthBar and band label. The
 * SORT still read `aData?.weight != null ? weight : -Infinity` — a TAUTOLOGY,
 * because `USER_EDGE_DEFAULTS`/`DEFAULT_EDGE_DATA` always define `weight`. So
 * the `-Infinity` arm was dead and a card whose own body says "Not set" ranked
 * above a measured one purely on its default.
 *
 * CLAIM TYPE: rendered ORDER — the sequence of `edge-card-*` testids in the
 * DOM. Not visibility, not layout.
 */
describe('RelationshipsSection — sort order is provenance-gated', () => {
  function renderedOrder(): string[] {
    return Array.from(document.querySelectorAll('[data-testid^="edge-card-"]')).map(
      el => el.getAttribute('data-testid') as string,
    )
  }

  it('ranks an unset edge BELOW a measured one, even when its default is larger', () => {
    // The unset edge's fabricated weight (0.9) beats the measured one (0.2).
    // Under the old sentinel it sorted first; "we measured a small effect"
    // must outrank "nobody has said".
    const edges = [
      makeUnstampedEdge('unset', 'f1', 'f2', 0.9),
      makeEdge('measured', 'f2', 'f1', { weight: 0.2 }),
    ]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(renderedOrder()).toEqual(['edge-card-measured', 'edge-card-unset'])
  })

  it('still orders two MEASURED edges by weight descending (discrimination)', () => {
    const edges = [
      makeEdge('weak', 'f1', 'f2', { weight: 0.2 }),
      makeEdge('strong', 'f2', 'f1', { weight: 0.9 }),
    ]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    expect(renderedOrder()).toEqual(['edge-card-strong', 'edge-card-weak'])
  })
})

describe('RelationshipsSection', () => {
  it('renders empty state when no causal edges', () => {
    render(<RelationshipsSection edges={[]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-empty-state')).toHaveTextContent(
      /No causal relationships in the model yet/i,
    )
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
    // Click to expand card (progressive disclosure)
    fireEvent.click(screen.getByTestId('edge-card-e-uw'))
    expect(screen.getByTestId('edge-e-uw-strength-notset')).toHaveTextContent('Not set')
    // No actionable button — no default injection
    expect(screen.queryByTestId('edge-e-uw-weight-unset')).not.toBeInTheDocument()
  })

  it('renders "Not set" for edge with no likelihood', () => {
    const edgeNoLikelihood: Edge = { id: 'e-ul', source: 'f1', target: 'f2', data: { weight: 0.5, direction: 'positive' } }
    render(<RelationshipsSection edges={[edgeNoLikelihood]} nodes={nodes} />)
    // Click to expand card (progressive disclosure)
    fireEvent.click(screen.getByTestId('edge-card-e-ul'))
    expect(screen.getByTestId('edge-e-ul-likelihood-notset')).toHaveTextContent('Not set')
    // No actionable button — no default injection
    expect(screen.queryByTestId('edge-e-ul-likelihood-unset')).not.toBeInTheDocument()
  })

  // ── F1: the gate that could not fire ──────────────────────────────────
  //
  // The two "Not set" tests above build `data` with the field literally
  // absent. That state does not exist in the product: every edge is
  // constructed by spreading DEFAULT_EDGE_DATA or USER_EDGE_DEFAULTS, both of
  // which ALWAYS define `weight` and `beliefExists`. So the old read gate
  // (`rawWeight !== undefined`) was true for every real edge and the "Not set"
  // branches were statically unreachable on the canvas — while the comment
  // above them claimed "treat absent fields as truly unset (no silent
  // defaults)".
  //
  // These tests use the SHAPE THE PRODUCT ACTUALLY BUILDS.
  describe('a freshly drawn edge (USER_EDGE_DEFAULTS) — nothing was characterised', () => {
    function drawnEdge(id = 'e-drawn'): Edge {
      return { id, source: 'f1', target: 'f2', data: { ...USER_EDGE_DEFAULTS } }
    }

    it('does NOT speak the defaulted strength', () => {
      render(<RelationshipsSection edges={[drawnEdge()]} nodes={nodes} />)
      fireEvent.click(screen.getByTestId('edge-card-e-drawn'))
      expect(screen.getByTestId('edge-e-drawn-strength-notset')).toHaveTextContent('Not set')
    })

    it('does NOT speak the defaulted likelihood, nor draw the reassuring green bar', () => {
      render(<RelationshipsSection edges={[drawnEdge()]} nodes={nodes} />)
      fireEvent.click(screen.getByTestId('edge-card-e-drawn'))
      expect(screen.getByTestId('edge-e-drawn-likelihood-notset')).toHaveTextContent('Not set')
      // 0.8 lands in the >= 70 band, so the old code rendered `bg-success`:
      // a reassuring signal about a relationship nobody has characterised.
      expect(document.querySelector('.bg-success')).toBeNull()
    })

    it('does not render a percentage anywhere on the card', () => {
      render(<RelationshipsSection edges={[drawnEdge()]} nodes={nodes} />)
      fireEvent.click(screen.getByTestId('edge-card-e-drawn'))
      expect(screen.getByTestId('edge-card-e-drawn').textContent ?? '').not.toMatch(/\d+%/)
    })

    it('POSITIVE CONTROL: the same card DOES speak the values once they are stamped', () => {
      // Without this the assertions above would pass on a component that
      // rendered "Not set" unconditionally.
      const stamped: Edge = {
        id: 'e-stamped',
        source: 'f1',
        target: 'f2',
        data: {
          ...USER_EDGE_DEFAULTS,
          weight: 0.8,
          beliefExists: 0.9,
          direction: 'positive',
          ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user' }),
        },
      }
      render(<RelationshipsSection edges={[stamped]} nodes={nodes} />)
      fireEvent.click(screen.getByTestId('edge-card-e-stamped'))
      expect(screen.queryByTestId('edge-e-stamped-strength-notset')).toBeNull()
      expect(screen.queryByTestId('edge-e-stamped-likelihood-notset')).toBeNull()
      expect(screen.getByTestId('edge-card-e-stamped').textContent ?? '').toMatch(/90%/)
    })
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
    // Click to expand card (progressive disclosure)
    fireEvent.click(screen.getByTestId('edge-card-e1'))
    expect(screen.getByTestId('edge-e1-likelihood-display')).toHaveTextContent('85')
  })

  it('writes the belief through the sanctioned setter when likelihood is edited', () => {
    mockUpdateEdge.mockClear()
    const edges = [makeEdge('e1', 'f1', 'f2', { beliefExists: 0.7 })]
    mockStoreState.edges = edges
    render(<RelationshipsSection edges={edges} nodes={nodes} />)
    // Click to expand card (progressive disclosure)
    fireEvent.click(screen.getByTestId('edge-card-e1'))

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

  it('reads beliefExists (canonical store name)', () => {
    const edgeWithBelief: Edge = {
      id: 'e-ep', source: 'f1', target: 'f2',
      data: {
        weight: 0.7, direction: 'positive', beliefExists: 0.73, provenance: 'assumption',
        ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user' }),
      },
    }
    render(<RelationshipsSection edges={[edgeWithBelief]} nodes={nodes} />)
    // Click to expand card (progressive disclosure)
    fireEvent.click(screen.getByTestId('edge-card-e-ep'))
    expect(screen.getByTestId('edge-e-ep-likelihood-display')).toHaveTextContent('73')
  })

  it('shows compact summary when collapsed and full controls when expanded', () => {
    const edges = [makeEdge('e1', 'f1', 'f2', { weight: 0.5, direction: 'positive', beliefExists: 0.7 })]
    render(<RelationshipsSection edges={edges} nodes={nodes} />)

    // Collapsed: strength label and coefficient visible in summary
    const summary = screen.getByTestId('edge-e1-summary')
    expect(summary).toBeInTheDocument()
    expect(summary.textContent).toContain('Moderate positive effect')
    expect(summary.textContent).toContain('+0.50')

    // Collapsed: InlineEdit for weight NOT visible
    expect(screen.queryByTestId('edge-e1-weight')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByTestId('edge-card-e1'))

    // Expanded: InlineEdit for weight IS visible
    expect(screen.getByTestId('edge-e1-weight-display')).toBeInTheDocument()
  })
})

// ── Expert inline data ────────────────────────────────────────────────────────

import { DetailToggleContext } from '../DetailToggleContext'

describe('RelationshipsSection — expert inline data', () => {
  it('shows σ and p on compact row when expert mode ON', () => {
    const edgeWithStd: Edge = {
      id: 'e1', source: 'f1', target: 'f2',
      data: {
        weight: 0.5, direction: 'positive', beliefExists: 0.8, strengthStd: 0.15, provenance: 'assumption',
        ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user' }),
      },
    }
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <RelationshipsSection edges={[edgeWithStd]} nodes={nodes} />
      </DetailToggleContext.Provider>
    )
    expect(screen.getByTestId('edge-e1-inline-std')).toHaveTextContent('σ0.15')
    expect(screen.getByTestId('edge-e1-inline-p')).toHaveTextContent('p0.80')
  })

  it('hides σ and p on compact row when expert mode OFF', () => {
    const edgeWithStd: Edge = {
      id: 'e1', source: 'f1', target: 'f2',
      data: {
        weight: 0.5, direction: 'positive', beliefExists: 0.8, strengthStd: 0.15, provenance: 'assumption',
        ...edgeValueSourcePatch({ weight: 'user', beliefExists: 'user' }),
      },
    }
    render(
      <DetailToggleContext.Provider value={{ showDetail: false }}>
        <RelationshipsSection edges={[edgeWithStd]} nodes={nodes} />
      </DetailToggleContext.Provider>
    )
    expect(screen.queryByTestId('edge-e1-inline-std')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edge-e1-inline-p')).not.toBeInTheDocument()
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

  it('shows contested count in accordion header', () => {
    const contested = makeContested('ec', 'f1', 'f2')
    const { container } = render(<RelationshipsSection edges={[contested]} nodes={nodes} />)
    // tierLabel renders "1 contested" inside the Accordion header
    expect(container.textContent).toContain('1 contested')
  })

  it('renders every pending contested edge as a ContestedEdgeCard, even when sharing a target node', () => {
    // Two contested edges with the same target node (f2). The model tab does
    // NOT apply the one-per-target-node cap — that policy belongs to the
    // pre-analysis panel. The full audit must keep every pending edge
    // directly actionable.
    const ec1 = makeContested('ec1', 'f1', 'f2', { max_divergence: 0.8 })
    const ec2 = makeContested('ec2', 'f1', 'f2', { max_divergence: 0.4 })
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[ec1, ec2, normal]} nodes={nodes} />)
    expect(screen.getByTestId('contested-card-ec1')).toBeInTheDocument()
    expect(screen.getByTestId('contested-card-ec2')).toBeInTheDocument()
    // Neither is shoved into the plain-EdgeCard fallback
    expect(screen.queryByTestId('edge-card-ec1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edge-card-ec2')).not.toBeInTheDocument()
  })

  it('orders shared-target contested edges by max_divergence desc', () => {
    const ec1 = makeContested('ec1', 'f1', 'f2', { max_divergence: 0.3 })
    const ec2 = makeContested('ec2', 'f1', 'f2', { max_divergence: 0.9 })
    const ec3 = makeContested('ec3', 'f1', 'f2', { max_divergence: 0.6 })
    render(<RelationshipsSection edges={[ec1, ec2, ec3]} nodes={nodes} />)
    const cards = screen.getAllByTestId(/^contested-card-/)
    expect(cards.map(c => c.getAttribute('data-testid'))).toEqual([
      'contested-card-ec2',
      'contested-card-ec3',
      'contested-card-ec1',
    ])
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

// ── Summary line ───────────────────────────────────────────────────────────────

describe('RelationshipsSection — summary line', () => {
  it('shows pre-analysis count summary when there are pending contested edges', () => {
    const contested = makeContested('ec', 'f1', 'f2', { evoi_impact: null, evoi_rank: null })
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[contested, normal]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-summary')).toHaveTextContent('1 contested, 1 agreed.')
  })

  it('appends post-analysis impact tail when topGroup has non-null evoi_impact', () => {
    const contested = makeContested('ec', 'f1', 'f2', { evoi_rank: 1, evoi_impact: 8 })
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[contested, normal]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-summary')).toHaveTextContent(
      /1 contested, 1 agreed\. Resolving the top contested relationship is worth 8pp of confidence\./,
    )
  })

  it('drops the post-analysis tail when no pending contested edges remain', () => {
    // Resolved contested is no longer "pending" — it counts toward agreed
    const resolved = makeContested('ec', 'f1', 'f2', {
      evoi_rank: 1,
      evoi_impact: 8,
      user_action: 'accepted_pass1',
    })
    const normal = makeEdge('en', 'f2', 'f1')
    render(<RelationshipsSection edges={[resolved, normal]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-summary')).toHaveTextContent('All 2 relationships agreed.')
    expect(screen.getByTestId('relationships-summary').textContent).not.toMatch(/worth/i)
  })

  it('uses "agreed" not "reviewed" when nothing is pending', () => {
    const normal = makeEdge('en', 'f1', 'f2')
    render(<RelationshipsSection edges={[normal]} nodes={nodes} />)
    expect(screen.getByTestId('relationships-summary')).toHaveTextContent('All 1 relationships agreed.')
    expect(screen.getByTestId('relationships-summary').textContent).not.toMatch(/reviewed/i)
  })
})
