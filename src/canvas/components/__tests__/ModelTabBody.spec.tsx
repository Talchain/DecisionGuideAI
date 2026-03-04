/**
 * ModelTabBody — unit tests (Phase 2 coverage)
 *
 * Covers:
 *  - Source mapping: canonical value preserved through edit roundtrip
 *  - Attention banner: conditions (fragile / missing-source / defaulted)
 *  - Warning copy: accurate count in defaulted-edges warning
 *  - Factor sort: needs-attention items first
 *  - Edge sort: fragile edges first
 *  - Inline edit: Enter commits, Escape cancels, blur commits
 *  - Search filtering
 *  - Fragile badge visibility guard (post-analysis only)
 *  - Goal headline visibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelTabBody } from '../ModelTabBody'
import type { Node, Edge } from '@xyflow/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: any) => any) =>
    selector({ updateNode: mockUpdateNode, updateEdge: mockUpdateEdge })
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGoalNode(id = 'goal-1', label = 'Maximise Revenue'): Node {
  return { id, type: 'goal', position: { x: 0, y: 0 }, data: { label } }
}

function makeFactorNode(
  id: string,
  label: string,
  opts: { source?: string; value?: number; category?: string } = {}
): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      category: opts.category ?? 'observable',
      observedState: {
        value: opts.value ?? 0.5,
        source: opts.source,
      },
    },
  }
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  opts: { weight?: number; strengthStd?: number; provenance?: string; direction?: string } = {}
): Edge {
  return {
    id,
    source,
    target,
    data: {
      weight: opts.weight ?? 0.5,
      strengthStd: opts.strengthStd ?? 0.125,
      provenance: opts.provenance ?? 'assumption',
      direction: opts.direction ?? 'positive',
    },
  }
}

const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Goal headline', () => {
  it('shows goal label when a goal node is present', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode('g1', 'Pick the right vendor')]}
        edges={[]}
      />
    )
    expect(screen.getByTestId('model-goal-headline')).toBeInTheDocument()
    expect(screen.getByText('Pick the right vendor')).toBeInTheDocument()
  })

  it('hides goal headline when no goal node', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeFactorNode('f1', 'Budget')]}
        edges={[]}
      />
    )
    expect(screen.queryByTestId('model-goal-headline')).not.toBeInTheDocument()
  })
})

describe('Source mapping — canonical value preserved', () => {
  it('shows friendly display label in read mode for cee_inference', () => {
    const nodes = [makeFactorNode('f1', 'Market size', { source: 'cee_inference' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    // Display text shows friendly label
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('shows friendly display label for brief_extraction', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'brief_extraction' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    expect(screen.getByText('From brief')).toBeInTheDocument()
  })

  it('shows AddSourcePill when source is absent', () => {
    const nodes = [makeFactorNode('f1', 'Cost', { source: undefined })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    expect(screen.getByText('+ Add source')).toBeInTheDocument()
  })

  it('calls updateNode with canonical source value, not display label', () => {
    const nodes = [makeFactorNode('f1', 'Market size', { source: 'cee_inference' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    // Click to enter edit mode
    const displayBtn = screen.getByTestId('factor-f1-source-display')
    fireEvent.click(displayBtn)

    // Input should show the canonical value
    const input = screen.getByTestId('factor-f1-source')
    expect((input as HTMLInputElement).value).toBe('cee_inference')

    // Type a new canonical value and commit
    fireEvent.change(input, { target: { value: 'user' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({
        data: expect.objectContaining({
          observedState: expect.objectContaining({ source: 'user' }),
        }),
      })
    )
  })
})

describe('Attention banner conditions', () => {
  const fragileEdge = makeEdge('e1', 'f1', 'f2')
  const robustnessWithFragile = {
    fragileEdges: [{ edgeId: 'e1', switchProbability: 0.8 }],
    robustEdges: [],
    stabilityScore: 0.5,
  }

  it('is hidden pre-analysis (robustness null)', () => {
    const nodes = [makeFactorNode('f1', 'Factor'), makeFactorNode('f2', 'Factor 2')]
    const edges = [fragileEdge]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} robustness={null} />)
    expect(screen.queryByTestId('model-attention-banner')).not.toBeInTheDocument()
  })

  it('shows when there are fragile edges post-analysis', () => {
    const nodes = [makeFactorNode('f1', 'Factor'), makeFactorNode('f2', 'Factor 2')]
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={nodes}
        edges={[fragileEdge]}
        robustness={robustnessWithFragile}
      />
    )
    expect(screen.getByTestId('model-attention-banner')).toBeInTheDocument()
    expect(screen.getByText(/1 fragile edge/)).toBeInTheDocument()
  })

  it('shows when factors are missing source post-analysis', () => {
    const nodes = [makeFactorNode('f1', 'Factor', { source: undefined })]
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={nodes}
        edges={[]}
        robustness={{ fragileEdges: [], robustEdges: [], stabilityScore: 0.9 }}
      />
    )
    expect(screen.getByTestId('model-attention-banner')).toBeInTheDocument()
    expect(screen.getByText(/1 factor missing source/)).toBeInTheDocument()
  })
})

describe('Defaulted-edges warning copy', () => {
  it('shows accurate count (not "All edges")', () => {
    // 3 edges with default weight=0.5 + strengthStd=0.125 triggers warning (> 2)
    const nodes = [
      makeFactorNode('f1', 'A'),
      makeFactorNode('f2', 'B'),
      makeFactorNode('f3', 'C'),
      makeFactorNode('f4', 'D'),
    ]
    const edges = [
      makeEdge('e1', 'f1', 'f2', { weight: 0.5, strengthStd: 0.125 }),
      makeEdge('e2', 'f2', 'f3', { weight: 0.5, strengthStd: 0.125 }),
      makeEdge('e3', 'f3', 'f4', { weight: 0.5, strengthStd: 0.125 }),
    ]
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={nodes}
        edges={edges}
      />
    )
    const warning = screen.getByTestId('model-defaulted-warning')
    expect(warning.textContent).toMatch(/3 edges use default AI-generated parameters/)
    // Ensure "All edges" phrase is NOT present
    expect(warning.textContent).not.toMatch(/All edges/)
  })

  it('is hidden when defaultedEdgeCount <= 2', () => {
    const nodes = [makeFactorNode('f1', 'A'), makeFactorNode('f2', 'B')]
    const edges = [makeEdge('e1', 'f1', 'f2', { weight: 0.5, strengthStd: 0.125 })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    expect(screen.queryByTestId('model-defaulted-warning')).not.toBeInTheDocument()
  })
})

describe('Inline edit — Enter/Escape/blur (source field)', () => {
  // Use source field for inline edit tests: it always gets an InlineEdit when source is set

  it('commits on blur', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'user' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const displayEl = screen.getByTestId('factor-f1-source-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-source')
    fireEvent.change(input, { target: { value: 'brief_extraction' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({
        data: expect.objectContaining({
          observedState: expect.objectContaining({ source: 'brief_extraction' }),
        }),
      })
    )
  })

  it('commits on Enter', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'user' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const displayEl = screen.getByTestId('factor-f1-source-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-source')
    fireEvent.change(input, { target: { value: 'brief_extraction' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdateNode).toHaveBeenCalled()
  })

  it('cancels on Escape without calling updateNode', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { source: 'user' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const displayEl = screen.getByTestId('factor-f1-source-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-source')
    fireEvent.change(input, { target: { value: 'something_else' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockUpdateNode).not.toHaveBeenCalled()
    // Display button should be back
    expect(screen.getByTestId('factor-f1-source-display')).toBeInTheDocument()
  })
})

describe('Search filtering', () => {
  it('filters factors by label', () => {
    const nodes = [
      makeFactorNode('f1', 'Market size', { source: 'user' }),
      makeFactorNode('f2', 'Interest rate', { source: 'user' }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const search = screen.getByTestId('model-search')
    fireEvent.change(search, { target: { value: 'market' } })

    expect(screen.getByText('Market size')).toBeInTheDocument()
    expect(screen.queryByText('Interest rate')).not.toBeInTheDocument()
  })

  it('shows no-match message when query has no results', () => {
    const nodes = [makeFactorNode('f1', 'Market size')]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const search = screen.getByTestId('model-search')
    fireEvent.change(search, { target: { value: 'zzznomatch' } })

    expect(screen.getByText('No matching factors.')).toBeInTheDocument()
  })
})

describe('Fragile badge — post-analysis guard', () => {
  const nodes = [
    makeFactorNode('f1', 'Factor A'),
    makeFactorNode('f2', 'Factor B'),
  ]
  const edge = makeEdge('e1', 'f1', 'f2')

  it('does not show fragile badge pre-analysis', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={nodes}
        edges={[edge]}
        robustness={null}
      />
    )
    expect(screen.queryByText('fragile')).not.toBeInTheDocument()
  })

  it('shows fragile badge post-analysis when edge is fragile', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={nodes}
        edges={[edge]}
        robustness={{
          fragileEdges: [{ edgeId: 'e1', switchProbability: 0.8 }],
          robustEdges: [],
          stabilityScore: 0.5,
        }}
      />
    )
    expect(screen.getByText('fragile')).toBeInTheDocument()
  })

  it('shows fragile badge when PLoT uses canonical from->to edge ID (not RF ID)', () => {
    // PLoT returns canonical IDs like "fac_pmf->out_cac"; RF edge ID is "e-5"
    // The lookup must match by source+target when string IDs differ
    const rfEdge = makeEdge('e-5', 'fac_pmf', 'out_cac')
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[
          makeFactorNode('fac_pmf', 'Product market fit'),
          makeFactorNode('out_cac', 'Customer acquisition'),
        ]}
        edges={[rfEdge]}
        robustness={{
          fragileEdges: [{ edgeId: 'fac_pmf->out_cac', fromId: 'fac_pmf', toId: 'out_cac', switchProbability: 0.72 }],
          robustEdges: [],
          stabilityScore: 0.45,
        }}
      />
    )
    expect(screen.getByText('fragile')).toBeInTheDocument()
  })
})

describe('Golden UI test — headline numbers regression guard', () => {
  // Build a mixed graph: causal nodes + organisational (decision + options)
  function makeDecisionNode(id = 'd1', label = 'Which vendor?'): Node {
    return { id, type: 'decision', position: { x: 0, y: 0 }, data: { label } }
  }

  function makeOptionNode(id: string, label: string): Node {
    return { id, type: 'option', position: { x: 0, y: 0 }, data: { label } }
  }

  function makeGoalNode(id: string, label: string): Node {
    return { id, type: 'goal', position: { x: 0, y: 0 }, data: { label } }
  }

  const goalNode = makeGoalNode('g1', 'Maximise Revenue')
  const f1 = makeFactorNode('f1', 'Market size', { source: 'brief_extraction' })
  const f2 = makeFactorNode('f2', 'Churn rate', { source: 'cee_inference' })
  const f3 = makeFactorNode('f3', 'Team size', { source: 'user' })
  const decision = makeDecisionNode('d1', 'Which strategy?')
  const optA = makeOptionNode('opt_a', 'Option A')
  const optB = makeOptionNode('opt_b', 'Option B')

  // Causal edges (between factors + goal)
  const e1: Edge = {
    id: 'e1', source: 'f1', target: 'g1',
    data: { weight: 0.8, strengthStd: 0.1, provenance: 'user_study', direction: 'positive', beliefExists: 0.85 },
  }
  const e2: Edge = {
    id: 'e2', source: 'f2', target: 'g1',
    data: { weight: 0.6, strengthStd: 0.15, provenance: 'assumption', direction: 'negative', beliefExists: 0.90 },
  }
  // Organisational edges (to/from decision+options — excluded from causal)
  const e3: Edge = { id: 'e3', source: 'd1', target: 'opt_a', data: {} }

  const allNodes = [goalNode, f1, f2, f3, decision, optA, optB]
  const allEdges = [e1, e2, e3]

  it('connectivity card shows causal node count only (excludes decision + options)', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={allNodes}
        edges={allEdges}
      />
    )
    // Causal nodes: g1, f1, f2, f3 = 4 nodes
    // Decision + options are excluded from denominator
    // f3 has no edges → 3 of 4 connected
    const connectCard = screen.getByText(/of 4/)
    expect(connectCard).toBeInTheDocument()
    // Ensure "of 7" (full count) is NOT shown
    expect(screen.queryByText(/of 7/)).not.toBeInTheDocument()
  })

  it('evidence coverage count reflects only causal edges', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={allNodes}
        edges={allEdges}
      />
    )
    // e1 has provenance 'user_study' (evidence) — e2 is 'assumption' (no evidence)
    // e3 is an organisational edge, excluded
    // So: 1 of 2 causal edges have evidence
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('edge likelihood % matches beliefExists * 100', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={allNodes}
        edges={allEdges}
      />
    )
    // e1 beliefExists = 0.85 → 85%
    // e2 beliefExists = 0.90 → 90%
    // Both should appear as likelihood values
    expect(screen.getByTestId('edge-e1-likelihood-display')).toHaveTextContent('85')
    expect(screen.getByTestId('edge-e2-likelihood-display')).toHaveTextContent('90')
  })

  it('edge likelihood % reads exists_probability when beliefExists is absent', () => {
    // Edges hydrated outside DraftChat (e.g. scenario restore) may carry only exists_probability
    const edgeWithExistsProb: Edge = {
      id: 'e-ep', source: 'f1', target: 'g1',
      data: { weight: 0.7, strengthStd: 0.1, provenance: 'assumption', direction: 'positive', exists_probability: 0.73 },
    }
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeGoalNode('g1', 'Goal'), makeFactorNode('f1', 'Factor')]}
        edges={[edgeWithExistsProb]}
      />
    )
    // exists_probability = 0.73 → 73%; must NOT fall back to default 70%
    expect(screen.getByTestId('edge-e-ep-likelihood-display')).toHaveTextContent('73')
  })
})

describe('Attention banner — source category split', () => {
  const postAnalysis = { fragileEdges: [], robustEdges: [], stabilityScore: 0.9 }

  it('shows "AI-estimated" for cee_inference source, not "missing source"', () => {
    const nodes = [makeFactorNode('f1', 'Revenue', { source: 'cee_inference' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} robustness={postAnalysis} />)
    expect(screen.getByTestId('model-attention-banner')).toBeInTheDocument()
    expect(screen.getByText(/1 AI-estimated/)).toBeInTheDocument()
    expect(screen.queryByText(/missing source/)).not.toBeInTheDocument()
  })

  it('shows "missing source" for truly absent source', () => {
    const nodes = [makeFactorNode('f1', 'Revenue', { source: undefined })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} robustness={postAnalysis} />)
    expect(screen.getByText(/1 factor missing source/)).toBeInTheDocument()
    expect(screen.queryByText(/AI-estimated/)).not.toBeInTheDocument()
  })

  it('shows both categories when mixed', () => {
    const nodes = [
      makeFactorNode('f1', 'Revenue', { source: undefined }),
      makeFactorNode('f2', 'Churn', { source: 'cee_inference' }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} robustness={postAnalysis} />)
    expect(screen.getByText(/1 factor missing source.*1 AI-estimated/)).toBeInTheDocument()
  })
})

describe('External factor — range display', () => {
  function makeExternalNode(id: string, label: string, priorMin?: number, priorMax?: number): Node {
    return {
      id,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label,
        category: 'external',
        ...(priorMin !== undefined && priorMax !== undefined
          ? { prior: { range_min: priorMin, range_max: priorMax } }
          : {}),
      },
    }
  }

  it('shows explicit prior range when set', () => {
    const node = makeExternalNode('ef1', 'Customer churn rate', 0, 0.14)
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    // InlineEdit renders with -display suffix in read mode
    expect(screen.getByTestId('factor-ef1-prior-min-display')).toBeInTheDocument()
    expect(screen.queryByTestId('factor-ef1-default-range')).not.toBeInTheDocument()
  })

  it('shows "0 – 1 (uniform) · default range" when no prior is set', () => {
    const node = makeExternalNode('ef2', 'Market growth rate')
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.getByTestId('factor-ef2-default-range')).toBeInTheDocument()
    expect(screen.getByTestId('factor-ef2-default-range')).toHaveTextContent('0 – 1 (uniform) · default range')
    // "No range specified" must not appear anywhere
    expect(screen.queryByText(/No range specified/)).not.toBeInTheDocument()
  })

  it('shows Refine range pill when no prior is set', () => {
    const node = makeExternalNode('ef3', 'Inflation rate')
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.getByTestId('factor-ef3-refine-range')).toBeInTheDocument()
    expect(screen.getByTestId('factor-ef3-refine-range')).toHaveTextContent('Refine range')
  })

  it('does not show Refine range pill when prior is already set', () => {
    const node = makeExternalNode('ef4', 'Interest rate', 0.01, 0.1)
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.queryByTestId('factor-ef4-refine-range')).not.toBeInTheDocument()
  })
})

describe('Strengthen section — sub-headers and constraint warnings', () => {
  const fragileRobustness = {
    fragileEdges: [{ edgeId: 'e1', fromId: 'f1', toId: 'f2', switchProbability: 0.85 }],
    robustEdges: [],
    stabilityScore: 0.4,
  }

  it('shows fragile edges sub-header post-analysis', () => {
    const nodes = [makeFactorNode('f1', 'Factor A'), makeFactorNode('f2', 'Factor B')]
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} robustness={fragileRobustness} />)
    expect(screen.getByTestId('strengthen-fragile-edges')).toBeInTheDocument()
    expect(screen.getByText(/Fragile edges \(1\)/)).toBeInTheDocument()
  })

  it('shows constraint warning when critique has baseline issue', () => {
    const nodes = [makeFactorNode('f1', 'Customer churn')]
    const critique = [
      { severity: 'WARNING' as const, message: 'constraint targets Customer churn which has no baseline', code: 'CONSTRAINT_NO_BASELINE', node_id: 'f1' },
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} robustness={null} critique={critique} />)
    expect(screen.getByTestId('strengthen-constraint-warnings')).toBeInTheDocument()
    expect(screen.getByText(/Needs attention \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/has a constraint but no baseline/)).toBeInTheDocument()
  })

  it('shows no constraint warnings section when critique is empty', () => {
    const nodes = [makeFactorNode('f1', 'Factor')]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} robustness={null} critique={[]} />)
    expect(screen.queryByTestId('strengthen-constraint-warnings')).not.toBeInTheDocument()
  })
})
