import { describe, expect, it } from 'vitest'
import { orderSimpleBands, simpleCrossingCounts, type SimpleLink, type SimpleOrder } from '../simpleOrdering'
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
  const base = bands.map(({ ids }) => ids)
  const place = (order: SimpleOrder) => {
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
    base,
    place,
    boxes,
    order: (links: readonly SimpleLink[], rank = stableIds) => orderSimpleBands(bands, links, rank, (order) => [score(boxes(place(order)), links)]),
  }
}

const options = { ids: ['A', 'B', 'C'], sizes: [2, 1], step: 76, fixed: true }
const score = simpleCrossingCounts

describe('Simple band sequence ordering', () => {
  it('reduces crossings by changing the sequence and keeps the option order', () => {
    const { base, boxes, order, place } = board(options, { ids: ['c', 'a', 'b'], sizes: [2, 1], step: 110 })
    const links = [link('A', 'a'), link('B', 'b'), link('C', 'c')]
    const chosen = order(links)
    expect(chosen).toEqual([options.ids, ['a', 'b', 'c']])
    const placed = place(chosen)
    expect(placed.get('c')!.y).toBeGreaterThan(place(base).get('c')!.y)
    expect(score(boxes(place(base)), links)).toEqual({ crossings: 1, cardHits: 1 })
    expect(score(boxes(placed), links)).toEqual({ crossings: 0, cardHits: 0 })
  })

  it('uses the group card as a slot and gives each of its connectors one vote regardless of count', () => {
    const fixed = { ...options, sizes: [3] }
    const { base, boxes, order, place } = board(fixed, { ids: ['x', 'group', 'z'], sizes: [3], step: 110 })
    const groupLink = { ...link('C', 'group'), group: true as const, count: 13 }
    const links = [link('A', 'group'), link('B', 'x'), link('C', 'x'), groupLink]
    const chosen = order(links)
    expect(chosen).toEqual([fixed.ids, ['group', 'x', 'z']])
    const placed = place(chosen)
    expect(score(boxes(place(base)), links)).toEqual({ crossings: 2, cardHits: 0 })
    expect(score(boxes(placed), links)).toEqual({ crossings: 1, cardHits: 0 })
    expect(order([...links.slice(0, -1), ...Array<SimpleLink>(groupLink.count).fill(groupLink)])).toEqual(base)
  })

  it('breaks ties by Core order, then extras order, even with links reversed', () => {
    const fixed = { ...options, ids: ['A', 'B'], sizes: [2] }
    const { order } = board(fixed, { ids: ['extra2', 'extra1', 'core2', 'core1', 'x'], sizes: [5], step: 78 })
    const links = ['extra2', 'extra1', 'core2', 'core1'].map((id) => link('B', id)).concat(link('A', 'x'))
    const rank = ['A', 'B', 'core1', 'core2', 'x', 'extra1', 'extra2']
    const expected = [fixed.ids, ['x', 'core1', 'core2', 'extra1', 'extra2']]
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
    expect(score(boxes(place(base)), links)).toEqual({ crossings: 1, cardHits: 0 })
    expect(score(boxes(candidate), links)).toEqual({ crossings: 0, cardHits: 1 })
    expect(order(links)).toEqual(base)
  })

  it.each([
    { crossings: 3, cardHits: 1 },
    { crossings: 2, cardHits: 2 },
  ])('rejects an aggregate improvement if one reference width rises to %j', (regression) => {
    const bands = [options, { ids: ['c', 'a', 'b'] }]
    const base = bands.map(({ ids }) => ids)
    const links = [link('A', 'a'), link('B', 'b'), link('C', 'c')]
    const baseline = { crossings: 2, cardHits: 1 }
    const improved = { crossings: 0, cardHits: 0 }
    const rank = base.flat()
    const scoreAtWidths = (order: SimpleOrder) => order[1]![0] === 'c'
      ? [baseline, baseline, baseline]
      : [improved, regression, improved]
    expect(orderSimpleBands(bands, links, rank, scoreAtWidths)).toEqual(base)
    expect(orderSimpleBands(bands, links, rank, (order) => order[1]![0] === 'c'
      ? [baseline, baseline, baseline]
      : [improved, baseline, improved])).toEqual([options.ids, ['a', 'b', 'c']])
  })

  it('matches the independent instrument for down, up, same-row and missing endpoints', () => {
    const { base, boxes, place } = board(options, { ids: ['c', 'a', 'b'], sizes: [2, 1], step: 110 })
    const links = [link('A', 'a'), link('b', 'B'), link('c', 'a'), link('C', 'missing')]
    const cards = boxes(place(base))
    expect(score(cards, links)).toEqual(crossingCounts(cards, links, (_link, from, to) => bezierPolyline(from, to, 256)))
  })

  it('uses bottom-to-top handles on a group connector whose target is above its source', () => {
    const cards = [
      { id: 'to', x: 0, y: 0, w: 24, h: 30 },
      { id: 'from', x: 300, y: 300, w: 24, h: 30 },
      { id: 'below', x: 300, y: 345, w: 24, h: 10 },
    ]
    const ordinary = link('from', 'to')
    const group: SimpleLink = { ...ordinary, group: true }
    expect(score(cards, [ordinary]).cardHits).toBe(0)
    expect(score(cards, [group]).cardHits).toBe(1)
    expect(score(cards, [group])).toEqual(crossingCounts(cards, [group], (_link, from, to) => bezierPolyline(from, to, 256, false)))
  })

  it('counts both crossings of the H–J and J–D links from the 490 px review case', () => {
    const cards = [
      { id: 'H', x: 0, y: 547, w: 272, h: 90 },
      { id: 'J', x: 592, y: 547, w: 272, h: 90 },
      { id: 'D', x: 444, y: 409, w: 296, h: 90 },
    ]
    const links = [link('H', 'J'), link('J', 'D')]
    expect(crossingCounts(cards, links, (_link, from, to) => bezierPolyline(from, to, 16)).crossings).toBe(0)
    expect(crossingCounts(cards, links, (_link, from, to) => bezierPolyline(from, to, 256)).crossings).toBe(2)
    expect(score(cards, links).crossings).toBe(2)
  })
})
