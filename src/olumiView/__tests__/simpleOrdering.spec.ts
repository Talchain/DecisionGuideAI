import { describe, expect, it } from 'vitest'
import { orderSimpleBands, simpleCrossingCounts, type SimpleLink } from '../simpleOrdering'
import { bezierPolyline, crossingCounts } from './support/crossings'

type TestBand = { ids: string[]; sizes: number[]; step: number; fixed?: boolean }
const link = (from: string, to: string): SimpleLink => ({ from, to })

function board(...bands: TestBand[]) {
  const w = 24, heightOf = () => 30
  const rows = bands.map((band) => ({
    ...band,
    rows: band.sizes.map((n) => Array.from({ length: n }, (_, i) => 150 + (i - (n - 1) / 2) * band.step)),
  }))
  const stableIds = bands.flatMap(({ ids }) => ids)
  const place = (order: readonly (readonly string[])[]) => {
    const placed = new Map<string, { x: number; y: number; w: number }>()
    let y = 0
    rows.forEach((band, i) => {
      let j = 0
      for (const xs of band.rows) {
        for (const x of xs) placed.set(order[i]![j++]!, { x: x - w / 2, y, w })
        y += 82
      }
    })
    return placed
  }
  const boxes = (placed: ReturnType<typeof place>) => [...placed].map(([id, p]) => ({ ...p, id, h: heightOf() }))
  return {
    base: place(bands.map(({ ids }) => ids)),
    place,
    boxes,
    order: (links: readonly SimpleLink[], rank = stableIds) => orderSimpleBands(rows, links, rank, place, heightOf),
  }
}

const options = { ids: ['A', 'B', 'C'], sizes: [2, 1], step: 76, fixed: true }
const score = simpleCrossingCounts

describe('Simple wrapped-row ordering', () => {
  it('changes wrapped membership to reduce crossings and keeps each option letter in its original slot', () => {
    const { base, boxes, order, place } = board(options, { ids: ['c', 'a', 'b'], sizes: [2, 1], step: 110 })
    const links = [link('A', 'a'), link('B', 'b'), link('C', 'c')]
    const placed = order(links)
    expect(placed).toEqual(place([options.ids, ['a', 'b', 'c']]))
    for (const id of options.ids) expect(placed.get(id)).toEqual(base.get(id))
    expect(placed.get('c')!.y).toBeGreaterThan(base.get('c')!.y)
    expect(score(boxes(base), links)).toEqual({ crossings: 1, cardHits: 1 })
    expect(score(boxes(placed), links)).toEqual({ crossings: 0, cardHits: 0 })
  })

  it('uses the group card as a slot and gives each of its connectors one vote regardless of count', () => {
    const fixed = { ...options, sizes: [3] }
    const { base, boxes, order, place } = board(fixed, { ids: ['x', 'group', 'z'], sizes: [3], step: 110 })
    const groupLink = { ...link('C', 'group'), count: 13 }
    const links = [link('A', 'group'), link('B', 'x'), link('C', 'x'), groupLink]
    const placed = order(links)
    expect(placed).toEqual(place([fixed.ids, ['group', 'x', 'z']]))
    expect(score(boxes(base), links)).toEqual({ crossings: 2, cardHits: 0 })
    expect(score(boxes(placed), links)).toEqual({ crossings: 1, cardHits: 0 })
    expect(order([...links.slice(0, -1), ...Array<SimpleLink>(groupLink.count).fill(groupLink)])).toEqual(base)
  })

  it('breaks ties by Core order, then extras order, even with links reversed', () => {
    const fixed = { ...options, ids: ['A', 'B'], sizes: [2] }
    const { order, place } = board(fixed, { ids: ['extra2', 'extra1', 'core2', 'core1', 'x'], sizes: [5], step: 78 })
    const links = ['extra2', 'extra1', 'core2', 'core1'].map((id) => link('B', id)).concat(link('A', 'x'))
    const rank = ['A', 'B', 'core1', 'core2', 'x', 'extra1', 'extra2']
    const expected = place([fixed.ids, ['x', 'core1', 'core2', 'extra1', 'extra2']])
    expect(order(links, rank)).toEqual(expected)
    expect(order([...links].reverse(), rank)).toEqual(expected)
  })

  it('keeps the base order when no candidate strictly reduces crossings', () => {
    const { base, order } = board(options, { ids: ['a', 'b', 'c'], sizes: [2, 1], step: 110 })
    expect(order([link('A', 'a'), link('B', 'b')])).toEqual(base)
  })

  it('keeps the base order when a sweep removes a crossing but hits another card', () => {
    const { base, boxes, order, place } = board(options, { ids: ['x', 'y', 'z'], sizes: [2, 1], step: 110 })
    const links = [link('A', 'x'), link('A', 'z'), link('C', 'x')]
    const candidate = place([options.ids, ['z', 'x', 'y']])
    expect(score(boxes(base), links)).toEqual({ crossings: 1, cardHits: 0 })
    expect(score(boxes(candidate), links)).toEqual({ crossings: 0, cardHits: 1 })
    expect(order(links)).toEqual(base)
  })

  it('matches the independent instrument for down, up, same-row and missing endpoints', () => {
    const { base, boxes } = board(options, { ids: ['c', 'a', 'b'], sizes: [2, 1], step: 110 })
    const links = [link('A', 'a'), link('b', 'B'), link('c', 'a'), link('C', 'missing')]
    const cards = boxes(base)
    expect(score(cards, links)).toEqual(crossingCounts(cards, links, (_link, from, to) => bezierPolyline(from, to)))
  })
})
