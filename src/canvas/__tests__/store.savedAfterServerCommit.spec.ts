/**
 * The save pill tells the truth after an edit (verifier, staging fe4e4b9d, 19 Oct 2026: "Saved 1h ago" stayed
 * after a value set that CEE had saved). A canvas edit is saved by CEE's turn, and the turn's new `graph_hash` is
 * the receipt, so that is where the save time moves. Opening a model is not a save.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../store'

afterEach(() => {
  vi.useRealTimers()
  useCanvasStore.setState({ lastServerGraphHash: null, lastSavedAt: null })
})

describe('the save time follows CEE committing a write', () => {
  it('a new graph hash over a held one moves the save time to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T09:00:00Z'))
    useCanvasStore.setState({ lastServerGraphHash: 'h1', lastSavedAt: Date.parse('2026-10-19T08:00:00Z') })
    useCanvasStore.getState().setLastServerGraphHash('h2')
    expect(useCanvasStore.getState().lastSavedAt).toBe(Date.parse('2026-10-19T09:00:00Z'))
  })

  it('CONTRAST: the first hash (open, reload, switch) is not a save, and the same hash again is no new save', () => {
    const opened = Date.parse('2026-10-19T08:00:00Z')
    useCanvasStore.setState({ lastServerGraphHash: null, lastSavedAt: opened })
    useCanvasStore.getState().setLastServerGraphHash('h1')
    expect(useCanvasStore.getState().lastSavedAt).toBe(opened)
    useCanvasStore.getState().setLastServerGraphHash('h1')
    expect(useCanvasStore.getState().lastSavedAt).toBe(opened)
  })

  it('CONTRAST: a turn with no hash says nothing about the saved graph', () => {
    const opened = Date.parse('2026-10-19T08:00:00Z')
    useCanvasStore.setState({ lastServerGraphHash: 'h1', lastSavedAt: opened })
    useCanvasStore.getState().setLastServerGraphHash(null)
    expect(useCanvasStore.getState().lastSavedAt).toBe(opened)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe('h1')
  })
})
