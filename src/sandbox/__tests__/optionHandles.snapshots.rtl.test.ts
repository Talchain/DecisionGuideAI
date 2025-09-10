// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { saveSnapshot, loadSnapshot, listSnapshots, fromB64, clearSnapshots } from '@/sandbox/state/snapshots'
import { BoardState, type Handle } from '@/sandbox/state/boardState'

const DECISION_ID = 'dec-snap-1'

beforeEach(() => {
  try { localStorage.clear() } catch {}
  clearSnapshots(DECISION_ID)
})

describe('Snapshots persist option handle IDs', () => {
  it('encodes and restores edges with sourceHandle option:<id>', () => {
    const s = new BoardState('board-A')
    const d = s.addNode({ type: 'decision', x: 0, y: 0, label: 'D' })
    const o = s.addNode({ type: 'option', x: 100, y: 0, label: 'O1' })
    const h = `option:${o.id}` as Handle
    const res = s.addEdge({ source: d.id, target: o.id, sourceHandle: h })
    expect(res.id).toBeTruthy()

    const bytes = s.getUpdate()
    const meta = saveSnapshot(DECISION_ID, bytes, { note: 'with handles' })
    expect(meta.decisionId).toBe(DECISION_ID)

    const list = listSnapshots(DECISION_ID)
    expect(list.find(m => m.id === meta.id)).toBeTruthy()

    const payload = loadSnapshot(DECISION_ID, meta.id)
    expect(payload).toBeTruthy()

    const decoded = fromB64(payload!.ydoc)
    const s2 = new BoardState('board-B')
    s2.replaceWithUpdate(decoded)
    const b = s2.getBoard()
    expect(b.edges.length).toBe(1)
    expect(b.edges[0].source).toBe(d.id)
    expect(b.edges[0].target).toBe(o.id)
    expect(b.edges[0].sourceHandle).toBe(h)
  })
})
