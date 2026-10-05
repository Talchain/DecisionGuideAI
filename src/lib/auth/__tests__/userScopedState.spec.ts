import { afterEach, describe, expect, it } from 'vitest'
import { clearUserScopedState, USER_SCOPED_STORAGE_KEYS, USER_SCOPED_STORAGE_PREFIXES } from '../userScopedState'
import { loadRuns, saveRuns, type StoredRun } from '../../../canvas/store/runHistory'
import { isGraphServerAcknowledged, markGraphServerAcknowledged } from '../../../canvas/store/importRegistrationMarker'

describe('user-scoped state identity boundary', () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('clears every registered persisted key and prefix while leaving device flags alone', () => {
    for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.setItem(key, 'user-a')
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) localStorage.setItem(`${prefix}scenario-a`, 'user-a')
    localStorage.setItem('feature.aiPanelV2', '1')
    clearUserScopedState()
    for (const key of USER_SCOPED_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull()
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) expect(localStorage.getItem(`${prefix}scenario-a`)).toBeNull()
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it("clears the previous account's run history, written and read through runHistory itself", () => {
    // Bound to the writer's own key, not the registry: a run A saved must not reach B's palette, ShareDrawer or restore.
    const runOfA = {
      id: 'run-of-a', ts: 1, seed: 7, adapter: 'httpv1', summary: "A's answer", graphHash: 'hash-a',
      report: { schema: 'report.v1' }, graph: { nodes: [{ id: 'a-private-factor' }], edges: [] },
    } as unknown as StoredRun
    saveRuns([runOfA])
    localStorage.setItem('feature.aiPanelV2', '1')
    expect(loadRuns().map(r => r.id)).toEqual(['run-of-a'])
    clearUserScopedState()
    expect(loadRuns()).toEqual([])
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it("clears the previous account's server acknowledgement, written and read through importRegistrationMarker", () => {
    // J1 ISO-1: after A -> B, `olumi.import.serverAcknowledged.v1` still named A's scenario. Bound to the marker's own
    // writer and reader, and to ISO-1's predicate: no stored value names A's scenario.
    const scenarioOfA = '9a9a9a9a-0000-4000-8000-a0a0a0a0a0a0'
    const nodes = [
      { id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow revenue' } },
      { id: 'opt', type: 'option', position: { x: 0, y: 100 }, data: { label: 'Raise prices' } },
    ]
    const edges = [{ id: 'e1', source: 'opt', target: 'goal', data: { weight: 0.5 } }]
    markGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never)
    expect(isGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never), 'precondition: A acknowledged').toBe(true)
    localStorage.setItem('feature.aiPanelV2', '1')
    clearUserScopedState()
    expect(isGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never)).toBe(false)
    const naming = Object.keys(localStorage).filter(k => (localStorage.getItem(k) ?? '').includes(scenarioOfA))
    expect(naming, "a stored value still names A's scenario").toEqual([])
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it('keeps the registry explicit so a new user-scoped persisted surface cannot hide in cleanup', () => {
    expect(new Set(USER_SCOPED_STORAGE_KEYS).size).toBe(USER_SCOPED_STORAGE_KEYS.length)
    expect(USER_SCOPED_STORAGE_PREFIXES.length).toBeGreaterThan(0)
  })
})
