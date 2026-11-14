import { describe, expect, it } from 'vitest'
import { lineCutShift, type LineBox } from '../footCut'

// DL 07:48Z (4), old look: at rest no line of text is cut by the actions foot's rule (no half-line shows).
const lines = (...tops: number[]): LineBox[] => tops.map((t) => ({ top: t, bottom: t + 20 }))
const crossed = (ls: readonly LineBox[], cut: number, d: number) => ls.some((l) => l.top - d < cut - 0.5 && l.bottom - d > cut + 0.5)

describe('lineCutShift: the resting thread leaves no line cut by the foot rule', () => {
  it('FK1 a line straddling the rule is moved wholly under the foot where that is the smaller move (contrast: one clear of it is left alone)', () => {
    const ls = lines(400, 420, 440)
    const d = lineCutShift(ls, 446, 100, 100)
    expect([d, crossed(ls, 446, d), crossed(ls, 446, 0)]).toEqual([-6, false, true])
    expect(lineCutShift(lines(400, 420, 446), 446, 100, 100)).toBe(0)
  })
  it('FK2 or wholly above the rule where that is the smaller move', () => {
    const ls = lines(400, 420, 440)
    const d = lineCutShift(ls, 456, 100, 100)
    expect([d, crossed(ls, 456, d)]).toEqual([4, false])
  })
  it('FK3 the move stays inside its room: no room back means the line goes wholly above', () => {
    const ls = lines(400, 420, 440)
    const d = lineCutShift(ls, 446, 0, 100)
    expect([d, crossed(ls, 446, d)]).toEqual([14, false])
  })
  it('FK4 no room either way leaves the thread where it is (never past the step\'s top, never off the foot\'s room)', () => {
    expect(lineCutShift(lines(400, 420, 440), 446, 2, 2)).toBe(0)
  })
})
