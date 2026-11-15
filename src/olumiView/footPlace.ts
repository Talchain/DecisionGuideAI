/**
 * WHERE THE FOOT CONTROLS STAND (14 Nov fault: 1232×704 at 133%, a 926×529 window). The zoom controls run as one row along the canvas's
 * foot (DL ruling 9 Nov, CanvasFloatingToolbar.module.css) with the "more cards" cue beside them (BelowCue). In a short window the first
 * option cards reach the foot, so the row and the cue were drawn over the first card's content. Below FOOT_STACK_BELOW_H of pane height the
 * zoom controls stand as one column at the canvas's left, under the canvas tools, in the gutter the board's framing already keeps clear
 * (computeFitPadding reserves the canvas tools' column: their right edge plus 16 px), and the cue stands above them in that column, as a
 * 36 px square whose words are its name and its tooltip. 1232×704, 1128×680 and 2000×1205 keep the row, as before.
 *
 * Pure: no DOM, no imports, so the toolbar (a shared layout component) and the cue read one decision.
 */

/** Below this pane height (CSS px) the foot controls stand as a column in the left gutter. 529 (the 133% window) is under it; 680 is not. */
export const FOOT_STACK_BELOW_H = 600

/** Whether the foot controls stand as a column, for a pane `paneHeight` px tall (0 before the pane is measured: the row, as before). */
export function footStackedOf(paneHeight: number): boolean {
  return Number.isFinite(paneHeight) && paneHeight > 0 && paneHeight < FOOT_STACK_BELOW_H
}

/** The cue's square in the column, px (the zoom buttons' size), and the room between it, the next square and the zoom column. The squares'
 *  44 px hit areas (HIT_44) meet and do not overlap: 36 + 8. */
export const CUE_SQUARE = 36
export const CUE_STACK_GAP = 8

/** On the row: the cue's distance right of the zoom row and from the window's foot (unchanged from the row's first rule). */
export const CUE_ROW_GAP = 12
export const CUE_ROW_BOTTOM = 40

type Box = { readonly left: number; readonly right: number; readonly top: number }
export type CuePlace = { readonly left: number; readonly bottom: number }

/**
 * The cue's fixed position (its left and its distance from the window's foot) from the zoom controls' drawn box: on the row, 12 px to its
 * right at the row's foot; in the column, centred on it and 8 px above its top.
 */
export function cuePlaceOf(zoom: Box, windowHeight: number, stacked: boolean): CuePlace {
  return stacked
    ? { left: Math.floor((zoom.left + zoom.right) / 2 - CUE_SQUARE / 2), bottom: Math.ceil(windowHeight - zoom.top + CUE_STACK_GAP) }
    : { left: Math.ceil(zoom.right + CUE_ROW_GAP), bottom: CUE_ROW_BOTTOM }
}
