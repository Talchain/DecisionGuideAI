/**
 * Audit SI-1 / SI-2 / SI-3 (27 Sep 2026) — where the inspector opens.
 *
 * Every rectangle below is MEASURED, not invented: pricing-model at 1280x800,
 * dock from x 920, app bar 51, canvas overlay band from y 724, left rails to
 * x 54 (local dev, the same build the audit reproduced on served staging).
 *
 *   SI-1 — the anchor is the card's RIGHT edge, and the left flip was
 *          `anchor.x - width - gap`: Net Revenue Retention (597..723) opened
 *          its inspector at 369..699, over 81% of itself.
 *   SI-2 — the bottom bound was the window: bottom-row panels ended at 784,
 *          over the band (724..788) that holds the focus chip's Clear button.
 *   SI-3 — Bottom-Up Adoption Friction's inspector opened at 220..550 and hid
 *          100% of Bottom-Up New Logo Acquisition and 69% of the Goal — the
 *          very path the selection had just highlighted.
 *
 * The pre-existing point-anchor pins (`InspectorModal.placement.contractV31`,
 * `…dragStaysClear.d2c3`) are unchanged: with no card rect and no path they
 * still describe the rule exactly. That is why they passed with SI-1 live —
 * they never modelled the card's width — and why these rows carry it.
 */
import { describe, it, expect } from 'vitest'
import { placeInspector, clampInspector, type ScreenRect } from '../InspectorModal'
import { INSPECTOR_SHELL_STYLE } from '../../ui/inspector-v2/inspectorStyle'

const WINDOW = { width: 1280, height: 800 }
const DOCK_LEFT = 920
const APP_BAR = 51
const BAND_TOP = 724
const LEFT_RAILS = 54
const PAD = 16
const GAP = 24

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({ left, top, right, bottom })
/** The anchor `computeAnchorPosition` hands over: the card's right edge, at its middle. */
const anchorOf = (r: ScreenRect) => ({ x: r.right, y: (r.top + r.bottom) / 2 })
const boxOf = (p: { x: number; y: number }, panel: { width: number; height: number }) =>
  rect(p.x, p.y, p.x + panel.width, p.y + panel.height)
function overlap(a: ScreenRect, b: ScreenRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}
const area = (r: ScreenRect) => (r.right - r.left) * (r.bottom - r.top)

/** Measured card rects (pricing-model, 1280x800). */
const CARD = {
  fac_adoption_friction: rect(70, 372, 196, 460),
  fac_enterprise_revenue_risk: rect(522, 372, 648, 460),
  fac_top_account_concentration: rect(672, 372, 798, 468),
  opt_new_logos: rect(446, 196, 572, 343),
  opt_status_quo: rect(597, 196, 723, 304),
  out_nrr: rect(597, 497, 723, 573),
  risk_enterprise_churn: rect(446, 497, 572, 582),
  out_bottom_up_growth: rect(296, 497, 422, 572),
  risk_pricing_complexity: rect(145, 497, 271, 594),
  goal_pricing_transition: rect(298, 623, 664, 672),
}

const BOUNDS = { viewport: WINDOW, rightLimit: DOCK_LEFT, leftLimit: LEFT_RAILS, topLimit: APP_BAR, bottomLimit: BAND_TOP }

describe('SI-1 — the inspector never opens over the card it inspects', () => {
  it.each([
    ['fac_enterprise_revenue_risk', 665],
    ['fac_top_account_concentration', 665],
    ['opt_new_logos', 665],
    ['opt_status_quo', 665],
    ['out_nrr', 537],
    ['risk_enterprise_churn', 543],
  ] as const)('⭐ %s (a right-half card the old flip covered by 81%%) is left clear', (id, height) => {
    const card = CARD[id]
    const panel = { width: 330, height: Math.min(height, BAND_TOP - APP_BAR - 2 * PAD) }
    const p = placeInspector({ anchor: anchorOf(card), panel, ...BOUNDS, target: card })
    expect(overlap(boxOf(p, panel), card), `${id}: the panel covers its own card`).toBe(0)
  })

  it('⭐ the flip clears the card\'s LEFT edge by the gap (Net Revenue Retention, the audit\'s case)', () => {
    const card = CARD.out_nrr
    const panel = { width: 330, height: 537 }
    // No dock-side room: 723 + 24 + 330 > 904. The old rule landed at 369..699.
    const p = placeInspector({ anchor: anchorOf(card), panel, viewport: WINDOW, rightLimit: DOCK_LEFT, target: card })
    expect(p.x + panel.width).toBeLessThanOrEqual(card.left - GAP)
  })

  it('CONTRAST — a left-hand card keeps the right-of-card placement it always had', () => {
    const card = CARD.fac_adoption_friction
    const p = placeInspector({ anchor: anchorOf(card), panel: { width: 330, height: 641 }, ...BOUNDS, target: card })
    expect(p.x).toBe(card.right + GAP)
  })

  it('a card wider than either side\'s room (the Goal, 366px) is covered by the least any position allows, not 90%', () => {
    const card = CARD.goal_pricing_transition
    const panel = { width: 330, height: 641 }
    const p = placeInspector({ anchor: anchorOf(card), panel, ...BOUNDS, target: card })
    // Free canvas 70..904: the right edge (574..904) covers 90px of the card,
    // the left (70..400) 102px. The old rule covered 342px (310..640).
    expect(overlap(boxOf(p, panel), card)).toBe(90 * (card.bottom - card.top))
  })
})

describe('SI-2 — the inspector never reaches the overlay band (the focus chip and its Clear button)', () => {
  it('⭐ a bottom-row selection ends above the band, not at the window\'s edge', () => {
    const card = CARD.out_nrr
    const panel = { width: 330, height: 537 }
    const p = placeInspector({ anchor: anchorOf(card), panel, ...BOUNDS, target: card })
    // The old bound was the window: 784, over the chip at 746..788.
    expect(p.y + panel.height).toBeLessThanOrEqual(BAND_TOP - PAD)
  })

  it('⭐ a drag toward the band stops at it (the one bounds rule, shared with the drag)', () => {
    const p = clampInspector({ at: { x: 300, y: 500 }, panel: { width: 330, height: 537 }, viewport: WINDOW, rightLimit: DOCK_LEFT, topLimit: APP_BAR, bottomLimit: BAND_TOP })
    expect(p.y + 537).toBe(BAND_TOP - PAD)
  })

  it('CONTRAST — with no band the window is still the bottom bound', () => {
    const p = clampInspector({ at: { x: 300, y: 500 }, panel: { width: 330, height: 537 }, viewport: WINDOW, rightLimit: DOCK_LEFT, topLimit: APP_BAR })
    expect(p.y + 537).toBe(WINDOW.height - PAD)
  })

  it('⭐ the shell\'s height is capped by the room between the app bar and the band, not the contract cap alone', () => {
    // 1280x800: the contract cap is 100vh - 135px = 665px; the room is 641px.
    expect(INSPECTOR_SHELL_STYLE.maxHeight).toContain('var(--inspector-room')
    expect(INSPECTOR_SHELL_STYLE.maxHeight).toContain('calc(100vh - 135px)')
  })

  it('the left rails bound the left edge like the dock bounds the right', () => {
    const p = clampInspector({ at: { x: 0, y: 100 }, panel: { width: 330, height: 400 }, viewport: WINDOW, rightLimit: DOCK_LEFT, leftLimit: LEFT_RAILS })
    expect(p.x).toBe(LEFT_RAILS + PAD)
  })
})

describe('SI-3 — the inspector keeps off the path its selection highlights, where the canvas has room', () => {
  // Bottom-Up Adoption Friction selected: its path is the new-logo outcome, the
  // complexity risk and the Goal (measured — the cards left undimmed).
  const selected = CARD.fac_adoption_friction
  const path = [CARD.out_bottom_up_growth, CARD.risk_pricing_complexity, CARD.goal_pricing_transition]
  const panel = { width: 330, height: 641 }
  const covered = (p: { x: number; y: number }) => path.reduce((s, r) => s + overlap(boxOf(p, panel), r), 0)
  const pathArea = path.reduce((s, r) => s + area(r), 0)

  it('⭐ hides at most a quarter of the path (the old right-of-card placement hid 68%)', () => {
    const p = placeInspector({ anchor: anchorOf(selected), panel, ...BOUNDS, target: selected, keepClear: path })
    expect(overlap(boxOf(p, panel), selected), 'never over the inspected card').toBe(0)
    expect(covered(p) / pathArea).toBeLessThanOrEqual(0.25)
  })

  it('CONTRAST — with no focused path the same card opens right beside itself, as before', () => {
    const p = placeInspector({ anchor: anchorOf(selected), panel, ...BOUNDS, target: selected })
    expect(p.x).toBe(selected.right + GAP)
    expect(covered(p) / pathArea).toBeGreaterThan(0.5) // …which is what hid the path
  })

  it('a sliver of path (under 2% of the panel) does not send the panel across the board', () => {
    const sliver = rect(selected.right + GAP + 10, 300, selected.right + GAP + 30, 320) // 20x20 under the right-of-card spot
    const p = placeInspector({ anchor: anchorOf(selected), panel, ...BOUNDS, target: selected, keepClear: [sliver] })
    expect(p.x).toBe(selected.right + GAP)
  })

  it('the inspected card outranks the path: no position over the card is ever taken to clear the path', () => {
    // A path card sitting exactly where the right-of-card and far-right spots are.
    const blocker = rect(200, 60, 910, 720)
    const p = placeInspector({ anchor: anchorOf(selected), panel, ...BOUNDS, target: selected, keepClear: [blocker] })
    expect(overlap(boxOf(p, panel), selected)).toBe(0)
  })
})
