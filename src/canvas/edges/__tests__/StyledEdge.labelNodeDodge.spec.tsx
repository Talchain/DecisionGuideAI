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
import { LABEL_HALF_HEIGHT, LABEL_HALF_WIDTH } from '../edgeLabelCollision'
import { Position } from '@xyflow/react'

// ── Node/edge registries — populated per test ───────────────────────────────
const nodeRegistry: Record<string, any> = {}
let edgeList: any[] = []

// STABLE useReactFlow surface: production useReactFlow returns a stable
// instance, so the collision memo's [getEdges, getNode, getNodes] deps never
// change identity. A fresh-object-per-render mock would force the memo to
// recompute on EVERY render and mask signature-staleness bugs (C2 review
// finding 2).
const rfApi = {
  getNode: (id: string) => nodeRegistry[id] ?? null,
  getEdges: () => edgeList,
  getNodes: () => Object.values(nodeRegistry),
}

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => rfApi,
    // The component subscribes to node geometry via the React Flow store.
    useStore: (selector: any) => selector({ nodes: Object.values(nodeRegistry) }),
  }
})

// ── Graph-lens state — the app's REAL node-hiding mechanism ─────────────────
// BaseNode returns null for ids in lens._hiddenNodeIds; React Flow's `hidden`
// flag is never set by this app. Mutable so individual tests can enable the
// lens and hide nodes/edges.
let lensEnabled = false
const makeLens = () => ({
  active: 'full' as const,
  _dimmedEdgeIds: new Set<string>(),
  _hiddenEdgeIds: new Set<string>(),
  _hiddenNodeIds: new Set<string>(),
  _fragileEdgeIds: new Set<string>(),
  _sensitivityWeights: new Map<string, number>(),
  _sensitivityQuartiles: null as { q25: number; q75: number } | null,
  _causalEdgeParams: new Map<string, unknown>(),
  _evidenceEdgeClass: new Map<string, string>(),
})
let lensState = makeLens()

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      // Results complete → persistent top-strength labels render (E2 policy)
      results: { status: 'complete', report: null },
      highlightedEdges: new Set<string>(),
      viewMode: 'standard',
      lens: lensState,
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
  isGraphLensEnabled: () => lensEnabled,
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
const card = (
  id: string,
  kind: string,
  x: number,
  y: number,
  opts: { width?: number; height?: number; hidden?: boolean; dragging?: boolean } = {},
) => ({
  id,
  type: kind,
  data: {},
  position: { x, y },
  measured: { width: opts.width ?? 200, height: opts.height ?? 80 },
  ...(opts.hidden !== undefined ? { hidden: opts.hidden } : {}),
  ...(opts.dragging !== undefined ? { dragging: opts.dragging } : {}),
})

const leaderOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="edge-label-leader"]')

/** Total label offset (dx, dy) extracted from the leader-line endpoints. */
const leaderDelta = (leader: Element) => ({
  dx: Number(leader.getAttribute('x2')) - Number(leader.getAttribute('x1')),
  dy: Number(leader.getAttribute('y2')) - Number(leader.getAttribute('y1')),
})

/** True when a 160×22 label box centred on (cx, cy) is clear of the rect. */
const labelClearOfRect = (
  cx: number,
  cy: number,
  r: { x: number; y: number; width: number; height: number },
) =>
  cx + 80 <= r.x || cx - 80 >= r.x + r.width || cy + 11 <= r.y || cy - 11 >= r.y + r.height

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
    lensEnabled = false
    lensState = makeLens()
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

  // ── Label-box assumption: the resolver clears a FIXED 160×22 box ──────────
  // The resolver has no access to the rendered label's real size — it assumes
  // ±LABEL_HALF_WIDTH / ±LABEL_HALF_HEIGHT around the anchor. That assumption
  // is only sound because the render caps the label at the same width and
  // refuses to wrap. These pin the coupling: widening the label (or letting a
  // long label wrap to a second line) without widening the resolver's box
  // would silently under-clear every dodge, re-opening the clipping bug for
  // exactly the long labels that triggered it ("Moderate boost (uncertain)").
  describe('the rendered label stays inside the box the resolver clears for', () => {
    const labelStyle = (container: HTMLElement) =>
      (container.querySelector('[role="note"]') as HTMLElement).style

    it('the label is capped at the resolver\'s assumed width and never wraps', () => {
      const { container } = render(<StyledEdge {...edgeProps as any} />)
      const style = labelStyle(container)
      // Width cap === the resolver's box width (2 × half-extent)
      expect(style.maxWidth).toBe(`${LABEL_HALF_WIDTH * 2}px`)
      // …and a long label is ellipsised on ONE line rather than wrapping to a
      // second, which would break the ±LABEL_HALF_HEIGHT assumption.
      expect(style.whiteSpace).toBe('nowrap')
      expect(style.overflow).toBe('hidden')
      expect(style.textOverflow).toBe('ellipsis')
    })

    it('a long label text does not widen the rendered box beyond the assumption', () => {
      const { container } = render(
        <StyledEdge
          {...(edgeProps as any)}
          data={{ ...edgeProps.data, label: 'Moderate boost (uncertain) — a deliberately very long label' }}
        />,
      )
      // Same cap regardless of text length: jsdom does not lay text out, so
      // the enforceable invariant is the cap itself, not a measured width.
      expect(labelStyle(container).maxWidth).toBe(`${LABEL_HALF_WIDTH * 2}px`)
      expect(LABEL_HALF_HEIGHT).toBe(11) // ~22px tall single line (padding included)
    })
  })

  // ── C2 review finding 1: lens-hidden nodes are NOT obstacles ──────────────
  // The app never sets React Flow's `hidden` flag; nodes disappear when
  // BaseNode returns null for ids in lens._hiddenNodeIds. An invisible card
  // must not displace a label (phantom obstacle).
  describe('lens-hidden nodes and edges are invisible to the collision pass', () => {
    it('a lens-hidden card on the label anchor causes NO displacement', () => {
      lensEnabled = true
      lensState._hiddenNodeIds.add('blocker')
      nodeRegistry.blocker = card('blocker', 'factor', -100, -40)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const label = container.querySelector('[role="note"]') as HTMLElement | null
      expect(label).not.toBeNull()
      expect(label!.style.transform).toContain('translate(50px,50px)')
      expect(leaderOf(container)).toBeNull()
    })

    it('belt-and-braces: a React-Flow-`hidden` card is still excluded', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -40, { hidden: true })

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      expect(leaderOf(container)).toBeNull()
    })

    it('with the lens flag OFF, _hiddenNodeIds is ignored and the card still dodges', () => {
      lensEnabled = false
      lensState._hiddenNodeIds.add('blocker') // stale state — flag gates the mechanism
      nodeRegistry.blocker = card('blocker', 'factor', -100, -40)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      expect(leaderOf(container)).not.toBeNull()
    })

    it('a lens-hidden EDGE renders no label, so it must not occupy a label slot', () => {
      lensEnabled = true
      // e2 (n3 → n4) is lens-hidden along with its organisational source node.
      // Its label anchor (0, −10) would collide with e1's anchor (0, 0) — but
      // no label renders for it, so e1 must stay put.
      nodeRegistry.n3 = card('n3', 'factor', -200, -300) // bottom handle (−100, −220)
      nodeRegistry.n4 = card('n4', 'outcome', 0, 200) // top handle (100, 200)
      edgeList = [...edgeList, { id: 'e2', source: 'n3', target: 'n4', data: { weight: 0.5 } }]
      lensState._hiddenNodeIds.add('n3')
      lensState._hiddenEdgeIds.add('e2')

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const label = container.querySelector('[role="note"]') as HTMLElement | null
      expect(label).not.toBeNull()
      expect(label!.style.transform).toContain('translate(50px,50px)')
      expect(leaderOf(container)).toBeNull()
    })
  })

  // ── C2 review finding 2: settled positions always recompute ──────────────
  // The geometry signature quantises to a 10px grid, so the FINAL sub-bucket
  // movement of a drag (or any small programmatic move) could otherwise leave
  // a permanently stale offset — up to ~10px of clip/spurious dodge that no
  // later event ever fixes.
  describe('drag-end / settled-position recompute (quantisation gap)', () => {
    // Blocker at y −94: bottom edge −14 just clears the label box (−11..11).
    // At y −88: bottom edge −8 overlaps. Both quantise to the same 10px
    // bucket (round(−9.4) === round(−8.8) === −9).
    it('a sub-bucket move of a settled card still triggers a recompute', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -94)
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)
      expect(leaderOf(container)).toBeNull() // clear at −94

      nodeRegistry.blocker = card('blocker', 'factor', -100, -88)
      // New data identity defeats React.memo bailout without touching any
      // collision-memo dependency.
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      expect(leaderDelta(leader!).dy).toBeGreaterThanOrEqual(26)
    })

    it('perf posture: mid-drag sub-bucket movement does NOT recompute', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -94, { dragging: true })
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)
      expect(leaderOf(container)).toBeNull()

      nodeRegistry.blocker = card('blocker', 'factor', -100, -88, { dragging: true })
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)

      // Same 10px bucket while dragging → throttled, still no dodge…
      expect(leaderOf(container)).toBeNull()
    })

    it('…but the drag SETTLING at the same sub-bucket position recomputes', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -94, { dragging: true })
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)

      nodeRegistry.blocker = card('blocker', 'factor', -100, -88, { dragging: true })
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)
      expect(leaderOf(container)).toBeNull() // throttled mid-drag

      nodeRegistry.blocker = card('blocker', 'factor', -100, -88, { dragging: false })
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      expect(leaderDelta(leader!).dy).toBeGreaterThanOrEqual(26)
    })
  })

  // ── C2 review finding 3: collision anchor === render anchor ──────────────
  // The label renders at the bezier label point = midpoint of the HANDLE
  // points (source bottom-centre → target top-centre). The collision pass
  // must test the same point — the midpoint of node CENTRES diverges by
  // (sourceHeight − targetHeight)/4 for unequal-height cards.
  describe('anchor basis with unequal-height endpoint cards', () => {
    beforeEach(() => {
      // n1 (−400, 0) 200×80 → bottom handle (−300, 80)
      // n2 (200, 200) 200×160 → top handle (300, 200)
      // handle-midpoint anchor (0, 140); node-centre midpoint would be (0, 160)
      nodeRegistry.n1 = card('n1', 'factor', -400, 0)
      nodeRegistry.n2 = card('n2', 'outcome', 200, 200, { height: 160 })
    })

    it('a card over the true (handle-midpoint) anchor is dodged', () => {
      // bottom edge 145: overlaps the 140-anchor box (129..151), clear of the
      // 160-anchor box (149..171)
      nodeRegistry.blocker = card('blocker', 'factor', -100, 65)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      const { dx, dy } = leaderDelta(leader!)
      expect(dx).toBe(0)
      // Clear of the blocker bottom (145) from cy 140 → dy ≥ 16
      expect(dy).toBeGreaterThanOrEqual(16)
      expect(labelClearOfRect(0 + dx, 140 + dy, { x: -100, y: 65, width: 200, height: 80 })).toBe(true)
    })

    it('a card over the node-centre midpoint (clear of the render anchor) is NOT dodged', () => {
      // top edge 155: overlaps the 160-anchor box (149..171), clear of the
      // 140-anchor box (129..151) — dodging it would be a phantom dodge
      nodeRegistry.blocker = card('blocker', 'factor', -100, 155)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const label = container.querySelector('[role="note"]') as HTMLElement | null
      expect(label).not.toBeNull()
      expect(label!.style.transform).toContain('translate(50px,50px)')
      expect(leaderOf(container)).toBeNull()
    })
  })

  // ── C2 review finding 4: the 9c proximity nudge is resolver-aware ─────────
  // The ±20px perpendicular nudge must be applied BEFORE resolution (the
  // resolver sees nudged anchors), so it can never push a cleared label back
  // under a card — and it must key off the true anchor, not a stale one.
  describe('proximity nudge goes through the resolver', () => {
    it('a nudge keyed off the wrong anchor must not push the label under a card', () => {
      // n1 (−30, 0) 200×80, n2 (−30, 140) 200×80 → true anchor (70, 110);
      // the label box (99..121) is clear of both cards, so NO offset at all
      // is correct. A post-resolution nudge (dy +20) would sink the label box
      // (119..141) into n2 (top edge 140).
      nodeRegistry.n1 = card('n1', 'factor', -30, 0)
      nodeRegistry.n2 = card('n2', 'outcome', -30, 140)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const label = container.querySelector('[role="note"]') as HTMLElement | null
      expect(label).not.toBeNull()
      const leader = leaderOf(container)
      const { dx, dy } = leader ? leaderDelta(leader) : { dx: 0, dy: 0 }
      // Whatever offset is applied, the final label box must clear both cards
      expect(labelClearOfRect(70 + dx, 110 + dy, { x: -30, y: 0, width: 200, height: 80 })).toBe(true)
      expect(labelClearOfRect(70 + dx, 110 + dy, { x: -30, y: 140, width: 200, height: 80 })).toBe(true)
    })

    it('when the nudge fires, the resolver still clears every card AND the nudge survives', () => {
      // n1 (0, 0) 200×80 (centre (100, 40)), n2 (0, 40) 200×160 (top handle
      // (100, 40)) → anchor (100, 60) is within 40px of n1's centre → nudge
      // fires perpendicular to the (vertical) handle direction: dx +20. The
      // anchor sits inside BOTH cards, so the resolver must then stack the
      // nudged label clear of both (dy ≥ 151 to pass n2's bottom edge 200).
      nodeRegistry.n1 = card('n1', 'factor', 0, 0)
      nodeRegistry.n2 = card('n2', 'outcome', 0, 40, { height: 160 })

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      const { dx, dy } = leaderDelta(leader!)
      expect(dx).toBe(20) // the 9c nudge survives, applied pre-resolution
      expect(dy).toBeGreaterThanOrEqual(151)
      expect(labelClearOfRect(100 + dx, 60 + dy, { x: 0, y: 0, width: 200, height: 80 })).toBe(true)
      expect(labelClearOfRect(100 + dx, 60 + dy, { x: 0, y: 40, width: 200, height: 160 })).toBe(true)
    })
  })
})
