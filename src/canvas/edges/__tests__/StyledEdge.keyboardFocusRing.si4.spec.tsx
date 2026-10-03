/**
 * Audit SI-4 (27 Sep 2026) — a link that has KEYBOARD focus shows a ring.
 *
 * Measured on pricing, local and served: Tab from the pane lands on link e-0
 * (a structural link) and nothing on screen changes — 0 changed pixels at 1x
 * between rest and focus. React Flow's `.react-flow__edge:focus-visible
 * {outline:none}` removes the outline, its focus stroke loses to this
 * component's inline `stroke`, and a structural line is a fixed 1px with a
 * faint hover glow. The ring is `[data-edge-focus-ring]`: a path along the
 * link, drawn only for keyboard focus.
 *
 * The harness (React Flow's own edge wrapper as real DOM, the store and
 * library mocks, `:focus-visible` driven explicitly) is
 * `StyledEdge.keyboardParity.spec.tsx`'s, copied rather than re-invented so
 * the two files cannot model the wrapper differently. jsdom proves the ring's
 * presence and its keyboard-only gate; that it is VISIBLE is a browser claim,
 * witnessed on pricing e-0 (0 → 461 changed pixels between rest and focus).
 *
 * ⛔ REVIEW, 28 Sep 2026 — THE RING HID THE UNCERTAINTY RIBBON. It painted
 * AFTER the ribbon, opaque, at the line's width + 4: on a 2px link that covers
 * the 7px floor ribbon completely, so under keyboard focus a stated uncertainty
 * and an unassessed link looked the same. The last block below binds the ring
 * to paint BEFORE the ribbon and the line (DOM order is SVG paint order), to be
 * 2px wider than the wider of the two on each side, and to be MASKED out along
 * that wider band — so it is an outline that never paints a pixel of either —
 * with the widths read off the rendered ribbon, line and cut, on real capture
 * data. It also binds the ring to stay outside the selection-dim group, so a
 * focused link off the selected path does not wear its ring at 0.18. jsdom
 * proves order, widths, the mask's wiring and the ancestry; that the ribbon
 * then READS inside the ring is a browser claim (witnessed on pricing e-4 at
 * two zooms: ribbon pixels grey, Info only outside them).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { StyledEdge, EDGE_FOCUS_RING_WIDTH, EDGE_SELECTION_DIM_OPACITY } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

// ── ReactFlow mocks ──────────────────────────────────────────────────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // Exposes the LINE's drawn width (and its vector effect, so the ring and the
    // cut can be shown to be in the same units), to measure the ring against it.
    BaseEdge: ({ style }: { style?: { strokeWidth?: number; vectorEffect?: string } }) => (
      <path
        data-testid="base-edge"
        data-stroke-width={String(style?.strokeWidth)}
        data-vector-effect={String(style?.vectorEffect)}
      />
    ),
    /**
     * ⭐ PORTALLED, NOT INLINED — and that is the faithful shape, not a
     * convenience. React Flow's real `EdgeLabelRenderer` portals into
     * `.react-flow__edgelabel-renderer`, a sibling of the edge `<svg>`
     * (`dist/esm/index.mjs:3630`). So in production the popover is NOT a DOM
     * descendant of the edge's `<g>`, which is precisely why closing on
     * focus-out needs a cross-portal test and cannot use `contains()` alone.
     * An inlined mock would have hidden the whole problem.
     */
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
      createPortal(children, document.body),
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: (s: unknown) => unknown) => selector({ nodes: [] }),
  }
})

// ── Store mocks (same shape as StyledEdge.hover.spec.tsx) ────────────────────
// The selection dim (another card selected, this link off its path). Read at
// call time, the pattern `StyledEdge.contractV31Edges.spec.tsx` uses.
let mockDimmed = new Set<string>()
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: mockDimmed,
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
  useEdgeLabelMode: vi.fn((selector: (s: unknown) => unknown) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  // importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12).
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: unknown, props: unknown) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Fixture ──────────────────────────────────────────────────────────────────

/** A fully characterised edge, so the popover has real content to carry. */
const characterisedEdge = {
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
  data: {
    weight: 0.3,
    direction: 'positive' as const,
    beliefExists: 0.8,
    weightSource: 'user' as const,
    beliefExistsSource: 'user' as const,
    directionSource: 'user' as const,
  },
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const HARNESS_ATTR = 'data-rf-edge-harness'

/**
 * Reproduces React Flow's own per-edge wrapper — the `<svg>`, the `<g>`, its
 * class, its `tabIndex` and its `role` all taken from `EdgeWrapper`'s render at
 * `@xyflow/react@12.10.2` `dist/esm/index.mjs:2907-2911`, not invented here.
 *
 * ⚠ BUILT AS REAL DOM AND HANDED TO RTL AS ITS CONTAINER, RATHER THAN RENDERED
 * AS JSX. React must not own the `<svg>`: when it did, mounting the portalled
 * popover mid-commit made React remove a node from a parent it no longer
 * belonged to (`NotFoundError: The node to be removed is not a child of this
 * node`), and EVERY case in this file failed — including the contrast controls,
 * which is the only reason it was caught rather than read as a product result.
 * `createElementNS` also guarantees the real SVG namespace, so `.focus()` and
 * `tabIndex` behave as they do in a browser rather than on an unknown element.
 */
function renderEdgeInReactFlowWrapper(props: Record<string, unknown> = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute(HARNESS_ATTR, '')
  const rfEdge = document.createElementNS(SVG_NS, 'g') as SVGGElement
  rfEdge.setAttribute('class', 'react-flow__edge react-flow__edge-styled')
  rfEdge.setAttribute('tabindex', '0')
  rfEdge.setAttribute('role', 'group')
  svg.appendChild(rfEdge)
  document.body.appendChild(svg)

  const result = render(<StyledEdge {...({ ...characterisedEdge, ...props } as any)} />, {
    container: rfEdge as unknown as HTMLElement,
  })

  expect(
    rfEdge.closest('.react-flow__edge'),
    'PRECONDITION: the anchor the product looks for must be reachable from the edge',
  ).toBe(rfEdge)
  return { ...result, rfEdge }
}

/**
 * Drive `:focus-visible` explicitly. See the header: this jsdom SUPPORTS the
 * pseudo-class and answers `true` for a programmatic focus, so without this the
 * "keyboard focus" and "mouse focus" cases would be indistinguishable and the
 * discrimination test would be a tautology.
 */
function stubFocusVisible(answer: boolean | 'throw') {
  const real = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    if (selector === ':focus-visible') {
      if (answer === 'throw') throw new Error('SyntaxError: unsupported pseudo-class')
      return answer
    }
    return real.call(this, selector)
  })
}

/** Focus the wrapper AND assert the focus landed, so no later result is vacuous. */
function focusEdge(rfEdge: SVGGElement) {
  act(() => {
    rfEdge.focus()
  })
  expect(
    document.activeElement,
    'PRECONDITION: focus must actually be on the React Flow edge wrapper',
  ).toBe(rfEdge)
}

const ring = (root: ParentNode = document) => root.querySelector('[data-edge-focus-ring]')

describe('SI-4 — a keyboard-focused link draws its focus ring', () => {
  afterEach(() => {
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
  })

  it('⭐ keyboard focus on the link draws the ring, along the link\'s own path', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    expect(ring(rfEdge), 'PRECONDITION: no ring at rest').toBeNull()
    focusEdge(rfEdge)
    const r = ring(rfEdge)
    expect(r, 'a keyboard user must see which link has focus').not.toBeNull()
    expect(r!.getAttribute('d')).toBe('M0 0 L100 100') // the edge's path, not a box around it
    expect((r as SVGPathElement).style.stroke).toBe('var(--info)')
    expect((r as SVGPathElement).style.pointerEvents).toBe('none')
  })

  it('the ring goes when focus leaves the link', () => {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(ring(rfEdge)).not.toBeNull()
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    act(() => { fireEvent.focusOut(rfEdge, { relatedTarget: elsewhere }) })
    expect(ring(rfEdge)).toBeNull()
    elsewhere.remove()
  })

  it('CONTRAST — a focus that is not a keyboard focus (a click) draws no ring', () => {
    stubFocusVisible(false)
    const { rfEdge } = renderEdgeInReactFlowWrapper()
    focusEdge(rfEdge)
    expect(ring(rfEdge)).toBeNull()
  })

  it('CONTRAST — the pointer passing over a link draws no ring (hover is not focus)', () => {
    const { container, rfEdge } = renderEdgeInReactFlowWrapper()
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath).not.toBeNull()
    act(() => { fireEvent.mouseEnter(hitPath!) })
    expect(ring(rfEdge)).toBeNull()
  })
})

// ── The ring must never hide the uncertainty ribbon (review, 28 Sep 2026) ────

type WireEdge = Record<string, unknown> & { strength?: Record<string, unknown> }

/** A real causal edge from the committed pricing capture: std 0.109, stated by the producer. */
function captureEdge(): WireEdge {
  const p = resolve(__dirname, '../../starters/data', 'pricing-model.draft.json')
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  const hit = edges.find((e) => e.from === 'fac_adoption_friction' && e.to === 'out_bottom_up_growth')
  expect(hit, 'capture no longer carries fac_adoption_friction → out_bottom_up_growth').toBeDefined()
  return hit!
}

/** The capture edge through REAL ingestion, with its std replaced (or deleted with `null`). */
function ingestWithStd(std: number | null): Record<string, unknown> {
  const wire = captureEdge()
  const strength = { ...(wire.strength ?? {}) }
  if (std === null) delete strength.std
  else strength.std = std
  return mapDraftEdgeToCanvas({ ...wire, strength }, 0).data as Record<string, unknown>
}

const num = (v: string | null | undefined) => {
  const n = parseFloat(String(v))
  expect(Number.isFinite(n), `expected a numeric width, got ${String(v)}`).toBe(true)
  return n
}
const ribbonOf = (root: ParentNode) => root.querySelector('[data-testid^="edge-uncertainty-band-"]')
const lineOf = (root: ParentNode) => root.querySelector('[data-testid="base-edge"]')
const paintsBefore = (a: Element, b: Element) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('SI-4 — the link focus ring never hides the uncertainty ribbon', () => {
  afterEach(() => {
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
    mockDimmed = new Set<string>()
  })

  function focusedWith(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    stubFocusVisible(true)
    const { rfEdge } = renderEdgeInReactFlowWrapper({ data, ...extra })
    focusEdge(rfEdge)
    const r = ring(rfEdge)
    const line = lineOf(rfEdge)
    expect(r, 'PRECONDITION: keyboard focus draws the ring').not.toBeNull()
    expect(line, 'PRECONDITION: the line is drawn').not.toBeNull()
    return { rfEdge, ring: r as SVGPathElement, line: line!, ribbon: ribbonOf(rfEdge) }
  }

  // std → ribbon: 0.01 is under the floor (7px total), 0.109 is the capture's
  // own (≈10.5px), 1 is past the ceiling (28px).
  it.each([
    ['the floor ribbon (the case the review found fully hidden)', 0.01],
    ['the capture\'s own ribbon', 'capture'],
    ['the ceiling ribbon', 1],
  ] as const)('⭐ %s: the ring paints BEFORE the ribbon and the line, and stands 2px clear of both on each side', (_label, std) => {
    const stated = std === 'capture' ? (captureEdge().strength as { std: number }).std : std
    const { ring: r, ribbon, line } = focusedWith(ingestWithStd(stated))
    expect(ribbon, 'PRECONDITION: keyboard focus shows the ribbon of a stated uncertainty').not.toBeNull()

    // DOM order is SVG paint order: whatever comes later paints on top.
    expect(paintsBefore(r, ribbon!), 'the ring must paint UNDER the ribbon, never over it').toBe(true)
    expect(paintsBefore(r, line), 'the ring must paint UNDER the line').toBe(true)

    const ringW = num(r.style.strokeWidth)
    const ribbonW = num(ribbon!.getAttribute('stroke-width'))
    const lineW = num(line.getAttribute('data-stroke-width'))
    expect(EDGE_FOCUS_RING_WIDTH).toBe(2) // the contract's `outline: 2px`
    expect(ringW, `ring ${ringW}px vs ribbon ${ribbonW}px: it must stand outside the ribbon's outer edge`)
      .toBeGreaterThanOrEqual(ribbonW + 2 * 2)
    expect(ringW, `ring ${ringW}px vs line ${lineW}px`).toBeGreaterThanOrEqual(lineW + 2 * 2)
  })

  it('CONTROL — with no stated uncertainty there is no ribbon, and the ring stands 2px clear of the line', () => {
    const { ring: r, ribbon, line } = focusedWith(ingestWithStd(null))
    expect(ribbon, 'no std, no ribbon').toBeNull()
    const ringW = num(r.style.strokeWidth)
    const lineW = num(line.getAttribute('data-stroke-width'))
    expect(ringW).toBeGreaterThanOrEqual(lineW + 2 * 2)
    // …and so a focused link WITH a ribbon wears a visibly wider ring than one without.
    cleanup()
    document.querySelectorAll(`[${HARNESS_ATTR}]`).forEach((n) => n.remove())
    vi.restoreAllMocks()
    const withRibbon = focusedWith(ingestWithStd(0.01))
    expect(num(withRibbon.ring.style.strokeWidth)).toBeGreaterThan(ringW)
  })

  // ⭐ THE OUTLINE. Paint order and width alone leave the ring UNDER the ribbon,
  // and the ribbon is 0.2-opacity ink: over Info it read, in the browser, as one
  // thick blue band. So the ring is masked out along the wider of the line and
  // the ribbon, and never paints a pixel of either.
  it.each([
    ['the floor ribbon', 0.01],
    ['the capture\'s own ribbon', 'capture'],
    ['the ceiling ribbon', 1],
    ['CONTROL — no stated uncertainty (the line alone)', null],
  ] as const)('⭐ %s: the ring is masked out along max(line, ribbon), leaving a 2px outline outside both', (_label, std) => {
    const stated = std === 'capture' ? (captureEdge().strength as { std: number }).std : std
    const { ring: r, ribbon, line } = focusedWith(ingestWithStd(stated))
    expect(ribbon === null, 'PRECONDITION: a ribbon exactly when an uncertainty is stated').toBe(stated === null)

    // The mask the ring names is the one this edge renders.
    const maskRef = /^url\(#(.+)\)$/.exec(r.getAttribute('mask') ?? '')
    expect(maskRef, 'the ring must be masked: unmasked, it paints under (and so through) the ribbon').not.toBeNull()
    const mask = document.getElementById(maskRef![1])
    expect(mask?.tagName.toLowerCase()).toBe('mask')
    expect(mask!.getAttribute('maskUnits'), 'a bounding-box mask region is zero-high on a flat link').toBe('userSpaceOnUse')

    // Shown everywhere…
    const keep = mask!.querySelector('rect')
    expect(keep?.getAttribute('fill')).toBe('white')
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(keep!.getAttribute(k)).toBe(mask!.getAttribute(k))
    // …except along the link, as wide as the widest thing the link draws.
    const cut = mask!.querySelector('[data-edge-focus-ring-cut]')
    expect(cut, 'the mask must cut the band the line and the ribbon occupy').not.toBeNull()
    expect(cut!.getAttribute('stroke')).toBe('black')
    expect(cut!.getAttribute('d'), 'the cut follows the ring\'s own path').toBe(r.getAttribute('d'))
    expect(cut!.getAttribute('d')).toBe('M0 0 L100 100')

    const ringW = num(r.style.strokeWidth)
    const cutW = num(cut!.getAttribute('stroke-width'))
    const lineW = num(line.getAttribute('data-stroke-width'))
    const ribbonW = ribbon ? num(ribbon.getAttribute('stroke-width')) : 0
    expect(cutW, `cut ${cutW}px vs ribbon ${ribbonW}px: the ring must never paint inside the ribbon`).toBeGreaterThanOrEqual(ribbonW)
    expect(cutW, `cut ${cutW}px vs line ${lineW}px`).toBeGreaterThanOrEqual(lineW)
    expect((ringW - cutW) / 2, 'the visible outline, each side').toBeGreaterThanOrEqual(EDGE_FOCUS_RING_WIDTH)

    // One unit system: the widths above only compare if all four scale alike.
    expect(cut!.getAttribute('vector-effect')).toBe('non-scaling-stroke')
    expect(r.style.vectorEffect).toBe('non-scaling-stroke')
    expect(line.getAttribute('data-vector-effect')).toBe('non-scaling-stroke')
    if (ribbon) expect(ribbon.getAttribute('vector-effect')).toBe('non-scaling-stroke')
  })

  it('⭐ a focused link that the selection DIMS keeps its ring at full strength (the dim still applies to the link itself)', () => {
    mockDimmed = new Set(['e1'])
    const { rfEdge, ring: r, ribbon, line } = focusedWith(ingestWithStd(0.01))
    const dimmed = rfEdge.querySelector('[data-selection-dimmed="true"]') as SVGGElement | null
    expect(dimmed, 'PRECONDITION: this link is selection-dimmed').not.toBeNull()
    expect(dimmed!.style.opacity).toBe(String(EDGE_SELECTION_DIM_OPACITY))
    // CONTRAST: the connection's own marks stay in the dimmed group.
    expect(dimmed!.contains(ribbon!), 'the ribbon is still dimmed with its link').toBe(true)
    expect(dimmed!.contains(line), 'the line is still dimmed').toBe(true)
    // The ring is not, and nothing between it and React Flow's wrapper fades it.
    expect(dimmed!.contains(r), `the focus ring must not wear the ${EDGE_SELECTION_DIM_OPACITY} dim`).toBe(false)
    for (let el: Element | null = r; el && el !== rfEdge; el = el.parentElement) {
      const o = (el as SVGElement).style?.opacity || el.getAttribute('opacity') || ''
      expect(o === '' || Number(o) >= 1, `<${el.tagName}> fades the ring to ${o}`).toBe(true)
    }
    // …and it still paints under both.
    expect(paintsBefore(r, ribbon!)).toBe(true)
    expect(paintsBefore(r, line)).toBe(true)
  })

  it('a SELECTED link (the widest line state) still gets a ring clear of line and ribbon', () => {
    const { ring: r, ribbon, line } = focusedWith(ingestWithStd(0.01), { selected: true })
    expect(ribbon).not.toBeNull()
    expect(paintsBefore(r, ribbon!)).toBe(true)
    const ringW = num(r.style.strokeWidth)
    expect(ringW).toBeGreaterThanOrEqual(num(ribbon!.getAttribute('stroke-width')) + 4)
    expect(ringW).toBeGreaterThanOrEqual(num(line.getAttribute('data-stroke-width')) + 4)
  })
})
