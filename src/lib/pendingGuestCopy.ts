/**
 * The guest scenario id a visitor was working on when they signed in — the
 * input to ACCOUNTS B3's server-side COPY (CEE `POST /assist/v1/scenarios/:id/copy`).
 *
 * Ported from `lane/pending-guest-claim` (f8965d28), with two changes:
 * - B3 COPIES the guest decision into the account and never transfers the guest
 *   row (DL #85 5942022182, PTL 5942126200), so this records the id to copy FROM.
 * - The scenario trail is not ported: only the live pointer is read.
 *
 * ── WHY IT IS CAPTURED AT SIGN-IN AND NOT LATER ─────────────────────────────
 * Signing in does not touch `olumi-canvas-current-scenario-id`. What destroys it
 * is the first thing the user does next: opening or creating a decision rewrites
 * the pointer and "start fresh" clears it. So the id is copied, at the moment of
 * sign-in, to a key none of those writes reach.
 *
 * ── WRITE-ONCE IS LOAD-BEARING ─────────────────────────────────────────────
 * A second sign-in must NOT overwrite a pending capture, or the first guest
 * model is discarded — the harm this module exists to prevent. Only
 * `clearPendingGuestCopy()` (after the copy succeeded, or the server answered
 * that the id can never be copied) frees the slot.
 *
 * This module RECORDS ONLY. It sends no request.
 */

/** Distinct from the live pointer by construction — see WRITE-ONCE above. */
export const PENDING_GUEST_COPY_KEY = 'olumi.pendingGuestCopy.v1'

/** The live pointer, owned by `canvas/store/scenarios.ts`. Read here, never written. */
const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

/**
 * The pointer as it stood when someone signed OUT. Work behind it was done
 * before THAT person signed in, so it belongs to no later account
 * (ACCOUNTS owner ruling, 2 Oct: no surprise copy into the next account on a
 * shared machine). Capture skips it; a guest who starts a NEW decision after the
 * sign-out moves the pointer and is captured as normal.
 */
export const SPENT_GUEST_POINTER_KEY = 'olumi.pendingGuestCopy.spentPointer.v1'

/**
 * Server rows are UUIDs. Legacy `scenario-{ts}-{rand}` ids are localStorage-only
 * relics with no server row, so recording one would promise a copy that cannot
 * happen. Shape-check only: this module cannot reach the server.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isScenarioUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // Storage unavailable (private mode, blocked cookies). Recording is a
    // safety net, never a precondition: degrade rather than break a sign-in.
    return null
  }
}

/** The live canvas pointer, or `null`. */
export function readCurrentScenarioPointer(): string | null {
  return readKey(CURRENT_SCENARIO_KEY)
}

/** The scenario id awaiting a copy, or `null`. */
export function readPendingGuestCopy(): string | null {
  const raw = readKey(PENDING_GUEST_COPY_KEY)
  return isScenarioUuid(raw) ? raw : null
}

/**
 * Record the scenario the visitor was working on, if any, and return whatever
 * is pending afterwards.
 *
 * Call on the guest → signed-in transition, BEFORE any navigation. Recording an
 * id the user already owns costs one refused request: the server copies only a
 * guest-owned source and answers `scenario_not_copyable` otherwise.
 */
export function capturePendingGuestCopy(): string | null {
  const pending = readPendingGuestCopy()
  if (pending !== null) return pending

  const current = readCurrentScenarioPointer()
  if (!isScenarioUuid(current)) return null
  if (current === readKey(SPENT_GUEST_POINTER_KEY)) return null

  try {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, current)
  } catch {
    return null
  }
  return current
}

/**
 * Release the slot. Call ONLY after a successful copy, or a refusal that proves
 * the id can never be copied. Clearing on a transient failure would discard the
 * only route back to the guest's work.
 */
export function clearPendingGuestCopy(): void {
  try {
    localStorage.removeItem(PENDING_GUEST_COPY_KEY)
  } catch {
    // The slot stays occupied, which fails safe.
  }
}

/**
 * On SIGNED_OUT: whatever was pending belonged to the person who just left, so
 * drop it, and mark the current pointer spent so the next sign-in on this
 * browser does not re-capture the same work from it.
 */
export function forgetPendingGuestCopyOnSignOut(): void {
  clearPendingGuestCopy()
  const current = readCurrentScenarioPointer()
  if (!isScenarioUuid(current)) return
  try {
    localStorage.setItem(SPENT_GUEST_POINTER_KEY, current)
  } catch {
    // Storage unavailable: nothing was pending either, since it lives there too.
  }
}
