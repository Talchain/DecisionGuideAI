/** Wide tiers wrap (DL 4 Nov, the core lane's original look): a row of more than four cards becomes rows of four, centred; rows below move down. */
import { describe, expect, it } from 'vitest'
import { wrapTiers } from '../wrapTiers'

const box = (id: string, x: number, y: number) => ({ id, x, y, width: 200, height: 80 })
describe('wrapTiers', () => {
  it('a row of six becomes four and two, centred where the row was, and the row below moves down by the new row', () => {
    const row = [0, 1, 2, 3, 4, 5].map((i) => box(`f${i}`, i * 300, 100)), below = box('goal', 700, 300)
    const at = wrapTiers([box('q', 600, 0), ...row, below])
    const first = [0, 1, 2, 3].map((i) => at.get(`f${i}`)!), second = [4, 5].map((i) => at.get(`f${i}`)!)
    expect(first.every((p) => p.y === 100) && second.every((p) => p.y === 100 + 80 + 48)).toBe(true)
    const centre = (ps: { x: number }[]) => (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x)) + 200) / 2
    expect([centre(first), centre(second)]).toEqual([850, 850])
    expect(at.get('goal')).toEqual({ x: 700, y: 300 + 128 })
    expect(at.get('q')).toEqual({ x: 600, y: 0 })
  })
  it('must not change: a board with no row wider than four keeps every place', () => {
    const boxes = [box('q', 0, 0), box('a', 0, 100), box('b', 300, 100), box('c', 600, 100), box('d', 900, 100)]
    expect([...wrapTiers(boxes)].map(([id, p]) => [id, p.x, p.y])).toEqual(boxes.map((b) => [b.id, b.x, b.y]))
  })
})
