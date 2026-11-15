/**
 * 14 Nov fault: at 1232×704 with the browser at 133% (a 926×529 window) the zoom row along the canvas's foot and the "more cards below"
 * cue beside it were drawn over the first option card. `footStackedOf` decides row or column from the pane's height; `cuePlaceOf` places
 * the cue from the zoom controls' drawn box. These rows bind both to the founder's sizes. The pixels (the controls' rectangles against each
 * card's) are the reviewer's capture, not this file's.
 *
 * The zoom controls' boxes below are derived from CanvasFloatingToolbar.module.css: `.surface` left 13px; `.viewportControls` bottom 40px,
 * padding 0, a 1px border; four 36px buttons with 4px between them (`.viewportControls .group`).
 */
import { describe, expect, it } from 'vitest'
import { CUE_SQUARE, CUE_STACK_GAP, cuePlaceOf, footStackedOf } from '../footPlace'

const LEFT = 13, FOOT = 40, RUN = 4 * 36 + 3 * 4 + 2, DEPTH = 36 + 2
const rowBox = (h: number) => ({ left: LEFT, right: LEFT + RUN, top: h - FOOT - DEPTH })
const columnBox = (h: number) => ({ left: LEFT, right: LEFT + DEPTH, top: h - FOOT - RUN })

describe('the foot controls: row or column (footStackedOf)', () => {
  it('FP1 catch: the 926×529 window (1232×704 at 133%) stands the controls as a column', () => {
    expect(footStackedOf(529)).toBe(true)
  })

  it('FP2 contrast: 1232×704, 1128×680 (1500×904 at 1.33), 2000×1100 and 2000×1205 keep the row; an unmeasured pane (0) keeps it too', () => {
    for (const h of [704, 680, 1100, 1205, 0]) expect(footStackedOf(h), `pane ${h}`).toBe(false)
  })
})

describe('the "more cards" cue\'s place (cuePlaceOf)', () => {
  it('CP1 on the row (1232×704) it stands where it did: 12 px right of the zoom row, 40 px up', () => {
    expect(cuePlaceOf(rowBox(704), 704, false)).toEqual({ left: LEFT + RUN + 12, bottom: 40 })
  })

  it('CP2 catch: in the column (926×529) it stands above the zoom column, inside its width, never beside it on the board', () => {
    const z = columnBox(529), p = cuePlaceOf(z, 529, true)
    expect(p.left).toBeGreaterThanOrEqual(z.left)
    expect(p.left + CUE_SQUARE).toBeLessThanOrEqual(z.right)
    // Its foot, in window px, is CUE_STACK_GAP above the column's top.
    expect(529 - p.bottom).toBe(z.top - CUE_STACK_GAP)
    // CONTRAST: the row's rule applied to the column would put it right of the column, over the first card column.
    expect(cuePlaceOf(z, 529, false).left).toBeGreaterThan(z.right)
  })
})
