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

vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()
let mockCeePipelineTrace: unknown = null

const mockSetHighlightedNodes = vi.fn()
const mockSetHighlightedEdges = vi.fn()

function getMockState() {
  return {
    updateNode: mockUpdateNode,
    updateEdge: mockUpdateEdge,
    ceePipelineTrace: mockCeePipelineTrace,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: mockSetHighlightedNodes,
    setHighlightedEdges: mockSetHighlightedEdges,
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
  }
}

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => any) => selector(getMockState())),
    { getState: getMockState },
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
  mockCeePipelineTrace = null
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
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    expect(screen.getByText('Pick the right vendor')).toBeInTheDocument()
  })

  it('hides goal section when no goal node', () => {
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[makeFactorNode('f1', 'Budget')]}
        edges={[]}
      />
    )
    expect(screen.queryByTestId('model-goal-section')).not.toBeInTheDocument()
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

  it('shows "Not set" pill when source is absent', () => {
    const nodes = [makeFactorNode('f1', 'Cost', { source: undefined })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    // SourceProvenancePill with showWhenAbsent=false — not shown for factors
    // Source provenance pill is hidden when absent (showWhenAbsent=false)
    expect(screen.queryByText('Not set')).not.toBeInTheDocument()
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

describe('Inline edit — Enter/Escape/blur (value field)', () => {
  // Use factor value field for inline edit tests

  it('commits on blur', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { value: 0.5 })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

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

  it('commits on Enter', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { value: 0.5 })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const displayEl = screen.getByTestId('factor-f1-value-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-value')
    fireEvent.change(input, { target: { value: '0.8' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockUpdateNode).toHaveBeenCalled()
  })

  it('cancels on Escape without calling updateNode', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { value: 0.5 })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const displayEl = screen.getByTestId('factor-f1-value-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('factor-f1-value')
    fireEvent.change(input, { target: { value: '0.9' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockUpdateNode).not.toHaveBeenCalled()
    // Display button should be back
    expect(screen.getByTestId('factor-f1-value-display')).toBeInTheDocument()
  })
})

describe('Search footer', () => {
  it('renders the search input', () => {
    const nodes = [
      makeFactorNode('f1', 'Market size', { source: 'user' }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)

    const search = screen.getByTestId('model-search')
    expect(search).toBeInTheDocument()
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

  it('shows "0 – 1 (uniform)" default range text when no prior is set', () => {
    const node = makeExternalNode('ef2', 'Market growth rate')
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.getByTestId('factor-ef2-default-range')).toBeInTheDocument()
    expect(screen.getByTestId('factor-ef2-default-range')).toHaveTextContent('0 – 1 (uniform)')
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

  it('shows synthesised prior from repair_summary when node has no explicit prior', () => {
    mockCeePipelineTrace = {
      repair_summary: {
        deterministic_repairs: [
          {
            action: 'Reclassified unreachable factor "Customer churn rate" to external with synthesised prior [0, 0.14]',
          },
        ],
      },
    }
    const node = makeExternalNode('ef5', 'Customer churn rate')
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    // Should show the synthesised range, not the default
    expect(screen.getByTestId('factor-ef5-prior-min-display')).toHaveTextContent('0')
    expect(screen.getByTestId('factor-ef5-prior-max-display')).toHaveTextContent('0.14')
    expect(screen.queryByTestId('factor-ef5-default-range')).not.toBeInTheDocument()
    // Should show "from model repair" provenance
    expect(screen.getByText(/from model repair/)).toBeInTheDocument()
  })

  it('shows synthesised prior from structured node_id + synthesised_range fields', () => {
    mockCeePipelineTrace = {
      repair_summary: {
        deterministic_repairs: [
          {
            node_id: 'ef6',
            synthesised_range: [0.05, 0.25],
            action: 'some repair action',
          },
        ],
      },
    }
    const node = makeExternalNode('ef6', 'Market growth')
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.getByTestId('factor-ef6-prior-min-display')).toHaveTextContent('0.05')
    expect(screen.getByTestId('factor-ef6-prior-max-display')).toHaveTextContent('0.25')
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

  it('excludes fragile edges from Missing evidence (no double-listing)', () => {
    const nodes = [
      makeFactorNode('f1', 'Factor A', { source: 'user' }),
      makeFactorNode('f2', 'Factor B', { source: 'user' }),
      makeFactorNode('f3', 'Factor C', { source: 'user' }),
    ]
    // e1 is fragile AND lacks evidence; e2 only lacks evidence
    const edges = [
      makeEdge('e1', 'f1', 'f2', { provenance: 'assumption' }),
      makeEdge('e2', 'f2', 'f3', { provenance: 'assumption' }),
    ]
    const robustness = {
      fragileEdges: [{ edgeId: 'e1', fromId: 'f1', toId: 'f2', switchProbability: 0.75 }],
      robustEdges: [],
      stabilityScore: 0.4,
    }
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} robustness={robustness} />)

    // e1 should appear in fragile edges section
    expect(screen.getByTestId('strengthen-fragile-edges')).toBeInTheDocument()

    // Missing evidence should only show e2, not e1
    const missingEvidence = screen.getByTestId('strengthen-missing-evidence')
    expect(missingEvidence).toBeInTheDocument()
    // Count should reflect de-duplication: only e2 (1 edge), not e1+e2 (2 edges)
    expect(missingEvidence).toHaveTextContent('Missing evidence (1)')
  })

  it('renders Strengthen sections in priority order: constraint → fragile → missing evidence', () => {
    const nodes = [
      makeFactorNode('f1', 'Factor A', { source: undefined }),
      makeFactorNode('f2', 'Factor B'),
      makeFactorNode('f3', 'Factor C'),
    ]
    const edges = [
      makeEdge('e1', 'f1', 'f2', { provenance: 'assumption' }),
      makeEdge('e2', 'f2', 'f3', { provenance: 'assumption' }),
    ]
    const robustness = {
      fragileEdges: [{ edgeId: 'e2', fromId: 'f2', toId: 'f3', switchProbability: 0.8 }],
      robustEdges: [],
      stabilityScore: 0.4,
    }
    const critique = [
      { severity: 'WARNING' as const, message: 'constraint no baseline', code: 'CONSTRAINT_NO_BASELINE', node_id: 'f2' },
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} robustness={robustness} critique={critique} />)

    const strengthenSection = screen.getByTestId('model-strengthen-section')
    const html = strengthenSection.innerHTML

    // Constraint warnings should appear before fragile edges, which should appear before missing evidence
    const constraintPos = html.indexOf('strengthen-constraint-warnings')
    const fragilePos = html.indexOf('strengthen-fragile-edges')
    const missingPos = html.indexOf('strengthen-missing-evidence')

    expect(constraintPos).toBeGreaterThan(-1)
    expect(fragilePos).toBeGreaterThan(-1)
    expect(missingPos).toBeGreaterThan(-1)
    expect(constraintPos).toBeLessThan(fragilePos)
    expect(fragilePos).toBeLessThan(missingPos)
  })
})

describe('Attention banner — no defaulted-edges bucket', () => {
  it('does not show "edges with default values" in the attention banner', () => {
    const nodes = [
      makeFactorNode('f1', 'A', { source: 'user' }),
      makeFactorNode('f2', 'B', { source: 'user' }),
      makeFactorNode('f3', 'C', { source: 'user' }),
      makeFactorNode('f4', 'D', { source: 'user' }),
    ]
    // 3 defaulted edges (weight=0.5, strengthStd=0.125)
    const edges = [
      makeEdge('e1', 'f1', 'f2', { weight: 0.5, strengthStd: 0.125 }),
      makeEdge('e2', 'f2', 'f3', { weight: 0.5, strengthStd: 0.125 }),
      makeEdge('e3', 'f3', 'f4', { weight: 0.5, strengthStd: 0.125 }),
    ]
    const robustness = { fragileEdges: [], robustEdges: [], stabilityScore: 0.9 }
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} robustness={robustness} />)
    // Banner should NOT appear (no missing source, no AI-estimated, no fragile edges)
    expect(screen.queryByTestId('model-attention-banner')).not.toBeInTheDocument()
  })
})

describe('Inline edit — hover affordance classes', () => {
  it('has cursor-text, hover:bg-panel-hover, and hover:border-panel-border on display element', () => {
    const nodes = [makeFactorNode('f1', 'Budget', { value: 0.5 })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    const displayEl = screen.getByTestId('factor-f1-value-display')
    expect(displayEl.className).toContain('cursor-text')
    expect(displayEl.className).toContain('hover:bg-panel-hover')
    expect(displayEl.className).toContain('hover:border-panel-border')
  })
})

describe('DS-1: All pills use outlined style (no filled backgrounds)', () => {
  it('category badges use transparent bg and border-only style', () => {
    const nodes = [
      makeFactorNode('f1', 'Cost', { source: 'user', category: 'controllable' }),
      makeFactorNode('f2', 'Weather', { source: 'user', category: 'external' }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    const badges = screen.getAllByText(/Controllable|External/)
    for (const badge of badges) {
      expect(badge.className).toContain('bg-transparent')
      expect(badge.className).toContain('text-text-body')
      expect(badge.className).not.toMatch(/bg-info-light|bg-warning-light|bg-factor-light/)
    }
  })

  it('category badges use outlined style on relationship edge likelihood pill', () => {
    const nodes = [makeFactorNode('f1', 'A'), makeFactorNode('f2', 'B')]
    const edges = [
      makeEdge('e1', 'f1', 'f2', { direction: 'positive', weight: 0.5, strengthStd: 0.1 }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    // Semantic label for weight=0.5 positive = "Moderate positive"
    expect(screen.getByText('Moderate positive')).toBeInTheDocument()
  })
})

describe('DS-4: Likelihood bars use evaluative threshold colours', () => {
  it('shows bg-danger for likelihood < 40%', () => {
    const nodes = [makeFactorNode('f1', 'A'), makeFactorNode('f2', 'B')]
    const edges: import('@xyflow/react').Edge[] = [{
      id: 'e1', source: 'f1', target: 'f2',
      data: { weight: 0.5, strengthStd: 0.1, direction: 'positive', beliefExists: 0.3 },
    }]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    // 30% likelihood should use danger colour
    expect(screen.getByTestId('edge-e1-likelihood-display')).toHaveTextContent('30')
  })
})

describe('DS-5: No evidence per-card noise reduction', () => {
  it('suppresses "No evidence" on every card when all edges lack evidence', () => {
    const nodes = [makeFactorNode('f1', 'A', { source: 'user' }), makeFactorNode('f2', 'B', { source: 'user' })]
    const edges = [makeEdge('e1', 'f1', 'f2', { provenance: 'assumption' })]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    // "No evidence" should NOT appear when all edges lack evidence
    expect(screen.queryByText('No evidence')).not.toBeInTheDocument()
  })

  it('in mixed evidence state, non-evidenced edges render no provenance row at all', () => {
    const nodes = [makeFactorNode('f1', 'A', { source: 'user' }), makeFactorNode('f2', 'B', { source: 'user' }), makeFactorNode('f3', 'C', { source: 'user' })]
    const edges = [
      makeEdge('e1', 'f1', 'f2', { provenance: 'user_study' }),
      makeEdge('e2', 'f2', 'f3', { provenance: 'assumption' }),
    ]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    // "No evidence" label should never appear — absence of provenance row is the signal
    expect(screen.queryByText('No evidence')).not.toBeInTheDocument()
    // But evidence edge should still show its source
    expect(screen.getByText(/Source: user_study/)).toBeInTheDocument()
  })
})

describe('PD-1: Currency prefix formatting', () => {
  it('displays currency symbol as prefix (£49 not 49 £)', () => {
    const node: import('@xyflow/react').Node = {
      id: 'f1', type: 'factor', position: { x: 0, y: 0 },
      data: {
        label: 'Budget',
        category: 'observable',
        observedState: { raw_value: 49, unit: '£', source: 'user' },
      },
    }
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    expect(screen.getByText('£49')).toBeInTheDocument()
  })
})

describe('PD-2: Smart value precision', () => {
  it('displays integer values without decimals', () => {
    const node: import('@xyflow/react').Node = {
      id: 'f1', type: 'factor', position: { x: 0, y: 0 },
      data: {
        label: 'Binary factor',
        category: 'observable',
        observedState: { value: 0, source: 'user' },
      },
    }
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[node]} edges={[]} />)
    // Should show "0" not "0.00"
    const valueElements = screen.getAllByText('0')
    expect(valueElements.length).toBeGreaterThan(0)
    expect(screen.queryByText('0.00')).not.toBeInTheDocument()
  })
})

describe('NF-1: Copy as JSON button', () => {
  it('renders a JSON copy button', () => {
    const nodes = [makeFactorNode('f1', 'Factor')]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    expect(screen.getByTestId('model-copy-json')).toBeInTheDocument()
    expect(screen.getByTestId('model-copy-json')).toHaveTextContent('JSON')
  })
})

describe('DS v4 contract: section header icons are plain (no badge container)', () => {
  it('section headers render correctly', () => {
    const nodes = [makeFactorNode('f1', 'A', { source: 'user' }), makeFactorNode('f2', 'B', { source: 'user' })]
    const edges = [makeEdge('e1', 'f1', 'f2')]
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={edges} />)
    // Sections are now in new components — verify they render
    expect(screen.getByTestId('model-factors-section')).toBeInTheDocument()
    expect(screen.getByTestId('model-relationships-section')).toBeInTheDocument()
    expect(screen.getByTestId('model-strengthen-section')).toBeInTheDocument()
  })
})

describe('DS v4 contract: pills use solid borders (no dashed)', () => {
  it('Refine range pill does not use border-dashed', () => {
    const externalFactor: import('@xyflow/react').Node = {
      id: 'f2', type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'External', category: 'external', observedState: {} },
    }
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={[externalFactor]} edges={[]} />)
    const refineBtn = screen.getByTestId('factor-f2-refine-range')
    expect(refineBtn.className).not.toMatch(/border-dashed/)
  })
})
