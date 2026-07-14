/**
 * C2 (A2 Experience) — E3 part 2: persistent edge labels dodge node CARDS,
 * not just each other.
 *
 * React Flow paints the node layer above `.react-flow__edgelabel-renderer`
 * (node wrappers carry inline zIndex ≥ 0; the label renderer has none), so a
 * label that lands under a card is clipped invisibly — the production bug:
 * "Moderate boost (uncertain)" truncated behind the "Equity Dilution Regret"
 * card. These tests mount StyledEdge with a node card sitting exactly on the
 * label anchor and assert the label renders displaced, with the existing
 * hairline leader line (>12px displacement rule) pointing back to the anchor.
 *
 * Geometry used throughout (graph coordinates):
 *  - n1 (source) card at (−400,−40) 200×80 → centre (−300, 0)
 *  - n2 (target) card at ( 200,−40) 200×80 → centre ( 300, 0)
 *  - label anchor basis = midpoint of node centres = (0, 0); the 160×22 label
 *    box (±80, ±11) is clear of both endpoint cards.
 *  - blocker card at (−100,−40) 200×80 spans x −100..100, y −40..40 — dead on
 *    the anchor. Clearing its bottom edge needs dy ≥ 51.
 *  - the mocked path functions put the RENDERED anchor at (50, 50).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Node/edge registries — populated per test ───────────────────────────────
const nodeRegistry: Record<string, any> = {}
let edgeList: any[] = []

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => nodeRegistry[id] ?? null,
      getEdges: () => edgeList,
      getNodes: () => Object.values(nodeRegistry),
    }),
    // The component subscribes to node geometry via the React Flow store.
    useStore: (selector: any) => selector({ nodes: Object.values(nodeRegistry) }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      // Results complete → persistent top-strength labels render (E2 policy)
      results: { status: 'complete', report: null },
      highlightedEdges: new Set<string>(),
      viewMode: 'standard',
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))

vi.mock('../../hooks/useTheme', () => ({
  useIsDark: () => false,
}))

vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))

vi.mock('../../utils/graphDisplayCalculations', () => ({
  existenceCertaintyToLineStyle: () => undefined,
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))

vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: () => ({ strokeWidth: 2, stroke: '#333', curvature: 0.15 }),
}))

vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Helpers ──────────────────────────────────────────────────────────────────
const card = (id: string, kind: string, x: number, y: number) => ({
  id,
  type: kind,
  data: {},
  position: { x, y },
  measured: { width: 200, height: 80 },
})

const edgeProps = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: -200,
  sourceY: 0,
  targetX: 200,
  targetY: 0,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: {
    weight: 0.6,
    direction: 'positive' as const,
    beliefExists: 0.8,
  },
}

describe('StyledEdge — E3 part 2: persistent label dodges node cards', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeRegistry)) delete nodeRegistry[k]
    nodeRegistry.n1 = card('n1', 'factor', -400, -40)
    nodeRegistry.n2 = card('n2', 'outcome', 200, -40)
    edgeList = [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.6 } }]
  })

  it('label under a third node card renders displaced, with a leader line back to the anchor', () => {
    nodeRegistry.blocker = card('blocker', 'factor', -100, -40)

    const { container } = render(<StyledEdge {...edgeProps as any} />)

    const label = container.querySelector('[role="note"]') as HTMLElement | null
    expect(label).not.toBeNull()

    // Leader line renders for any displacement > 12px…
    const leader = container.querySelector('[data-testid="edge-label-leader"]')
    expect(leader).not.toBeNull()
    const x1 = Number(leader!.getAttribute('x1'))
    const y1 = Number(leader!.getAttribute('y1'))
    const x2 = Number(leader!.getAttribute('x2'))
    const y2 = Number(leader!.getAttribute('y2'))
    // …anchored at the (mocked) label anchor
    expect(x1).toBe(50)
    expect(y1).toBe(50)
    // Displaced clear of the blocker card: label top edge must pass the card
    // bottom (40) plus the 11px label half-height → dy ≥ 51
    expect(y2 - y1).toBeGreaterThanOrEqual(51)
    // The label itself renders at the leader's far end
    expect(label!.style.transform).toContain(`translate(${x2}px,${y2}px)`)
  })

  it('label clear of every card renders at the anchor with no leader line', () => {
    nodeRegistry.remote = card('remote', 'factor', 1000, 1000)

    const { container } = render(<StyledEdge {...edgeProps as any} />)

    const label = container.querySelector('[role="note"]') as HTMLElement | null
    expect(label).not.toBeNull()
    expect(label!.style.transform).toContain('translate(50px,50px)')
    expect(container.querySelector('[data-testid="edge-label-leader"]')).toBeNull()
  })

  it('an unmeasured node card falls back to ~200×80 for the dodge', () => {
    // No measured/width/height — the rect must fall back to sane defaults
    nodeRegistry.blocker = { id: 'blocker', type: 'factor', data: {}, position: { x: -100, y: -40 } }

    const { container } = render(<StyledEdge {...edgeProps as any} />)

    const leader = container.querySelector('[data-testid="edge-label-leader"]')
    expect(leader).not.toBeNull()
    const dy = Number(leader!.getAttribute('y2')) - Number(leader!.getAttribute('y1'))
    expect(dy).toBeGreaterThanOrEqual(51)
  })
})
