/**
 * Canvas visual contract v3.1 — the connection hover is ONE LINE (DESIGN-GAP-v31
 * row 12; one tooltip style, row 36).
 *
 *   v3.1: the edge tooltip is the contract's `.tooltip` (dark #303A3A, radius
 *   7px, 12px, max-width 300px) carrying one sentence — "<A> → <B>. Positive
 *   direction in this model." — and the detail lives in the edge inspector
 *   (Direction / Stroke width / Existence rows), with NO percentages.
 *   Served (`eec722ab`): a 110×302 popover (220 world px, not counter-scaled at
 *   0.5) that overlapped cards, carrying "78% confident", "Link strength ·
 *   Olumi's estimate 35%", a duplicate bold "Positive" and three buttons in two
 *   styles.
 *
 * Pinned: the hover surface is a non-interactive tooltip whose text is the
 * contract sentence (by the SAME `edgeArrowSentence` the old first line used),
 * with no percentage, no button, and the one tooltip style; the doubt clause
 * still follows the dashed stroke (contrast).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { EDGE_EXISTENCE_DOUBT_SENTENCE } from '../connectorCopy'
import { TOOLTIP_SURFACE_CLASS } from '../../../components/Tooltip'

// ── ReactFlow mocks (as in StyledEdge.hover.spec.tsx) ────────────────────────
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
      getEdges: () => [],
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
    })
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
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const defaultEdgeProps = {
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

function hover(data: Record<string, unknown>) {
  const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} data={data} />)
  const hitPath = container.querySelector('path[stroke="transparent"]')!
  act(() => {
    fireEvent.mouseEnter(hitPath)
    vi.advanceTimersByTime(400)
  })
  return container.querySelector('[data-testid="edge-hover-popover"]') as HTMLElement | null
}

const STATED = { weight: 0.35, direction: 'positive', directionSource: 'user', beliefExists: 0.78, beliefExistsSource: 'cee' }

describe('v3.1 row 12 — the connection hover is one line, in the one tooltip style', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is a non-interactive tooltip carrying the contract sentence only', () => {
    const tip = hover(STATED)
    expect(tip).not.toBeNull()
    expect(tip!.getAttribute('role')).toBe('tooltip')
    expect(tip!.textContent).toBe('n1 → n2. Positive direction in this model.')
    expect(tip!.querySelectorAll('button')).toHaveLength(0)
    expect(tip!.style.pointerEvents).toBe('none')
  })

  it('states no percentage and no second "Positive"', () => {
    const tip = hover(STATED)!
    expect(tip.textContent).not.toMatch(/%/)
    expect(tip.textContent).not.toMatch(/confident/i)
    expect((tip.textContent!.match(/Positive/g) ?? []).length).toBe(1)
    expect(tip.querySelector('[data-testid="edge-direct-strength-edit"]')).toBeNull()
  })

  it('wears the ONE tooltip style (the shared surface class)', () => {
    const tip = hover(STATED)!
    for (const token of TOOLTIP_SURFACE_CLASS.split(/\s+/)) expect(tip.className).toContain(token)
  })

  it('⭐ CONTRAST — a recorded existence doubt still appends its sentence', () => {
    const tip = hover({ ...STATED, beliefExists: 0.5, beliefExistsSource: 'user' })!
    expect(tip.textContent).toBe(`n1 → n2. Positive direction in this model. ${EDGE_EXISTENCE_DOUBT_SENTENCE}`)
  })
})
