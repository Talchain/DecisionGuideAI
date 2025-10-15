import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadState, saveState, clearState } from '../persist'

describe('Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no saved state', () => {
    expect(loadState()).toBeNull()
  })

  it('saves and loads state', () => {
    const state = { nodes: [{ id: '1', type: 'decision', position: { x: 0, y: 0 }, data: {} }], edges: [] }
    saveState(state)
    const loaded = loadState()
    expect(loaded).toEqual(state)
  })

  it('returns null on invalid JSON', () => {
    localStorage.setItem('canvas-storage', 'invalid json')
    expect(loadState()).toBeNull()
  })

  it('returns null on invalid schema', () => {
    localStorage.setItem('canvas-storage', JSON.stringify({ foo: 'bar' }))
    expect(loadState()).toBeNull()
  })

  it('clears state', () => {
    saveState({ nodes: [], edges: [] })
    clearState()
    expect(loadState()).toBeNull()
  })

  it('handles save errors gracefully', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    
    saveState({ nodes: [], edges: [] })
    expect(spy).toHaveBeenCalled()
    
    spy.mockRestore()
  })
})
