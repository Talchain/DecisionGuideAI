/**
 * decisionRecordStore — scenario-keyed `localStorage` persistence.
 *
 * ⚠ THE HEADER USED TO SAY "sessionStorage … prototype-only … no backend
 * persistence exists". Both halves had gone stale: the durable half of the
 * record commits to CEE (`attachRemote`), and the local half moved to
 * `localStorage` on 7 Sep 2026 so that a record survives the tab closing.
 *
 * ⭐ THE LIFETIME IS THE PROPERTY UNDER TEST, NOT THE API NAME. A suite that
 * only swapped `sessionStorage` for `localStorage` throughout would be green on
 * a store that had not changed behaviour at all — the two APIs are identical in
 * shape. `a record survives the tab closing` below is the assertion that can
 * only pass on the new store: it clears sessionStorage and nothing else.
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
  // Both, deliberately: `_reset` should leave neither store holding a record,
  // and clearing only the one under test would hide a write to the other.
  localStorage.clear()
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

  it('round-trips through storage (simulated reload) including the analysis hash', () => {
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
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw as string).version).toBe(1)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, byScenario: { scn_a: record() } }),
    )
    useDecisionRecordStore.getState()._rehydrateForTests()
    expect(selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')).toBeNull()
  })

  it('ignores corrupt storage payloads', () => {
    localStorage.setItem(STORAGE_KEY, '¬ not json')
    useDecisionRecordStore.getState()._rehydrateForTests()
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
  })

  it('_reset clears memory and storage', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())
    useDecisionRecordStore.getState()._reset()
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  /**
   * ⭐⭐ THE CAPABILITY, AND THE ONLY TEST HERE THAT COULD NOT PASS BEFORE.
   *
   * "Record what you decided, and read it back when you come back" is worthless
   * if the record dies with the tab. `sessionStorage.clear()` is the closest a
   * jsdom suite gets to closing the tab — it is precisely what the browser does
   * to that store and to nothing else — so a record that survives it is a
   * record that survives the visit.
   *
   * ⚠ IT ASSERTS BOTH DIRECTIONS ON PURPOSE. The survival alone would pass on a
   * store that wrote to BOTH; the second half pins that sessionStorage is not
   * being written at all, so the claim "on this device" is about one store whose
   * lifetime we have actually checked.
   */
  it('a record survives the tab closing (sessionStorage cleared, record intact)', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())

    expect(
      sessionStorage.getItem(STORAGE_KEY),
      'the record must not be written to sessionStorage — that store dies with the tab',
    ).toBeNull()

    sessionStorage.clear()
    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()

    expect(selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')).toEqual(record())
  })

  /**
   * ⚠ THE DISCRIMINATION FOR THE TEST ABOVE. Clearing sessionStorage proves
   * survival only if clearing the store the record IS in destroys it — without
   * this, the survival test would also pass on a store that persisted nothing
   * and returned a stale in-memory value.
   */
  it('…and does NOT survive localStorage being cleared — the twin', () => {
    useDecisionRecordStore.getState().saveRecord('scn_a', record())

    localStorage.clear()
    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()

    expect(selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_a')).toBeNull()
  })
})
