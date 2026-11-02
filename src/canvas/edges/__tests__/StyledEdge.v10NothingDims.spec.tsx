/**
 * v10 (#/canvas2), Paul 24 Oct ruling 1, "nothing dims": a link is never faded under the v10 presentation. Each dim
 * StyledEdge can wear (selection, lens, Changes-view subdue) is driven here, once in the current design (it dims, the
 * contrast) and once in v10 (full strength, no dim marker). The Changes view's changed link keeps its mark.
 *
 * Harness copied from `StyledEdge.pathHighlightColour.spec.tsx` (store mock shape, mock paths).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StyledEdge } from '../StyledEdge'
import { PresentationProvider } from '../../../presentation/v10'
import { Position } from '@xyflow/react'

let mockHighlightedEdges = new Set<string>()
let mockDimmedEdgeIds = new Set<string>()
let mockLensDimmedEdgeIds = new Set<string>()
let mockAnalysisHighlight: any = { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() }

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // `data-edge-id` lets a two-edge render find each line BY ITS OWN ID.
    BaseEdge: (props: any) => <path data-testid="base-edge" data-edge-id={props.id} style={props.style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      viewMode: 'standard',
      hoveredOptionId: null,
      highlightedEdges: mockHighlightedEdges,
      dimmedEdgeIds: mockDimmedEdgeIds,
      analysisHighlight: mockAnalysisHighlight,
      lens: {
        active: 'full',
        _dimmedEdgeIds: mockLensDimmedEdgeIds,
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
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => true }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({ getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '' }))

const POSITIVE_EDGE = {
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
  data: { strength_mean: 0.6, effect_direction: 'positive' as const, exists_probability: 0.8 },
}


afterEach(() => {
  cleanup()
  mockHighlightedEdges = new Set<string>()
  mockDimmedEdgeIds = new Set<string>()
  mockLensDimmedEdgeIds = new Set<string>()
  mockAnalysisHighlight = { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() }
})

const lineOf = (container: HTMLElement, edgeId: string) =>
  container.querySelector(`[data-testid="base-edge"][data-edge-id="${edgeId}"]`) as unknown as HTMLElement
const groupOf = (container: HTMLElement, edgeId: string) =>
  lineOf(container, edgeId).closest('g') as unknown as SVGGElement & HTMLElement

const renderEdge = (presentation: 'current' | 'v10', edge: object = POSITIVE_EDGE) =>
  render(
    <MemoryRouter>
      <PresentationProvider value={presentation}>
        <StyledEdge {...(edge as any)} />
      </PresentationProvider>
    </MemoryRouter>,
  )

const DIMS: Array<[string, () => void]> = [
  ['a selection dims the link (dimmedEdgeIds)', () => { mockDimmedEdgeIds = new Set(['e1']) }],
  ['a lens dims the link (lens._dimmedEdgeIds)', () => { mockLensDimmedEdgeIds = new Set(['e1']) }],
  ['the Changes view subdues a link nothing happened to', () => {
    mockAnalysisHighlight = { source: 'run_changes', edgeIds: new Set(['other-edge']), nodeIds: new Set<string>() }
  }],
]

describe('StyledEdge in v10: nothing dims', () => {
  for (const [name, arrange] of DIMS) {
    it(`CONTRAST (current design): ${name}, so the link is below full strength`, () => {
      arrange()
      const { container } = renderEdge('current')
      const g = groupOf(container, 'e1')
      const faded = g.style.opacity !== '' && Number(g.style.opacity) < 1
      const lineFaded = lineOf(container, 'e1').style.opacity !== '' && Number(lineOf(container, 'e1').style.opacity) < 1
      expect(faded || lineFaded).toBe(true)
    })

    it(`v10: ${name}, and the link stays at full strength with no dim marker`, () => {
      arrange()
      const { container } = renderEdge('v10')
      const g = groupOf(container, 'e1')
      expect(g.style.opacity).not.toMatch(/^0\./)
      expect(lineOf(container, 'e1').style.opacity).toBe('')
      expect(g.getAttribute('data-selection-dimmed')).toBeNull()
      expect(g.getAttribute('data-run-change-subdued')).toBeNull()
    })
  }

  it('v10 keeps the emphasis: the link a change landed on still carries its mark', () => {
    mockAnalysisHighlight = { source: 'run_changes', edgeIds: new Set(['e1']), nodeIds: new Set<string>() }
    const { container } = renderEdge('v10')
    expect(groupOf(container, 'e1').getAttribute('data-run-change')).toBe('changed')
  })
})
