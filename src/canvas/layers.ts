/**
 * ⭐ THE CANVAS STACKING ORDER — one source for every overlay drawn over the
 * graph (build train slice D-3, #70 5855068711; root R7 "stacking is hand-set
 * in 5+ files").
 *
 * Before this module each overlay picked its own number, and they collided:
 * a selected card's "…" menu (951) opened UNDER that card's own inspector
 * (5000) in Paul's MRR screenshots (27 Sep 2026), and the menu's tooltip and
 * "Set value" popover (101) sat below the menu's own dismiss backdrop.
 *
 * The order, bottom to top, and why each sits where it does:
 *   · sheet (60)          — the lane's one box beside a card (its preview and its pinned details, `olumiView/v12/edit/LaneInspector`):
 *                           over the board, under the dock and every menu and dialog (it is placed inside the free canvas).
 *   · chatFloat (300)     — the floating Olumi conversation.
 *   · dock (900)          — the right-hand dock (`OutputsDock`, Panel-owned; its
 *                           literal stays in that file and is mirrored here so
 *                           the order is readable in one place).
 *   · overlayBand (1050)  — status chips over the board (focus chip, notices).
 *   · chromeMenu (1200)   — a menu opened from the canvas's own chrome (the left rail's Lenses): above the band and the box.
 *   · edgeEditPopover (3000) — editing a link, anchored to the board.
 *   · inspector (5000)    — the floating node inspector.
 *   · contextMenu (5011/5012) — the "…" / right-click menu and its
 *                           submenu open ON TOP of whatever is selected, the
 *                           inspector included: the menu is the newest,
 *                           shortest-lived surface.
 *   · menuTooltip / setValuePopover (5013) — belong to the menu, so above it.
 *   · modalBackdrop (6000) — a dialog (`aria-modal`), e.g. the chat's Add option
 *                           panel: its backdrop covers the whole page, so it
 *                           sits above every canvas overlay, the inspector and
 *                           the menu included. (It was 5000, tied with the
 *                           inspector, so DOM order decided.)
 *   · hoverPreview (9999) — the node hover preview. (Surfaces step B meant to lower it under the menus and dialogs; at 1500x904 at 1.33 the
 *                           question card's preview then stood under the top bar (3000), so it stays here until its placement
 *                           keeps clear of the bar.)
 *
 * ⚠ LITERAL CLASS STRINGS, NOT TEMPLATES: Tailwind emits CSS only for class
 * text it can see (`tailwind.config.js` content covers `src/**\/*.ts`).
 * `layers.spec.ts` parses every class back and asserts it equals its number
 * and that the order holds, so the two maps cannot drift.
 */
export const CANVAS_LAYER = {
  sheet: 60,
  chatFloat: 300,
  dock: 900,
  overlayBand: 1050,
  chromeMenu: 1200,
  edgeEditPopover: 3000,
  inspector: 5000,
  contextMenu: 5011,
  submenu: 5012,
  menuTooltip: 5013,
  setValuePopover: 5013,
  modalBackdrop: 6000,
  hoverPreview: 9999,
} as const

export type CanvasLayer = keyof typeof CANVAS_LAYER

export const CANVAS_LAYER_CLASS: Readonly<Record<Exclude<CanvasLayer, 'dock'>, string>> = Object.freeze({
  sheet: 'z-[60]',
  chatFloat: 'z-[300]',
  overlayBand: 'z-[1050]',
  chromeMenu: 'z-[1200]',
  edgeEditPopover: 'z-[3000]',
  inspector: 'z-[5000]',
  contextMenu: 'z-[5011]',
  submenu: 'z-[5012]',
  menuTooltip: 'z-[5013]',
  setValuePopover: 'z-[5013]',
  modalBackdrop: 'z-[6000]',
  hoverPreview: 'z-[9999]',
})
