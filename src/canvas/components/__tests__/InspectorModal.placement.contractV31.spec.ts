/**
 * Canvas visual contract v3.1 — the inspector never covers the right panel.
 *
 * DESIGN-GAP-v31 acceptance "No overlap: FAIL". Measured on the served dev
 * build (pricing, 1280x800, dock open at x=853): a Risk click placed the
 * inspector at x=611..941 — 88px over the dock, hiding its "Selected" row and
 * the conversation it names. The placement only kept clear of the WINDOW edge;
 * the dock is part of the right edge the canvas actually has.
 *
 * `placeInspector` is the whole placement rule, pure, so every branch is
 * pinned without a browser: right of the anchor; flip left when the right
 * side is blocked; clamp inside [padding, rightLimit - width]; clamp
 * vertically inside the window.
 */
import { describe, it, expect } from 'vitest'
import { placeInspector } from '../InspectorModal'

const PANEL = { width: 330, height: 600 }
const WINDOW = { width: 1280, height: 800 }

describe('v3.1 — the inspector is placed clear of the right panel', () => {
  it('⭐ an anchor whose right-hand placement would cross the dock flips LEFT of the anchor', () => {
    // Anchor at 587 → right placement 611..941, over a dock starting at 853.
    const p = placeInspector({ anchor: { x: 587, y: 400 }, panel: PANEL, viewport: WINDOW, rightLimit: 853 })
    expect(p.x + PANEL.width).toBeLessThanOrEqual(853 - 16)
    expect(p.x).toBe(587 - PANEL.width - 24)
  })

  it('⭐ CONTRAST — with no dock (the window is the right edge) the same anchor stays on the right', () => {
    const p = placeInspector({ anchor: { x: 587, y: 400 }, panel: PANEL, viewport: WINDOW, rightLimit: WINDOW.width })
    expect(p.x).toBe(587 + 24)
  })

  it('an anchor with room on neither side is clamped inside the free canvas, never over the dock', () => {
    // A wide dock (free canvas 16..584): right of 300 needs 654, left needs -54.
    const p = placeInspector({ anchor: { x: 300, y: 400 }, panel: PANEL, viewport: WINDOW, rightLimit: 600 })
    expect(p.x).toBe(16)
    expect(p.x + PANEL.width).toBeLessThanOrEqual(600 - 16)
  })

  it('stays inside the window vertically', () => {
    const low = placeInspector({ anchor: { x: 200, y: 780 }, panel: PANEL, viewport: WINDOW, rightLimit: 853 })
    expect(low.y + PANEL.height).toBeLessThanOrEqual(WINDOW.height - 16)
    const high = placeInspector({ anchor: { x: 200, y: 10 }, panel: PANEL, viewport: WINDOW, rightLimit: 853 })
    expect(high.y).toBeGreaterThanOrEqual(16)
  })
})
