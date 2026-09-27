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
 *   · dock (900)          — the right-hand dock (`OutputsDock`, Panel-owned; its
 *                           literal stays in that file and is mirrored here so
 *                           the order is readable in one place).
 *   · overlayBand (1050)  — status chips over the board (focus chip, notices).
 *   · edgeEditPopover (3000) — editing a link, anchored to the board.
 *   · inspector (5000)    — the floating node inspector.
 *   · contextMenu (5010/5011/5012) — the "…" / right-click menu and its
 *                           submenu open ON TOP of whatever is selected, the
 *                           inspector included: the menu is the newest,
 *                           shortest-lived surface.
 *   · menuTooltip / setValuePopover (5013) — belong to the menu, so above it.
 *   · hoverPreview (9999) — the node hover preview; the menu's backdrop takes
 *                           the pointer while a menu is open, so the two never
 *                           compete.
 *
 * ⚠ LITERAL CLASS STRINGS, NOT TEMPLATES: Tailwind emits CSS only for class
 * text it can see (`tailwind.config.js` content covers `src/**\/*.ts`).
 * `layers.spec.ts` parses every class back and asserts it equals its number
 * and that the order holds, so the two maps cannot drift.
 */
export const CANVAS_LAYER = {
  dock: 900,
  overlayBand: 1050,
  edgeEditPopover: 3000,
  inspector: 5000,
  contextMenuBackdrop: 5010,
  contextMenu: 5011,
  submenu: 5012,
  menuTooltip: 5013,
  setValuePopover: 5013,
  hoverPreview: 9999,
} as const

export type CanvasLayer = keyof typeof CANVAS_LAYER

export const CANVAS_LAYER_CLASS: Readonly<Record<Exclude<CanvasLayer, 'dock'>, string>> = Object.freeze({
  overlayBand: 'z-[1050]',
  edgeEditPopover: 'z-[3000]',
  inspector: 'z-[5000]',
  contextMenuBackdrop: 'z-[5010]',
  contextMenu: 'z-[5011]',
  submenu: 'z-[5012]',
  menuTooltip: 'z-[5013]',
  setValuePopover: 'z-[5013]',
  hoverPreview: 'z-[9999]',
})
