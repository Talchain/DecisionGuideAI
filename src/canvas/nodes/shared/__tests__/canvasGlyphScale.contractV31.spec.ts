/**
 * ⭐ canvasGlyphScale — the contract v3.1 geometry this module now carries.
 *
 *   · FRAME-12 + PILL-11 — the corner stack no longer hangs off the frame
 *     (`right-[-8px]`) and its offsets scale with the members they separate.
 *     Since gap 11 (25 Sep) it sits INSIDE the card at the contract's
 *     `top:5px; right:7px` — see the updated block below.
 *   · RHY-01 — the card RENDERS the rail band as a calc over the live scale,
 *     which equals `NODE_QUICK_ACTION_BAND_PX` exactly at the bound (the only
 *     scale `measureNodeHeightsAtLabelBound` reads heights at).
 *   · ANC-02 / RHY-02 — the anchor rail reserve is literal Tailwind (so the JIT
 *     sees it and the css-var census can resolve it), and every literal is
 *     parsed back here against the derivation, so the hand-typed numbers cannot
 *     drift from the rail they describe.
 */
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_RAIL_MAX_BUTTONS,
  ANCHOR_RAIL_MIN_BUTTONS,
  ANCHOR_RAIL_RESERVE_CLASSES,
  CANVAS_CORNER_STACK_CLASSES,
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_INSET_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
  NODE_QUICK_ACTION_BAND_CSS,
  NODE_QUICK_ACTION_BAND_PX,
  anchorRailButtonsKey,
  anchorRailReservePx,
  type AnchorRailButtons,
} from '../canvasGlyphScale'
import { MAX_LABEL_COUNTER_SCALE } from '../../../utils/zoomLegibility'

const tokens = (s: string) => s.split(/\s+/).filter(Boolean)

describe('corner stack — inside the card at the contract offsets (gap 11; was FRAME-12 + PILL-11)', () => {
  /**
   * ⛔ UPDATED 25 Sep 2026 (gap 11, DESIGN-GAP-AUDIT-20260924.md row 11): the
   * DESIGN moved this anchor. Visual Contract §02 puts the mark INSIDE the card —
   * `.node .attention{position:absolute;right:7px;top:5px}` — where FRAME-12 had
   * it `bottom-full right-3` with a scaled `mb-` gap, floating above the border
   * in the row gap. Old pins: `right-3`, `mb-[calc(4px*…)]`, `bottom-full`.
   * New: `top-[5px]`, `right-[7px]`. What FRAME-12 guarded still holds: nothing
   * overhangs the frame, and the gap BETWEEN members carries the scale.
   */
  it('anchors inside the top-right corner at the contract offsets, never past the right border', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('top-[5px]')
    expect(t).toContain('right-[7px]')
    expect(t.some((c) => /^right-\[-/.test(c) || c.startsWith('-right-') || c.startsWith('-top-'))).toBe(false)
  })

  it('the gap between members carries --canvas-label-scale; there is no margin into the row gap', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('gap-[calc(4px*var(--canvas-label-scale,1))]')
    expect(t.some((c) => c.startsWith('mb-'))).toBe(false)
    expect(t).not.toContain('gap-1')
  })

  it('stays out of flow (no card box changes) — but no longer above the card', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('absolute')
    expect(t).not.toContain('bottom-full')
  })
})

describe('the rendered rail band (contract v3.1 RHY-01)', () => {
  const resolveAt = (scale: number) => {
    const m = NODE_QUICK_ACTION_BAND_CSS.match(
      /^calc\((\d+)px \+ (\d+)px \* var\(--canvas-label-scale, 1\)\)$/,
    )
    expect(m, `unparseable band: ${NODE_QUICK_ACTION_BAND_CSS}`).not.toBeNull()
    return Number(m![1]) + Number(m![2]) * scale
  }

  it('equals NODE_QUICK_ACTION_BAND_PX exactly at the bound the layout measures at', () => {
    expect(resolveAt(MAX_LABEL_COUNTER_SCALE)).toBe(NODE_QUICK_ACTION_BAND_PX)
  })

  it('is derived from the rail constants, and is shorter than the reservation below the bound', () => {
    expect(resolveAt(1)).toBe(
      CANVAS_QUICK_ACTION_INSET_PX + CANVAS_QUICK_ACTION_BOX_PX + CANVAS_QUICK_ACTION_SLOP_PX,
    )
    expect(resolveAt(1)).toBeLessThan(NODE_QUICK_ACTION_BAND_PX)
  })
})

describe('the anchor rail reserve (contract v3.1 ANC-02, RHY-02)', () => {
  const keys = Object.keys(ANCHOR_RAIL_RESERVE_CLASSES).map(Number) as AnchorRailButtons[]

  it('covers every reachable count, 3 to 6, and nothing else', () => {
    expect(keys.sort()).toEqual([3, 4, 5, 6])
    expect(ANCHOR_RAIL_MIN_BUTTONS).toBe(3)
    expect(ANCHOR_RAIL_MAX_BUTTONS).toBe(6)
  })

  it.each([3, 4, 5, 6] as const)('the %i-button literal spells the derivation (inset + scaled run + one gap)', (n) => {
    const cls = ANCHOR_RAIL_RESERVE_CLASSES[n]
    const m = cls.match(/^\[&>:last-child\]:pr-\[calc\((\d+)px\+(\d+)px\*var\(--canvas-label-scale,1\)\)\]$/)
    expect(m, `unparseable reserve class: ${cls}`).not.toBeNull()
    expect(Number(m![1])).toBe(CANVAS_QUICK_ACTION_INSET_PX)
    expect(Number(m![2])).toBe(anchorRailReservePx(n))
    // n boxes, n-1 gaps between them, + 1 gap of clearance to the text.
    expect(anchorRailReservePx(n)).toBe(n * CANVAS_QUICK_ACTION_BOX_PX + (n - 1) * 6 + 6)
  })

  it('clamps a counted rail into the table', () => {
    expect(anchorRailButtonsKey(2)).toBe(3)
    expect(anchorRailButtonsKey(3)).toBe(3)
    expect(anchorRailButtonsKey(5)).toBe(5)
    expect(anchorRailButtonsKey(9)).toBe(6)
  })
})
