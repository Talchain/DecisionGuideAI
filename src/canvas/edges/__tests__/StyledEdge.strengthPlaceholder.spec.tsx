/**
 * POM-8 (27 Sep 2026) — ON THE GRAPH, A PLACEHOLDER STRENGTH IS NOT DRAWN OR
 * SPOKEN AS AN ESTIMATE.
 *
 * Measured on Paul's MRR board (17d1cd3a, 90b8f080): "Pro plan price → MRR", a
 * 0.5 `olumi_placeholder`, drew at 4px — the Strong band, the heaviest causal
 * line on the board — and its hover read only "Pro plan price → MRR. Positive
 * direction in this model." Owner decision: the placeholder draws at the
 * NOT-SET width, and the hover says it is a placeholder, not an estimate.
 *
 * Discriminating pair, from the same board and the same mapper: the −0.4
 * `olumi_estimate` "Pro plan price → Monthly new Pro subscribers" keeps the
 * Strong width. Edge data is produced by the real `mapDraftEdgeToCanvas` from the
 * fixture — never hand-typed — and the width by the real
 * `weightMagnitudeToStrokeWidth` (unmocked here).
 *
 * jsdom limit: this reads the declared style and marker attributes; it cannot
 * paint. The served witness is the browser probe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Position } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { EDGE_STRENGTH_PLACEHOLDER_SENTENCE } from '../connectorCopy'
import { EDGE_STROKE_WIDTH_BANDS, UNSET_EDGE_STROKE_WIDTH } from '../../utils/graphDisplayCalculations'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
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
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const dataFor = (from: string, to: string): Record<string, unknown> => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  expect(i, `${from} → ${to} is in the fixture`).toBeGreaterThanOrEqual(0)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data
}
const PLACEHOLDER = () => dataFor('pro_plan_price', 'mrr')
const ESTIMATE = () => dataFor('pro_plan_price', 'monthly_new_pro_subscribers')

const props = {
  id: 'e1', source: 'pro_plan_price', target: 'mrr',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top,
  selected: false,
}

const strokeWidthOf = (c: HTMLElement) =>
  Number.parseFloat((c.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style.strokeWidth)
const headOf = (c: HTMLElement) => Number(c.querySelector('marker')?.getAttribute('markerWidth'))

describe('POM-8 — the line: a placeholder draws at the not-set width', () => {
  it('Pro plan price → MRR (0.5 placeholder) draws at the NOT-SET width, not Strong', () => {
    const { container } = render(<StyledEdge {...(props as any)} data={PLACEHOLDER()} />)
    expect(strokeWidthOf(container)).toBe(UNSET_EDGE_STROKE_WIDTH)
    // …and carries the contract's smallest head (F2's floor), not a 4px one.
    expect(headOf(container)).toBe(8)
  })

  it('CONTRAST: the −0.4 estimate on the same board keeps the Strong width', () => {
    const { container } = render(<StyledEdge {...(props as any)} data={ESTIMATE()} />)
    expect(strokeWidthOf(container)).toBe(EDGE_STROKE_WIDTH_BANDS.strong)
  })

  it('the same number set by a person is drawn at its band again (the flag retires itself)', () => {
    const { container } = render(<StyledEdge {...(props as any)} data={{ ...PLACEHOLDER(), weightSource: 'user' }} />)
    expect(strokeWidthOf(container)).toBe(EDGE_STROKE_WIDTH_BANDS.strong)
  })
})

describe('POM-8 — the hover says it is a placeholder, not an estimate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const hover = (data: Record<string, unknown>) => {
    const { container } = render(<StyledEdge {...(props as any)} data={data} />)
    const hit = container.querySelector('path[stroke="transparent"]')!
    act(() => {
      fireEvent.mouseEnter(hit)
      vi.advanceTimersByTime(400)
    })
    return container
  }

  it('the placeholder\'s hover carries the placeholder sentence after the arrow sentence', () => {
    const c = hover(PLACEHOLDER())
    const popover = c.querySelector('[data-testid="edge-hover-popover"]')
    expect(popover).not.toBeNull()
    expect(c.querySelector('[data-testid="edge-hover-strength-placeholder"]')?.textContent).toBe(
      EDGE_STRENGTH_PLACEHOLDER_SENTENCE,
    )
    expect(EDGE_STRENGTH_PLACEHOLDER_SENTENCE).toMatch(/placeholder, not an estimate/)
  })

  it('CONTRAST: the estimate\'s hover says nothing about a placeholder', () => {
    const c = hover(ESTIMATE())
    expect(c.querySelector('[data-testid="edge-hover-popover"]')).not.toBeNull()
    expect(c.querySelector('[data-testid="edge-hover-strength-placeholder"]')).toBeNull()
  })
})
