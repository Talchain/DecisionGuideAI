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
  EDGE_ARROWHEAD_FLOW_SIZE,
  renderedArrowheadPx,
  edgeArrowheadMarkerId,
} from '../edgePresentation'
import { LABEL_LEGIBLE_ZOOM, MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'

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
 * an arrowhead is a filled polygon. So a naive 6-unit marker renders at 3px at
 * the 0.50 auto-fit floor the canvas parks a fresh model at, and the mark that
 * was supposed to fix the legibility gap is itself illegible.
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
 * hand-tuned. The pixel half is NOT established by this suite.
 */
describe('arrowhead size — sized for the bound, not tracked at runtime', () => {
  it('derives its flow-space size from the single zoom authority, not a second constant', () => {
    expect(EDGE_ARROWHEAD_FLOW_SIZE).toBe(EDGE_ARROWHEAD_BASE_PX * MAX_LABEL_COUNTER_SCALE)
  })

  it('renders at its full declared size at the zoom the product parks a fresh model at', () => {
    expect(renderedArrowheadPx(LABEL_LEGIBLE_ZOOM)).toBeCloseTo(EDGE_ARROWHEAD_BASE_PX, 10)
  })

  /**
   * The point of the whole exercise: at the parked zoom the mark must be big
   * enough to read against a 2px line. A bare 6-unit marker — the size the dead
   * `<defs>` used — would have rendered at 3px there.
   */
  it('is materially larger at that zoom than the dead defs marker would have been', () => {
    const deadDefsMarkerSize = 6
    expect(renderedArrowheadPx(LABEL_LEGIBLE_ZOOM)).toBeGreaterThan(
      deadDefsMarkerSize * LABEL_LEGIBLE_ZOOM,
    )
    expect(renderedArrowheadPx(LABEL_LEGIBLE_ZOOM)).toBeGreaterThanOrEqual(8)
  })

  /**
   * STATED, NOT HIDDEN: past 1:1 the mark grows with the canvas, exactly as node
   * geometry does and unlike the stroke width. That is the cost of sizing for
   * the bound, and `zoomLegibility.ts` already rules that magnification past 1:1
   * "is then the user's own deliberate choice".
   */
  it('grows with deliberate magnification past 1:1, like node geometry', () => {
    expect(renderedArrowheadPx(1)).toBeGreaterThan(renderedArrowheadPx(LABEL_LEGIBLE_ZOOM))
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
   * Injectivity is the property that matters: two edges resolving to ONE marker
   * id would silently paint one edge's arrowhead in the other's colour. A
   * sanitiser that maps every unsafe character to `_` is fragment-safe and NOT
   * injective, which is why this case exists.
   */
  it('is injective — distinct edge ids never share a marker', () => {
    const raws = ['a b', 'a_b', 'a(b', 'a)b', 'a%20b', 'a b ', 'A B']
    const ids = raws.map(edgeArrowheadMarkerId)
    expect(new Set(ids).size).toBe(raws.length)
  })
})
