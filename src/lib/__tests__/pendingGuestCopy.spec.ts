/**
 * Pending guest copies — the capture half of ACCOUNTS B3, as S-G (7 Oct) changed it: what is captured is the guest's
 * RECENT work from the ledger (`guestWork.ts`), as a set; the bare pointer is offered, never captured.
 *
 * NEVER DROPPED is the load-bearing property: a later sign-in must not discard a pending capture, or that guest model
 * is lost. The capture/offer split itself is pinned in `guestWork.spec.ts`; the end-to-end sign-in rows in
 * `guestContinuity.signIn.spec.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => false }))

import {
  PENDING_GUEST_COPIES_KEY,
  PENDING_GUEST_COPY_KEY,
  capturePendingGuestCopies,
  readPendingGuestCopies,
  clearPendingGuestCopy,
  forgetPendingGuestCopyOnSignOut,
} from '../pendingGuestCopy'
import { noteGuestWork, readGuestWork } from '../guestWork'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

const GUEST_SCENARIO = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SECOND_SCENARIO = '9f8b7a6c-1234-4def-8abc-0123456789ab'

/** The guest worked on `id` a minute ago, with the pointer on it (what a guest turn leaves behind). */
function workedOn(id: string) {
  localStorage.setItem(CURRENT_SCENARIO_KEY, id)
  noteGuestWork(id, null, Date.now() - 60_000)
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

// The storage-unavailable row stubs `Storage.prototype`, which is GLOBAL: only
// `afterEach` keeps a sibling spec in the same worker from inheriting it.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('capturePendingGuestCopies', () => {
  it('captures the decision the guest just worked on', () => {
    workedOn(GUEST_SCENARIO)

    expect(capturePendingGuestCopies()).toEqual([GUEST_SCENARIO])
    expect(readPendingGuestCopies()).toEqual([GUEST_SCENARIO])
  })

  it('survives the pointer being overwritten by opening another scenario', () => {
    workedOn(GUEST_SCENARIO)
    capturePendingGuestCopies()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(readPendingGuestCopies()).toEqual([GUEST_SCENARIO])
  })

  it('survives the pointer being cleared by "start fresh"', () => {
    workedOn(GUEST_SCENARIO)
    capturePendingGuestCopies()

    localStorage.removeItem(CURRENT_SCENARIO_KEY)

    expect(readPendingGuestCopies()).toEqual([GUEST_SCENARIO])
  })

  it('NEVER DROPPED: a second sign-in adds to a pending capture, never replaces it', () => {
    workedOn(GUEST_SCENARIO)
    capturePendingGuestCopies()

    workedOn(SECOND_SCENARIO)
    const second = capturePendingGuestCopies()

    expect(second).toEqual([GUEST_SCENARIO, SECOND_SCENARIO])
    expect(readPendingGuestCopies()).toEqual([GUEST_SCENARIO, SECOND_SCENARIO])
  })

  it('a v1 single id (the build before the set) is read as pending and migrated, never lost', () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, GUEST_SCENARIO)

    expect(readPendingGuestCopies()).toEqual([GUEST_SCENARIO])
    workedOn(SECOND_SCENARIO)
    expect(capturePendingGuestCopies()).toEqual([GUEST_SCENARIO, SECOND_SCENARIO])
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('captures again once the pending copy has been cleared', () => {
    workedOn(GUEST_SCENARIO)
    capturePendingGuestCopies()
    clearPendingGuestCopy(GUEST_SCENARIO)

    workedOn(SECOND_SCENARIO)

    expect(capturePendingGuestCopies()).toEqual([SECOND_SCENARIO])
  })

  it('records nothing when the visitor built no model', () => {
    expect(capturePendingGuestCopies()).toEqual([])
    expect(readPendingGuestCopies()).toEqual([])
    expect(localStorage.getItem(PENDING_GUEST_COPIES_KEY)).toBeNull()
    expect(readGuestWork()).toEqual([])
  })

  it('records nothing for a legacy non-UUID pointer, which can never be a server row', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, 'scenario-1712345678901-ab12cd')

    expect(capturePendingGuestCopies()).toEqual([])
    expect(readGuestWork()).toEqual([])
  })

  it('never throws when storage is unavailable', () => {
    const boom = () => {
      throw new Error('QuotaExceededError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)

    expect(() => capturePendingGuestCopies()).not.toThrow()
    expect(() => readPendingGuestCopies()).not.toThrow()
    expect(() => clearPendingGuestCopy(GUEST_SCENARIO)).not.toThrow()
    expect(() => forgetPendingGuestCopyOnSignOut()).not.toThrow()
    expect(capturePendingGuestCopies()).toEqual([])
    expect(readPendingGuestCopies()).toEqual([])
  })

  it('uses keys distinct from the live pointer', () => {
    expect(PENDING_GUEST_COPY_KEY).not.toBe(CURRENT_SCENARIO_KEY)
    expect(PENDING_GUEST_COPIES_KEY).not.toBe(CURRENT_SCENARIO_KEY)
  })
})

describe('forgetPendingGuestCopyOnSignOut (owner ruling: no surprise copy into the next account)', () => {
  it('drops what was pending, and the same pointer is NOT re-captured or offered at the next sign-in', () => {
    workedOn(GUEST_SCENARIO)
    capturePendingGuestCopies() // user A signed in; the copy was kept by a 503

    forgetPendingGuestCopyOnSignOut() // A signs out

    expect(readPendingGuestCopies()).toEqual([])
    expect(capturePendingGuestCopies()).toEqual([]) // user B signs in on the same browser
    expect(readGuestWork()).toEqual([])
  })

  it('CONTRAST: a NEW decision worked on after the sign-out IS captured for the next sign-in', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    forgetPendingGuestCopyOnSignOut()

    workedOn(SECOND_SCENARIO)

    expect(capturePendingGuestCopies()).toEqual([SECOND_SCENARIO])
  })
})
