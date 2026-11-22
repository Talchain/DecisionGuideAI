/**
 * THE LANE'S ONE MENU SHELL (surfaces step B, 18 Nov). On the lane every menu that floats over the canvas wears the same box and the same row, whoever opens it (a card's
 * right-click, its submenu, the left rail's "+" and Lenses, the lens bar's Explore): one radius, border, ground, padding and shadow; rows py-2.5
 * with the shell's inner radius; a hairline between groups. The audit found four boxes (rounded-md or rounded-lg; py-2, p-1 or p-1.5) and two rows
 * (h-9 px-4, min-h-[32px] px-3). Entries, their words and what they do are each menu's own: only the shell is shared. Where a menu stands, how wide it
 * is and its layer stay with its opener.
 */
import { typography } from '../../styles/typography'

/** The menu's own box. */
export const MENU_SHELL = `rounded-md border border-panel-border bg-panel p-1 shadow-2 ${typography.viewPanelBody}`
/** One row of it (its colour, and its focused, checked and disabled states, are the menu's). */
export const MENU_ROW = 'rounded-sm px-3 py-2.5'
/** The hairline between two groups of rows. */
export const MENU_SEPARATOR = 'my-1 border-t border-panel-border'

/**
 * OFF THE LANE (the older look, which stays live) the right-click menu and its submenu keep the box, row and gap they had: nothing there changes
 * until someone has opened a picture of it (UI lead, 18 Nov). The two looks are named here, once, and the shared menu asks `menuLook`.
 */
const OLDER_MENU = { shell: 'rounded-md border border-panel-border bg-panel py-2 shadow-2', row: `h-9 px-4 ${typography.panelBody}`, separator: 'mx-2 my-2' } as const
const LANE_MENU = { shell: MENU_SHELL, row: MENU_ROW, separator: MENU_SEPARATOR } as const
export const menuLook = (lane: boolean): { readonly shell: string; readonly row: string; readonly separator: string } => (lane ? LANE_MENU : OLDER_MENU)
