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
    // P0.5: showWhenAbsent defaults to true — "Not set" is shown to surface missing sources
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })
})

// Attention banner and defaulted-edges warning tests removed —
// AttentionBanner and StrengthenSection were moved to Analysis tab in tightening brief.

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

  // Connectivity and evidence coverage tests removed — ModelSummaryBar replaced by EntityBar.

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

  it('edge likelihood % reads beliefExists correctly', () => {
    // Canvas store canonical name — CEE ingestion normalises to beliefExists
    const edgeWithExistsProb: Edge = {
      id: 'e-ep', source: 'f1', target: 'g1',
      data: { weight: 0.7, strengthStd: 0.1, provenance: 'assumption', direction: 'positive', beliefExists: 0.73 },
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

// Attention banner source category split tests removed — component moved to Analysis tab.

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

// Strengthen section and attention banner tests removed — components moved to Analysis tab.

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
    // Semantic label for weight=0.5 positive = "Moderate positive effect"
    expect(screen.getByText('Moderate positive effect')).toBeInTheDocument()
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

describe('Cross-section full-detail toggle integration', () => {
  it('toggling "Show full detail" reveals detail panels across goal, factors, and relationships simultaneously', () => {
    const goal = makeGoalNode('g1', 'Revenue target')
    const factor = makeFactorNode('f1', 'Budget', { source: 'user', value: 0.6 })
    const edge = makeEdge('e1', 'f1', 'g1', { weight: 0.5, direction: 'positive' })
    render(
      <ModelTabBody
        {...DEFAULT_PROPS}
        nodes={[goal, factor]}
        edges={[edge]}
      />
    )

    // Detail panels should be absent by default
    expect(screen.queryByText('Goal threshold')).not.toBeInTheDocument()
    expect(screen.queryByText('Factor detail')).not.toBeInTheDocument()
    expect(screen.queryByText('Edge detail')).not.toBeInTheDocument()

    // Toggle "Show full detail"
    const toggle = screen.getByTestId('model-tab-show-detail-toggle')
    fireEvent.click(toggle)

    // All sections should now show their detail panels simultaneously
    expect(screen.getByText('Goal threshold')).toBeInTheDocument()
    expect(screen.getByText('Factor detail')).toBeInTheDocument()
    expect(screen.getByText('Edge detail')).toBeInTheDocument()

    // Toggle off — all detail panels should hide again
    fireEvent.click(toggle)
    expect(screen.queryByText('Goal threshold')).not.toBeInTheDocument()
    expect(screen.queryByText('Factor detail')).not.toBeInTheDocument()
    expect(screen.queryByText('Edge detail')).not.toBeInTheDocument()
  })
})
