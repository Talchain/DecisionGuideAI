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
 *  - label anchor basis = midpoint of node centres = (0, 0); the 160×34 label
 *    box (±80, ±17) is clear of both endpoint cards.
 *  - blocker card at (−100,−40) 200×80 spans x −100..100, y −40..40 — dead on
 *    the anchor. Clearing its bottom edge needs dy ≥ 57.
 *  - the mocked path functions put the RENDERED anchor at (50, 50).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { LABEL_HALF_HEIGHT, LABEL_HALF_WIDTH, labelHalfHeightForRows } from '../edgeLabelCollision'
import { Position } from '@xyflow/react'

// ── Node/edge registries — populated per test ───────────────────────────────
const nodeRegistry: Record<string, any> = {}
let edgeList: any[] = []
/** Robustness report — set per test to make an edge's chip carry a second row. */
let mockReport: any = null
/**
 * Edges the mocked matcher should treat as fragile. The matcher is mocked here
 * (this suite is about GEOMETRY, not about robustness matching), so membership
 * of this set is what gives a chip its second row.
 */
const fragileIds = new Set<string>()

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
      results: { status: 'complete', report: mockReport },
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
  // Driven by `fragileIds` rather than pinned to false: a chip's SECOND ROW is
  // a geometry input (it makes the box taller), so this suite has to be able
  // to produce one. Empty by default, so every pre-existing test is unchanged.
  isEdgeFragile: (id: string) => fragileIds.has(id),
  getFragileEdgeSwitchProbability: (id: string) => (fragileIds.has(id) ? 0.49 : null),
  isTopFragileEdge: (id: string) => fragileIds.has(id),
}))

vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // ⛔ importOriginal-SPREAD, not a hand-listed replacement. A `vi.mock`
  // factory REPLACES the module, so every export added after this mock was
  // written silently vanished — adding `UNSET_EDGE_STROKE_WIDTH` took 49 tests
  // down across seven files at once. The spread makes the mock derive from the
  // real module and override only what it means to stub.
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
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

// True when the label box centred on (cx, cy) is clear of the rect. The
// half-extents are INDEPENDENT literals, never imported from the module under
// test — a helper reading the same constants as the code agrees with it by
// construction. 160 × 34: the width cap, and the height at the maximum canvas
// counter-scale (measured 33.0 in Chromium; the module rounds its half-extent
// up to 17).
const labelClearOfRect = (
  cx: number,
  cy: number,
  r: { x: number; y: number; width: number; height: number },
) =>
  cx + 80 <= r.x || cx - 80 >= r.x + r.width || cy + 17 <= r.y || cy - 17 >= r.y + r.height

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
    mockReport = null
    fragileIds.clear()
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
    // bottom (40) plus the 17px label half-height → dy ≥ 57
    expect(y2 - y1).toBeGreaterThanOrEqual(57)
    // The label itself renders at the leader's far end
    expect(label!.style.transform).toContain(`translate(${x2}px,${y2}px)`)
  })

  // ── 31 Aug 2026: the leader must be VISIBLE, not merely present ──────────
  // Every other test here asserts the leader EXISTS. A leader drawn in a
  // near-background colour at half a device pixel exists and cannot be seen,
  // which is how a displaced label came to be reported as having "no visible
  // edge". jsdom cannot prove visibility (CLAUDE.md trap 3), so what is
  // pinned is the two declarations that decide it — the ones a tidy-up would
  // otherwise revert without anything going red.
  it('the leader is drawn in a foreground token, not the near-background border token', () => {
    nodeRegistry.blocker = card('blocker', 'factor', -100, -40)

    const { container } = render(<StyledEdge {...edgeProps as any} />)

    const leader = leaderOf(container)
    expect(leader).not.toBeNull()
    const stroke = leader!.getAttribute('stroke') ?? ''
    // Independent literals: the token this must NOT be, and the one it is.
    expect(stroke).not.toContain('--border-default')
    expect(stroke).toContain('--text-light')
  })

  it('the leader keeps a constant SCREEN width, so it survives the auto-fit zoom', () => {
    nodeRegistry.blocker = card('blocker', 'factor', -100, -40)

    const { container } = render(<StyledEdge {...edgeProps as any} />)

    const leader = leaderOf(container)
    expect(leader).not.toBeNull()
    // Without this the 1-unit stroke renders at 0.5 device px at the 0.50 zoom
    // a freshly drafted model is fitted to — invisible exactly when a label is
    // most likely to have been displaced.
    expect(leader!.getAttribute('vector-effect')).toBe('non-scaling-stroke')
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
    expect(dy).toBeGreaterThanOrEqual(57)
  })

  // ── Label-box assumption: the resolver clears a FIXED 160×22 box ──────────
  // The resolver has no access to the rendered label's real size — it assumes
  // ±LABEL_HALF_WIDTH / ±LABEL_HALF_HEIGHT around the anchor. That assumption
  // is only sound because the render caps the label at the same width and
  // refuses to wrap. These pin the coupling: widening the label (or letting a
  // long label wrap to a second line) without widening the resolver's box
  // would silently under-clear every dodge, re-opening the clipping bug for
  // exactly the long labels that triggered it ("Moderate boost (uncertain)").
  //
  // ⚠ THE INVARIANT CHANGED OWNER; IT DID NOT RELAX. The single-line
  // ellipsis used to sit on the label CONTAINER, which is a flex box — there
  // text-overflow computes to a hard clip, so long labels were cut mid-word
  // ("Moderate drag (unc") instead of ellipsised. It now sits on the label
  // TEXT span. Both halves are pinned below, because the 160×22 assumption
  // needs both: the container may not wrap or exceed the box, and the text
  // may not wrap and must shorten to fit. Drop either and the resolver's box
  // stops describing the rendered label.
  describe('the rendered label stays inside the box the resolver clears for', () => {
    const labelStyle = (container: HTMLElement) =>
      (container.querySelector('[role="note"]') as HTMLElement).style

    // Bound by test id, never by its text: the label row also renders a
    // provenance dot span, so a text- or position-based selector could start
    // reading a different span without failing.
    const labelTextStyle = (container: HTMLElement) => {
      const span = container.querySelector(
        '[role="note"] [data-testid="edge-influence-label-text"]',
      ) as HTMLElement | null
      expect(span).not.toBeNull()
      return span!.style
    }

    it('the container is capped at the resolver\'s assumed width and cannot become two lines', () => {
      const { container } = render(<StyledEdge {...edgeProps as any} />)
      const style = labelStyle(container)
      // ⚠ These two literals are written INDEPENDENTLY of the constants they
      // pin. StyledEdge now DERIVES its cap from LABEL_HALF_WIDTH, so an
      // assertion phrased as `LABEL_HALF_WIDTH * 2` would read the same
      // constant as the code and could never fail — a guard agreeing with
      // itself. 160 is the rendered cap; 80 is the half-extent the resolver
      // clears. Changing the geometry REDs here, where the coupling is
      // explained, rather than passing silently.
      expect(style.maxWidth).toBe('160px')
      expect(LABEL_HALF_WIDTH).toBe(80)
      // The row is a flex line that may not wrap — this is what holds the
      // ±LABEL_HALF_HEIGHT (single-line) half of the assumption now that
      // white-space no longer sits here — and anything past the cap is
      // clipped away rather than growing the box.
      expect(style.display).toBe('flex')
      expect(style.flexWrap).toBe('nowrap')
      expect(style.overflow).toBe('hidden')
      // The vertical chrome the HEIGHT derivation adds to the line box: 3px
      // padding and a 1px border, top and bottom. Pinned here, beside the
      // width cap, because the resolver's box height is computed from it —
      // change the padding and the box the dodge clears is wrong again.
      expect(style.padding).toBe('3px 8px')
      expect(container.querySelector('[role="note"]')!.className).toContain('border')
    })

    it('the label TEXT carries the single-line ellipsis, so a long label shortens instead of wrapping', () => {
      const { container } = render(<StyledEdge {...edgeProps as any} />)
      const style = labelTextStyle(container)
      // A long label is ellipsised on ONE line rather than wrapping to a
      // second, which would break the ±LABEL_HALF_HEIGHT assumption.
      expect(style.whiteSpace).toBe('nowrap')
      expect(style.overflow).toBe('hidden')
      expect(style.textOverflow).toBe('ellipsis')
      // Without this the flex item's automatic minimum pins it to its own
      // text width, the ellipsis never engages, and the row pushes past the
      // ±LABEL_HALF_WIDTH cap — the clipping bug in its original form.
      // Read numerically so the assertion pins ZERO, not React's spelling of
      // it ('0' unitless vs '0px'); an absent value parses to NaN and REDs.
      expect(parseFloat(style.minWidth)).toBe(0)
    })

    // The regression in one assertion: put the ellipsis back on the flex
    // container and it silently becomes a hard clip again, while every
    // width/height assertion above still passes.
    it('the ellipsis is NOT declared on the flex container, where it computes to a clip', () => {
      const { container } = render(<StyledEdge {...edgeProps as any} />)
      expect(labelStyle(container).textOverflow).toBe('')
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
      expect(labelStyle(container).maxWidth).toBe('160px') // independent literal, as above
      // …and at that length the shortening machinery is still on the text,
      // so the extra characters ellipsise rather than widen the row.
      expect(labelTextStyle(container).textOverflow).toBe('ellipsis')
      expect(parseFloat(labelTextStyle(container).minWidth)).toBe(0)
      // ⚠ 11 UNTIL 31 Aug 2026, WHEN THE RENDERED BOX WAS MEASURED AT 33 GRAPH
      // UNITS TALL IN CHROMIUM. Canvas label text carries a counter-scale, so
      // the height a resolver working in graph units must clear depends on
      // zoom, and is largest at exactly the zoom the product's auto-fit parks
      // at. The constant is now derived from that scale; this remains an
      // INDEPENDENT literal so the derivation cannot silently drift.
      expect(LABEL_HALF_HEIGHT).toBe(17)
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
    // ⚠ RE-SITED 31 Aug 2026 with the corrected label box (±17, not ±11): the
    // old −94/−88 pair now BOTH overlap, so it stopped testing the boundary.
    // Blocker at y −100.4: bottom edge −20.4 just clears the label box
    // (−17..17). At y −95.6: bottom edge −15.6 overlaps. Both quantise to the
    // same 10px bucket (round(−10.04) === round(−9.56) === −10), which is the
    // property under test.
    it('a sub-bucket move of a settled card still triggers a recompute', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -100.4)
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)
      expect(leaderOf(container)).toBeNull() // clear at −94

      nodeRegistry.blocker = card('blocker', 'factor', -100, -95.6)
      // New data identity defeats React.memo bailout without touching any
      // collision-memo dependency.
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      expect(leaderDelta(leader!).dy).toBeGreaterThanOrEqual(26)
    })

    it('perf posture: mid-drag sub-bucket movement does NOT recompute', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -100.4, { dragging: true })
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)
      expect(leaderOf(container)).toBeNull()

      nodeRegistry.blocker = card('blocker', 'factor', -100, -95.6, { dragging: true })
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)

      // Same 10px bucket while dragging → throttled, still no dodge…
      expect(leaderOf(container)).toBeNull()
    })

    it('…but the drag SETTLING at the same sub-bucket position recomputes', () => {
      nodeRegistry.blocker = card('blocker', 'factor', -100, -100.4, { dragging: true })
      const { container, rerender } = render(<StyledEdge {...edgeProps as any} />)

      nodeRegistry.blocker = card('blocker', 'factor', -100, -95.6, { dragging: true })
      rerender(<StyledEdge {...(edgeProps as any)} data={{ ...edgeProps.data }} />)
      expect(leaderOf(container)).toBeNull() // throttled mid-drag

      nodeRegistry.blocker = card('blocker', 'factor', -100, -95.6, { dragging: false })
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
      // ⚠ RE-SITED 31 Aug 2026 for the corrected ±17 label box: at y 65 the
      // card overlapped BOTH candidate anchors and the pair discriminated
      // nothing. Bottom edge 140: overlaps the 140-anchor box (123..157),
      // clear of the 160-anchor box (143..177).
      nodeRegistry.blocker = card('blocker', 'factor', -100, 60)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      const { dx, dy } = leaderDelta(leader!)
      expect(dx).toBe(0)
      // Clear of the blocker bottom (140) from cy 140 → dy ≥ 17
      expect(dy).toBeGreaterThanOrEqual(17)
      expect(labelClearOfRect(0 + dx, 140 + dy, { x: -100, y: 60, width: 200, height: 80 })).toBe(true)
    })

    it('a card over the node-centre midpoint (clear of the render anchor) is NOT dodged', () => {
      // Top edge 160: overlaps the 160-anchor box (143..177), clear of the
      // 140-anchor box (123..157) — dodging it would be a phantom dodge.
      // Re-sited from 155 with the corrected ±17 box, same reason as above.
      nodeRegistry.blocker = card('blocker', 'factor', -100, 160)

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
      // n1 (−30, 0) 200×80, n2 (−30, 160) 200×80 → true anchor (70, 120);
      // the label box (103..137) is clear of both cards, so NO offset at all
      // is correct. A post-resolution nudge (dy +20) would sink the label box
      // (123..157) into n2 (top edge 160). ⚠ n2 moved 140 → 160 on 31 Aug
      // 2026: with the corrected ±17 box the old spacing left no clear slot
      // at the anchor, so the case could no longer observe "no offset".
      nodeRegistry.n2 = card('n2', 'outcome', -30, 160)
      nodeRegistry.n1 = card('n1', 'factor', -30, 0)

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const label = container.querySelector('[role="note"]') as HTMLElement | null
      expect(label).not.toBeNull()
      const leader = leaderOf(container)
      const { dx, dy } = leader ? leaderDelta(leader) : { dx: 0, dy: 0 }
      // Whatever offset is applied, the final label box must clear both cards
      expect(labelClearOfRect(70 + dx, 120 + dy, { x: -30, y: 0, width: 200, height: 80 })).toBe(true)
      expect(labelClearOfRect(70 + dx, 120 + dy, { x: -30, y: 160, width: 200, height: 80 })).toBe(true)
    })

    it('when the nudge fires, the resolver still clears every card AND the nudge survives', () => {
      // n1 (0, 0) 200×80 (centre (100, 40)), n2 (0, 40) 200×160 (top handle
      // (100, 40)) → anchor (100, 60) is within 40px of n1's centre → nudge
      // fires perpendicular to the (vertical) handle direction: dx +20. The
      // anchor sits inside BOTH cards, so the resolver must then displace the
      // nudged label clear of both.
      //
      // ⚠ REPHRASED 31 Aug 2026: this pinned `dy >= 151` (downward past n2's
      // bottom edge). Clearing upward past n1's top edge costs 78 against 156,
      // and the search is now bidirectional-nearest-first, so it takes the
      // short way. The clearance assertions — the actual property — are
      // unchanged; the magnitude is now bounded on BOTH sides so it still
      // fails a resolver that does not displace, and fails one that travels
      // the long way round.
      nodeRegistry.n1 = card('n1', 'factor', 0, 0)
      nodeRegistry.n2 = card('n2', 'outcome', 0, 40, { height: 160 })

      const { container } = render(<StyledEdge {...edgeProps as any} />)

      const leader = leaderOf(container)
      expect(leader).not.toBeNull()
      const { dx, dy } = leaderDelta(leader!)
      expect(dx).toBe(20) // the 9c nudge survives, applied pre-resolution
      expect(Math.abs(dy)).toBeGreaterThanOrEqual(71) // n1's top edge from cy 60
      expect(Math.abs(dy)).toBeLessThan(151) // n2's bottom edge — the long way
      expect(labelClearOfRect(100 + dx, 60 + dy, { x: 0, y: 0, width: 200, height: 80 })).toBe(true)
      expect(labelClearOfRect(100 + dx, 60 + dy, { x: 0, y: 40, width: 200, height: 160 })).toBe(true)
    })
  })

  /**
   * ⛔ THE ROW COUNT MUST REACH THE RESOLVER FROM THE COMPONENT.
   *
   * A mutant that dropped `rows` from the `placementEdges` push survived every
   * other spec in this change: the resolver's own unit tests pass `rows`
   * directly, so they prove the RESOLVER honours it and say nothing about
   * whether StyledEdge ever supplies it. This is that binding, and it is the
   * only test in the suite that fails when the pass-through is removed.
   *
   * Geometry is DERIVED from the registry, not hand-copied: the blocker card
   * is placed so that one step of travel clears a ONE-row box and leaves a
   * TWO-row box still overlapping. So the same graph must displace a fragile
   * (two-row) chip further than a plain (one-row) one.
   */
  it('a two-row chip is displaced further than a one-row chip on identical geometry', () => {
    const anchorX = ((nodeRegistry.n1.position.x + 100) + (nodeRegistry.n2.position.x + 100)) / 2
    const anchorY = ((nodeRegistry.n1.position.y + 80) + nodeRegistry.n2.position.y) / 2

    // Card bottom sits between (anchor + STEP − twoRowHalf) and
    // (anchor + STEP − oneRowHalf): one step clears the short box, not the tall.
    const STEP = LABEL_HALF_HEIGHT * 2 + 2
    const oneRowHalf = labelHalfHeightForRows(1)
    const twoRowHalf = labelHalfHeightForRows(2)
    const bottom = anchorY + STEP - Math.round((oneRowHalf + twoRowHalf) / 2)
    nodeRegistry.blocker = card('blocker', 'factor', anchorX - 100, bottom - 80)

    const dyOf = (c: HTMLElement) => {
      const leader = c.querySelector('[data-testid="edge-label-leader"]')
      if (!leader) return 0
      return Number(leader.getAttribute('y2')) - Number(leader.getAttribute('y1'))
    }

    const plain = render(<StyledEdge {...edgeProps as any} />)
    const dyOneRow = dyOf(plain.container)
    plain.unmount()

    // Same graph, same blocker — the ONLY change is a second chip row.
    mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.49 }] } }
    fragileIds.add('e1')
    const fragile = render(<StyledEdge {...edgeProps as any} />)
    expect(
      fragile.container.querySelector('[data-testid="edge-fragile-tag"]'),
      'the second row did not render — the fixture, not the code, is wrong',
    ).not.toBeNull()
    const dyTwoRow = dyOf(fragile.container)

    expect(Math.abs(dyTwoRow)).toBeGreaterThan(Math.abs(dyOneRow))
  })

})
