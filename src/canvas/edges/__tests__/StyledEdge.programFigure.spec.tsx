/**
 * A PROGRAM LINK SAYS ITS COEFFICIENT, IN NATURAL UNITS, AT REST — in the link's note slot, with the figure's author
 * mark before it, in place of the β words. A non-program link keeps its strength words and source mark as today.
 *
 * Program recognised by `living_model.model_program` on the saved read; the figure is the read's own canonical
 * quantity (value, range, unit, author), through the house number formatter. Edge data from the real
 * `mapDraftEdgeToCanvas`; the saved read is handed to `useSavedGraph` at its seam (this harness mocks the store, so
 * the fetch-path read is pinned in `programLinkValueEditor.spec.tsx`). Expected words are spelled inline.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import words from '../../nodes/shared/__tests__/fixtures/q1-words-graph.hand-made.json'
import parallel from '../../nodes/shared/__tests__/fixtures/q1-parallel-links.hand-made.json'

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

type Rec = Record<string, unknown>
// smoke-alpha2 capacity-r1.read.json: the coefficient link and its canonical quantity, as served.
const CAP_EDGE: Rec = {
  from: 'specialists_added', to: 'additional_capacity',
  strength: { mean: 1, std: 0.001 }, exists_probability: 1, effect_direction: 'positive',
  provenance: {
    source: 'brief_extraction', magnitude: 'user_stated',
    natural_effect: {
      amount: 20, amount_unit: 'ticket/week', per_source_change: 1, per_source_change_unit: 'specialist',
      strength_mean: 1, strength_mean_frame: 'edge_strength',
    },
  },
  origin: 'model_program:calculation', coefficient_id: 'capacity_per_specialist', id: 'specialists_added__additional_capacity',
}
const CAP_GRAPH: Rec = {
  edges: [CAP_EDGE],
  living_model: {
    model_program: 'v1',
    canonical: {
      quantities: [{
        id: 'capacity_per_specialist', label: 'Weekly capacity per additional specialist', unit: 'ticket/week/specialist',
        value: 20, low: 10, high: 30, range_kind: 'bounds', kind: 'coefficient', author: 'person',
        quote: 'Each additional specialist resolves about 20 tickets per week, between 10 and 30.',
      }],
    },
  },
}
// option-card-probe-2011 reads[6]: the café β link, on a core model with no `model_program`.
const CAFE_EDGE: Rec = {
  id: 'loyalty_customer_effect', from: 'loyalty_card__on', to: 'weekly_customers',
  strength: { std: 0.058333333333333334, mean: 0.11666666666666667 }, effect_direction: 'positive', exists_probability: 1,
  provenance: {
    source: 'brief_extraction', magnitude: 'user_stated',
    natural_effect: {
      amount: 70, amount_unit: 'customers a week', strength_mean: 0.11666666666666667, per_source_change: 1,
      strength_mean_frame: 'edge_strength', per_source_change_unit: 'switch',
    },
  },
}
const CAFE_GRAPH: Rec = { edges: [CAFE_EDGE], living_model: { aims: [], links: [], factors: [], options: [] } }

const edgeProps = (wire: Rec) => ({
  id: wire.id as string, source: wire.from as string, target: wire.to as string,
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top, selected: false,
  data: mapDraftEdgeToCanvas({ ...wire } as never, 0).data,
})

afterEach(() => { saved.graph = null })

describe('a program link shows its coefficient at rest', () => {
  it('the capacity link: "+20 (10–30) ticket/week/specialist" after the brief\'s mark, never a strength word', () => {
    saved.graph = CAP_GRAPH
    const { container } = render(<StyledEdge {...(edgeProps(CAP_EDGE) as any)} />)
    const figure = container.querySelector('[data-testid="edge-program-figure"]')
    expect(figure).not.toBeNull()
    expect(figure!.textContent).toBe('+20 (10–30) ticket/week/specialist')
    expect(figure!.getAttribute('data-mark')).toBe('brief')
    expect(figure!.getAttribute('aria-label')).toBe('+20 (10–30) ticket/week/specialist. From brief')
    expect(figure!.querySelector('svg')).not.toBeNull()
    // The mark rides inside the figure; the bare source glyph is not drawn beside it.
    expect(container.querySelector('[data-edge-source-icon]')).toBeNull()
    expect(container.textContent).not.toMatch(/boost/i)
  })
})

describe('CONTROL: an unknown program version keeps today\'s link (Codex r1 on #2950)', () => {
  it('the same capacity link under model_program "v2": no figure, its source mark as today', () => {
    const living = CAP_GRAPH.living_model as Rec
    saved.graph = { ...CAP_GRAPH, living_model: { ...living, model_program: 'v2' } }
    const { container } = render(<StyledEdge {...(edgeProps(CAP_EDGE) as any)} />)
    expect(container.querySelector('[data-testid="edge-program-figure"]')).toBeNull()
    expect(container.querySelector('[data-edge-source-icon]')?.getAttribute('aria-label')).toBe('From brief')
  })
})

describe('CONTROL: a non-program link keeps its strength words and source mark', () => {
  it('the café β link: no figure, its source mark as today', () => {
    saved.graph = CAFE_GRAPH
    const { container } = render(<StyledEdge {...(edgeProps(CAFE_EDGE) as any)} />)
    expect(container.querySelector('[data-testid="edge-program-figure"]')).toBeNull()
    expect(container.querySelector('[data-edge-source-icon]')?.getAttribute('aria-label')).toBe('From brief')
  })
})

// CEE #3859: a link whose range runs both ways says "?", never the centre's sign — drawn even where the strength row
// carries a direction (Codex r1 on the first-screen PR). Bound to the edge by `data-edge-id`.
describe('an unsettled direction reads "?" on its own link', () => {
  const withSettled = (settled: boolean | undefined) => {
    const edge = settled === undefined ? CAP_EDGE : { ...CAP_EDGE, direction_settled: settled }
    return { edge, graph: { ...CAP_GRAPH, edges: [edge] } }
  }
  const glyphOf = (container: HTMLElement) => container.querySelector(`div[data-edge-id="${CAP_EDGE.id}"]`)

  it('direction_settled:false → "?" with its words', () => {
    const { edge, graph } = withSettled(false)
    saved.graph = graph
    const glyph = glyphOf(render(<StyledEdge {...(edgeProps(edge) as any)} />).container)
    expect(glyph?.textContent).toBe('?')
    expect(glyph?.getAttribute('aria-label')).toBe('Effect direction: not settled. Its range runs both ways.')
  })

  it('CONTRAST: the same link, settled, draws no "?"', () => {
    for (const settled of [true, undefined]) {
      const { edge, graph } = withSettled(settled)
      saved.graph = graph
      const { container, unmount } = render(<StyledEdge {...(edgeProps(edge) as any)} />)
      expect(glyphOf(container)?.textContent ?? '').not.toBe('?')
      expect(container.textContent).not.toContain('not settled')
      unmount()
    }
  })
})

// Q1 readers (DL GO, 28 Oct): a link in words keeps "?" where no way is settled, and its accessible name gives the
// stated direction in words; "Its range runs both ways" stays for a numerical range only. Hand-made graph.
describe('Q1: a link in words names its stated direction on the "?"', () => {
  const glyphOf = (container: HTMLElement, id: string) => container.querySelector(`div[data-edge-id="${id}"]`)
  const edgeOf = (g: Rec, id: string) => (g.edges as Rec[]).find((e) => e.id === id)!
  it.each([
    ['conditional', 'evening_classes__member_mood', 'Effect direction: depends on conditions'],
    ['unknown (an unsized risk)', 'rent_rise__keep_members', 'Effect direction: not known yet'],
  ])('%s → "?" with its words, never the range sentence', (_label, id, aria) => {
    saved.graph = words
    const edge = edgeOf(words as Rec, id)
    const { container } = render(<StyledEdge {...(edgeProps(edge) as any)} />)
    expect(glyphOf(container, id)?.textContent).toBe('?')
    expect(glyphOf(container, id)?.getAttribute('aria-label')).toBe(aria)
    expect(container.innerHTML).not.toContain('runs both ways')
  })
  it('disputed → "?" with "Effect direction: disputed"', () => {
    const g = structuredClone(words) as Rec
    ;(edgeOf(g, 'evening_classes__member_mood').link_words as Rec).direction = 'disputed'
    saved.graph = g
    const edge = edgeOf(g, 'evening_classes__member_mood')
    const { container } = render(<StyledEdge {...(edgeProps(edge) as any)} />)
    expect(glyphOf(container, edge.id as string)?.getAttribute('aria-label')).toBe('Effect direction: disputed')
  })
  it('CONTROL: a numerical range across zero keeps its sentence', () => {
    saved.graph = words
    const edge = edgeOf(words as Rec, 'monthly_cost__keep_members')
    const { container } = render(<StyledEdge {...(edgeProps(edge) as any)} />)
    expect(glyphOf(container, edge.id as string)?.getAttribute('aria-label')).toBe('Effect direction: not settled. Its range runs both ways.')
  })
})

// Q1 readers (PL BLOCK 1): two links between the same cards under their own ids, word-first and numeric-first. Each glyph
// says its own record.
describe('Q1: parallel links each draw their own glyph', () => {
  it.each([
    ['quality__members', '?', 'Effect direction: depends on conditions'],
    ['quality__members__2', '+', 'Effect direction: positive'],
    ['price__demand', '−', 'Effect direction: negative'],
    ['price__demand__2', '?', 'Effect direction: disputed'],
  ])('%s → "%s", "%s"', (id, glyph, aria) => {
    saved.graph = parallel
    const edge = (parallel.edges as Rec[]).find((e) => e.id === id)!
    const { container } = render(<StyledEdge {...(edgeProps(edge) as any)} />)
    const el = container.querySelector(`div[data-edge-id="${id}"]`)
    expect(el?.textContent).toBe(glyph)
    expect(el?.getAttribute('aria-label')).toBe(aria)
  })
})
