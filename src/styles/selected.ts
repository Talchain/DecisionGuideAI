/**
 * THE ONE SELECTED STATE (DL layout pass, 9 Nov 2026; from the V11 comp). A selected thing on the olumi-core lane (the canvas's Model ·
 * Explore · Team chip, a dock tab, a card, a reveal mark) carries the same ink edge, 1 px; its words go ink at 600 where it has words; and,
 * where it sits on the panel's white, the panel's warm hover fill. Ink, never blue: blue is Olumi's. Built only on existing tokens
 * (`--text-header`, `--bg-panel-hover`).
 */

/** The selected edge: an ink ring, 1 px, outside any border the thing already has. */
export const SELECTED_RING = 'ring-1 ring-text-header'
/** Selected words: ink at 600. */
export const SELECTED_TEXT = 'text-text-header font-semibold'
/** The fill, only where the surface is the panel's white (a tab, a chip on the canvas's head band): the panel's warm hover. */
export const SELECTED_FILL = 'bg-panel-hover'
/** All three, for a control with words on a light surface (the chips and the dock tabs). */
export const SELECTED = `${SELECTED_RING} ${SELECTED_TEXT} ${SELECTED_FILL}`
