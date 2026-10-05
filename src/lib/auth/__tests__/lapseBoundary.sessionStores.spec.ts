/**
 * LAPSE-FC × the session-backed stores (Codex, #2534 r1 P1-1). The success measure and the Strengthen findings persist
 * in SESSIONstorage, so a lapse in the same tab (the refresh fails, the next reload is a guest's) still holds them. The
 * full boundary clears them through each store's `_reset`; the fallback runs without those stores, so its sweep must
 * name the blobs itself, or a slow or failed chunk hands the guest A's measure and A's active findings.
 *
 * Real writers → the boundary → FRESH stores (`vi.resetModules`: the next page evaluates the modules again).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'
import type { SuccessMeasure } from '../../../components/results/modals/successMeasureStore'

const SCENARIO = '11111111-2222-4333-8444-555555555555'
const A_METRIC = 'Enterprise prospect signing likelihood'
const measure: SuccessMeasure = {
  metric: A_METRIC, direction: 'reach_at_least', threshold: 60, unit: '%', timeframe: 'Q4', baseline: null, savedAt: 1,
}
const finding: Recommendation = {
  id: 'r-a', helpType: 'clarify', title: `Test ${A_METRIC}`, signal: 'signal', whyNow: 'why now', tryThis: 'try this',
  sourceLine: 'Source: test.', action: { kind: 'ai-dialogue', label: 'Work through', actionType: 'discuss', prompt: 'p' },
  targetId: null, priority: 10,
}

/** A new page: every module evaluates again and reads storage afresh. */
async function freshStores() {
  vi.resetModules()
  const { useSuccessMeasureStore } = await import('../../../components/results/modals/successMeasureStore')
  const { useStrengthenStore, selectActive } = await import('../../../canvas/stores/strengthenStore')
  return {
    measures: useSuccessMeasureStore.getState().byScenario,
    activeFindings: selectActive(useStrengthenStore.getState()),
  }
}

/** A signed-in page in this tab records the sign-in and writes A's measure and findings through the real writers. */
async function signedInTabWritesAsWork(): Promise<void> {
  const { markSignedInHere } = await import('../lapseBoundary')
  markSignedInHere()
  const { useSuccessMeasureStore } = await import('../../../components/results/modals/successMeasureStore')
  const { useStrengthenStore } = await import('../../../canvas/stores/strengthenStore')
  useSuccessMeasureStore.getState().saveMeasure(SCENARIO, measure)
  useStrengthenStore.getState().reconcile([finding], 'hash-a', SCENARIO)
  // PRECONDITION: the next page in this tab reads A's work back (the session lapses; no stored session is involved).
  const before = await freshStores()
  expect(before.measures[SCENARIO]?.metric).toBe(A_METRIC)
  expect(before.activeFindings.map((r) => r.snapshot.id)).toEqual(['r-a'])
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()
})
afterEach(() => { vi.restoreAllMocks() })

describe('LAPSE-FC — the fallback clears the session-backed stores', () => {
  const hanging = () => new Promise<never>(() => { /* never settles */ })
  const failing = () => Promise.reject(new Error('chunk failed'))

  it.each([['never settles', hanging], ['fails to load', failing]] as const)(
    '⭐ a chunk that %s: the next page has none of A\'s success measure and no active finding',
    async (_label, loadBoundary) => {
      await signedInTabWritesAsWork()
      vi.resetModules()
      const { runLapseBoundaryIfNeeded } = await import('../lapseBoundary')
      expect(await runLapseBoundaryIfNeeded(loadBoundary, 40)).toBe(true)
      const after = await freshStores()
      expect(after.measures).toEqual({})
      expect(after.activeFindings).toEqual([])
    }, 5_000)

  it('CONTROL — the full boundary (its chunk loads) leaves the same: no measure, no active finding', async () => {
    await signedInTabWritesAsWork()
    vi.resetModules()
    const { runLapseBoundaryIfNeeded } = await import('../lapseBoundary')
    expect(await runLapseBoundaryIfNeeded()).toBe(true)
    const after = await freshStores()
    expect(after.measures).toEqual({})
    expect(after.activeFindings).toEqual([])
  }, 5_000)
})
