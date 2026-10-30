/**
 * P1 S3b (DL, 30 Oct; the witness at 06:09Z): a program figure a teammate gave and the owner approved says whose it is
 * on its LINK too — the demo's shares are coefficients drawn on links, never cards. The same words and the same reader
 * as the card (S3, `teammateFigureWords` over the saved read's canonical quantity): "Sam’s figure · approved by you",
 * "approved by the owner" for a viewer of a shared link. They stand where the card's mark says its source: in the
 * figure's accessible name and title, in place of the provenance words. A figure one person gave and approved, or
 * Olumi's, says what it said before; a non-program link is untouched.
 *
 * Harness: the real `StyledEdge`, its edge data from the real `mapDraftEdgeToCanvas`, the saved read handed to
 * `useSavedGraph` at its seam (as StyledEdge.programFigure.spec.tsx does).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ id, style }: any) => <path data-testid="base-edge" data-edge-id={id} style={style} />,
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
    }),
  ),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })) }))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../domain/identityExactLinks', () => ({ useIdentityExactWords: () => null }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
const saved: { graph: unknown } = { graph: null }
vi.mock('../../nodes/shared/savedGraph', () => ({ useSavedGraph: () => saved.graph }))
import { setViewerScenario, __resetViewerModeForTests } from '../../../lib/viewerMode'

type Rec = Record<string, unknown>
// The served shape (smoke-alpha2 capacity-r1): a coefficient link and its canonical quantity, here as a teammate's
// verified panel answer the owner applied (CEE S1: author_id = the participant, party = their name, approved_by = owner).
const EDGE: Rec = {
  from: 'specialists_added', to: 'additional_capacity',
  strength: { mean: 1, std: 0.001 }, exists_probability: 1, effect_direction: 'positive',
  provenance: { source: 'brief_extraction', magnitude: 'user_stated',
    natural_effect: { amount: 20, amount_unit: 'ticket/week', per_source_change: 1, per_source_change_unit: 'specialist',
      strength_mean: 1, strength_mean_frame: 'edge_strength' } },
  origin: 'model_program:calculation', coefficient_id: 'capacity_per_specialist', id: 'specialists_added__additional_capacity',
}
const OWNER = 'owner-0000-4000-8000-000000000001'
const quantity = (who: Rec): Rec => ({
  id: 'capacity_per_specialist', label: 'Weekly capacity per additional specialist', unit: 'ticket/week/specialist',
  value: 20, low: 10, high: 30, range_kind: 'bounds', kind: 'coefficient', ...who,
})
const graphWith = (who: Rec): Rec => ({ edges: [EDGE], living_model: { model_program: 'v1', canonical: { quantities: [quantity(who)] } } })
const SAMS = { author: 'person', quote: '20', author_id: 'p-sam-1', party: 'Sam', approved_by: OWNER }

const edgeProps = (wire: Rec) => ({
  id: wire.id as string, source: wire.from as string, target: wire.to as string,
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top, selected: false,
  data: mapDraftEdgeToCanvas({ ...wire } as never, 0).data,
})
const figureOf = (who: Rec) => {
  saved.graph = graphWith(who)
  const { container } = render(<StyledEdge {...(edgeProps(EDGE) as any)} />)
  return container.querySelector('[data-testid="edge-program-figure"]')
}

afterEach(() => { saved.graph = null; __resetViewerModeForTests() })

describe('P1 S3b: a teammate’s coefficient says whose it is on its link', () => {
  it('(a) the owner reads "Sam’s figure · approved by you" where the link says its source; the figure itself is unchanged', () => {
    const figure = figureOf(SAMS)
    expect(figure).not.toBeNull()
    expect(figure!.textContent).toBe('+20 (10–30) ticket/week/specialist')
    expect(figure!.getAttribute('aria-label')).toBe('+20 (10–30) ticket/week/specialist. Sam’s figure · approved by you')
    expect(figure!.getAttribute('title')).toBe('+20 (10–30) ticket/week/specialist. Sam’s figure · approved by you')
    expect(figure!.getAttribute('data-quantity-id')).toBe('capacity_per_specialist')
  })

  it('(b) a viewer of the shared link reads "approved by the owner", never "by you"', () => {
    setViewerScenario('scenario-shared')
    const figure = figureOf(SAMS)
    expect(figure!.getAttribute('aria-label')).toBe('+20 (10–30) ticket/week/specialist. Sam’s figure · approved by the owner')
    expect(figure!.getAttribute('aria-label')).not.toContain('by you')
  })

  it('(c) CONTRAST: Olumi’s coefficient, and the owner’s own, say what they said before', () => {
    const olumi = figureOf({ author: 'olumi', approved_by: OWNER })
    expect(olumi!.getAttribute('aria-label')).not.toMatch(/figure · approved/)
    const own = figureOf({ author: 'person', quote: '20', author_id: OWNER, party: 'Me', approved_by: OWNER })
    expect(own!.getAttribute('aria-label')).toBe('+20 (10–30) ticket/week/specialist. From brief')
    expect(own!.getAttribute('aria-label')).not.toMatch(/figure · approved/)
  })

  it('(d) CONTRAST: a non-program link is untouched (no figure, its source mark as today)', () => {
    saved.graph = { edges: [EDGE], living_model: { aims: [], links: [], factors: [], options: [] } }
    const { container } = render(<StyledEdge {...(edgeProps(EDGE) as any)} />)
    expect(container.querySelector('[data-testid="edge-program-figure"]')).toBeNull()
    expect(container.textContent).not.toMatch(/approved by/)
  })
})
