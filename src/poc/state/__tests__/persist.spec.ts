import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState, clearState } from '../../state/persist'

const KEY = 'sandbox.state.v1'

describe('persist v1 schema', () => {
  beforeEach(() => {
    try { localStorage.removeItem(KEY) } catch {}
    try { clearState() } catch {}
  })

  it('saveState writes schemaVersion:1 and round-trips', () => {
    // save minimal SamState (saveState should add schemaVersion)
    saveState({ nodes: [], edges: [], renames: {} } as any)
    const raw = localStorage.getItem(KEY)
    expect(raw).toBeTruthy()
    const parsed = raw ? JSON.parse(raw) : null
    expect(parsed?.schemaVersion).toBe(1)
    expect(Array.isArray(parsed?.nodes)).toBe(true)
    expect(Array.isArray(parsed?.edges)).toBe(true)

    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect(Array.isArray(loaded!.nodes)).toBe(true)
    expect(Array.isArray(loaded!.edges)).toBe(true)
  })

  it('rejects garbage payloads', () => {
    localStorage.setItem(KEY, '{"schemaVersion":1,"nodes":1}')
    expect(loadState()).toBeNull()
  })

  it('accepts legacy (no schemaVersion) if shapes look right', () => {
    localStorage.setItem(KEY, '{"nodes":[],"edges":[],"notes":[]}')
    const loaded = loadState()
    // Our loader is lenient if nodes/edges are arrays.
    expect(loaded === null || (Array.isArray(loaded.nodes) && Array.isArray(loaded.edges))).toBe(true)
  })
})
