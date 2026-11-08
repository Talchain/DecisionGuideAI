/**
 * Link words keep clear of the chips on a card's rail as of the card itself (olumiView/railBoxes.ts, canvas/edges/ViewLinkEdge.tsx).
 * Paul's gate, 8 Nov: on his consulting board an edge label "replaces" sat over the end of a doubted link's chip, because the rail hangs
 * below its card, out of React Flow's measured box, and the words were kept clear of the card boxes alone. The geometry here is built to
 * that shape (a 220-wide card, its 190 × 24 chip 4 below it, a short link from its foot to the next card down); the board itself is the
 * browser witness's (~/olumi-work/tm04-chip, gate-after: no link words on any chip).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider, type Node } from '@xyflow/react'
import type { View } from '../client'
import { railObstacles, useRailBoxes, useRailBoxesRef, type RailEntry } from '../railBoxes'
import { linkWordsAt } from '../../canvas/edges/linkWordsPlace'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'

afterEach(() => { cleanup(); useRailBoxes.setState({ rails: {} }); vi.restoreAllMocks() })

const card = { id: 'time_to_contract', x: 36, y: -48, w: 220, h: 303 }
const below = { id: 'consulting_contract_to_cash', x: 200, y: 300, w: 220, h: 120 }
const chipBox = { x: 15, y: 307, w: 190, h: 24 } // from the card's top-left: 4 below its foot, centred
const rails: Record<string, RailEntry> = {
  'reveal:time_to_contract': { card: 'time_to_contract', boxes: [chipBox] },
  'reveal:not_drawn': { card: 'not_drawn', boxes: [{ x: 0, y: 0, w: 10, h: 10 }] },
}
// A link from the card's foot to the card below, as React Flow draws it (a cubic); its midpoint falls in the chip row.
const from = { x: 120, y: 255 }, to = { x: 310, y: 300 }
const curve = `M ${from.x},${from.y} C ${from.x},${from.y + 22.5} ${to.x},${to.y - 22.5} ${to.x},${to.y}`
/** The cubic's point at t = 0.5, as React Flow gives it with the path. */
const mid = { x: (from.x + 3 * from.x + 3 * to.x + to.x) / 8, y: (from.y + 3 * (from.y + 22.5) + 3 * (to.y - 22.5) + to.y) / 8 }
const inBox = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }, size = { w: 0, h: 0 }) =>
  p.x - size.w / 2 < b.x + b.w && p.x + size.w / 2 > b.x && p.y - size.h / 2 < b.y + b.h && p.y + size.h / 2 > b.y
const chipOnBoard = { x: card.x + chipBox.x, y: card.y + chipBox.y, w: chipBox.w, h: chipBox.h }

describe('railBoxes: the link words keep clear of the chips on a card\'s rail', () => {
  it('maps each chip to the board by its card\'s top-left, a card\'s two rails both, and leaves out a rail whose card is not drawn', () => {
    expect(railObstacles([card, below], rails)).toEqual([{ id: 'reveal:time_to_contract#0', ...chipOnBoard }])
    const two = { ...rails, 'strategy:time_to_contract': { card: 'time_to_contract', boxes: [{ x: 15, y: 337, w: 120, h: 24 }] } }
    expect(railObstacles([card], two).map((b) => b.id)).toEqual(['reveal:time_to_contract#0', 'strategy:time_to_contract#0'])
  })

  it('HIGH: the words of a link leaving by the card\'s foot are put off its chip, where the card boxes alone put them on it', () => {
    const size = { w: 56, h: 18 }
    // CONTRAST: clear of the cards alone, the words land on the chip (the defect the gate found).
    expect(inBox(linkWordsAt(curve, [card, below], size, mid), chipOnBoard, size)).toBe(true)
    // Clear of the cards and the rail's chips: off the chip and every card.
    const placed = linkWordsAt(curve, [card, below, ...railObstacles([card, below], rails)], size, mid)
    expect([inBox(placed, chipOnBoard, size), inBox(placed, card, size), inBox(placed, below, size)]).toEqual([false, false, false])
  })

  it('HIGH: the drawn edge keeps its words off a published chip (ViewLinkEdge passes the rails to its placement)', () => {
    // A real link with words (bakery: second_oven -> sales, its strength in core's words, shown while selected), between two cards React
    // Flow holds, measured.
    const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
    const link = model.links[9]!
    const nodes: Node[] = [
      { id: link.from, position: { x: card.x, y: card.y }, data: {}, width: card.w, height: card.h, measured: { width: card.w, height: card.h } },
      { id: link.to, position: { x: below.x, y: below.y }, data: {}, width: below.w, height: below.h, measured: { width: below.w, height: below.h } },
    ]
    const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
    const words = () => {
      const c = render(<ReactFlowProvider initialNodes={nodes}><EdgeLabelLayer><svg>
        <Edge id="l9" source={link.from} target={link.to} sourceX={from.x} sourceY={from.y} targetX={to.x} targetY={to.y}
          sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 9 }} selected />
      </svg></EdgeLabelLayer></ReactFlowProvider>).container
      const el = c.querySelector('[data-view-link-words="links.9"]') as HTMLElement
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)\s*$/.exec(el.style.transform)!
      cleanup()
      return { x: Number(m[1]), y: Number(m[2]) }
    }
    // CONTRAST: with no rail published, the words sit at the link's middle, on the chip.
    expect(inBox(words(), chipOnBoard)).toBe(true)
    act(() => { useRailBoxes.getState().put('reveal:second_oven', link.from, [chipBox]) })
    const w = words()
    expect([inBox(w, chipOnBoard), inBox(w, { ...card, x: card.x, y: card.y }), inBox(w, below)]).toEqual([false, false, false])
  })

  it('a rail publishes its chips from its card\'s top-left as it is drawn, and takes them back when it goes', () => {
    // jsdom lays nothing out, so the layout offsets are read from the elements here; the browser witness measures the real ones.
    const num = (el: HTMLElement, k: string, i: number) => Number((el.getAttribute(k) ?? '0,0').split(',')[i])
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (this: HTMLElement) { return this.parentElement })
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) { return num(this, 'data-off', 0) })
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return num(this, 'data-off', 1) })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return num(this, 'data-size', 0) })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return num(this, 'data-size', 1) })
    // As CardViewChips is: the hook always runs, the rail is drawn only while the card has chips.
    function Rail({ shown }: { shown: boolean }): JSX.Element {
      const ref = useRailBoxesRef('reveal:time_to_contract', 'time_to_contract')
      return <div className="react-flow__node"><span data-off="0,303">{shown ? <div ref={ref} data-off="0,4"><button type="button" data-off="15,0" data-size="190,24" /></div> : null}</span></div>
    }
    const published = { 'reveal:time_to_contract': { card: 'time_to_contract', boxes: [{ x: 14, y: 306, w: 192, h: 26 }] } }
    const { rerender, unmount } = render(<Rail shown />)
    // 15 across, 303 + 4 down from the card's top-left, 190 × 24, with a unit kept on every side for rounding.
    expect(useRailBoxes.getState().rails).toEqual(published)
    // The card's chips go while the card stays: the rail goes, and so do its boxes.
    rerender(<Rail shown={false} />)
    expect(useRailBoxes.getState().rails).toEqual({})
    rerender(<Rail shown />)
    expect(useRailBoxes.getState().rails).toEqual(published)
    unmount()
    expect(useRailBoxes.getState().rails).toEqual({})
  })
})
