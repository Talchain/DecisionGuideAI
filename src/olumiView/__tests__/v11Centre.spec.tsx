/**
 * V11 choice D (Paul, 6 Nov): opening a chip or an evidence mark centres and enlarges the active subgraph (the card and its chip rail)
 * instead of shrinking the model. Bound by identity: the card id comes from the REAL fixtures; the camera numbers are the 1232 x 704 board
 * (free canvas 880 x 704 beside the 352 px dock; core's card width, 220).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import * as layout from '../layout'
import { CARD_WIDTH, evidenceCards } from '../layout'
import { useViewStore } from '../store'
import { computeFitPadding } from '../../canvas/utils/computeFitPadding'
import { openedCardOf, openInViewTarget, OPEN_MIN_ZOOM, revealFocusTarget, useRevealInView } from '../revealCamera'

const camera = vi.hoisted(() => ({
  getViewport: () => ({ x: 0, y: 0, zoom: 1 }), setViewport: vi.fn(), getInternalNode: (_id: string): unknown => undefined,
  // J1 gate: the reveal camera reads the board's bounds; with no nodes it centres as before (no whole-board clamp).
  getNodes: (): unknown[] => [], getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
}))
vi.mock('@xyflow/react', async (original) => ({ ...await original<typeof import('@xyflow/react')>(), useReactFlow: () => camera }))
vi.mock('../canvas', () => ({ viewLaying: () => false }))
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers(); camera.setViewport.mockClear() })

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
  it('a card in view but off centre is centred on selection (design owner, 8 Nov: "centre on chip selection")', () => {
    const t = openInViewTarget({ card: { ...CARD, y: 200 }, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 1 } })!
    expect((200 + (CARD.h + CHIP_H) / 2) * t.zoom + t.y).toBeCloseTo(PANE.h / 2)
  })
  it('CONTRAST: a card already centred at zoom 0.9 or more does not move', () => {
    for (const zoom of [1, OPEN_MIN_ZOOM]) {
      const at = openInViewTarget({ card: CARD, chipH: CHIP_H, pane: PANE, viewport: { x: 0, y: 0, zoom: 0.5 } })!
      const centred = { zoom, x: PANE.w / 2 - (CARD.x + CARD.w / 2) * zoom, y: PANE.h / 2 - (CARD.y + (CARD.h + CHIP_H) / 2) * zoom }
      expect(at.zoom).toBe(OPEN_MIN_ZOOM)
      expect(openInViewTarget({ card: CARD, chipH: CHIP_H, pane: PANE, viewport: centred })).toBeNull()
    }
  })
  it('the 1232 x 704 board: the selected card and its chips are centred in the free canvas left of the dock, not the whole pane', () => {
    // The design owner's witness: a 1232 pane, the dock from x 885, the free centre about (443, 352); the chip had been left at y 761.
    const pane = { w: 1232, h: 704 }, inset = { left: 0, top: 0, right: 1232 - 885, bottom: 0 }
    const card = { x: 300, y: 600, w: CARD_WIDTH, h: 125 }
    const t = openInViewTarget({ card, chipH: CHIP_H, pane, inset, viewport: { x: 0, y: 0, zoom: 1 } })!
    expect((card.x + card.w / 2) * t.zoom + t.x).toBeCloseTo(885 / 2)
    expect((card.y + (card.h + CHIP_H) / 2) * t.zoom + t.y).toBeCloseTo(352)
    const chipBottom = (card.y + card.h + CHIP_H) * t.zoom + t.y
    expect(chipBottom).toBeLessThan(pane.h)
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

it('N2 contract, on V11 centring: layout places evidence by identity; the revealed chip waits for its exact position, then its card and chips are centred in the free canvas', () => {
  const own = evidenceView.evidence[0]!
  const placed = layout.evidenceOn?.(evidenceView, DIAG)
  expect.soft(placed?.[0]).toBe(own)
  expect.soft(placed?.map((e) => [e.id, e.text])).toEqual(evidenceView.evidence.map((e) => [e.id, e.text]))
  const view = load('consulting-chain.view3.json')
  const mark = view.collab.marks!.find((m) => m.card === 'diagnostic_time_to_contract' && m.kind === 'disagreement')!
  expect(mark.text).toBe('Priya and Tom differ')
  useViewStore.setState({ view, sid: view.id, at: null })
  const pane = document.createElement('div'), node = document.createElement('div'), rail = document.createElement('div'), chip = document.createElement('button')
  pane.className = 'react-flow'
  node.className = 'react-flow__node'; node.dataset.id = mark.card
  rail.dataset.testid = `reveal-chips-${mark.card}`
  chip.dataset.revealKind = mark.kind
  chip.textContent = mark.text
  rail.append(chip); node.append(rail); pane.append(node); document.body.append(pane)
  const card = { x: 300, y: 800, w: CARD_WIDTH, h: 96 }
  camera.getInternalNode = (id: string) => (id === mark.card ? { measured: { width: card.w, height: card.h }, internals: { positionAbsolute: { x: card.x, y: card.y } } } : undefined)
  let y = 800.1
  pane.getBoundingClientRect = () => new DOMRect(0, 0, PANE.w, PANE.h)
  rail.getBoundingClientRect = () => new DOMRect(300, y, CARD_WIDTH, CHIP_H)
  chip.getBoundingClientRect = () => new DOMRect(300, y, CARD_WIDTH, CHIP_H)
  vi.useFakeTimers()
  renderHook(() => useRevealInView({ current: 0 }))
  act(() => vi.advanceTimersByTime(250))
  y = 800.2
  act(() => vi.advanceTimersByTime(250))
  expect.soft(camera.setViewport.mock.calls).toEqual([])
  act(() => vi.advanceTimersByTime(250))
  const pad = computeFitPadding(pane), num = (v: string | number) => (typeof v === 'number' ? v : parseFloat(v) || 0)
  const inset = { left: num(pad.left), top: num(pad.top), right: num(pad.right), bottom: num(pad.bottom) }
  const want = revealFocusTarget({ card, chipH: CHIP_H + 4, pane: PANE, inset, viewport: { x: 0, y: 0, zoom: 1 } })
  expect(want).not.toBeNull()
  expect(camera.setViewport.mock.calls).toEqual([[want, { duration: 300 }]])
})
