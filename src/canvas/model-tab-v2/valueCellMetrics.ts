/**
 * The height a value cell RESERVES so that entering edit does not move the page.
 *
 * ⚠ WHY THIS CONSTANT EXISTS. The panel-scale migration put the idle value on
 * `panelTabular` (12px) and DS v5 §2.1 keeps the edit `<input>` at 14px — 14px is
 * this system's minimum accessible size, and a 12px field at the 280px dock floor
 * is a usability regression (that was a blocking review finding in its own right).
 * Both decisions are right, and together they made clicking a value grow its row.
 *
 * MEASURED, NOT ESTIMATED — in a real browser, at `6870d5e5`, before this fix:
 * the row grew by EXACTLY 3.50px at a 280px dock AND at a 416px dock.
 *
 *   idle    12px x leading-relaxed (1.625)          = 19.5px
 *   editing 14px x leading-normal  (1.5)   = 21px
 *           + 1px border-top + 1px border-bottom    = 23.0px
 *                                             delta =  3.5px  ✓ matches
 *
 * So the idle cell reserves the taller box and the glyph size changes inside a
 * stationary frame.
 *
 * ⭐ THIS NUMBER IS A HAND-MAINTAINED MIRROR OF THE INPUT'S BOX, AND IT IS PINNED
 * BY A BROWSER TEST RATHER THAN BY A COMMENT. `e2e/geometry/modelRowEditReflow.measure.ts`
 * measures the real rendered delta at both dock widths and REDs if it is not zero,
 * so changing the input's font size, line-height, border or padding without
 * changing this constant fails loudly. jsdom performs no layout, so no unit test
 * can hold this — that is why the guard is a geometry measure.
 */
export const EDIT_RESERVED_HEIGHT_CLASS = 'min-h-[23px]'
