import { describe, it, expect } from 'vitest'
import { initialHistory, push as pushHistory, rebaseToIndex, historyEntries, labelOf, type PlcState, type Op } from '../../state/history'

function seed(): PlcState {
  return {
    nodes: [
      { id: 'a', label: 'A', x: 10, y: 10 },
      { id: 'b', label: 'B', x: 80, y: 20 },
      { id: 'c', label: 'C', x: 150, y: 30 },
    ],
    edges: [],
  }
}

describe('PLC history: labels & time-travel', () => {
  it('labels latest-first and supports jump with redo truncation', () => {
    let hist = initialHistory(seed())

    // Align Left (2)
    const alignLeft: Op = {
      type: 'batchMove',
      meta: { kind: 'align-left' },
      payload: {
        moves: [
          { id: 'b', from: { x: 80, y: 20 }, to: { x: 10, y: 20 } },
          { id: 'c', from: { x: 150, y: 30 }, to: { x: 10, y: 30 } },
        ],
      },
    }
    hist = pushHistory(hist, alignLeft)

    // Distribute H (3)
    const distH: Op = {
      type: 'batchMove',
      meta: { kind: 'distribute-h' },
      payload: {
        moves: [
          { id: 'a', from: { x: 10, y: 10 }, to: { x: 10, y: 10 } },
          { id: 'b', from: { x: 10, y: 20 }, to: { x: 80, y: 20 } },
          { id: 'c', from: { x: 10, y: 30 }, to: { x: 150, y: 30 } },
        ],
      },
    }
    hist = pushHistory(hist, distH)

    // Move (1)
    const moveOne: Op = {
      type: 'move',
      payload: { id: 'a', from: { x: 10, y: 10 }, to: { x: 14, y: 12 } },
    }
    hist = pushHistory(hist, moveOne)

    const entries = historyEntries(hist) // latest-first
    expect(entries[0].label).toMatch(/Move\b/i)
    expect(entries[1].label).toMatch(/Distribute H\b/i)
    expect(entries[2].label).toMatch(/Align Left\b/i)
    expect(labelOf(alignLeft)).toMatch(/Align Left \(2\)/)

    // Jump back to "Distribute H"
    const targetIdx = entries[1].index
    hist = rebaseToIndex(hist, targetIdx)
    expect(historyEntries(hist)[0].label).toMatch(/Distribute H\b/i)

    // New op after jump clears redo
    const moveTwo: Op = {
      type: 'move',
      payload: { id: 'b', from: { x: 80, y: 20 }, to: { x: 90, y: 22 } },
    }
    hist = pushHistory(hist, moveTwo)
    expect(hist.future.length).toBe(0)
  })
})

describe('historyEntries window cap', () => {
  it('returns latest-first list aligned to active index, capped at 20', () => {
    let h = initialHistory({ nodes: [], edges: [] })
    for (let i = 0; i < 35; i++) {
      h = pushHistory(h, {
        type: 'move',
        payload: { id: `n${i % 3}`, from: { x: i, y: i }, to: { x: i + 1, y: i + 1 } },
      })
    }
    const list = historyEntries(h)
    expect(list.length).toBeLessThanOrEqual(20)
    // Latest-first aligned to active index (past.length - 1)
    expect(list[0].index).toBe(h.past.length - 1)
    expect(list[0].label).toMatch(/move|align|distribute/i)
  })
})
