/**
 * The trail that makes a lost pointer recoverable — and the proof that ONE
 * mechanism covers both triggers.
 *
 * Two symptoms, one cause: `olumi-canvas-current-scenario-id` is a single slot
 * and the only route back to a model. "Start new model" clears it
 * (`canvas/store.ts:3571` → `clearCurrentScenarioId`) and switching models
 * overwrites it (`canvas/store.ts:4654` → `setCurrentScenarioId`). Recording
 * the OUTGOING id inside those two functions serves the guest path and the
 * sign-in path at once.
 *
 * The last describe block is the load-bearing one: it exercises the guest
 * trigger and the sign-in trigger THROUGH THE SAME STORE FUNCTIONS, so if the
 * two ever stop sharing a mechanism these cases fail rather than quietly
 * passing against two implementations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  SCENARIO_TRAIL_KEY,
  SCENARIO_TRAIL_LIMIT,
  recordScenarioTrail,
  readScenarioTrail,
  latestScenarioTrail,
} from '../scenarioTrail'
import { setCurrentScenarioId, clearCurrentScenarioId } from '../../canvas/store/scenarios'
import { capturePendingGuestClaim, readPendingGuestClaim } from '../pendingGuestClaim'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'
const A = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const B = '9f8b7a6c-1234-4def-8abc-0123456789ab'
const C = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// Restores GLOBAL `Storage.prototype` stubs so they cannot outlive this file
// and break a sibling spec sharing the worker.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('scenarioTrail', () => {
  it('records ids most-recent-first', () => {
    recordScenarioTrail(A)
    recordScenarioTrail(B)

    expect(readScenarioTrail()).toEqual([B, A])
    expect(latestScenarioTrail()).toBe(B)
  })

  it('promotes a revisited id instead of duplicating it', () => {
    recordScenarioTrail(A)
    recordScenarioTrail(B)
    recordScenarioTrail(A)

    expect(readScenarioTrail()).toEqual([A, B])
  })

  it('is bounded', () => {
    for (let i = 0; i < SCENARIO_TRAIL_LIMIT + 5; i++) {
      recordScenarioTrail(`${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`)
    }
    expect(readScenarioTrail()).toHaveLength(SCENARIO_TRAIL_LIMIT)
  })

  it('ignores ids that cannot be server rows', () => {
    recordScenarioTrail('scenario-1712345678901-ab12cd')
    recordScenarioTrail(null)
    recordScenarioTrail(undefined)

    expect(readScenarioTrail()).toEqual([])
  })

  it('treats a corrupt trail as empty rather than throwing', () => {
    localStorage.setItem(SCENARIO_TRAIL_KEY, 'not json')
    expect(() => readScenarioTrail()).not.toThrow()
    expect(readScenarioTrail()).toEqual([])
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => recordScenarioTrail(A)).not.toThrow()
    expect(readScenarioTrail()).toEqual([])
  })
})

describe('the store writes the trail at the two places the pointer is lost', () => {
  it('TRIGGER 1 (guest, "Start new model"): clearing the pointer records it', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, A)

    clearCurrentScenarioId()

    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBeNull()
    expect(latestScenarioTrail()).toBe(A)
  })

  it('TRIGGER 2 (switching models): the DISPLACED id is recorded, not the new one', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, A)

    setCurrentScenarioId(B)

    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBe(B)
    // The id at risk is the one leaving, not the one arriving.
    expect(readScenarioTrail()).toEqual([A])
  })

  it('re-setting the same id records nothing', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, A)

    setCurrentScenarioId(A)

    expect(readScenarioTrail()).toEqual([])
  })

  it('setting a first-ever pointer records nothing', () => {
    setCurrentScenarioId(A)

    expect(readScenarioTrail()).toEqual([])
    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBe(A)
  })
})

describe('ONE mechanism: the sign-in capture consumes the same trail', () => {
  it('a guest who hits "Start new model" and THEN signs in is still recoverable', () => {
    // The exact sequence the two triggers combine into, and the reason these
    // are not two separate fixes. Without the trail the live pointer is gone by
    // sign-in time and the capture would find nothing.
    localStorage.setItem(CURRENT_SCENARIO_KEY, A)
    clearCurrentScenarioId() // "Start new model"

    expect(localStorage.getItem(CURRENT_SCENARIO_KEY)).toBeNull()

    expect(capturePendingGuestClaim()).toBe(A)
    expect(readPendingGuestClaim()).toBe(A)
  })

  it('a live pointer still wins over the trail', () => {
    recordScenarioTrail(A)
    localStorage.setItem(CURRENT_SCENARIO_KEY, C)

    expect(capturePendingGuestClaim()).toBe(C)
  })

  it('captures nothing when the browser has no history at all', () => {
    expect(capturePendingGuestClaim()).toBeNull()
  })
})
