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
import { evidenceCards } from '../evidence'
import * as layout from '../layout'
import { CARD_WIDTH } from '../layout'
import { useViewStore } from '../store'
import { openedCardOf, openInViewTarget, OPEN_MIN_ZOOM, useRevealInView } from '../revealCamera'

const camera = vi.hoisted(() => ({
  getViewport: () => ({ x: 0, y: 0, zoom: 1 }), setViewport: vi.fn(),
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

it('N2 contract: layout places evidence by identity and the revealed diagnostic chip waits for its exact position', () => {
  const own = evidenceView.evidence[0]!
  const placed = layout.evidenceOn?.(evidenceView, DIAG)
  expect.soft(placed?.[0]).toBe(own)
  expect.soft(placed?.map((e) => [e.id, e.text])).toEqual(evidenceView.evidence.map((e) => [e.id, e.text]))
  const view = load('consulting-chain.view3.json')
  const mark = view.collab.marks!.find((m) => m.card === 'diagnostic_time_to_contract' && m.kind === 'disagreement')!
  expect(mark.text).toBe('Priya and Tom differ')
  useViewStore.setState({ view, sid: view.id, at: null })
  const pane = document.createElement('div'), chip = document.createElement('button')
  pane.className = 'react-flow'
  chip.dataset.revealChip = `${mark.card}:${mark.kind}`
  chip.textContent = mark.text
  pane.append(chip); document.body.append(pane)
  let y = 800.1
  pane.getBoundingClientRect = () => new DOMRect(0, 0, PANE.w, PANE.h)
  chip.getBoundingClientRect = () => new DOMRect(300, y, CARD_WIDTH, CHIP_H)
  vi.useFakeTimers()
  renderHook(() => useRevealInView({ current: 0 }))
  act(() => vi.advanceTimersByTime(250))
  y = 800.2
  act(() => vi.advanceTimersByTime(250))
  expect.soft(camera.setViewport.mock.calls).toEqual([])
  act(() => vi.advanceTimersByTime(250))
  expect(camera.setViewport.mock.calls).toEqual([[{ x: 0, y: 664 - (y + CHIP_H), zoom: 1 }, { duration: 300 }]])
})
