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
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  selectDecisionRecord,
  useDecisionRecordStore,
  type DecisionRecord,
} from '../decisionRecordStore'
import { UNSCOPED_SCENARIO_KEY } from '../scenarioKey'

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

/**
 * ⭐⭐⭐ WHAT `localStorage` BOUGHT ALONG WITH THE LIFETIME.
 *
 * `sessionStorage` is per-tab and dies with it, which hid two properties that
 * `localStorage` makes reachable and permanent. Neither was a bug in the move;
 * both are what the move exposed, and both are cross-user or cross-tab, which
 * is why they get their own block rather than a line in the round-trip test.
 */
describe('the shared, permanent store does not leak between people or tabs', () => {
  /**
   * ⭐⭐ THE UNSCOPED KEY IS NEVER WRITTEN TO DURABLE STORAGE.
   *
   * `resolveScenarioKey` folds "no scenario yet" onto the single literal
   * `__unscoped__`. Under `sessionStorage` that shared slot was bounded by the
   * tab. Under `localStorage` it would be a PERMANENT, browser-global,
   * identity-independent slot — so a decision captured on an unsaved canvas
   * would be read back, indefinitely, by the next person to open an unsaved
   * canvas in that browser profile, and rendered to them as "for this
   * scenario".
   *
   * ⚠ AND NO SIGN-OUT HOOK COULD CLOSE IT. On the deployed staging posture
   * (`VITE_AUTH_MODE = "guest"`) the optional-auth `signOut` opens
   * `if (!session) return`, so a visitor who never signed in never runs a
   * sign-out path at all. Two guests on one machine are one identity to this
   * product; not writing the shared key is the only defence at this layer.
   */
  it('an unscoped record is held in memory but never written to localStorage', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord(UNSCOPED_SCENARIO_KEY, record({ optionId: 'opt_unscoped' }))

    // It is usable in this session — the capability is not withdrawn.
    expect(
      selectDecisionRecord(useDecisionRecordStore.getState(), UNSCOPED_SCENARIO_KEY)?.optionId,
    ).toBe('opt_unscoped')

    // …and it is not on disk for the next person.
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw === null || !JSON.parse(raw).byScenario[UNSCOPED_SCENARIO_KEY]).toBe(true)
  })

  /**
   * ⚠ THE POSITIVE CONTROL. "Not in storage" would pass on a store that had
   * stopped persisting ANYTHING — an absence assertion with no proof it can
   * see a presence (CLAUDE.md trap 13). Same call, one argument different.
   */
  it('…while a scenario-keyed record IS written (control)', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord('scn_real', record({ optionId: 'opt_real' }))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).byScenario.scn_real.optionId).toBe('opt_real')
  })

  /**
   * ⚠ AND IT DOES NOT SURVIVE A RELOAD — the property that makes it safe. The
   * in-memory copy above is the whole of its life.
   */
  it('an unscoped record is gone after a reload; a scenario-keyed one is not', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord(UNSCOPED_SCENARIO_KEY, record({ optionId: 'opt_unscoped' }))
    store.saveRecord('scn_real', record({ optionId: 'opt_real' }))

    useDecisionRecordStore.getState()._rehydrateForTests()

    const after = useDecisionRecordStore.getState()
    expect(selectDecisionRecord(after, UNSCOPED_SCENARIO_KEY)).toBeNull()
    expect(selectDecisionRecord(after, 'scn_real')?.optionId).toBe('opt_real')
  })

  /**
   * ⭐⭐ TWO TABS DO NOT CLOBBER EACH OTHER.
   *
   * The store reads `localStorage` ONCE (the `...loadPersisted()` spread in the
   * factory) and has no `storage` listener, and every save writes the WHOLE
   * `byScenario` map back. Under `sessionStorage` that was safe by
   * construction. Under `localStorage` a second tab's save would stamp its own
   * minutes-old snapshot over the shared map and silently delete the first
   * tab's record — while both users were told "Decision recorded on this
   * device."
   *
   * ⚠ THE OTHER TAB IS SIMULATED AT THE STORAGE LAYER, WHICH IS THE ONLY
   * HONEST WAY TO DO IT IN JSDOM: a second tab is precisely a second module
   * instance whose writes this one cannot see. Writing the key directly IS
   * what that other tab does.
   */
  it('a save merges onto what is on disk now, not this tab’s stale snapshot', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord('scn_tab_a', record({ optionId: 'opt_a' }))

    // ── another tab, same profile, different scenario ──
    const onDisk = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    onDisk.byScenario.scn_tab_b = record({ optionId: 'opt_b' })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(onDisk))

    // ── back in this tab, which never saw that write ──
    useDecisionRecordStore.getState().saveRecord('scn_tab_c', record({ optionId: 'opt_c' }))

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) as string).byScenario
    expect(persisted.scn_tab_c.optionId).toBe('opt_c')
    expect(persisted.scn_tab_a.optionId).toBe('opt_a')
    expect(
      persisted.scn_tab_b?.optionId,
      'the other tab’s record was overwritten by this tab’s stale snapshot',
    ).toBe('opt_b')
  })

  /**
   * ⚠ THE SAME PROPERTY FOR `attachRemote`, which has the identical whole-map
   * write. Two writers, one map — closing one and leaving the other would be a
   * guard watching one door.
   */
  it('attachRemote merges onto disk too', () => {
    const store = useDecisionRecordStore.getState()
    store.saveRecord('scn_tab_a', record({ optionId: 'opt_a' }))

    const onDisk = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    onDisk.byScenario.scn_tab_b = record({ optionId: 'opt_b' })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(onDisk))

    useDecisionRecordStore.getState().attachRemote('scn_tab_a', {
      recordId: 'dr_1',
      reviewDate: '2026-12-01T00:00:00.000Z',
      reviewDateSource: 'user_set',
    })

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) as string).byScenario
    expect(persisted.scn_tab_a.remote.recordId).toBe('dr_1')
    expect(persisted.scn_tab_b?.optionId).toBe('opt_b')
  })
})

/**
 * ⭐⭐⭐ THE PRODUCTION READ PATH, WHICH NOTHING EXERCISED.
 *
 * Every survival test above rehydrates through `_rehydrateForTests`. That seam
 * is a TEST seam: the path a real returning user takes is the
 * `...loadPersisted()` spread evaluated ONCE when the module is first
 * imported. It is the headline capability's actual mechanism — "come back
 * tomorrow and your decision is still there" — and it had no guard at all, so
 * deleting the spread would have left every survival test green.
 *
 * ⚠ THE ONLY WAY TO EXERCISE IT IS A FRESH MODULE INSTANCE. `vi.resetModules()`
 * plus a dynamic import re-runs the factory, which is exactly what a page load
 * does; calling anything on the already-imported store cannot reach it.
 */
describe('the read path a returning user actually takes', () => {
  it('a fresh module instance picks up a record written before it loaded', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        byScenario: { scn_yesterday: record({ optionId: 'opt_from_yesterday' }) },
      }),
    )

    vi.resetModules()
    const fresh = await import('../decisionRecordStore')

    expect(
      fresh.selectDecisionRecord(fresh.useDecisionRecordStore.getState(), 'scn_yesterday')
        ?.optionId,
      'the store factory did not read localStorage at import — the capability is dark',
    ).toBe('opt_from_yesterday')
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. The assertion above would also pass on a module
   * that somehow inherited state from this test file rather than reading
   * storage. With storage empty, a fresh instance must be empty.
   */
  it('…and a fresh module instance with empty storage holds nothing (twin)', async () => {
    localStorage.clear()
    vi.resetModules()
    const fresh = await import('../decisionRecordStore')
    expect(fresh.useDecisionRecordStore.getState().byScenario).toEqual({})
  })
})
