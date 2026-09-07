/**
 * THE DIRECTION OF CAUSATION HAD NO MARK — measured on deployed staging, 7 Sep
 * 2026: 39 edges on the board, `marker-end` and `marker-start` empty on all 39.
 *
 * Two arrowhead markers WERE painted into the canvas `<defs>`
 * (`ReactFlowGraph.tsx:2638-2645`) and referenced by nothing — a repo-wide sweep
 * returned exactly 2 hits for `arrowhead-(default|selected)`, both of them the
 * definitions, against a contrast control (`edge-influence-label`) of 18 in the
 * same sweep. So the probe discriminates and the absence is real.
 *
 * ── WHY THOSE TWO MARKERS ARE NOT REUSED ──────────────────────────────────
 * Derived at the token bytes rather than assumed:
 *
 *   `arrowhead-default`  fill `var(--surface-border)`
 *                        → `--border-default` (brand.css:113, :105)
 *                        → `--border-default-rgb: 238 230 216` = #EEE6D8.
 *     StyledEdge's own leader-line note already measured this exact token on
 *     this exact surface: *"a pale cream, chosen for panel EDGES against a panel
 *     FILL. On the canvas ground it is very nearly the background."* An
 *     arrowhead painted in it is the invisible-leader defect of 31 Aug, again.
 *
 *   `arrowhead-selected` fill `var(--info)` = `rgb(39 122 157)` — a fixed blue,
 *     keyed on SELECTION. Selection is not a colour rule at all in
 *     `EDGE_STROKE_RULES`; it changes stroke WIDTH. A marker keyed on it would
 *     disagree with its own line on every selected edge.
 *
 * Neither fill is any of the seven values `resolveEdgeStroke` can return, so
 * reusing them ships an arrow in a different colour from the line it terminates.
 * They are deleted with this change rather than left as a decoy.
 *
 * ── WHAT THIS SPEC PINS ───────────────────────────────────────────────────
 * The decision, by RULE NAME rather than by the boolean, exactly as the stroke
 * and dash resolvers beside it are pinned (CLAUDE.md trap 19: bind to identity,
 * never to a value another rule could also produce — `false` is returned by two
 * different rules here and they mean different things).
 */
import { describe, it, expect } from 'vitest'
import {
  EDGE_DIRECTION_MARKER_RULES,
  resolveEdgeDirectionMarker,
  isNonDirectionalEdgeType,
  NON_DIRECTIONAL_EDGE_TYPES,
  EDGE_ARROWHEAD_BASE_PX,
  EDGE_ARROWHEAD_FLOW_WIDTH,
  EDGE_ARROWHEAD_FLOW_LENGTH,
  EDGE_ARROWHEAD_VIEWBOX,
  EDGE_ARROWHEAD_POLYGON_POINTS,
  renderedArrowheadWidthPx,
  renderedArrowheadLengthPx,
  edgeArrowheadMarkerId,
} from '../edgePresentation'
import { LABEL_LEGIBLE_ZOOM, MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import {
  GLYPH_ANCHOR_RADIUS,
  GLYPH_PAINTED_BOX_FLOW,
  GLYPH_BOX_GAP_FLOW,
} from '../../utils/edgeGlyphPlacement'

describe('EDGE_DIRECTION_MARKER_RULES — the order is the contract', () => {
  it('states the precedence, highest first', () => {
    expect([...EDGE_DIRECTION_MARKER_RULES]).toEqual([
      'structural',
      'non_directional_type',
      'causal',
    ])
  })
})

describe('resolveEdgeDirectionMarker', () => {
  it('marks an ordinary causal edge', () => {
    const d = resolveEdgeDirectionMarker({ isStructural: false, edgeType: undefined })
    expect(d.rule).toBe('causal')
    expect(d.show).toBe(true)
  })

  /**
   * A structural link (decision→option, option→factor) asserts MEMBERSHIP —
   * "this option belongs to this decision" — not causation. `edgePresentation`'s
   * own header says structural scaffolding "never carries a data claim". An
   * arrowhead is a data claim, so it is withheld: one mark, one meaning.
   */
  it('withholds the mark on a structural edge, and says which rule withheld it', () => {
    const d = resolveEdgeDirectionMarker({ isStructural: true, edgeType: 'structural' })
    expect(d.rule).toBe('structural')
    expect(d.show).toBe(false)
  })

  /**
   * ⚠ `bidirected` REACHES THE UI — it is not hypothetical. `edge_type` is a
   * bare `z.string().optional()` (domain/edges.ts:220), the turn-request shape
   * spec pins that `bidirected` survives the wire, and
   * `StyledEdge.structural.spec.tsx:250` pins that it keeps full causal styling.
   *
   * In causal-graph notation `A <-> B` says the two share an unobserved common
   * cause; it is a REFUSAL to claim that A causes B. A single arrowhead at the
   * target would state the one thing the type denies — the "confident
   * wrongness" this estate ranks below visible silence.
   */
  it.each([...NON_DIRECTIONAL_EDGE_TYPES])(
    'withholds the mark on edge_type=%s, which denies a single direction',
    (edgeType) => {
      const d = resolveEdgeDirectionMarker({ isStructural: false, edgeType })
      expect(d.rule).toBe('non_directional_type')
      expect(d.show).toBe(false)
    },
  )

  it('is case- and whitespace-insensitive about that type, since it crosses a wire unvalidated', () => {
    expect(resolveEdgeDirectionMarker({ isStructural: false, edgeType: '  BiDirected ' }).rule)
      .toBe('non_directional_type')
  })

  /**
   * The contrast that proves the rule above is not simply "any edge_type
   * suppresses". Without it, a resolver that returned `non_directional_type`
   * for every non-empty string would pass the case above.
   */
  it.each(['causal', 'directed', 'some_future_kind'])(
    'still marks edge_type=%s — an unrecognised type is not a denial of direction',
    (edgeType) => {
      const d = resolveEdgeDirectionMarker({ isStructural: false, edgeType })
      expect(d.rule).toBe('causal')
      expect(d.show).toBe(true)
    },
  )

  it('lets structural win over the type check, so the reason reported is the stronger one', () => {
    const d = resolveEdgeDirectionMarker({ isStructural: true, edgeType: 'bidirected' })
    expect(d.rule).toBe('structural')
  })

  it('isNonDirectionalEdgeType rejects the non-string shapes the wire can supply', () => {
    for (const v of [undefined, null, 42, {}, [], '']) {
      expect(isNonDirectionalEdgeType(v)).toBe(false)
    }
  })
})

/**
 * ── THE ZOOM CLAIM, MADE AS ARITHMETIC ────────────────────────────────────
 *
 * A marker's geometry is USER-SPACE and is multiplied by the viewport transform
 * before it reaches a pixel. `vector-effect: non-scaling-stroke` — the mechanism
 * the edge STROKE uses — does not reach it: that governs stroke rendering, and
 * an arrowhead is a filled polygon.
 *
 * ⚠⚠ THE NUMBER THIS BLOCK USED TO CARRY WAS WRONG, AND THE ASSERTION BELOW WAS
 * LOOSE ENOUGH TO ACCOMMODATE IT. It said a naive 6-unit marker "renders at 3px
 * at the 0.50 auto-fit floor". The deleted `<defs>` markers carried NO
 * `markerUnits` attribute, so the SVG default `strokeWidth` applied and the
 * marker viewport was `6 × stroke-width 2` = 12 user units → **6px**, not 3px.
 * The old assertion was `toBeGreaterThan(6 * 0.50)` = `> 3`, which is satisfied
 * by 8 whether the dead marker was 3px or 6px — a wrong figure surviving because
 * nothing pinned it. Corrected and pinned to exact px, 7 Sep 2026.
 *
 * THE ANSWER IS THE ONE THIS CODEBASE ALREADY CHOSE FOR NODE GEOMETRY, and it is
 * chosen here for the same stated reason (`zoomLegibility.ts`, on
 * `MAX_LABEL_COUNTER_SCALE`): *"the settle zoom IS the worst case, and the worst
 * case is a CONSTANT rather than a number that has to be tracked at runtime"*.
 * Size for the bound. The marker is a compile-time constant, so no edge
 * subscribes to zoom — which matters, because `CanvasLabelScaleSync` exists
 * precisely to avoid "re-render every node and every edge on every wheel event".
 *
 * ⚠ HONEST LIMIT, and it is the same one `StyledEdge.zoomLegibleThickness.spec`
 * declares: jsdom has no layout and no viewport transform, so nothing here
 * observes a rendered pixel. What is checkable is the arithmetic that decides
 * the size, and that it is derived from the single zoom source rather than
 * hand-tuned. The pixel half is NOT established by this suite, and no other
 * instrument in this estate establishes it either.
 */
describe('arrowhead size — sized for the bound, not tracked at runtime', () => {
  it('derives its ACROSS-path size from the single zoom authority, not a second constant', () => {
    expect(EDGE_ARROWHEAD_FLOW_WIDTH).toBe(EDGE_ARROWHEAD_BASE_PX * MAX_LABEL_COUNTER_SCALE)
  })

  it('renders its full declared width at the zoom the product parks a fresh model at', () => {
    expect(renderedArrowheadWidthPx(LABEL_LEGIBLE_ZOOM)).toBeCloseTo(EDGE_ARROWHEAD_BASE_PX, 10)
  })

  /**
   * ⭐ THE COMPARISON THE PR'S CASE RESTS ON, PINNED TO EXACT PIXELS RATHER THAN
   * MERELY EXCEEDED.
   *
   * The deleted `<defs>` markers were `markerWidth="6" markerHeight="6"` with NO
   * `markerUnits`, so the SVG default `strokeWidth` applied against the 2px
   * causal stroke: a 12 × 12 user-unit viewport, i.e. 6px × 6px at the 0.50
   * park. Not 3px. The dead figures are spelled out here rather than baked into
   * one number so the derivation is auditable, and every quantity is asserted to
   * an exact value so a future drift REDs instead of squeaking past a `>`.
   *
   * ⚠ AND THE HONEST READING OF THE RESULT: 6px × 8px against 6px × 6px is the
   * SAME LENGTH and a third more width. This is not the justification for the
   * mark — the deleted markers were referenced by nothing, so the real baseline
   * is no arrow at all. It is simply the true comparison.
   */
  it('is exactly 6px long and 8px wide at the park — against the dead markers exact 6px × 6px', () => {
    const DEAD_DEFS_MARKER_UNITS = 6
    const CAUSAL_STROKE_WIDTH = 2 // markerUnits defaulted to `strokeWidth`
    const deadDefsFlowSize = DEAD_DEFS_MARKER_UNITS * CAUSAL_STROKE_WIDTH
    expect(deadDefsFlowSize).toBe(12)
    expect(deadDefsFlowSize * LABEL_LEGIBLE_ZOOM).toBe(6)

    expect(renderedArrowheadWidthPx(LABEL_LEGIBLE_ZOOM)).toBe(8)
    expect(renderedArrowheadLengthPx(LABEL_LEGIBLE_ZOOM)).toBe(6)
  })

  /**
   * STATED, NOT HIDDEN: past 1:1 the mark grows with the canvas, exactly as node
   * geometry does and unlike the stroke width, which is `non-scaling-stroke` and
   * therefore 2px at every zoom. That is the cost of sizing for the bound, and
   * `zoomLegibility.ts` already rules that magnification past 1:1 "is then the
   * user's own deliberate choice".
   */
  it('grows with deliberate magnification past 1:1, like node geometry', () => {
    expect(renderedArrowheadWidthPx(1)).toBeGreaterThan(renderedArrowheadWidthPx(LABEL_LEGIBLE_ZOOM))
    expect(renderedArrowheadLengthPx(1)).toBeGreaterThan(renderedArrowheadLengthPx(LABEL_LEGIBLE_ZOOM))
  })
})

/**
 * ⛔⛔ THE CLEARANCE THE FIRST VERSION OF THIS MARK DID NOT HAVE.
 *
 * The arrowhead and the `+`/`−` polarity glyph both live at the TARGET end, on
 * very nearly the same axis: the arrowhead occupies `0 → length` graph units
 * back from the target anchor along the path's end tangent, and the glyph's
 * centre sits at `GLYPH_ANCHOR_RADIUS` back from the same anchor along the
 * target→source centre direction. On a straight edge running to its source they
 * coincide.
 *
 * At the shipped length of 16 units those two footprints met at exactly 16 units
 * — clearance 0.0px at the park. And that is a trust defect rather than clutter:
 * `directionStroke.ts:23-32` measures the polarity pair at ΔE2000 11.7 under
 * deuteranopia, so the GLYPH, not the hue, is what carries direction-of-effect
 * for a red-green dichromat. Crowding it trades one channel for another at the
 * expense of the readers with the least redundancy to spare.
 *
 * These cases compute both footprints from the primitive constants and pin the
 * gap in BOTH units. They are the reason `EDGE_ARROWHEAD_FLOW_LENGTH` is derived
 * from the glyph rather than chosen, and restoring the square 16-unit mark REDs
 * every one of them.
 *
 * ⚠ ARITHMETIC, NOT AN OBSERVATION. Every quantity here is a constant this
 * codebase declares; none is a measured pixel. `GLYPH_PAINTED_BOX_FLOW` is the
 * codebase's own committed figure for the glyph's box and is used as found.
 */
describe('arrowhead clearance — the polarity glyph is the nearest neighbour, not the node card', () => {
  const glyphNearEdgeFlow = GLYPH_ANCHOR_RADIUS - GLYPH_PAINTED_BOX_FLOW / 2
  const arrowTailFlow = EDGE_ARROWHEAD_FLOW_LENGTH

  it('positions the two footprints where the constants say, in graph units', () => {
    expect(glyphNearEdgeFlow).toBe(16)
    expect(arrowTailFlow).toBe(12)
  })

  it('leaves a POSITIVE clearance, pinned at 4 graph units / 2.0px at the 0.50 park', () => {
    const clearanceFlow = glyphNearEdgeFlow - arrowTailFlow
    expect(clearanceFlow).toBe(4)
    expect(clearanceFlow).toBe(GLYPH_BOX_GAP_FLOW)
    expect(clearanceFlow * LABEL_LEGIBLE_ZOOM).toBe(2)
  })

  /**
   * The regression this exists for, named: the mark as first written was square,
   * so its length was the WIDTH constant and its tail landed exactly on the
   * glyph's near edge. Length and width must stay separate quantities.
   */
  it('keeps length and width as separate quantities — a square mark reopens the collision', () => {
    expect(EDGE_ARROWHEAD_FLOW_LENGTH).not.toBe(EDGE_ARROWHEAD_FLOW_WIDTH)
    expect(EDGE_ARROWHEAD_FLOW_WIDTH).toBeGreaterThan(glyphNearEdgeFlow - GLYPH_BOX_GAP_FLOW)
    expect(EDGE_ARROWHEAD_FLOW_LENGTH).toBeLessThanOrEqual(glyphNearEdgeFlow - GLYPH_BOX_GAP_FLOW)
  })

  /**
   * ⚠ THE `preserveAspectRatio` TRAP. It defaults to `xMidYMid meet`, so a
   * viewBox whose aspect ratio differs from `markerWidth`/`markerHeight` is
   * LETTERBOXED rather than stretched — the mark would render smaller than every
   * number above says, silently and in a browser only. Deriving the viewBox from
   * the same two constants makes the mismatch unrepresentable; this pins that.
   */
  it('declares a viewBox at 1:1 with the marker box, so nothing is letterboxed', () => {
    expect(EDGE_ARROWHEAD_VIEWBOX)
      .toBe(`0 0 ${EDGE_ARROWHEAD_FLOW_LENGTH} ${EDGE_ARROWHEAD_FLOW_WIDTH}`)
    expect(EDGE_ARROWHEAD_POLYGON_POINTS)
      .toBe(`0 0, ${EDGE_ARROWHEAD_FLOW_LENGTH} ${EDGE_ARROWHEAD_FLOW_WIDTH / 2}, 0 ${EDGE_ARROWHEAD_FLOW_WIDTH}`)
  })
})

describe('edgeArrowheadMarkerId', () => {
  it('produces a fragment-safe id — no character that would break url(#…)', () => {
    for (const raw of ['e1', 'a b', "quote'", 'paren(s)', 'hash#frag', 'pct%20', 'star*', 'bang!']) {
      const id = edgeArrowheadMarkerId(raw)
      expect(id).toMatch(/^edge-direction-[A-Za-z0-9\-._~%]*$/)
    }
  })

  /**
   * ⚠⚠ SAY WHICH COLLISION CLASS THIS GUARDS. This docblock previously justified
   * injectivity by "two edges resolving to ONE marker id would silently paint
   * one edge's arrowhead in the other's colour" — but React Flow already
   * guarantees distinct edge ids WITHIN one instance, so that cannot arise from
   * the graph. Corrected 7 Sep 2026.
   *
   * The class this genuinely guards is SANITISATION: a sanitiser mapping every
   * unsafe character to `_` is fragment-safe and NOT injective, so `a b` and
   * `a_b` — both perfectly legal edge ids — would collapse onto one marker.
   * That is what the cases below are, and it is a real risk because the obvious
   * implementation is exactly that sanitiser.
   */
  it('is injective under SANITISATION — ids that a lossy escape would collapse stay distinct', () => {
    const raws = ['a b', 'a_b', 'a(b', 'a)b', 'a%20b', 'a b ', 'A B']
    const ids = raws.map(edgeArrowheadMarkerId)
    expect(new Set(ids).size).toBe(raws.length)
  })

  /**
   * ⛔ THE KNOWN, MEASURED GAP — PINNED SO IT CANNOT DRIFT SILENTLY.
   *
   * `ComparisonCanvasLayout` mounts one `<MiniCanvas>` per scenario and
   * `generateScenarios` filters a shared edge list WITHOUT re-keying, so an edge
   * common to two scenarios is mounted twice and emits the same marker id twice.
   * Measured on a 5-node/5-edge graph: `e_f1_g1` (factor→goal, direction
   * positive — exactly the marked class) appears in both scenarios, and
   * `url(#…)` then resolves to whichever marker is first in document order.
   *
   * It is DOCUMENTED rather than fixed, and the reasoning is at
   * `edgeArrowheadMarkerId`'s docblock. What makes that honest rather than
   * accidental is this case: the id is a PURE FUNCTION OF THE EDGE ID and
   * carries no canvas-instance component. Namespacing it later (a `useId()`
   * suffix, say) is then a deliberate act with a red test in front of it — and
   * whoever does it must also confront that every assertion in
   * `StyledEdge.directionMark.spec.tsx` computes the expected id from the edge
   * id, which is what binds those assertions to their object by IDENTITY.
   *
   * ⚠ Scope: no visual divergence was demonstrated. Both instances read the same
   * global store, so both resolve the same stroke rule and the same colour
   * today. This is invalid DOM and a latent divergence, not a witnessed break.
   */
  it('KNOWN GAP — the id carries no canvas-instance component, so two mounted canvases share it', () => {
    const sharedEdgeId = 'e_f1_g1'
    expect(edgeArrowheadMarkerId(sharedEdgeId)).toBe(edgeArrowheadMarkerId(sharedEdgeId))
    expect(edgeArrowheadMarkerId(sharedEdgeId)).toBe('edge-direction-e_f1_g1')
    // Purity, stated as the property it is: same input, same output, no hidden
    // per-mount salt. A `useId()`-namespaced implementation fails this line.
    const twoMounts = new Set([1, 2].map(() => edgeArrowheadMarkerId(sharedEdgeId)))
    expect(twoMounts.size).toBe(1)
  })
})
