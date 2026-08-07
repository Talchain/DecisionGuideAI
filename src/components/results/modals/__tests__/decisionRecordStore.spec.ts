/**
 * decisionRecordStore — scenario-keyed sessionStorage persistence for the
 * prototype-only decision record (no backend persistence exists).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  selectDecisionRecord,
  useDecisionRecordStore,
  type DecisionRecord,
} from '../decisionRecordStore'

const STORAGE_KEY = 'decisionRecord.v1'

function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    optionId: 'opt_1',
    optionLabel: 'Bring on technical co-founder',
    optionNumber: 1,
    confidence: 70,
    rationale: 'Best current choice.',
    assumptionToWatch: 'Hiring market stays open.',
    revisitTrigger: 'Runway falls below 9 months',
    analysisHash: 'hash_1',
    savedAt: 1234,
    ...overrides,
  }
}

beforeEach(() => {
  useDecisionRecordStore.getState()._reset()
  sessionStorage.clear()
})

describe('decisionRecordStore', () => {
  it('saves one record per scenario, latest wins', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord('scn_a', record())
    store.saveRecord('scn_a', record({ optionId: 'opt_2', optionLabel: 'Outsource' }))
    store.saveRecord('scn_b', record({ optionId: 'opt_3' }))

    const state = useDecisionRecordStore.getState()
    expect(selectDecisionRecord(state, 'scn_a')?.optionId).toBe('opt_2')
    expect(selectDecisionRecord(state, 'scn_b')?.optionId).toBe('opt_3')
    expect(selectDecisionRecord(state, 'scn_c')).toBeNull()
  })

  it('round-trips through sessionStorage (simulated reload) including the analysis hash', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())

    useDecisionRecordStore.setState({ byScenario: {} })
    expect(selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')).toBeNull()

    useDecisionRecordStore.getState()._rehydrateForTests()
    const restored = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')
    expect(restored).toEqual(record())
    expect(restored?.analysisHash).toBe('hash_1')
  })

  it('persists a version-keyed payload and ignores unknown versions', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())
    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw as string).version).toBe(1)

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, byScenario: { scn_a: record() } }),
    )
    useDecisionRecordStore.getState()._rehydrateForTests()
    expect(selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')).toBeNull()
  })

  it('ignores corrupt storage payloads', () => {
    sessionStorage.setItem(STORAGE_KEY, '¬ not json')
    useDecisionRecordStore.getState()._rehydrateForTests()
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
  })

  it('_reset clears memory and storage', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())
    useDecisionRecordStore.getState()._reset()
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
