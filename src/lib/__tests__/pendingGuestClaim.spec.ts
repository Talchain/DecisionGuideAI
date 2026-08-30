/**
 * Pending guest claim — the capture half of guest→account ownership transfer.
 *
 * WHY THIS EXISTS, stated precisely, because the obvious version of this fix is
 * pointed at the wrong moment.
 *
 * Signing in does NOT overwrite `olumi-canvas-current-scenario-id`. Nothing in
 * `LoginPage`, `AuthContext`, `AuthCallback` or `clearAuthStates()` touches that
 * key — `clearAuthStates` clears a hand-listed set that does not include it
 * (`lib/auth/authUtils.ts:77-87`). So "preserve the pointer at sign-in" has
 * nothing to build: it is already the behaviour.
 *
 * What DOES destroy it is the first thing the user does next. The pointer is
 * rewritten whenever a scenario is opened (`canvas/store.ts:4654`) or created
 * (`canvas/store/scenarios.ts:344`), and cleared by "start fresh"
 * (`canvas/store.ts:3571`). A colleague who signs in and then opens any decision
 * has silently lost the id of the guest model they built minutes earlier.
 *
 * That id is the ONLY route back. The guest row itself is never deleted — its
 * `user_id` stays NULL, and RLS gives a NULL-owner row no user-reachable delete
 * path (`Users can delete own scenarios` requires `auth.uid() = user_id`), so it
 * stays claimable forever. The loss mode is pointer loss, not row destruction.
 * Capturing the id to a key nothing else writes converts an unrecoverable loss
 * into a recoverable one, whether or not the claim endpoint ever ships.
 *
 * WRITE-ONCE is the load-bearing property. A second sign-in must not overwrite a
 * pending capture: that would discard the first guest model — the exact harm
 * this module exists to prevent, reintroduced by the module meant to prevent it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  PENDING_GUEST_CLAIM_KEY,
  capturePendingGuestClaim,
  readPendingGuestClaim,
  clearPendingGuestClaim,
} from '../pendingGuestClaim'

const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

const GUEST_SCENARIO = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SECOND_SCENARIO = '9f8b7a6c-1234-4def-8abc-0123456789ab'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('capturePendingGuestClaim', () => {
  it('captures the live scenario pointer', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)

    expect(capturePendingGuestClaim()).toBe(GUEST_SCENARIO)
    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  it('survives the pointer being overwritten by opening another scenario', () => {
    // The real sequence: guest builds a model, signs in (capture), then opens
    // one of their own decisions — which rewrites the live pointer.
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestClaim()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  it('survives the pointer being cleared by "start fresh"', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestClaim()

    localStorage.removeItem(CURRENT_SCENARIO_KEY)

    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  it('is WRITE-ONCE: a second sign-in never overwrites a pending capture', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestClaim()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)
    const second = capturePendingGuestClaim()

    // Returns what remains pending, and the ORIGINAL id is what survives.
    expect(second).toBe(GUEST_SCENARIO)
    expect(readPendingGuestClaim()).toBe(GUEST_SCENARIO)
  })

  it('captures again once the pending claim has been cleared', () => {
    localStorage.setItem(CURRENT_SCENARIO_KEY, GUEST_SCENARIO)
    capturePendingGuestClaim()
    clearPendingGuestClaim()

    localStorage.setItem(CURRENT_SCENARIO_KEY, SECOND_SCENARIO)

    expect(capturePendingGuestClaim()).toBe(SECOND_SCENARIO)
    expect(readPendingGuestClaim()).toBe(SECOND_SCENARIO)
  })

  it('records nothing when the visitor built no model', () => {
    expect(capturePendingGuestClaim()).toBeNull()
    expect(readPendingGuestClaim()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_CLAIM_KEY)).toBeNull()
  })

  it('records nothing for a legacy non-UUID pointer, which can never be a server row', () => {
    // `canvas/store/scenarios.ts` documents legacy `scenario-{ts}-{rand}` ids
    // that were never migrated. They are localStorage-only relics: no server row
    // exists, and `claim_guest_scenario(p_scenario_id uuid, …)` could not accept
    // one. Recording it would promise a recovery that cannot happen.
    localStorage.setItem(CURRENT_SCENARIO_KEY, 'scenario-1712345678901-ab12cd')

    expect(capturePendingGuestClaim()).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_CLAIM_KEY)).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const boom = () => {
      throw new Error('QuotaExceededError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)

    expect(() => capturePendingGuestClaim()).not.toThrow()
    expect(() => readPendingGuestClaim()).not.toThrow()
    expect(() => clearPendingGuestClaim()).not.toThrow()
    expect(capturePendingGuestClaim()).toBeNull()
    expect(readPendingGuestClaim()).toBeNull()
  })

  it('uses a key nothing else in the tree writes', () => {
    // Distinct from the live pointer by construction: if they shared a key the
    // capture would be rewritten by the very writes it exists to survive.
    expect(PENDING_GUEST_CLAIM_KEY).not.toBe(CURRENT_SCENARIO_KEY)
  })
})
