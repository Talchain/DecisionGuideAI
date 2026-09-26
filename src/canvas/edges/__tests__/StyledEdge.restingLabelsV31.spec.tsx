/**
 * CONTRACT v3.1 (U10) — THE DEFAULT VIEW PINS NO STRENGTH LABEL AT REST.
 *
 * Paul's post-run screenshot (OpenAI PoC, zoom 67%) showed three floating
 * "Strong boost est." chips mid-canvas. They were E2 (graph-visuals
 * 2026-07-11): top-strength labels pinned in the default view. Contract v3.1
 * draws a connection as stroke width (strength magnitude, the 23 Sep ruling),
 * a `+`/`−`/`±` glyph in body ink (pt 12) and one discreet fragility cue
 * (pt 4); "strength, uncertainty and explanation remain in the existing
 * relationship inspector". No text label rests on the line.
 *
 * ⛔ BINDING. Elements are found by test id or `data-edge-id`, never by the
 * text under test. Harness copied from `StyledEdge.paulFeedback23Sep.spec.tsx`
 * (same mocks, same fixtures) so the two describe one rendering.
 *
 * CONTRASTS in the same file: Detailed view still pins the strength row; the
 * fragility cue still paints in the default view; the hover still states the
 * strength.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockStatus = 'complete'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => mockEdges,
      getNodes: () => [],
    }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: mockStatus, report: mockReport },
      viewMode: mockViewMode,
      lodRung: 'full',
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

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A producer-estimated strength: the served "Strong boost est." population. */
const CEE_EDGE = {
  strength_mean: 0.6,
  effect_direction: 'positive' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}
const CEE_EDGE_NEGATIVE = {
  strength_mean: -0.6,
  effect_direction: 'negative' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}

const baseProps = {
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
}

const byTestId = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
/** The polarity glyph, by the identity binding it carries — never by its text. */
const glyphOf = (c: HTMLElement) =>
  c.querySelector('[data-edge-id="e1"]') as HTMLElement | null

/**
 * The board around e1. `count` 1 takes the "3 or fewer causal edges" ranking
 * branch; 4 takes the post-analysis composite-importance branch. e1 wins its
 * target on the id tie-break in both, so it IS a top-strength edge — the
 * population E2 pinned.
 */
function boardOf(count: number, data: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    source: `n${i + 1}`,
    target: i === 0 ? 'n2' : `t${i + 1}`,
    data,
  }))
}

function renderEdge(data: Record<string, unknown>) {
  return render(<StyledEdge {...(baseProps as any)} data={data} />)
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'standard'
  mockStatus = 'complete'
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('contract v3.1 U10 — no strength label rests on a connection in the default view', () => {
  it.each([1, 4])(
    'THE CHANGE: after a run, a top-strength connection (%i causal edges) paints no strength chip',
    (count) => {
      mockEdges = boardOf(count, CEE_EDGE)
      const { container } = renderEdge({ ...CEE_EDGE })
      expect(byTestId(container, 'edge-influence-label-text'), 'a strength row rests on the line').toBeNull()
      expect(byTestId(container, 'edge-influence-label'), 'a chip rests on the line').toBeNull()
      // Not vacuous: the connection itself rendered.
      expect(byTestId(container, 'base-edge')).not.toBeNull()
    },
  )

  it.each([
    ['positive', CEE_EDGE, '+'],
    ['negative', CEE_EDGE_NEGATIVE, '−'],
  ] as const)('pt 12: the %s sign glyph stays, because no label now carries direction', (_, data, ch) => {
    mockEdges = boardOf(1, data)
    const { container } = renderEdge({ ...data })
    const glyph = glyphOf(container)
    expect(glyph, 'the sign glyph was suppressed').not.toBeNull()
    expect(glyph!.textContent).toBe(ch)
  })

  it('pt 4: the fragility cue still paints in the default view — as the ONLY row of its chip', () => {
    mockEdges = boardOf(1, CEE_EDGE)
    mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } }
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag'), 'the fragility cue is gone').not.toBeNull()
    expect(byTestId(container, 'edge-influence-label'), 'the cue lost its chip').not.toBeNull()
    expect(byTestId(container, 'edge-influence-label-text'), 'a strength row rides on the cue').toBeNull()
  })

  // ⭐ v3.1 row 12 MOVES THE STRENGTH FROM ONE HOVER AWAY TO ONE CLICK AWAY.
  // U10 withdrew the resting label on the ground that the strength stayed on
  // hover. The hover is now the contract's one-line tooltip ("detail in the
  // edge inspector"), so the strength is the edge inspector's — a click on the
  // connection opens it, and its strength control is pinned in
  // `ui/inspector-v2/__tests__/statedStrengthIsTheOneShown.spec.tsx`. What this
  // case pins now: the hover still opens, and it does not half-keep a strength.
  it('the hover opens the one-line tooltip and carries no strength (the inspector does)', () => {
    mockEdges = boardOf(1, CEE_EDGE)
    const { container } = renderEdge({ ...CEE_EDGE })
    const hit = container.querySelector('path[stroke="transparent"]')
    expect(hit, 'no hit path — the hover cannot be driven').not.toBeNull()
    act(() => { fireEvent.mouseEnter(hit!) })
    act(() => { vi.advanceTimersByTime(350) })
    const tooltip = byTestId(container, 'edge-hover-popover')
    expect(tooltip, 'the hover tooltip did not open').not.toBeNull()
    expect(tooltip!.getAttribute('role')).toBe('tooltip')
    expect(byTestId(container, 'edge-hover-strength-caption')).toBeNull()
    // No figure: the endpoint ids are the only digits allowed.
    expect((tooltip!.textContent ?? '').replace(/\bn[12]\b/g, '')).not.toMatch(/\d/)
  })

  it('CONTROL: Detailed view still pins the same connection\'s strength row', () => {
    mockViewMode = 'expert'
    mockEdges = boardOf(1, CEE_EDGE)
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-influence-label-text')).not.toBeNull()
  })

  it('CONTROL: before any run, no view paints a strength row (unchanged)', () => {
    mockStatus = 'idle'
    mockViewMode = 'expert'
    mockEdges = boardOf(1, CEE_EDGE)
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-influence-label-text')).toBeNull()
  })
})
