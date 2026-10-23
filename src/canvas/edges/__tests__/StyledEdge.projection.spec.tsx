/**
 * StyledEdge — analysis-graph projection marker.
 *
 * A flip-risk edge in the analysisHighlight slice carries a warning halo +
 * thicker stroke while viewed. This pins that the edge group exposes the
 * data-analysis-fragile marker when (and only when) the slice names it — the
 * consumer read is wired. The stroke COLOUR is asserted unchanged elsewhere
 * (directionColour.spec); the marker composes via a separate CSS channel.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, cleanup, screen } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { recordMethodPointing, useMethodPointingStore } from '../../conversation/methodResultPointing'
import { Position } from '@xyflow/react'
import {
  activateAssistantFocus,
  dismissAssistantFocus,
} from '../../stores/assistantFocusStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

let analysisHighlight: { source: 'flip_risks' | 'drivers' | null; edgeIds: Set<string>; nodeIds: Set<string> } = {
  source: null,
  edgeIds: new Set(),
  nodeIds: new Set(),
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: { robustness: { fragile_edges: [] } } },
      currentScenarioId: 'scn-pointing',
      highlightedEdges: new Set<string>(),
      analysisHighlight,
      viewMode: 'standard',
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _hiddenNodeIds: new Set<string>(),
        _hiddenEdgeIds: new Set<string>(),
        _causalEdgeParams: new Map(),
        _evidenceEdgeClass: new Map(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: (s: any) => s({ mode: 'human' }) }))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // ⛔ importOriginal-SPREAD, not a hand-listed replacement. A `vi.mock`
  // factory REPLACES the module, so every export added after this mock was
  // written silently vanished — adding `UNSET_EDGE_STROKE_WIDTH` took 49 tests
  // down across seven files at once. The spread makes the mock derive from the
  // real module and override only what it means to stub.
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({ getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '' }))

const edgeProps = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: { weight: 0.6, direction: 'positive' as const, beliefExists: 0.8, edge_type: 'causal' },
}

afterEach(() => {
  cleanup()
  dismissAssistantFocus()
  analysisHighlight = { source: null, edgeIds: new Set(), nodeIds: new Set() }
})

describe('StyledEdge — analysis-graph projection marker', () => {
  it('marks the edge group when the flip_risks slice names this edge', () => {
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e1']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).not.toBeNull()
  })

  it('does NOT mark the edge when the slice is empty', () => {
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })

  it('does NOT mark the edge when a DIFFERENT edge is named', () => {
    analysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e9']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })

  it('does NOT mark when the source is drivers (edge ids belong only to flip_risks)', () => {
    analysisHighlight = { source: 'drivers', edgeIds: new Set(['e1']), nodeIds: new Set() }
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-analysis-fragile="true"]')).toBeNull()
  })
})

describe('StyledEdge — assistant focus render', () => {
  it('renders an independent static halo on the exact edge', () => {
    act(() => {
      activateAssistantFocus({ id: 'e1', kind: 'edge', label: 'One → Two' })
    })
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-assistant-focused="true"]')).not.toBeNull()
    expect(screen.getByTestId('pointing-edge-halo-e1')).toBeInTheDocument()
  })

  it('discriminating identity: another edge receives no halo', () => {
    act(() => {
      activateAssistantFocus({ id: 'e9', kind: 'edge', label: 'Other' })
    })
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(container.querySelector('g[data-assistant-focused="true"]')).toBeNull()
    expect(screen.queryByTestId('pointing-edge-halo-e1')).not.toBeInTheDocument()
  })
})

// Pointing into the model: the link the last reply tested wears the same halo as an assistant focus, until the next
// reply. Identity-bound: another link, or the same link in another scenario, wears none.
describe('StyledEdge — the link the reply tested', () => {
  afterEach(() => recordMethodPointing(null))
  const point = (scenarioId: string, link: string) => act(() => {
    useMethodPointingStore.setState({ pointing: { scenarioId, actionId: 'test_link', links: new Set([link]), optionIds: new Set() } })
  })
  it('the tested link has the halo, marked with the method', () => {
    point('scn-pointing', 'n1->n2')
    render(<StyledEdge {...(edgeProps as any)} />)
    expect(screen.getByTestId('pointing-edge-halo-e1')).toHaveAttribute('data-method-pointed', 'test_link')
  })
  it('⭐ ONE pointing halo (vision spec §3): assistant focus AND the reply\'s test on the same link draw one mark, method kept', () => {
    point('scn-pointing', 'n1->n2')
    act(() => { activateAssistantFocus({ id: 'e1', kind: 'edge', label: 'One → Two' }) })
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    expect(screen.getAllByTestId('pointing-edge-halo-e1')).toHaveLength(1)
    expect(screen.getByTestId('pointing-edge-halo-e1')).toHaveAttribute('data-method-pointed', 'test_link')
    // The two old marks are gone: no second halo by either retired name.
    expect(container.querySelector('[data-testid^="assistant-focus-edge-halo-"], [data-testid^="method-pointed-edge-halo-"]')).toBeNull()
    act(() => { dismissAssistantFocus() })
  })
  it('CONTRAST: another link, or another scenario, has none', () => {
    point('scn-pointing', 'n2->n1')
    const a = render(<StyledEdge {...(edgeProps as any)} />)
    expect(screen.queryByTestId('pointing-edge-halo-e1')).toBeNull()
    a.unmount()
    point('scn-other', 'n1->n2')
    render(<StyledEdge {...(edgeProps as any)} />)
    expect(screen.queryByTestId('pointing-edge-halo-e1')).toBeNull()
  })
})
