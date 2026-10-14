/** P41 / DGAI G4: connector semantics on a captured board, bound by link id. */
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Position, type Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { StyledEdge } from '../StyledEdge'
import { isEdgeStrengthNotSet, linkIsStructural, STRENGTH_NOT_SET_DASH } from '../edgePresentation'
import { resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'
import { linkEndsOf } from '../../domain/heldUserLink'
import { isStrengthPlaceholder } from '../../domain/strengthPlaceholder'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { UNSET_EDGE_STROKE_WIDTH, weightMagnitudeToStrokeWidth } from '../../utils/graphDisplayCalculations'

type WireEdge = Record<string, unknown> & { id?: string; from: string; to: string }
type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }

// Same rendering harness as StyledEdge.strengthPlaceholder.spec.tsx. Only the
// React Flow host and ambient UI state are doubled; ingestion and presentation
// (including the placeholder licence and strength bands) stay real.
const { flow } = vi.hoisted(() => ({ flow: { nodes: [] as Node[], edges: [] as CanvasEdge[] } }))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ id, style }: { id: string; style: CSSProperties }) => (
      <path data-testid="base-edge" data-edge-id={id} style={style} />
    ),
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => flow.nodes.find(node => node.id === id),
      getEdges: () => flow.edges,
      getNodes: () => flow.nodes,
    }),
    useStore: (selector: (state: { nodes: Node[] }) => unknown) => selector({ nodes: flow.nodes }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => selector({
    nodes: flow.nodes,
    edges: flow.edges,
    updateEdgeData: vi.fn(),
    runMeta: { ceeReview: null },
    results: { status: 'idle', report: null },
    viewMode: 'standard',
    hoveredOptionId: null,
    highlightedEdges: new Set<string>(),
    dimmedEdgeIds: new Set<string>(),
    lodRung: 'full',
    lens: {
      active: 'full',
      _dimmedEdgeIds: new Set<string>(),
      _sensitivityWeights: new Map<string, number>(),
      _sensitivityQuartiles: null,
      _fragileEdgeIds: new Set<string>(),
      _lensFragileLabels: new Map<string, string>(),
    },
  })),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: (state: { mode: string }) => unknown) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

function ingestBoard() {
  // Fixture shape is draft.nodes / draft.edges. Keep any positive-control
  // addition in this private copy, never in the captured fixture on disk.
  const draft = structuredClone(fixture.draft) as unknown as { nodes: unknown[]; edges: WireEdge[] }
  const nodes = draft.nodes.map(mapDraftNodeToCanvas) as Node[]
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const isCausal = (edge: CanvasEdge) => !linkIsStructural(
    nodeById.get(edge.source)?.type, nodeById.get(edge.target)?.type, edge.data,
  )
  const endsOf = linkEndsOf(draft.nodes)
  const wireById = new Map<string, WireEdge>()
  const ingest = (wire: WireEdge, index: number): CanvasEdge => {
    const edge = mapDraftEdgeToCanvas(wire, index, endsOf(wire)) as CanvasEdge
    wireById.set(edge.id, { ...wire, id: edge.id })
    return edge
  }
  const edges = draft.edges.map(ingest)
  if (!edges.some(edge => isCausal(edge) && isEdgeStrengthNotSet(edge.data))) {
    const contrast = edges.find(isCausal)
    if (!contrast) throw new Error('captured board needs a causal contrast link')
    edges.push(ingest({
      id: 'g4-placeholder-positive-control',
      from: contrast.source,
      to: contrast.target,
      strength: { mean: 0.5, std: 0.25 },
      effect_direction: 'positive',
      exists_probability: 0.8,
      provenance: { source: 'cee_hypothesis', magnitude: 'olumi_placeholder' },
    }, edges.length))
  }
  return { nodes, edges, causalEdges: edges.filter(isCausal), wireById }
}

const board = ingestBoard()

beforeEach(() => {
  flow.nodes = board.nodes
  flow.edges = board.edges
})
afterEach(cleanup)

function renderLinks(edges: CanvasEdge[]) {
  return render(<>{edges.map(edge => <StyledEdge
    key={edge.id}
    {...({
      ...edge,
      sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
      sourcePosition: Position.Bottom, targetPosition: Position.Top,
      selected: false,
    } as ComponentProps<typeof StyledEdge>)}
  />)}</>)
}

function pathFor(container: HTMLElement, id: string): SVGElement {
  const paths = Array.from(container.querySelectorAll<SVGElement>('path[data-testid="base-edge"]'))
    .filter(path => path.getAttribute('data-edge-id') === id)
  expect(paths, `one rendered line for link ${id}`).toHaveLength(1)
  return paths[0]!
}

const isDotted = (path: SVGElement) => path.style.strokeDasharray === STRENGTH_NOT_SET_DASH

describe('P41 / DGAI G4 connector semantics', () => {
  it('row 1: captured-board dotted link ids equal the strength-not-set predicate ids', () => {
    const { container } = renderLinks(board.causalEdges)
    const dottedIds = new Set(board.causalEdges
      .filter(edge => isDotted(pathFor(container, edge.id))).map(edge => edge.id))
    const notSetIds = new Set(board.causalEdges
      .filter(edge => isEdgeStrengthNotSet(edge.data)).map(edge => edge.id))

    expect(dottedIds).toEqual(notSetIds)
    expect(dottedIds.size).toBeGreaterThan(0)
    expect(notSetIds.size).toBeGreaterThan(0)
    expect(board.causalEdges.some(edge => !dottedIds.has(edge.id))).toBe(true)

    // An independent placeholder control prevents equality from self-validating
    // if both renderer and oracle accidentally drop the placeholder licence.
    const placeholders = board.causalEdges.filter(edge => isStrengthPlaceholder(edge.data))
    expect(placeholders.length).toBeGreaterThan(0)
    for (const edge of placeholders) {
      expect(notSetIds.has(edge.id), `placeholder ${edge.id} is strength-not-set`).toBe(true)
      expect(dottedIds.has(edge.id), `placeholder ${edge.id} renders dotted`).toBe(true)
      expect(pathFor(container, edge.id).style.strokeLinecap).toBe('round')
    }
  })

  it('row 2: set causal links retain their strength band widths; dots use the unset width', () => {
    const { container } = renderLinks(board.causalEdges)
    const setWidths = new Set<number>()
    let dottedCount = 0
    for (const edge of board.causalEdges) {
      const path = pathFor(container, edge.id)
      const width = Number.parseFloat(path.style.strokeWidth)
      if (isEdgeStrengthNotSet(edge.data)) {
        expect(isDotted(path), `unset link ${edge.id}`).toBe(true)
        expect(width, `unset width for ${edge.id}`).toBe(UNSET_EDGE_STROKE_WIDTH)
        dottedCount++
      } else {
        expect(isDotted(path), `set link ${edge.id}`).toBe(false)
        const strength = resolveEdgeSignedStrengthDisplay(edge.data)
        expect(strength.show, `set strength for ${edge.id}`).toBe(true)
        if (!strength.show) throw new Error(`missing set strength for ${edge.id}`)
        expect(width, `band width for ${edge.id}`).toBe(weightMagnitudeToStrokeWidth(strength.value))
        setWidths.add(width)
      }
    }
    expect(setWidths.size).toBeGreaterThanOrEqual(2)
    expect(dottedCount).toBeGreaterThan(0)
  })

  it('row 3: the same placeholder link stays dotted at existence 0.8 and 1.0', () => {
    const placeholder = board.causalEdges.find(edge => isStrengthPlaceholder(edge.data))
    expect(placeholder).toBeDefined()
    const id = placeholder!.id
    const wire = board.wireById.get(id)!
    const endsOf = linkEndsOf(fixture.draft.nodes)
    for (const existence of [0.8, 1.0]) {
      const edge = mapDraftEdgeToCanvas({ ...wire, exists_probability: existence }, 0, endsOf(wire)) as CanvasEdge
      expect(edge.id).toBe(id)
      expect(edge.data.beliefExists).toBe(existence)
      expect(isStrengthPlaceholder(edge.data)).toBe(true)
      const { container, unmount } = renderLinks([edge])
      const path = pathFor(container, id)
      expect(path.style.strokeDasharray, `${id} at existence ${existence}`).toBe(STRENGTH_NOT_SET_DASH)
      expect(path.style.strokeLinecap).toBe('round')
      expect(Number.parseFloat(path.style.strokeWidth)).toBe(UNSET_EDGE_STROKE_WIDTH)
      unmount()
    }
  })
})
