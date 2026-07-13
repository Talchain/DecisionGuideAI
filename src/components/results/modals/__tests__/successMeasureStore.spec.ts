/**
 * successMeasureStore — scenario-keyed sessionStorage persistence
 * (strengthenStore pattern: manual, version-keyed, degrade on storage
 * failure).
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  selectSuccessMeasure,
  useSuccessMeasureStore,
  type SuccessMeasure,
} from '../successMeasureStore'
import { resolveScenarioKey, UNSCOPED_SCENARIO_KEY } from '../scenarioKey'

const STORAGE_KEY = 'defineSuccess.measure.v1'

function measure(overrides: Partial<SuccessMeasure> = {}): SuccessMeasure {
  return {
    metric: 'Productivity',
    direction: 'increase_by_at_least',
    threshold: 20,
    unit: '%',
    timeframe: 'Within 6 months',
    baseline: null,
    savedAt: 1234,
    ...overrides,
  }
}

beforeEach(() => {
  useSuccessMeasureStore.getState()._reset()
  sessionStorage.clear()
})

describe('successMeasureStore', () => {
  it('saves per scenario without collisions', () => {
    const store = useSuccessMeasureStore.getState()
    store.saveMeasure('scn_a', measure({ metric: 'Revenue' }))
    store.saveMeasure('scn_b', measure({ metric: 'Churn', direction: 'keep_below' }))

    const state = useSuccessMeasureStore.getState()
    expect(selectSuccessMeasure(state, 'scn_a')?.metric).toBe('Revenue')
    expect(selectSuccessMeasure(state, 'scn_b')?.metric).toBe('Churn')
    expect(selectSuccessMeasure(state, 'scn_c')).toBeNull()
  })

  it('round-trips through sessionStorage (simulated reload)', () => {
    useSuccessMeasureStore.getState().saveMeasure('scn_a', measure())

    // Wipe the in-memory copy, then rehydrate from storage.
    useSuccessMeasureStore.setState({ byScenario: {} })
    expect(selectSuccessMeasure(useSuccessMeasureStore.getState(), 'scn_a')).toBeNull()

    useSuccessMeasureStore.getState()._rehydrateForTests()
    expect(selectSuccessMeasure(useSuccessMeasureStore.getState(), 'scn_a')).toEqual(measure())
  })

  it('persists a version-keyed payload and ignores unknown versions', () => {
    useSuccessMeasureStore.getState().saveMeasure('scn_a', measure())
    const raw = sessionStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).version).toBe(1)

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 99, byScenario: { scn_a: measure() } }),
    )
    useSuccessMeasureStore.getState()._rehydrateForTests()
    expect(selectSuccessMeasure(useSuccessMeasureStore.getState(), 'scn_a')).toBeNull()
  })

  it('ignores corrupt storage payloads', () => {
    sessionStorage.setItem(STORAGE_KEY, 'not json {')
    useSuccessMeasureStore.getState()._rehydrateForTests()
    expect(useSuccessMeasureStore.getState().byScenario).toEqual({})
  })

  it('_reset clears memory and storage', () => {
    useSuccessMeasureStore.getState().saveMeasure('scn_a', measure())
    useSuccessMeasureStore.getState()._reset()
    expect(useSuccessMeasureStore.getState().byScenario).toEqual({})
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('open/close drive the modal visibility flag', () => {
    expect(useSuccessMeasureStore.getState().isOpen).toBe(false)
    useSuccessMeasureStore.getState().open()
    expect(useSuccessMeasureStore.getState().isOpen).toBe(true)
    useSuccessMeasureStore.getState().close()
    expect(useSuccessMeasureStore.getState().isOpen).toBe(false)
  })
})

describe('resolveScenarioKey', () => {
  it('falls back to the unscoped key for null/empty scenario ids', () => {
    expect(resolveScenarioKey(null)).toBe(UNSCOPED_SCENARIO_KEY)
    expect(resolveScenarioKey(undefined)).toBe(UNSCOPED_SCENARIO_KEY)
    expect(resolveScenarioKey('')).toBe(UNSCOPED_SCENARIO_KEY)
    expect(resolveScenarioKey('scn_1')).toBe('scn_1')
  })
})
