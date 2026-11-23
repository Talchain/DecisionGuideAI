import { DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../../canvas/utils/computeFitPadding'
import { FOOT_CONTROLS, HEAD_CONTROLS, LENS_KEYS, regionsOf } from '../regions'
import { freeCanvas } from '../v12/edit/placeBeside'
import { typography } from '../../styles/typography'

/** The menu's own box. */
export const MENU_SHELL = `rounded-md border border-panel-border bg-panel p-1.5 shadow-2 ${typography.viewPanelBody}`
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

/** Free space beside the chrome, using the canvas's measured regions. */
export const canvasChromeMenuBoundary = {
  elements: () => document.querySelectorAll([DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR, ...HEAD_CONTROLS, ...FOOT_CONTROLS, ...LENS_KEYS].join(',')),
  rect: () => {
    const { left, top, right, bottom } = freeCanvas()
    const { foot, keys = [] } = regionsOf()
    const floor = [...foot, ...keys].reduce((y, control) =>
      control.right > left && control.left < right && control.top > top && control.bottom > control.top ? Math.min(y, control.top) : y,
    bottom)
    return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, floor - top) }
  },
}
