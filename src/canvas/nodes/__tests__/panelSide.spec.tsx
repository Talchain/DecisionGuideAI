/**
 * DL ruling 7 Nov (the narrowest reading of Paul's 4 Nov design): a card's open words stay beside it, on the side with room. Measured
 * before on copies of Paul's and the hosting board: every panel opened right, 8 of 10 and 4 of 6 over another card or the question.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi, type Node, type NodeProps } from '@xyflow/react'
import type { View } from '../../../olumiView/client'
import { VIEW_CARD } from '../../../olumiView/canvas'
import { ViewCardNode } from '../ViewCardNode'
import { PANEL_GAP, panelSide } from '../panelSide'

afterEach(() => cleanup())
const card = { x: 300, y: 100, w: 220, h: 140 }, size = { w: 220, h: 180 }
const right = { x: card.x + card.w + PANEL_GAP + 20, y: 120, w: 220, h: 140 }, left = { x: card.x - PANEL_GAP - 240, y: 120, w: 220, h: 140 }

describe('which side a card\'s open words go', () => {
  it('catch: a card with a neighbour on its right opens its words on the left, where nothing is', () => {
    expect(panelSide(card, size, [right])).toBe('left')
  })
  it('must not change: with room on the right (nothing there, or a card only above or below the panel) it stays right', () => {
    expect(panelSide(card, size, [])).toBe('right')
    expect(panelSide(card, size, [{ ...right, y: card.y + size.h + 1 }])).toBe('right')
    expect(panelSide(card, size, [left])).toBe('right')
  })
  it('neither side clear: the side it covers less of, never more than the right did; the right on a tie', () => {
    // Each neighbour as placed covers 200 of the panel's 220 across; moved 100 further out, it covers 100.
    expect(panelSide(card, size, [{ ...right, x: right.x + 100 }, left])).toBe('right') // the left would cover more
    expect(panelSide(card, size, [right, { ...left, x: left.x - 100 }])).toBe('left') // the left covers less
    expect(panelSide(card, size, [right, left])).toBe('right') // the same area: right
  })
})

describe('a side the person cannot see is never the clear one (strategy journey at 1232, served 55c0, 10 Nov)', () => {
  // Measured: "£50M ARR by 2027" selected after the reveal opened its words right, at x 805-1005, under the dock from 924; cut.
  it('catch: nothing on the right, but the right lies past the visible canvas: its words open on the left', () => {
    expect(panelSide(card, size, [], { left: 0, right: card.x + card.w + PANEL_GAP + size.w - 1 })).toBe('left')
  })
  it('catch: the left lies off the canvas and the right is visible, though a card is there: right', () => {
    expect(panelSide(card, size, [right], { left: card.x - PANEL_GAP - size.w + 1, right: 2000 })).toBe('right')
  })
  it('must not change: both sides visible, or neither, the area rule decides as before', () => {
    expect(panelSide(card, size, [right], { left: 0, right: 2000 })).toBe('left')
    expect(panelSide(card, size, [], { left: 0, right: 2000 })).toBe('right')
    expect(panelSide(card, size, [right], { left: 299, right: 520 })).toBe('left')
    expect(panelSide(card, size, [], null)).toBe('right')
  })
})

describe('the drawn card reads where its neighbours are now', () => {
  const real = (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'capacity.view3.json'), 'utf8')) as View).model!
  const withMore = real.cards.find((c) => c.premises.length > 0)!
  const box = (id: string, x: number, y: number): Node => ({ id, position: { x, y }, data: {}, width: 220, height: 140, measured: { width: 220, height: 140 } })
  let api: ReturnType<typeof useStoreApi> | null = null
  const Grab = () => { api = useStoreApi(); return null }
  it('catch: selected, with a card on its right, its words open on the left; moved after the first draw, they follow (xyflow refills its lookup in place)', () => {
    const c = render(<ReactFlowProvider initialNodes={[box(withMore.id, 300, 100), box('n', 560, 100)]}><Grab />
      <ViewCardNode {...({ id: withMore.id, data: { card: withMore, label: withMore.heading }, selected: true, type: VIEW_CARD } as unknown as NodeProps)} />
    </ReactFlowProvider>).container
    const side = () => c.querySelector('[data-view-more]')!.getAttribute('data-panel-side')
    expect(side()).toBe('left')
    act(() => { api!.getState().setNodes([box(withMore.id, 300, 100), box('n', 40, 100)]) })
    expect(side()).toBe('right')
  })
  it('catch: selected, nothing beside it, the outputs dock over its right: its words open on the left; with no dock, right', () => {
    const dock = document.createElement('aside'); dock.setAttribute('aria-label', 'Outputs dock')
    dock.getBoundingClientRect = () => ({ left: 700, right: 1032, top: 0, bottom: 704, width: 332, height: 704, x: 700, y: 0, toJSON: () => ({}) }) as DOMRect
    document.body.appendChild(dock)
    try {
      const c = render(<ReactFlowProvider initialNodes={[box(withMore.id, 300, 100)]}>
        <ViewCardNode {...({ id: withMore.id, data: { card: withMore, label: withMore.heading }, selected: true, type: VIEW_CARD } as unknown as NodeProps)} />
      </ReactFlowProvider>).container
      expect(c.querySelector('[data-view-more]')!.getAttribute('data-panel-side')).toBe('left')
    } finally { dock.remove() }
    cleanup()
    const c = render(<ReactFlowProvider initialNodes={[box(withMore.id, 300, 100)]}>
      <ViewCardNode {...({ id: withMore.id, data: { card: withMore, label: withMore.heading }, selected: true, type: VIEW_CARD } as unknown as NodeProps)} />
    </ReactFlowProvider>).container
    expect(c.querySelector('[data-view-more]')!.getAttribute('data-panel-side')).toBe('right')
  })
})
