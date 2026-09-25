/**
 * ⭐ canvasGlyphScale — the contract v3.1 geometry this module now carries.
 *
 *   · FRAME-12 + PILL-11 — the corner stack no longer hangs off the frame
 *     (`right-[-8px]`) and its offsets scale with the members they separate.
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

describe('corner stack — nothing overhangs the frame (contract v3.1 FRAME-12, PILL-11)', () => {
  it('right-aligns at the card padding, never past the right border', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('right-3')
    expect(t.some((c) => /^right-\[-/.test(c) || c.startsWith('-right-'))).toBe(false)
  })

  it('the gap to the border and between members carries --canvas-label-scale', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('mb-[calc(4px*var(--canvas-label-scale,1))]')
    expect(t).toContain('gap-[calc(4px*var(--canvas-label-scale,1))]')
    expect(t).not.toContain('mb-[2px]')
    expect(t).not.toContain('gap-1')
  })

  it('stays out of flow above the card (no box change)', () => {
    const t = tokens(CANVAS_CORNER_STACK_CLASSES)
    expect(t).toContain('absolute')
    expect(t).toContain('bottom-full')
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

  // ⚠ WAS 3 TO 6. Design-gap row 20 put the EDIT route on both anchors' rail, so
  // BaseNode counts from 4 and the formula's maximum is 7 (Edit + Challenge +
  // More + Ask/coaching + run icon + evidence + behaviour).
  it('covers every reachable count, 3 to 7, and nothing else', () => {
    expect(keys.sort()).toEqual([3, 4, 5, 6, 7])
    expect(ANCHOR_RAIL_MIN_BUTTONS).toBe(3)
    expect(ANCHOR_RAIL_MAX_BUTTONS).toBe(7)
  })

  it.each([3, 4, 5, 6, 7] as const)('the %i-button literal spells the derivation (inset + scaled run + one gap)', (n) => {
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
    expect(anchorRailButtonsKey(7)).toBe(7)
    expect(anchorRailButtonsKey(9)).toBe(7)
  })
})
