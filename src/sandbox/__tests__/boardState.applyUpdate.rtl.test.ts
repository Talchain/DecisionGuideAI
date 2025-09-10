import { describe, it, expect } from 'vitest'
import { BoardState, type Handle } from '@/sandbox/state/boardState'

function createBoard() {
  const s = new BoardState('apply-update-test')
  const d = s.addNode({ type: 'decision', x: 0, y: 0, label: 'D' })
  const o = s.addNode({ type: 'option', x: 100, y: 0, label: 'O' })
  return { s, d, o }
}

describe('BoardState.applyUpdate maintains edge dedupe indexes', () => {
  it('blocks duplicate edges after applyUpdate()', () => {
    const { s, d, o } = createBoard()
    const h = `option:${o.id}` as Handle
    const e1 = s.addEdge({ source: d.id, target: o.id, sourceHandle: h })
    expect(e1.id).toBeTruthy()

    const bytes = s.getUpdate()

    const s2 = new BoardState('apply-update-test-2')
    s2.applyUpdate(bytes)

    // Attempt to add the exact same edge again should be rejected
    const dup = s2.addEdge({ source: d.id, target: o.id, sourceHandle: h })
    expect(dup.error).toMatch(/already exists/i)
  })
})
