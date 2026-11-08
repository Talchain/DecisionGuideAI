/**
 * V11 choice D (Paul, 6 Nov): opening a chip or an evidence mark centres and enlarges the active subgraph (the card and its chip rail)
 * instead of shrinking the model. Bound by identity: the card id comes from the REAL fixtures; the camera numbers are the 1232 x 704 board
 * (free canvas 880 x 704 beside the 352 px dock; core's card width, 220).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { evidenceCards } from '../evidence'
import { CARD_WIDTH } from '../layout'
import { openedCardOf, openInViewTarget, OPEN_MIN_ZOOM, revealFocusTarget } from '../revealCamera'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', f), 'utf8'))
const evidenceView = load('consulting-evidence.view3.json')
const DIAG = 'paid_enterprise_diagnostic'
const PANE = { w: 880, h: 704 }
const CARD = { x: 300, y: 560, w: CARD_WIDTH, h: 96 } // flow units: a card at the bottom edge
const CHIP_H = 28

describe('which card an open brings in (real fixtures)', () => {
  it('a chip is its own card id', () => {
    expect(openedCardOf(evidenceView, DIAG, null)).toBe(DIAG)
  })
  it('an evidence mark is the first card core concerns', () => {
    const e = evidenceView.evidence[0]!
    expect(evidenceCards(evidenceView, e)[0]).toBe(DIAG)
    expect(openedCardOf(evidenceView, null, e.id)).toBe(DIAG)
    expect(openedCardOf(evidenceView, null, 99999)).toBeNull()
    expect(openedCardOf(evidenceView, null, null)).toBeNull()
  })
})

describe('the target viewport', () => {
  it('a card at the bottom edge comes fully into view, card and chip rail, centred', () => {
    const t = openInViewTarget({ card: CARD, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 1 } })!
    expect(t.zoom).toBe(1)
    const top = CARD.y * t.zoom + t.y, bottom = (CARD.y + CARD.h + CHIP_H) * t.zoom + t.y
    expect(top).toBeGreaterThanOrEqual(0)
    expect(bottom).toBeLessThanOrEqual(PANE.h)
    expect((top + bottom) / 2).toBeCloseTo(PANE.h / 2)
    expect((CARD.x + CARD.w / 2) * t.zoom + t.x).toBeCloseTo(PANE.w / 2)
  })
  it('a card already in view at zoom 0.9 or more does not move', () => {
    expect(openInViewTarget({ card: { ...CARD, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 1 } })).toBeNull()
    expect(openInViewTarget({ card: { ...CARD, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: OPEN_MIN_ZOOM } })).toBeNull()
  })
  it('zoom 0.6 goes to 0.9, even when already in view', () => {
    const t = openInViewTarget({ card: { ...CARD, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 0.6 } })!
    expect(t.zoom).toBe(0.9)
    expect((CARD.x + CARD.w / 2) * t.zoom + t.x).toBeCloseTo(PANE.w / 2)
  })
  it('zoom 1.2 stays 1.2, never zoomed out', () => {
    const t = openInViewTarget({ card: CARD, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 1.2 } })!
    expect(t.zoom).toBe(1.2)
  })
  it('a card partly past the left edge is brought in', () => {
    const t = openInViewTarget({ card: { ...CARD, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 200, y: 0, zoom: 1 } })
    expect(t).toBeNull() // x=500..720 in view
    const u = openInViewTarget({ card: { ...CARD, x: -100, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 1 } })!
    expect((-100 + CARD.w / 2) * u.zoom + u.x).toBeCloseTo(PANE.w / 2)
  })
})

describe('a reveal centres the contested card and its chips (ruling D; design owner’s witness, 8 Nov)', () => {
  // The card the 1232 witness found at the bottom edge: a card low in a 845 x 652 pane at zoom 0.8.
  const card = { x: 400, y: 900, w: 220, h: 120 }, pane = { w: 845, h: 652 }, viewport = { x: 0, y: -200, zoom: 0.8 }
  it('moves the card and its rail to the middle of the pane at the person’s zoom', () => {
    const to = revealFocusTarget({ card, chipH: 32, pane, viewport })!
    expect(to.zoom).toBe(0.8)
    expect((card.x + card.w / 2) * to.zoom + to.x).toBeCloseTo(pane.w / 2)
    expect((card.y + (card.h + 32) / 2) * to.zoom + to.y).toBeCloseTo(pane.h / 2)
  })
  it('centres it in the free canvas, never under the dock that covers the right of the pane', () => {
    const inset = { left: 0, top: 52, right: 348, bottom: 0 }
    const to = revealFocusTarget({ card, chipH: 32, pane, inset, viewport })!
    expect((card.x + card.w / 2) * to.zoom + to.x).toBeCloseTo((pane.w - 348) / 2)
    expect((card.y + (card.h + 32) / 2) * to.zoom + to.y).toBeCloseTo(52 + (pane.h - 52) / 2)
  })
  it('CONTRAST: a board already centred on it does not move', () => {
    const to = revealFocusTarget({ card, chipH: 32, pane, viewport })!
    expect(revealFocusTarget({ card, chipH: 32, pane, viewport: to })).toBeNull()
  })
})
