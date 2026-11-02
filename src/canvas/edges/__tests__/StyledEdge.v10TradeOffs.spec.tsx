/**
 * v10 Trade-offs on the canvas, through the mounted StyledEdge (not only its pure helper): under the lens the picked
 * option's links change their stroke COLOUR and nothing else. A link keeps its own width (strength) and its own dash
 * (doubt that it exists); a link whose sign is not held under every option, or is not given, stays in its normal
 * rendering; with no routes to draw, nothing changes; #/canvas (the current design) never changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { PresentationProvider, type Presentation } from '../../../presentation/v10'

const holder = vi.hoisted(() => ({
  lens: 'tradeoffs' as string,
  effects: new Map<string, string>(),
}))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  const nodes = [
    { id: 'src', type: 'factor', data: { label: 'Price' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
    { id: 'tgt', type: 'outcome', data: { label: 'Revenue' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
  ]
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: (id: string) => nodes.find((n) => n.id === id) ?? null, getEdges: () => [], getNodes: () => nodes }),
    useStore: (selector: any) => selector({ nodes }),
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
      viewMode: 'standard',
      lens: {
        active: holder.lens,
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
        _restsOn: new Map(),
        _emphasisEdgeIds: new Set<string>(),
        _routeEffects: holder.effects,
      },
    }),
  ),
}))
vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })) }))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => true }))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))

const props = {
  id: 'e1', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}
// A stated direction and strength, and a stated doubt that the link exists: a dashed, polarity-coloured, sized line.
const DOUBTED = { weight: 0.9, weightSource: 'user', direction: 'positive', directionSource: 'user', beliefExists: 0.3, beliefExistsSource: 'cee', confidence: 0.5 }

function styleOf(presentation: Presentation, lens: string, effects: Record<string, string>, data: Record<string, unknown> = DOUBTED) {
  holder.lens = lens
  holder.effects = new Map(Object.entries(effects))
  const { container, unmount } = render(
    <MemoryRouter><PresentationProvider value={presentation}><StyledEdge {...(props as any)} data={data} /></PresentationProvider></MemoryRouter>,
  )
  const style = (container.querySelector('[data-testid="base-edge"]') as HTMLElement).style
  const out = { stroke: style.getPropertyValue('stroke'), width: style.strokeWidth, dash: style.strokeDasharray, opacity: style.opacity }
  unmount()
  return out
}

describe('v10 Trade-offs through the mounted StyledEdge', () => {
  beforeEach(() => { holder.lens = 'tradeoffs'; holder.effects = new Map() })

  it('an off-route link rests in grey and keeps its own width and its own existence-doubt dash, at full strength', () => {
    const normal = styleOf('v10', 'full', {})
    const rest = styleOf('v10', 'tradeoffs', { other: 'gains' })
    expect(rest.stroke).toBe('var(--edge-neutral)')
    expect(rest.width).toBe(normal.width)
    expect(rest.width).not.toBe('')
    expect(rest.dash).toBe('6,4')
    expect(rest.dash).toBe(normal.dash)
    expect(rest.opacity).toBe('')
    // CONTRAST: the normal stroke is not that grey, so the assertion above sees a change.
    expect(normal.stroke).not.toBe('')
    expect(normal.stroke).not.toBe('var(--edge-neutral)')
  })

  it('a link that helps under every option is green, a link that works against the goal is rose, each keeping its dash and width', () => {
    const normal = styleOf('v10', 'full', {})
    const gains = styleOf('v10', 'tradeoffs', { e1: 'gains' })
    const gives = styleOf('v10', 'tradeoffs', { e1: 'gives_up' })
    expect(gains.stroke).toBe('var(--edge-positive)')
    expect(gives.stroke).toBe('var(--edge-negative)')
    for (const s of [gains, gives]) { expect(s.dash).toBe('6,4'); expect(s.width).toBe(normal.width) }
  })

  it('a mixed link (or one whose sign is not held under every option) takes the rest grey, never its own green, keeping its width and dash', () => {
    const normal = styleOf('v10', 'full', {})
    const mixed = styleOf('v10', 'tradeoffs', { e1: 'none', other: 'gains' })
    // CONTRAST: the same link, drawn normally, wears its own polarity colour: the green the lens must not show here.
    expect(normal.stroke).toBe('var(--edge-positive)')
    expect(mixed.stroke).toBe('var(--edge-neutral)')
    expect(mixed.width).toBe(normal.width)
    expect(mixed.dash).toBe('6,4')
    expect(mixed.opacity).toBe('')
  })

  it('a sign in dispute keeps its warning stroke over the lens colour, on a route and off it', () => {
    const disputed = {
      ...DOUBTED,
      validation: {
        status: 'contested', contested_reasons: ['sign_flip'],
        pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
        pass2: { strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9, reasoning: 'test', basis: 'domain_prior', needs_user_input: false },
        max_divergence: 0.6, distance_to_goal: 1, evoi_rank: null, evoi_impact: null, was_shown: true,
        user_action: 'pending', resolved_value: null, resolved_by: 'default',
      },
    }
    const normal = styleOf('v10', 'full', {}, disputed)
    expect(normal.stroke).toBe('var(--semantic-warning)')
    const cases: Array<Record<string, string>> = [{ e1: 'gains' }, { e1: 'gives_up' }, { e1: 'none' }, { other: 'gains' }]
    for (const effects of cases) {
      const s = styleOf('v10', 'tradeoffs', effects, disputed)
      expect(s.stroke, JSON.stringify(effects)).toBe('var(--semantic-warning)')
      expect(s.width).toBe(normal.width)
    }
    // CONTRAST: the same lens on an undisputed link does recolour it.
    expect(styleOf('v10', 'tradeoffs', { other: 'gains' }).stroke).toBe('var(--edge-neutral)')
  })

  it('with no routes to draw the lens changes nothing at all', () => {
    expect(styleOf('v10', 'tradeoffs', {})).toEqual(styleOf('v10', 'full', {}))
  })

  it('CONTRAST: #/canvas (the current design) draws the same lens as it always did', () => {
    const normal = styleOf('current', 'full', {})
    expect(styleOf('current', 'tradeoffs', { e1: 'gains' })).toEqual(normal)
    expect(styleOf('current', 'tradeoffs', { other: 'gains' })).toEqual(normal)
  })
})
