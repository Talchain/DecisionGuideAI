/**
 * Pending guest copy — the capture half of ACCOUNTS B3 (ported from
 * `lane/pending-guest-claim`'s pendingGuestClaim.spec.ts; the trail rows are not
 * ported because the trail is not).
 *
 * WRITE-ONCE is the load-bearing property: a second sign-in must not overwrite a
 * pending capture, or the first guest model is discarded.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  PENDING_GUEST_COPY_KEY,
  capturePendingGuestCopy,
  readPendingGuestCopy,
  clearPendingGuestCopy,
  forgetPendingGuestCopyOnSignOut,
} from '../pendingGuestCopy'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

const GUEST_SCENARIO = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SECOND_SCENARIO = '9f8b7a6c-1234-4def-8abc-0123456789ab'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// The storage-unavailable row stubs `Storage.prototype`, which is GLOBAL: only
// `afterEach` keeps a sibling spec in the same worker from inheriting it.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('capturePendingGuestCopy', () => {
  it('captures the live scenario pointer', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)

    expect(capturePendingGuestCopy()).toBe(GUEST_SCENARIO)
    expect(readPendingGuestCopy()).toBe(GUEST_SCENARIO)
  })

  it('survives the pointer being overwritten by opening another scenario', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestCopy()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(readPendingGuestCopy()).toBe(GUEST_SCENARIO)
  })

  it('survives the pointer being cleared by "start fresh"', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestCopy()

    localStorage.removeItem(CURRENT_SCENARIO_KEY)

    expect(readPendingGuestCopy()).toBe(GUEST_SCENARIO)
  })

  it('is WRITE-ONCE: a second sign-in never overwrites a pending capture', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestCopy()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)
    const second = capturePendingGuestCopy()

    expect(second).toBe(GUEST_SCENARIO)
    expect(readPendingGuestCopy()).toBe(GUEST_SCENARIO)
  })

  it('captures again once the pending copy has been cleared', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestCopy()
    clearPendingGuestCopy()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(capturePendingGuestCopy()).toBe(SECOND_SCENARIO)
    expect(readPendingGuestCopy()).toBe(SECOND_SCENARIO)
  })

  it('records nothing when the visitor built no model', () => {
    expect(capturePendingGuestCopy()).toBeNull()
    expect(readPendingGuestCopy()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('records nothing for a legacy non-UUID pointer, which can never be a server row', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, 'scenario-1712345678901-ab12cd')

    expect(capturePendingGuestCopy()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const boom = () => {
      throw new Error('QuotaExceededError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)

    expect(() => capturePendingGuestCopy()).not.toThrow()
    expect(() => readPendingGuestCopy()).not.toThrow()
    expect(() => clearPendingGuestCopy()).not.toThrow()
    expect(capturePendingGuestCopy()).toBeNull()
    expect(readPendingGuestCopy()).toBeNull()
  })

  it('uses a key distinct from the live pointer', () => {
    expect(PENDING_GUEST_COPY_KEY).not.toBe(CURRENT_SCENARIO_KEY)
  })
})

describe('forgetPendingGuestCopyOnSignOut (owner ruling: no surprise copy into the next account)', () => {
  it('drops what was pending, and the same pointer is NOT re-captured by the next sign-in', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestCopy() // user A signed in; the copy was kept by a 503

    forgetPendingGuestCopyOnSignOut() // A signs out

    expect(readPendingGuestCopy()).toBeNull()
    expect(capturePendingGuestCopy()).toBeNull() // user B signs in on the same browser
    expect(readPendingGuestCopy()).toBeNull()
  })

  it('CONTRAST: a NEW decision started after the sign-out IS captured for the next sign-in', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    forgetPendingGuestCopyOnSignOut()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(capturePendingGuestCopy()).toBe(SECOND_SCENARIO)
  })
})
