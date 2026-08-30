/**
 * The guest scenario id a visitor was working on when they signed in.
 *
 * ── WHAT THIS IS FOR, AND WHY IT IS NOT WHERE YOU WOULD FIRST PUT IT ────────
 * Ownership of a scenario is decided by its FIRST writer and never revisited:
 * CEE's `ensure_scenario_exists` inserts `ON CONFLICT (id) DO NOTHING`, so a
 * model a guest starts is stamped `user_id = NULL` permanently. Signing in
 * later does not change it, and `listScenarios` filters on `user_id`, so the
 * work never appears in the account it belongs to.
 *
 * The obvious fix — "don't clear the pointer at sign-in" — is pointed at the
 * wrong moment. Sign-in does not touch `olumi-canvas-current-scenario-id`:
 * nothing in `LoginPage`, `AuthContext`, `AuthCallback` or `clearAuthStates()`
 * writes it (`lib/auth/authUtils.ts:77-87` clears a hand-listed set that does
 * not include it). Preservation across sign-in is already the behaviour.
 *
 * What destroys the id is the first thing the user does AFTER signing in. The
 * live pointer is rewritten when any scenario is opened (`canvas/store.ts:4654`)
 * or created (`canvas/store/scenarios.ts:344`), and cleared by "start fresh"
 * (`canvas/store.ts:3571`). So the id must be copied somewhere those writes do
 * not reach, at the moment sign-in succeeds.
 *
 * ── WHY A COPY IS WORTH ANYTHING ON ITS OWN ────────────────────────────────
 * The guest row is never destroyed. Its `user_id` stays NULL, and RLS gives a
 * NULL-owner row no user-reachable delete path (`Users can delete own
 * scenarios` requires `auth.uid() = user_id`). It therefore remains claimable
 * indefinitely, and `claim_guest_scenario` — already deployed, row-locked and
 * idempotent — is waiting for exactly this id. The loss mode is POINTER LOSS,
 * not row destruction, so keeping the pointer is the whole of the safety net:
 * it converts an unrecoverable loss into a recoverable one whether or not the
 * claim endpoint ships.
 *
 * ── WRITE-ONCE IS LOAD-BEARING ─────────────────────────────────────────────
 * A second sign-in must NOT overwrite a pending capture. Overwriting would
 * discard the first guest model — the precise harm this module exists to
 * prevent, reintroduced by the module meant to prevent it. Capture yields to
 * whatever is already pending; only an explicit `clearPendingGuestClaim()`
 * (after a claim has actually succeeded) frees the slot.
 *
 * This module RECORDS ONLY. It performs no claim, sends no request, and changes
 * nothing a guest sees — a visitor who never signs in never reaches it.
 */

import { latestScenarioTrail } from './scenarioTrail'

/** Distinct from the live pointer by construction — see WRITE-ONCE above. */
export const PENDING_GUEST_CLAIM_KEY = 'olumi.pendingGuestClaim.v1'

/** The live pointer, owned by `canvas/store/scenarios.ts`. Read here, never written. */
const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

/**
 * Server rows are UUIDs (`crypto.randomUUID()` via the store's `generateId`).
 * Legacy `scenario-{ts}-{rand}` ids are localStorage-only relics that were
 * never migrated and have no server row, and `claim_guest_scenario`'s
 * `p_scenario_id` is a `uuid` — so recording one would promise a recovery that
 * cannot happen. Shape-check, not an existence check: this module cannot reach
 * the server and does not pretend to.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage unavailable (private mode, blocked cookies). Recording is a
    // safety net, never a precondition — degrade silently rather than break
    // a sign-in that is otherwise fine.
    return null
  }
}

/**
 * The scenario id awaiting a claim, or `null`.
 */
export function readPendingGuestClaim(): string | null {
  const raw = readKey(PENDING_GUEST_CLAIM_KEY)
  return raw && UUID_RE.test(raw) ? raw : null
}

/**
 * Record the scenario the visitor was working on, if any, and return whatever
 * is pending afterwards.
 *
 * Call at sign-in success, BEFORE any navigation — the destination route opens
 * or creates a scenario and rewrites the live pointer.
 *
 * Safe to call unconditionally. Recording an id the caller already owns costs
 * nothing: `claim_guest_scenario` answers `already_owned` for the same user and
 * `GC409` for a different one, so a wrong guess is refused server-side rather
 * than acted on. Nothing here decides ownership.
 */
export function capturePendingGuestClaim(): string | null {
  const pending = readPendingGuestClaim()
  if (pending !== null) return pending

  // The live pointer first; the trail when it has already been lost.
  //
  // ONE MECHANISM, TWO TRIGGERS. A colleague who hits "Start new model" and
  // THEN signs in has no live pointer — `clearCurrentScenarioId` emptied the
  // slot. Without this fallback the sign-in capture would find nothing and the
  // guest model would still be stranded, so the two triggers would need two
  // fixes. `scenarioTrail` recorded the id at the moment it was displaced, and
  // reading it here is what makes this a single mechanism.
  const current = readKey(CURRENT_SCENARIO_KEY) ?? latestScenarioTrail()
  if (!current || !UUID_RE.test(current)) return null

  try {
    localStorage.setItem(PENDING_GUEST_CLAIM_KEY, current)
  } catch {
    return null
  }
  return current
}

/**
 * Release the slot. Call ONLY once the work is genuinely the user's — a
 * successful claim, or a refusal that proves it can never be theirs (`GC409`,
 * another account owns it). Clearing on a transient failure would discard the
 * only route back.
 */
export function clearPendingGuestClaim(): void {
  try {
    localStorage.removeItem(PENDING_GUEST_CLAIM_KEY)
  } catch {
    // Nothing to do: the slot simply stays occupied, which fails safe.
  }
}
