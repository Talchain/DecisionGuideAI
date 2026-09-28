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
  EDGE_ARROWHEAD_STROKE_MULTIPLE,
  edgeArrowheadSize,
  edgeArrowheadViewBox,
  edgeArrowheadPolygonPoints,
  renderedArrowheadPx,
  edgeArrowheadMarkerId,
} from '../edgePresentation'
import { LABEL_LEGIBLE_ZOOM, glyphCounterScale, labelCounterScale } from '../../utils/zoomLegibility'
import {
  EDGE_STROKE_WIDTH_BANDS,
  MEASURED_EDGE_STROKE_WIDTH_FLOOR,
  UNSET_EDGE_STROKE_WIDTH,
} from '../../utils/graphDisplayCalculations'
import {
  GLYPH_ROW_RISE_MAX_FLOW,
  glyphMetricsAt,
  resolvePolarityGlyphOnPath,
} from '../../utils/edgeGlyphPlacement'
import { flattenSvgPath } from '../fragileCuePlacement'

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
 * ── THE SIZE, MADE AS ARITHMETIC ──────────────────────────────────────────
 *
 * ⭐ contract v3.1 (side-by-side DIFF item 13, 27 Sep 2026): the contract's
 * marker is `markerWidth="4"` in the default `strokeWidth` units — the head is
 * FOUR TIMES THE LINE, 8px on a 2px line and 16px on a 4px one. It replaces a
 * fixed 12 × 12 user-space triangle that was the same on every line (so a
 * 1.5px line carried a 12px head).
 *
 * ⭐ AND IT IS COUNTER-SCALED, BECAUSE THE LINE IS. The stroke is
 * `non-scaling-stroke`, so its width is a SCREEN width at every zoom. A head in
 * plain graph units would shrink against its own line as the camera pulls back
 * (2:1 at the 0.50 landing floor). The head reads `--canvas-glyph-scale`, the
 * scale `zoomLegibility.ts` gives glyphs and "the edge arrowhead", so it keeps
 * `rendered === declared` — and the contract's 4:1 — from the landing floor to
 * 1:1. This replaces "size for the bound", which could only be right at ONE
 * zoom (6px at 0.50, 12px at 1:1 on every line).
 *
 * ⚠ HONEST LIMIT: arithmetic over the declared numbers. jsdom has no paint. The
 * CSS mechanism the counter-scale rides on was witnessed once, in Chromium, on a
 * static page (see `StyledEdge.directionMark.spec.tsx`); the product's own head
 * has not been measured on a served build by this change.
 */
describe('arrowhead size — the contract\'s markerWidth 4, counter-scaled like a glyph', () => {
  it('is 4 × the stroke width: 8 / 12 / 16 on the contract\'s 2 / 3 / 4', () => {
    expect(EDGE_ARROWHEAD_STROKE_MULTIPLE).toBe(4)
    expect([2, 3, 4].map(edgeArrowheadSize)).toEqual([8, 12, 16])
  })

  it('renders at its declared size from the landing floor to 1:1 — the contract\'s 4:1 against a non-scaling line', () => {
    for (const zoom of [LABEL_LEGIBLE_ZOOM, 0.65, 0.8, 1]) {
      for (const width of [2, 3, 4]) {
        const px = renderedArrowheadPx(width, zoom)
        expect(px, `width ${width} at zoom ${zoom}`).toBeCloseTo(4 * width, 10)
        // The line is a screen width, so the ratio is the head over the width itself.
        expect(px / width).toBeCloseTo(4, 10)
      }
    }
  })

  it('grows past 1:1 and shrinks below the landing floor, like every counter-scaled glyph', () => {
    expect(renderedArrowheadPx(3, 2)).toBe(24)
    expect(renderedArrowheadPx(3, LABEL_LEGIBLE_ZOOM / 2)).toBe(6)
  })

  /**
   * ⭐ code-review F2 (27 Sep 2026). #2208 applied the contract's 4× rule to the
   * product-only 1px UNSET floor, which the contract's key does not have (it
   * draws a link with no width at 2px, `e.width||2`). Every link nobody has
   * given a strength — every link a user draws — got a 4px head at every zoom,
   * a third of the old 12px at 1:1 and below anything the contract draws. The
   * head now reads the width floored at the thinnest MEASURED band, so an unset
   * link carries the contract's smallest head; the 1px line still says "not set"
   * on the width channel.
   */
  it('a link with no strength set carries the contract\'s smallest head, never a 4px one (F2)', () => {
    expect(UNSET_EDGE_STROKE_WIDTH).toBeLessThan(MEASURED_EDGE_STROKE_WIDTH_FLOOR)
    expect(edgeArrowheadSize(UNSET_EDGE_STROKE_WIDTH)).toBe(edgeArrowheadSize(MEASURED_EDGE_STROKE_WIDTH_FLOOR))
    expect(edgeArrowheadSize(UNSET_EDGE_STROKE_WIDTH)).toBe(8)
    for (const zoom of [LABEL_LEGIBLE_ZOOM, 0.5085, 0.75, 1]) {
      expect(renderedArrowheadPx(UNSET_EDGE_STROKE_WIDTH, zoom), `zoom ${zoom}`).toBeCloseTo(8, 10)
    }
    // CONTRAST: the measured bands keep their own 4× heads, unfloored.
    expect(Object.values(EDGE_STROKE_WIDTH_BANDS).map(edgeArrowheadSize)).toEqual(
      Object.values(EDGE_STROKE_WIDTH_BANDS).map((w) => 4 * w),
    )
  })

  it('declares a square viewBox with the tip at the origin, so nothing is letterboxed and the scale pivots on the tip', () => {
    expect(edgeArrowheadViewBox(12)).toBe('-12 -6 12 12')
    expect(edgeArrowheadPolygonPoints(12)).toBe('-12 -6, 0 0, -12 6')
  })
})

/**
 * ── CLEARANCE BETWEEN A SIGN AND ITS OWN HEAD ─────────────────────────────
 *
 * ⚠ RE-WRITTEN 28 Sep 2026 (canvas/paul-test-edges). The signs no longer stand
 * in one row beside a shared arrival (the rule this block pinned); each sits ON
 * its own line, one head length + the mark gap + half its box back from its own
 * tip (`edgeGlyphPlacement.ts` rule B), under the rise bound. So the clearance
 * is ALONG the line: the sign's box ends the mark gap short of the head's base
 * wherever the rise bound leaves room. Both terms follow the live counter-scales
 * (the head the glyph scale, the box the text scale), so it is checked at every
 * zoom from the landing to 1:1. Arithmetic only — not measured on paint.
 */
describe('arrowhead clearance — the sign sits on its own line, clear of its own head', () => {
  /** A link dropping straight into a card whose top is y 1000, tip on the border or on the apex. */
  const clearance = (width: number, zoom: number, tipAbove = 0) => {
    const g = glyphCounterScale(zoom)
    const l = labelCounterScale(zoom)
    const m = glyphMetricsAt(width, g, l)
    const tipY = 1000 - tipAbove
    const placed = resolvePolarityGlyphOnPath(flattenSvgPath(`M500,500 L500,${tipY}`)!, 1000, m)
    return { gap: tipY - placed.y - m.halfBox - m.headLength, m }
  }

  it('a BORDER arrival: the sign clears its head by the mark gap for every band short of the widest, at every zoom from the landing to 1:1', () => {
    for (const zoom of [LABEL_LEGIBLE_ZOOM, 0.6, 0.75, 0.9, 1]) {
      for (const width of [UNSET_EDGE_STROKE_WIDTH, EDGE_STROKE_WIDTH_BANDS.slight, EDGE_STROKE_WIDTH_BANDS.moderate, EDGE_STROKE_WIDTH_BANDS.strong]) {
        const { gap, m } = clearance(width, zoom)
        expect(gap, `zoom ${zoom} width ${width}`).toBeGreaterThanOrEqual(m.gap - 1e-6)
      }
    }
  })

  it('STATED LIMIT, pinned: the widest head at the landing leaves the sign touching its base, not overlapping it (0 of the 4-unit gap)', () => {
    const { gap } = clearance(EDGE_STROKE_WIDTH_BANDS.veryStrong, LABEL_LEGIBLE_ZOOM)
    expect(gap).toBeCloseTo(0, 1)
  })

  it('STATED LIMIT, pinned: an APEX arrival at the landing has 22.64 above its tip, so the sign reaches into every head (3.36 into the 16-unit slight head)', () => {
    // The rise bound above a kind apex at the label bound.
    expect(GLYPH_ROW_RISE_MAX_FLOW).toBeCloseTo(22.64, 10)
    const { gap } = clearance(EDGE_STROKE_WIDTH_BANDS.slight, LABEL_LEGIBLE_ZOOM, 50 - GLYPH_ROW_RISE_MAX_FLOW)
    expect(gap).toBeCloseTo(-3.36, 1)
    expect(gap).toBeLessThan(0)
    // From zoom ≈ 0.65 up the apex sign clears its slight head again.
    expect(clearance(EDGE_STROKE_WIDTH_BANDS.slight, 0.7, 24 * labelCounterScale(0.7) - 12).gap).toBeGreaterThan(0)
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
