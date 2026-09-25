/**
 * ⛔⛔ UNRUN IN THIS SESSION — CI IS THE AUTHORITY.
 * Written under a hard no-execution constraint: no vitest, no typecheck, no
 * install was run against this tree. Nothing here has been observed to pass OR
 * to fail, and the arithmetic below was derived by reading the constants at
 * `dfa351cb`, not by measuring a browser. Treat the "Staging Tests" run on this
 * branch as the only evidence about these assertions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ TWO MARKS, ONE GAP — the residual of the two-mark change, and the reason
 * it is not a taste question.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `NodeProvenanceMark` renders a SECOND glyph where node authorship and value
 * basis disagree. The group that hosts it in `BaseNode` was
 * `inline-flex items-center shrink-0 ml-auto` — **no gap** — wrapping two spans
 * that each hold a bare lucide svg at
 * `w-[calc(14px*var(--canvas-label-scale,1))]` with no margin. The pair
 * therefore rendered FLUSH, at up to 28px each under the 2x counter-scale.
 *
 * ⛔ WHY THAT IS A DEFECT AND NOT A NICETY: the component's own header took the
 * HUE off these glyphs on a measurement (`text-warning` is 1.92:1 against the
 * card fill, against SC 1.4.11's 3:1) on the explicit ground that **"the SHAPE
 * carries the meaning"**. Two abutting shapes at the fit zoom degrade the one
 * channel the design says is load-bearing.
 *
 * ⭐ THE CONTRAST CONTROL IS IN THE ESTATE, NOT IN THIS FILE'S OPINION: `gap-1`
 * is already the convention for adjacent header glyphs — the `headerSlot` group
 * in `BaseNode` and the ScienceIcons group in `FactorNode` both spell it, and
 * the provenance group was the ONLY one without it. The fix makes the two
 * `BaseNode` groups read ONE string
 * (`CANVAS_HEADER_GLYPH_GROUP_CLASSES`), so they cannot drift apart again.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import {
  CANVAS_HEADER_GLYPH_GROUP_CLASSES,
  CANVAS_HEADER_GLYPH_GAP_PX,
} from '../shared/canvasGlyphScale'
import { PROVENANCE_ICON_DECLARED_PX } from '../../domain/valueProvenanceIcon'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_GAP_PX,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_TITLE_MIN_MEASURE_PX,
} from '../../utils/nodeLayoutConstants'

/* ReactFlow's NodeProps requires a dozen fields no assertion here reads; the
   casts below are the sibling node specs' own pattern. */
const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function mockStore(over: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
      ...over,
    } as never),
  )
}

function renderFactor(id: string, data: Record<string, unknown>) {
  mockStore({ nodes: [{ id, type: 'factor', data }] })
  return render(
    <ReactFlowProvider>
      <FactorNode {...(baseProps as any)} type="factor" id={id} data={data as any} />
    </ReactFlowProvider>,
  )
}

/**
 * ⚠ THE MEASURED TWO-MARK SHAPE, not a plausible one. Factor `6d9a37f3` "Pro
 * Plan Monthly Price" arrived `provenance: "ai_inferred"` (Olumi named the node)
 * beside `observed_state.source: "brief_extraction"` (the user's own number) on
 * a captured wire body served by build `1690c1f`. That disagreement is what
 * mounts the pair.
 */
const TWO_MARK_DATA = {
  label: 'Pro Plan Monthly Price',
  type: 'factor',
  category: 'controllable',
  provenance: 'ai_inferred',
  observedState: { value: 0.49, baseline: 49, source: 'brief_extraction', extractionType: 'explicit' },
}

/**
 * ⛔ THE CONTRAST FIXTURE. Same card, same claim axis, authorship and value
 * AGREE (`ai_inferred` + `cee_inference`), so exactly ONE mark mounts. Without
 * it the "exactly two" assertion below could be satisfied by a card that always
 * renders two marks — i.e. by the noise-on-every-card mistake the two-mark
 * branch was deliberately written to avoid.
 */
const ONE_MARK_DATA = {
  label: 'Hiring rate',
  type: 'factor',
  category: 'controllable',
  provenance: 'ai_inferred',
  observedState: { value: 0.7, source: 'cee_inference' },
}

/** The exact class string that shipped the defect, kept as a historic pin. */
const THE_GAPLESS_STRING = 'inline-flex items-center shrink-0 ml-auto'

const group = () => screen.getByTestId('node-provenance-mark-group')
const marks = () => screen.queryAllByTestId('node-provenance-mark')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('⭐ the two provenance marks do not touch', () => {
  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-16, DESIGN-GAP-AUDIT-20260924.md row 16).
   *
   * `TWO_MARK_DATA`'s disagreement used to mount BOTH a structural and a
   * value mark. The value half is now suppressed everywhere, unconditionally
   * — `FactorNode` carries that same fact on its own value line
   * (`valueSourceMark.tsx`), so the header copy was a duplicate (contract
   * §03). The two-mark disagreement branch in `resolveProvenanceMarks` still
   * exists and still fires (it decides WHICH facts are eligible), but its
   * output is now filtered down to the structural entry alone — so a
   * genuinely disagreeing card mounts exactly ONE header mark, same as an
   * agreeing one. The "two marks never touch" GROUP-CLASS machinery below
   * (gap-1, the width arithmetic) is kept: it is shared with OTHER
   * counter-scaled glyph groups on the card (`CANVAS_HEADER_GLYPH_GROUP_CLASSES`
   * per this file's own header comment), so it is not dead code, just
   * unreachable through THIS path until/unless a future design re-admits a
   * second concurrent header mark.
   */
  it('the disagreeing card now mounts exactly ONE mark (structural) — the value half moved to the value line', () => {
    renderFactor('fac_two', TWO_MARK_DATA)
    expect(marks()).toHaveLength(1)
    expect(marks()[0].getAttribute('data-provenance-claim')).toBe('structural')
    expect(group()).not.toBeNull()
  })

  it('and the group that holds them carries a gap', () => {
    renderFactor('fac_two', TWO_MARK_DATA)
    // Bound to the group by its own testid, never by walking up from a mark:
    // with two marks present, position is not identity (trap 19).
    expect(group().className).toBe(CANVAS_HEADER_GLYPH_GROUP_CLASSES)
    // ⭐ THE PROPERTY, NOT THE STRING. A rename or a reshuffle of the constant
    // is fine; losing the gap is not, and this is the line that REDs if the gap
    // is removed from the shared string.
    expect(CANVAS_HEADER_GLYPH_GROUP_CLASSES.split(' ')).toContain('gap-1')
    // ⛔ THE HISTORIC PIN. The exact string that rendered the marks flush.
    expect(group().className).not.toBe(THE_GAPLESS_STRING)
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-16). `ONE_MARK_DATA` agrees (`ai_inferred` +
   * `cee_inference`, both kind `ai`), which produced a single VALUE-claim
   * mark before GAP-16. That mark is now suppressed too (the value line
   * carries it instead), so the agreeing card renders NO header mark at all
   * — the discriminating property this test protects is now "disagreement
   * still gets its one structural mark; agreement gets none", not "two
   * marks vs one".
   */
  // ⛔ review 5822866079: ONE_MARK_DATA's `cee_inference` has no extractionType, so the
  // value line reads `unknown` and the header keeps its single value mark.
  it('⛔ CONTRAST — an AGREEING card whose value line reads unknown keeps ONE header mark; the group still mounts unconditionally', () => {
    renderFactor('fac_one', ONE_MARK_DATA)
    expect(marks()).toHaveLength(1)
    expect(marks()[0].getAttribute('data-provenance-claim')).toBe('value')
    // The group is unconditional, so the gap class stays available for
    // whatever DOES mount inside it (structural-only today).
    expect(group().className).toBe(CANVAS_HEADER_GLYPH_GROUP_CLASSES)
  })
})

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE SECOND MARK COSTS HEADER WIDTH — DERIVED AT THIS HEAD, NOT QUOTED.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The header row is `display: flex; flexWrap: 'wrap'` with the title `flex-1` at
 * `minWidth: min(NODE_TITLE_MIN_MEASURE_PX, cardW - NODE_CARD_PADDING_X -
 * NODE_HEADER_RESERVE_PX)` and the mark group `shrink-0`. So the row stays on
 * ONE line only while
 *
 *     titleMin + NODE_HEADER_GAP_PX + groupW  <=  cardW - NODE_CARD_PADDING_X
 *
 * and `groupW = marks x 14 x scale + (marks - 1) x gap`. Read at `dfa351cb`:
 * `NODE_TITLE_MIN_MEASURE_PX` 236 (= 108 x 2 + 20), `NODE_HEADER_GAP_PX` 6,
 * `NODE_CARD_PADDING_X` 24, `NODE_HEADER_RESERVE_PX` 0, `NODE_CARD_MAX_W` 336,
 * `NODE_LAYOUT_MIN_W` 260, `MAX_LABEL_COUNTER_SCALE` 2.
 *
 *     one mark    236 + 6 + 28      + 24 = 294
 *     two marks   236 + 6 + 56 + 4  + 24 = 326   <= NODE_CARD_MAX_W (336)
 *
 * ⚠ SO THE WRAP BAND IS `[294, 326)`: a card rendered in it puts the PAIR on a
 * second header row where a SINGLE mark sat inline. Under the DEFAULT layout
 * that band is empty — `planLayoutBox`/`tierBoxWidth` give a factor card
 * `NODE_LAYOUT_MIN_W` (260, where even one mark already wraps) or a width at or
 * above `NODE_CARD_MAX_W`, never between. It is reachable only under a
 * non-`DOWN` direction with a widest tier of 6-9 (e.g. widest 7, factor tier 6,
 * spacing 15 ⇒ 309px), and the cost there is the DESIGNED fallback the header's
 * own comment describes: the group drops below the title rather than squeezing
 * the title under its measure.
 *
 * ⛔ WHICH IS WHY `NODE_HEADER_RESERVE_PX` IS **NOT** RAISED, against the
 * reviewer's suggestion and its own docblock's invitation. That constant is a
 * WIDTH the title surrenders, and it is consumed by `NODE_LAYOUT_MIN_W =
 * NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X`.
 * Raising it by the 62px this ornament needs would take the minimum CARD width
 * 260 -> 322 and `LAYOUT_BOX_MIN_W` 284 -> 346, moving the packing cliffs for
 * every board — the exact class of regression `nodeLayoutConstants.ts` records
 * costing four cards per row and a lower fit zoom. Buying that for a band the
 * default layout cannot reach is the wrong trade. It is ALSO pinned to 0 by
 * `utils/__tests__/nodeLabelFit.spec.ts`, so the change is not silent either.
 *
 * The premise is asserted rather than assumed below: if a later lane DOES raise
 * it, this guard REDs and the arithmetic above must be re-derived instead of
 * inherited.
 */
const inlineHeaderNeedsCardWidthPx = (markCount: number) =>
  NODE_TITLE_MIN_MEASURE_PX +
  NODE_HEADER_GAP_PX +
  markCount * PROVENANCE_ICON_DECLARED_PX * MAX_LABEL_COUNTER_SCALE +
  Math.max(0, markCount - 1) * CANVAS_HEADER_GLYPH_GAP_PX +
  NODE_CARD_PADDING_X

describe('⭐ the pair still fits the header row inline at the width cards render at', () => {
  it('the premise this arithmetic rests on: NODE_HEADER_RESERVE_PX is 0', () => {
    // With a non-zero reserve the title's measure is clamped and the threshold
    // arithmetic below changes shape. Pinned so the derivation cannot go stale
    // underneath a later constant change.
    expect(NODE_HEADER_RESERVE_PX).toBe(0)
  })

  it('the thresholds are 294px for one mark and 326px for two', () => {
    expect(inlineHeaderNeedsCardWidthPx(1)).toBe(294)
    expect(inlineHeaderNeedsCardWidthPx(2)).toBe(326)
    // ⭐ THE MECHANISM ITSELF: the second mark costs exactly one counter-scaled
    // glyph plus one gap. If a future change makes the gap free, or makes the
    // glyph unscaled, this stops being true and the band above is wrong.
    expect(inlineHeaderNeedsCardWidthPx(2) - inlineHeaderNeedsCardWidthPx(1)).toBe(
      PROVENANCE_ICON_DECLARED_PX * MAX_LABEL_COUNTER_SCALE + CANVAS_HEADER_GLYPH_GAP_PX,
    )
  })

  it('⛔ THE LOAD-BEARING ONE — a full-width card affords the PAIR inline, gap included', () => {
    // 336 >= 326. REDs if the card cap shrinks, if the title measure grows, if
    // the glyph grows, or if the gap grows — i.e. on every input to the band.
    expect(NODE_CARD_MAX_W).toBeGreaterThanOrEqual(inlineHeaderNeedsCardWidthPx(2))
  })

  it('and at the layout floor even ONE mark wraps, so the pair adds no new behaviour there', () => {
    // The honest scope of the claim above: at `NODE_LAYOUT_MIN_W` the header
    // already wraps with a single mark, so the second one changes nothing at the
    // narrowest card the layout can produce.
    expect(NODE_LAYOUT_MIN_W).toBeLessThan(inlineHeaderNeedsCardWidthPx(1))
  })
})
