/**
 * THE ARROW MUST BE THE SAME COLOUR AS ITS LINE, AND MUST ONLY APPEAR ON EDGES
 * THAT ACTUALLY CLAIM A DIRECTION OF CAUSATION.
 *
 * ── WHY THE MARKER IS PER-EDGE AND NOT ONE SHARED `<defs>` ENTRY ───────────
 * Stroke colour is decided by a SEVEN-RULE ordered precedence
 * (`EDGE_STROKE_RULES`), whose outputs include `var(--semantic-warning)`, a
 * `color-mix(…)`, the structural grey and the polarity stroke. A marker in a
 * shared `<defs>` cannot know which of those won, so a shared marker is a second
 * copy of a decision that already has an authority — the hand-maintained mirror
 * this estate pays for over and over (CLAUDE.md trap 12). The per-edge marker
 * reads `edgeStroke.value`: the SAME resolved decision that sets `stroke`, one
 * quantity with two readers. If a rule is added or reordered, the arrow follows
 * with no edit here at all, and the test below would go red if it stopped.
 *
 * SVG 2's `fill="context-stroke"` would also achieve this, in one shared marker.
 * It is NOT used, deliberately: this lane has no browser witness (stated in the
 * PR), so a feature whose fallback is a black arrowhead on every edge cannot be
 * verified with the instruments actually in hand. The explicit fill can be —
 * below, in jsdom, by identity.
 *
 * `BaseEdge` forwarding `markerEnd` to its `<path>` was verified at the library
 * bytes, not assumed: `@xyflow/react@12.8.6` spreads `...props` onto the path
 * element, and `BaseEdgeProps` declares `markerEnd?: string` in the
 * `url(#markerId)` form.
 *
 * ── HONEST LIMIT ──────────────────────────────────────────────────────────
 * jsdom has no layout, no paint and no viewport transform. Nothing here shows
 * that the arrowhead LOOKS right, is the right size on screen, or does not
 * collide with a node card. `Visual Regression` is a standing estate-wide red;
 * `Canvas Browser Gate` is green on staging as well as on this change, so it
 * discriminates nothing about the mark. **Nobody has seen this arrowhead
 * painted** — every size and clearance number in this file and in
 * `edgePresentation.ts` is arithmetic over declared constants. The geometry
 * cases below assert that the rendered ELEMENT carries those numbers; they do
 * not and cannot assert what happens on a screen. Read them at that rung.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import {
  edgeArrowheadMarkerId,
  STRUCTURAL_EDGE_COLOUR,
  edgeArrowheadViewBox,
  edgeArrowheadPolygonPoints,
} from '../edgePresentation'

// ── Node kind registry — switched per-test ───────────────────────────────────
const nodeKinds: Record<string, string> = {}

// The props BaseEdge was actually called with. Asserting the PROP rather than a
// rendered attribute keeps the test bound to the contract with xyflow that was
// verified at its bytes, and sidesteps jsdom's HTML/SVG namespace rules for
// camelCase SVG attribute names.
let baseEdgeProps: Record<string, unknown> | null = null

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => {
      baseEdgeProps = props
      return <path data-testid="base-edge" style={props.style} />
    },
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? { id, type: nodeKinds[id], data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
          : null,
      getEdges: () => [],
      getNodes: () =>
        Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
    }),
    useStore: (selector: any) =>
      selector({
        nodes: Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
      }),
  }
})

// ⚠ SWITCHABLE, and that is the whole point of this harness change. The store
// used to be a frozen literal with `highlightedEdges: new Set()`, so the
// `highlighted` stroke rule COULD NOT FIRE in this file — and a case whose
// docblock claimed to exercise it silently exercised `polarity` instead,
// returning a byte-identical result to the case above it. A per-test override
// is what lets the colour battery below reach four DIFFERENT rules and prove it.
const storeOverrides: Record<string, unknown> = {}
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
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
      ...storeOverrides,
    })
  ),
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
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// ⛔ importOriginal-SPREAD, never a hand-listed replacement: a `vi.mock` factory
// REPLACES the module, so any export added later silently vanishes.
// The strength width the edge draws at, switchable per test so the arrowhead's
// size can be observed against TWO widths (a discriminating pair, not one value).
const strengthWidth = vi.hoisted(() => ({ px: 2 }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  weightMagnitudeToStrokeWidth: () => strengthWidth.px,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const baseProps = {
  id: 'e1', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

/** Renders into a real SVG-namespaced container so `<marker>` attributes keep their SVG spelling. */
function renderEdge(props: Record<string, unknown>) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  document.body.appendChild(svg)
  render(<StyledEdge {...(baseProps as any)} {...(props as any)} />, {
    container: svg as unknown as HTMLElement,
  })
  return svg
}

const markerOf = (root: Element) => root.querySelector('marker')
const strokeOf = () => (baseEdgeProps?.style as Record<string, unknown> | undefined)?.stroke

describe('StyledEdge — the direction of causation carries a mark', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    for (const k of Object.keys(storeOverrides)) delete storeOverrides[k]
    baseEdgeProps = null
    document.body.innerHTML = ''
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    strengthWidth.px = 2
  })

  it('points a marker at the target end of a causal edge', () => {
    renderEdge({ data: { direction: 'positive', direction_source: 'user' } })
    expect(baseEdgeProps?.markerEnd).toBe(`url(#${edgeArrowheadMarkerId('e1')})`)
  })

  it('leaves marker-start empty — the mark states one direction, not two', () => {
    renderEdge({ data: { direction: 'positive', direction_source: 'user' } })
    expect(baseEdgeProps?.markerStart).toBeUndefined()
  })

  it('renders the marker it references, under exactly that id', () => {
    const root = renderEdge({ data: { direction: 'positive', direction_source: 'user' } })
    const marker = markerOf(root)
    expect(marker).not.toBeNull()
    expect(marker!.getAttribute('id')).toBe(edgeArrowheadMarkerId('e1'))
  })

  /**
   * ⭐ THE LOAD-BEARING PROPERTY, AND THE EVIDENCE FOR IT WAS FALSE UNTIL NOW.
   *
   * What stood here: two cases. The first rendered `direction: 'positive'`, the
   * second `direction: 'negative'`, under a docblock claiming the second fired
   * `highlighted` → `var(--semantic-info)` "so agreement is shown across two
   * rules rather than at one point where a constant could coincide."
   *
   * MEASURED, 7 Sep 2026, by reading the stroke back out of both renders:
   *
   *   case 1  stroke = "var(--edge-neutral)"
   *   case 2  stroke = "var(--edge-neutral)"      ← byte-identical
   *
   * `highlighted` could not fire at all: `isHighlightedEdge` is
   * `s.highlightedEdges.has(id)` and the mocked store supplied an EMPTY Set. And
   * `{direction, direction_source}` is not the shape the polarity stroke reads
   * (the shipped glyph reads `effect_direction` — see
   * `StyledEdge.polarityGlyphPlacement.spec.tsx`), so both fell to the same
   * neutral. The second case was a byte-equivalent duplicate of the first, and
   * the exact property its own docblock claimed to establish — that agreement
   * is not a coincidence at one constant — was the one thing it could not show.
   *
   * ⭐ THE REPLACEMENT, and note what each case has to carry. Every row PINS ITS
   * OWN PRECONDITION: it asserts the stroke really is the distinct value its
   * rule produces, so a case cannot silently degrade back into the neutral one
   * and keep passing. That is the failure this table exists to make impossible.
   * Four DIFFERENT rules, four distinct values, including the `color-mix()` that
   * an explicit `fill` attribute is most likely to mishandle.
   *
   * ⭐ GAP 1 FIX, 24 Sep 2026 (design-gap audit row 13, contract §03 "Colour
   * and sign = direction") REMOVED THE `highlighted` ROW THAT STOOD HERE. It
   * pinned the DEFECT this fix removes: `resolveEdgeStroke`'s `highlighted`
   * branch used to return `var(--semantic-info)` outright, so a selected
   * node's path edges lost their +/− polarity colour. Post-fix, `highlighted`
   * returns `state.polarityStroke` — i.e. for ANY given edge data it now
   * paints the SAME value the `polarity` rule would, which is the whole
   * point of the fix and is exactly why it can no longer supply this table's
   * fifth DISTINCT value. That property — a highlighted path keeps its own
   * direction colour, and separately gains a soft Info glow rather than a
   * recolour — is asserted where it belongs: `edgePresentation.spec.ts`
   * ("GAP 1: a highlighted path keeps its direction colour", value-level) and
   * `StyledEdge.pathHighlightColour.spec.tsx` (DOM-level: stroke AND glow,
   * bound by identity, with contrasts for unhighlighted and selection-dimmed
   * edges).
   */
  const COLOUR_CASES: ReadonlyArray<{
    rule: string
    stroke: string
    data: Record<string, unknown>
    store?: Record<string, unknown>
  }> = [
    {
      rule: 'polarity (resting neutral)',
      stroke: 'var(--edge-neutral)',
      data: { direction: 'positive', direction_source: 'user' },
    },
    {
      rule: 'polarity (a stated negative — same rule, different value)',
      stroke: 'var(--edge-negative)',
      data: { strength_mean: 0.6, effect_direction: 'negative', exists_probability: 0.8 },
    },
    // ⭐ REPLACED 23 Sep 2026. This row was `contested_needs_user_input`
    // (full `var(--semantic-warning)`), a rule the locked connector grammar
    // deleted ("orange = AI review SIGN disagreement only"). A stated POSITIVE
    // takes its place so the table still carries distinct strokes.
    {
      rule: 'polarity (a stated positive — same rule, third value)',
      stroke: 'var(--edge-positive)',
      data: { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 },
    },
    // contract v3.1 (E12/T07, 24 Sep 2026): the dispute hue is now the SOLID
    // Warning token (Paul 23 Sep point 9), no longer a 70% color-mix — so the
    // arrowhead is no longer translucent where it crosses another edge. Still
    // a fourth distinct value: no other rule paints `var(--semantic-warning)`.
    {
      rule: 'contested_direction_disputed (the Warning token)',
      stroke: 'var(--semantic-warning)',
      data: {
        direction: 'positive',
        direction_source: 'user',
        validation: {
          status: 'contested',
          user_action: 'pending',
          max_divergence: 0.5,
          contested_reasons: ['sign_flip'],
        },
      },
    },
  ]

  it.each(COLOUR_CASES)(
    'paints the arrow in the exact colour the stroke precedence resolved — $rule',
    ({ stroke, data, store }) => {
      Object.assign(storeOverrides, store ?? {})
      const root = renderEdge({ data })
      // PRECONDITION PIN. Without this the case passes when the rule it names
      // never fires and the neutral wins instead — which is exactly how the two
      // cases this table replaces came to be identical.
      expect(strokeOf(), `the ${stroke} rule did not fire; this case proves nothing`).toBe(stroke)
      const fill = markerOf(root)!.querySelector('polygon')!.getAttribute('fill')
      expect(fill).toBe(strokeOf())
      expect(fill).toBeTruthy()
    },
  )

  /**
   * ⭐ AND THE GUARD AGAINST THE DEFECT ITSELF, not just against its symptom.
   * The table above is only evidence about "agreement across rules" while its
   * rows actually differ. If a future change collapses two of them onto one
   * value — the precise thing that happened here — this REDs, whereas every
   * individual row would keep passing.
   */
  it('exercises four DISTINCT stroke values, so agreement is not one constant coinciding', () => {
    const seen = new Set<string>()
    for (const c of COLOUR_CASES) {
      for (const k of Object.keys(storeOverrides)) delete storeOverrides[k]
      Object.assign(storeOverrides, c.store ?? {})
      document.body.innerHTML = ''
      renderEdge({ data: c.data })
      seen.add(String(strokeOf()))
    }
    expect(seen.size).toBe(COLOUR_CASES.length)
    expect([...seen].sort()).toEqual([...COLOUR_CASES.map((c) => c.stroke)].sort())
  })

  it('orients along the path, so the arrow points the way the edge runs', () => {
    const root = renderEdge({ data: { direction: 'positive', direction_source: 'user' } })
    expect(markerOf(root)!.getAttribute('orient')).toBe('auto')
  })

  /**
   * ⭐ contract v3.1 (side-by-side DIFF item 13, 27 Sep 2026): THE HEAD SCALES
   * WITH THE STROKE. The contract's marker is `markerWidth="4"` in the default
   * `strokeWidth` units — 8px on a 2px line, 16px on a 4px one. The superseded
   * mark was a fixed 12 × 12 `userSpaceOnUse` triangle, so a 1.5px line carried
   * a 12px head. Observed against TWO strength widths — one width alone could be
   * satisfied by a constant that happens to equal it.
   */
  it('is 4 × the strength width, like the contract\'s markerWidth 4 — a discriminating pair', () => {
    const stated = { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 }
    strengthWidth.px = 2
    const thin = markerOf(renderEdge({ data: stated }))!
    expect(Number(thin.getAttribute('markerWidth'))).toBe(8)
    expect(Number(thin.getAttribute('markerHeight'))).toBe(8)
    document.body.innerHTML = ''
    strengthWidth.px = 4
    const thick = markerOf(renderEdge({ data: stated }))!
    expect(Number(thick.getAttribute('markerWidth'))).toBe(16)
    expect(Number(thick.getAttribute('markerHeight'))).toBe(16)
  })

  /**
   * ⚠ THE WIDTH IT READS IS THE RESTING STRENGTH WIDTH, NEVER THE INTERACTION
   * WIDTH. Under SVG's default `markerUnits="strokeWidth"` a SELECTED edge
   * (+2) would get a bigger head, leaking the interaction channel into the
   * direction channel. The contract never widens a selected line (it glows), so
   * the mark stays `userSpaceOnUse`, sized from the strength width alone.
   */
  it('does not grow when the edge is selected — the head reads strength, not interaction', () => {
    const stated = { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 }
    strengthWidth.px = 3
    const marker = markerOf(renderEdge({ data: stated, selected: true }))!
    expect(marker.getAttribute('markerUnits')).toBe('userSpaceOnUse')
    expect(Number(marker.getAttribute('markerWidth'))).toBe(12)
    // CONTRAST: the line itself IS wider while selected.
    expect((baseEdgeProps?.style as Record<string, unknown>).strokeWidth).toBe(5)
  })

  /**
   * ⭐ COUNTER-SCALED LIKE EVERY CANVAS GLYPH. The line is `non-scaling-stroke`
   * (its width is a SCREEN width at every zoom), so a head in plain graph units
   * would shrink against its own line as the camera pulls back — 2:1 at the
   * 0.50 landing floor instead of the contract's 4:1. The polygon carries
   * `--canvas-glyph-scale` (`zoomLegibility.ts`: "the edge arrowhead keep[s]
   * rendered === declared down to the landing floor"), scaled about the tip.
   *
   * ⚠ jsdom proves the style is carried, not that it paints. The mechanism — a
   * CSS `scale(var(...))` on a `<marker>`'s polygon, with `overflow="visible"`,
   * the var inherited from an HTML ancestor — was witnessed in Chromium on a
   * static page (27 Sep 2026): var 2 painted the head twice the size of var
   * fallback 1, tip fixed at the path end.
   */
  it('is counter-scaled about its tip by the glyph scale, and is not clipped by its own box', () => {
    const marker = markerOf(renderEdge({ data: { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 } }))!
    const polygon = marker.querySelector('polygon') as SVGPolygonElement
    expect(polygon.style.transform).toBe('scale(var(--canvas-glyph-scale, 1))')
    expect(polygon.style.transformOrigin).toBe('0 0')
    expect(marker.getAttribute('overflow')).toBe('visible')
  })

  /**
   * THE TIP IS THE ORIGIN, so the counter-scale grows the head BACK along the
   * line and the point never leaves the path's end. The viewBox and the marker
   * box are the same size, so nothing is letterboxed.
   */
  it('keeps its tip on the path end and its viewBox at 1:1 with the marker box', () => {
    strengthWidth.px = 3
    const marker = markerOf(renderEdge({ data: { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 } }))!
    expect(marker.getAttribute('viewBox')).toBe(edgeArrowheadViewBox(12))
    expect(marker.getAttribute('viewBox')).toBe('-12 -6 12 12')
    expect(marker.querySelector('polygon')!.getAttribute('points')).toBe(edgeArrowheadPolygonPoints(12))
    expect(marker.querySelector('polygon')!.getAttribute('points')).toBe('-12 -6, 0 0, -12 6')
    expect(Number(marker.getAttribute('refX'))).toBe(0)
    expect(Number(marker.getAttribute('refY'))).toBe(0)
  })

  /**
   * ⭐ THE CONSTRAINT THE BRIEF PUT HARDEST. The green/rose polarity pair
   * measures ΔE2000 11.7 under deuteranopia (vs 28.3 for the green/red it
   * replaced), so the `+`/`−` SHAPE — not hue — is what carries polarity for a
   * red-green dichromat. The arrowhead states DIRECTION OF CAUSATION, a
   * different fact. It must sit alongside the glyph, never instead of it.
   *
   * Uses the `effect_direction` shape the shipped glyph actually reads (see
   * `StyledEdge.polarityGlyphPlacement.spec.tsx`), so the glyph really renders
   * here and the co-existence is observed rather than assumed.
   */
  it('does not displace or duplicate the +/− polarity glyph', () => {
    const root = renderEdge({
      data: { strength_mean: 0.6, effect_direction: 'positive', exists_probability: 0.8 },
    })
    const glyph = root.querySelector('[data-edge-id="e1"][aria-label^="Effect direction:"]')
    expect(glyph, 'no polarity glyph — this case cannot observe co-existence without one').not.toBeNull()
    expect(glyph!.textContent).toBe('+')
    expect(markerOf(root), 'the arrowhead must be present alongside the glyph').not.toBeNull()
    // Exactly one polarity mark: the arrow must not become a second sign channel.
    expect(root.querySelectorAll('[aria-label^="Effect direction:"]').length).toBe(1)
  })
})

/**
 * ── THE DISCRIMINATING TWINS ──────────────────────────────────────────────
 * These pass at pristine too — vacuously, because nothing renders a marker
 * there. That is stated rather than hidden: their job is not to go red before
 * the fix, it is to go red if the fix OVER-APPLIES. A change that marks every
 * edge would satisfy every assertion above and fail every one below.
 */
describe('StyledEdge — edges that make no claim about direction get no mark', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    for (const k of Object.keys(storeOverrides)) delete storeOverrides[k]
    baseEdgeProps = null
    document.body.innerHTML = ''
  })

  it('a structural decision→option link is membership, not causation', () => {
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'
    const root = renderEdge({ data: {} })
    expect(baseEdgeProps?.markerEnd).toBeUndefined()
    expect(markerOf(root)).toBeNull()
    // Precondition pin: this really is the structural branch, not an edge that
    // happened to render nothing. Without it the case passes on any failure.
    expect((baseEdgeProps?.style as Record<string, unknown>)?.stroke).toBe(STRUCTURAL_EDGE_COLOUR)
  })

  it('an option→factor structural link likewise', () => {
    nodeKinds.src = 'option'
    nodeKinds.tgt = 'factor'
    const root = renderEdge({ data: {} })
    expect(baseEdgeProps?.markerEnd).toBeUndefined()
    expect(markerOf(root)).toBeNull()
    expect((baseEdgeProps?.style as Record<string, unknown>)?.stroke).toBe(STRUCTURAL_EDGE_COLOUR)
  })

  it('a bidirected edge denies a single direction, so it gets no arrowhead', () => {
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    const root = renderEdge({
      data: { edge_type: 'bidirected', direction: 'positive', direction_source: 'user' },
    })
    expect(baseEdgeProps?.markerEnd).toBeUndefined()
    expect(markerOf(root)).toBeNull()
    // Precondition pin: `bidirected` must still be a CAUSALLY-STYLED edge here —
    // if it had fallen into the structural branch this case would prove nothing
    // about the type rule (`StyledEdge.structural.spec.tsx:250` pins that it
    // keeps causal styling, and this asserts we did not quietly change it).
    expect((baseEdgeProps?.style as Record<string, unknown>)?.stroke)
      .not.toBe(STRUCTURAL_EDGE_COLOUR)
  })

  /**
   * ⭐ THE CONTRAST THAT PROVES THE THREE CASES ABOVE ARE NOT JUST "NOTHING EVER
   * RENDERS A MARKER". Same suite, same harness, an edge that MUST be marked.
   * Without this, a fix that was reverted entirely would leave this file green.
   */
  it('CONTROL — a plain causal edge in this same harness IS marked', () => {
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    const root = renderEdge({ data: { direction: 'positive', direction_source: 'user' } })
    expect(baseEdgeProps?.markerEnd).toBe(`url(#${edgeArrowheadMarkerId('e1')})`)
    expect(markerOf(root)).not.toBeNull()
  })
})
