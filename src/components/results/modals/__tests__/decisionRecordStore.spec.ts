/** Account-bound local retention and capture-specific acknowledgement. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDecisionRecords, observeDecisionRecordOwner, selectDecisionRecord,
  useDecisionRecordStore, type DecisionRecord,
} from '../decisionRecordStore'
import { UNSCOPED_SCENARIO_KEY } from '../scenarioKey'

const OWNER_KEY = 'decisionRecord.v2:owner'
const store = () => useDecisionRecordStore.getState()
const read = (key = 'scn_a') => selectDecisionRecord(store(), key)
const diskKeys = () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
const dataKeys = () => diskKeys().filter(k => k.includes(':record:'))
const remote = { recordId: 'dr_a', reviewDate: '2026-12-01T00:00:00.000Z', reviewDateSource: 'user_set' as const }
function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    optionId: 'opt_a', optionLabel: 'Hire a technical lead', optionNumber: 1, confidence: 70,
    rationale: 'Current reasoning', expectation: 'Faster delivery', assumptionToWatch: 'Hiring stays open',
    revisitTrigger: '2026-12-01', analysisHash: 'hash_1', savedAt: 1234, remote: null, ...overrides,
  }
}
async function anotherTab(owner: string | null = null) {
  vi.resetModules()
  const tab = await import('../decisionRecordStore')
  tab.observeDecisionRecordOwner(owner)
  return tab
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  store()._reset()
})
afterEach(() => { vi.restoreAllMocks() })

describe('local lifetime and exact scenario scope', () => {
  it('keeps latest record per scenario without replacing a different scenario', () => {
    store().saveRecord('scn_a', record())
    store().saveRecord('scn_a', record({ optionId: 'opt_b' }))
    store().saveRecord('scn_b', record({ optionId: 'opt_c' }))
    expect(read()?.optionId).toBe('opt_b')
    expect(read('scn_b')?.optionId).toBe('opt_c')
    expect(read('absent')).toBeNull()
  })
  it('round-trips the complete record and analysis hash', () => {
    store().saveRecord('scn_a', record())
    useDecisionRecordStore.setState({ byScenario: {} })
    expect(read()).toBeNull()
    store()._rehydrateForTests()
    expect(read()).toEqual(record())
  })
  it('uses separate versioned records and ignores an unknown version', () => {
    store().saveRecord('scn_a', record(), 'capture-a')
    const key = dataKeys()[0]
    expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ version: 2, scenarioKey: 'scn_a', clientCommitId: 'capture-a' })
    localStorage.setItem(key, JSON.stringify({ version: 99, scenarioKey: 'scn_a', record: record() }))
    store()._rehydrateForTests()
    expect(read()).toBeNull()
  })
  it('ignores corrupt record payloads', () => {
    store().saveRecord('scn_a', record())
    localStorage.setItem(dataKeys()[0], 'not json')
    store()._rehydrateForTests()
    expect(read()).toBeNull()
  })
  it('reset clears notes from memory and storage, not unrelated application data', () => {
    store().saveRecord('scn_a', record())
    localStorage.setItem('unrelated', 'retain me')
    store()._reset()
    expect(store().byScenario).toEqual({})
    expect(dataKeys()).toEqual([])
    expect(localStorage.getItem('unrelated')).toBe('retain me')
  })
  it('survives tab-close session storage clearing, without writing there', () => {
    store().saveRecord('scn_a', record())
    expect(sessionStorage.length).toBe(0)
    sessionStorage.clear()
    useDecisionRecordStore.setState({ byScenario: {} })
    store()._rehydrateForTests()
    expect(read()).toEqual(record())
  })
  it('does not survive clearing its actual durable store (opposite control)', () => {
    store().saveRecord('scn_a', record())
    localStorage.clear()
    store()._rehydrateForTests()
    expect(read()).toBeNull()
  })
  it('unscoped records remain memory-only while a named scenario survives reload', () => {
    store().saveRecord(UNSCOPED_SCENARIO_KEY, record())
    expect(read(UNSCOPED_SCENARIO_KEY)).toEqual(record())
    expect(dataKeys()).toHaveLength(0)
    store().saveRecord('scn_a', record())
    expect(dataKeys()).toHaveLength(1)
    store()._rehydrateForTests()
    expect(read(UNSCOPED_SCENARIO_KEY)).toBeNull()
    expect(read()).toEqual(record())
  })
})

describe('resolved identity and revocation', () => {
  it('fresh module exposes nothing until owner resolves, then restores the same account', async () => {
    observeDecisionRecordOwner('account-a')
    store().saveRecord('scn_a', record())
    vi.resetModules()
    const fresh = await import('../decisionRecordStore')
    expect(fresh.useDecisionRecordStore.getState().byScenario).toEqual({})
    fresh.observeDecisionRecordOwner('account-a')
    expect(fresh.useDecisionRecordStore.getState().byScenario.scn_a).toEqual(record())
  })
  it('fresh module with empty storage restores nothing (positive restore twin)', async () => {
    localStorage.clear()
    const fresh = await anotherTab('account-a')
    expect(fresh.useDecisionRecordStore.getState().byScenario).toEqual({})
  })
  it('quarantines ownerless v1 notes without exposing or erasing them on ordinary adoption', async () => {
    localStorage.removeItem(OWNER_KEY)
    const legacy = JSON.stringify({ version: 1, byScenario: { scn_a: record() } })
    localStorage.setItem('decisionRecord.v1', legacy)
    const fresh = await anotherTab('account-a')
    expect(fresh.useDecisionRecordStore.getState().byScenario).toEqual({})
    expect(localStorage.getItem('decisionRecord.v1')).toBe(legacy)
    fresh.clearDecisionRecords()
    expect(localStorage.getItem('decisionRecord.v1')).toBeNull()
  })
  it('account A to B clears memory, disk and account proof even for the same scenario', () => {
    observeDecisionRecordOwner('account-a')
    const capture = store().saveRecord('scn_a', record())!
    expect(store().attachRemote('scn_a', capture, remote)).toBe(true)
    store().open()
    observeDecisionRecordOwner('account-b')
    expect(store().byScenario).toEqual({})
    expect(store().isOpen).toBe(false)
    expect(dataKeys()).toEqual([])
    expect(store().attachRemote('scn_a', capture, remote)).toBe(false)
    expect(store().saveRecord('scn_a', record({ rationale: 'B owns this' }))).not.toBeNull()
    expect(read()?.rationale).toBe('B owns this')
  })
  it('sign-out revokes a stale tab even before its storage event arrives', async () => {
    observeDecisionRecordOwner('account-a')
    const capture = store().saveRecord('scn_a', record())!
    const tab = await anotherTab('account-a')
    tab.clearDecisionRecords()
    tab.observeDecisionRecordOwner('account-b')
    expect(store().attachRemote('scn_a', capture, remote)).toBe(false)
    expect(store().saveRecord('scn_a', record())).toBeNull()
    expect(store().byScenario).toEqual({})
    expect(dataKeys()).toEqual([])
  })
  it('storage revocation clears an idle old tab without another save', async () => {
    observeDecisionRecordOwner('account-a')
    store().saveRecord('scn_a', record())
    const tab = await anotherTab('account-a')
    tab.clearDecisionRecords()
    window.dispatchEvent(new StorageEvent('storage', { key: OWNER_KEY }))
    expect(store().byScenario).toEqual({})
  })
  it('sign-out interleaved inside a write cannot repopulate revoked data', () => {
    observeDecisionRecordOwner('account-a')
    const original = Storage.prototype.setItem
    let crossed = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (!crossed && key.includes(':record:')) {
        crossed = true
        clearDecisionRecords()
      }
      original.call(this, key, value)
    })
    expect(store().saveRecord('scn_a', record())).toBeNull()
    expect(crossed).toBe(true)
    expect(dataKeys()).toEqual([])
    expect(store().byScenario).toEqual({})
  })
  it('corrupt owner metadata fails closed, not as a blocked-storage exception', () => {
    const capture = store().saveRecord('scn_a', record())!
    localStorage.setItem(OWNER_KEY, 'not json')
    expect(store().attachRemote('scn_a', capture, remote)).toBe(false)
    expect(store().saveRecord('scn_a', record())).toBeNull()
  })
  it('blocked storage does not claim a scoped record was kept; sign-out still clears memory', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    observeDecisionRecordOwner('account-a')
    expect(store().saveRecord('scn_a', record())).toBeNull()
    expect(read()).toBeNull()
    expect(store().saveRecord(UNSCOPED_SCENARIO_KEY, record())).not.toBeNull()
    expect(read(UNSCOPED_SCENARIO_KEY)?.optionId).toBe('opt_a')
    clearDecisionRecords()
    expect(read()).toBeNull()
    expect(read(UNSCOPED_SCENARIO_KEY)).toBeNull()
  })
})

describe('cross-tab interleavings and exact acknowledgement identity', () => {
  it.each(['initial', 'account-switch'] as const)('concurrent same-owner adoption keeps both scenarios (%s)', async (mode) => {
    if (mode === 'initial') localStorage.clear()
    else observeDecisionRecordOwner('previous-account')
    vi.resetModules()
    const tab = await import('../decisionRecordStore')
    const original = Storage.prototype.setItem
    let crossed = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === OWNER_KEY && !crossed) {
        crossed = true
        tab.observeDecisionRecordOwner('account-a')
        expect(tab.useDecisionRecordStore.getState().saveRecord('scn_b', record({ optionId: 'opt_b' }))).not.toBeNull()
        expect(tab.useDecisionRecordStore.getState().byScenario.scn_b?.optionId).toBe('opt_b')
      }
      original.call(this, key, value)
    })
    observeDecisionRecordOwner('account-a')
    expect(crossed).toBe(true)
    expect(store().saveRecord('scn_a', record())).not.toBeNull()
    store()._rehydrateForTests()
    expect(read()?.optionId).toBe('opt_a')
    expect(read('scn_b')?.optionId).toBe('opt_b')
  })

  it('overlapping writes to different scenarios both survive: A begins, B writes, A completes', async () => {
    const tab = await anotherTab()
    const original = Storage.prototype.setItem
    let crossed = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (!crossed && key.includes(':record:')) {
        crossed = true
        tab.useDecisionRecordStore.getState().saveRecord('scn_b', record({ optionId: 'opt_b' }))
      }
      original.call(this, key, value)
    })
    store().saveRecord('scn_a', record())
    expect(crossed).toBe(true)
    expect(dataKeys()).toHaveLength(2)
    store()._rehydrateForTests()
    expect(read()?.optionId).toBe('opt_a')
    expect(read('scn_b')?.optionId).toBe('opt_b')
  })
  it('late A success cannot confirm newer B after B network failure', async () => {
    const captureA = store().saveRecord('scn_a', record(), 'request-a')!
    const tab = await anotherTab()
    const captureB = tab.useDecisionRecordStore.getState().saveRecord('scn_a', record({ optionId: 'opt_b' }), 'request-b')!
    expect(store().attachRemote('scn_a', captureA, remote)).toBe(false)
    store()._rehydrateForTests()
    expect(read()?.optionId).toBe('opt_b')
    expect(read()?.remote).toBeNull()
    expect(tab.useDecisionRecordStore.getState().attachRemote('scn_a', captureB, { ...remote, recordId: 'dr_b' })).toBe(true)
    store()._rehydrateForTests()
    expect(read()?.remote?.recordId).toBe('dr_b')
  })
  it('B capture inside A acknowledgement write never inherits A account proof', async () => {
    const captureA = store().saveRecord('scn_a', record(), 'request-a')!
    const tab = await anotherTab()
    const original = Storage.prototype.setItem
    let crossed = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (!crossed && key.includes(':ack:')) {
        crossed = true
        tab.useDecisionRecordStore.getState().saveRecord('scn_a', record({ optionId: 'opt_b' }), 'request-b')
      }
      original.call(this, key, value)
    })
    expect(store().attachRemote('scn_a', captureA, remote)).toBe(false)
    expect(crossed).toBe(true)
    store()._rehydrateForTests()
    expect(read()?.optionId).toBe('opt_b')
    expect(read()?.remote).toBeNull()
  })
  it('valid acknowledgement persists while preserving another scenario and refusing a missing record', async () => {
    const capture = store().saveRecord('scn_a', record(), 'request-a')!
    const tab = await anotherTab()
    tab.useDecisionRecordStore.getState().saveRecord('scn_b', record({ optionId: 'opt_b' }))
    expect(store().attachRemote('scn_a', capture, remote)).toBe(true)
    expect(store().attachRemote('absent', capture, remote)).toBe(false)
    store()._rehydrateForTests()
    expect(read()?.remote).toEqual(remote)
    expect(read('scn_b')?.optionId).toBe('opt_b')
  })
  it('deleted durable capture cannot fall back to stale memory for acknowledgement', () => {
    const capture = store().saveRecord('scn_a', record())!
    localStorage.removeItem(dataKeys()[0])
    expect(store().attachRemote('scn_a', capture, remote)).toBe(false)
  })
})
