/**
 * The guest decisions awaiting a copy into the account a visitor just signed in to — the input to ACCOUNTS B3's
 * server-side COPY (CEE `POST /assist/v1/scenarios/:id/copy`).
 *
 * B3 COPIES a guest decision into the account and never transfers the guest row (DL #85 5942022182, PTL 5942126200),
 * so this records the ids to copy FROM.
 *
 * ── S-G (7 Oct 2026): WHAT IS CAPTURED IS THE WORK THE USER WAS DOING, NOT WHATEVER THE POINTER NAMES ──────────────
 * This module used to capture ONE id: the live pointer, however old. On 7 Oct that copied Paul's 28 Sep guest decision
 * into his account on production, nine days after he last worked on it. Now (`capturePendingGuestCopies`):
 * - every decision the guest-work ledger (`guestWork.ts`) saw a turn for in the last `RECENT_GUEST_WORK_MS` is
 *   captured, so several decisions from one sitting all arrive;
 * - an older one, or a pointer the ledger never saw, is left as an OFFER on "My decisions" for the user to choose.
 *
 * ── WHY IT IS CAPTURED AT SIGN-IN AND NOT LATER ─────────────────────────────
 * Signing in does not touch `olumi-canvas-current-scenario-id`. What destroys it is the first thing the user does next:
 * opening or creating a decision rewrites the pointer and "start fresh" clears it. So the ids are copied, at the moment
 * of sign-in, to a key none of those writes reach.
 *
 * ── NEVER OVERWRITTEN IS LOAD-BEARING ───────────────────────────────────────
 * A second sign-in must NOT discard a pending capture, or that guest model is lost — the harm this module exists to
 * prevent. The pending SET only grows by union; only `clearPendingGuestCopy(id)` (after that copy succeeded, or the
 * server answered that the id can never be copied) removes an id. A single id left by the version before the set
 * (`PENDING_GUEST_COPY_KEY`, v1) is read as a member and migrated in, never dropped.
 *
 * This module RECORDS ONLY. It sends no request.
 */
import {
  forgetGuestWork,
  isRecentGuestWork,
  readGuestWork,
  recordGuestWorkOffer,
  clearGuestWork,
} from './guestWork'

/** v1: ONE id, written once. Read as a member of the set and migrated into it; never written any more. */
export const PENDING_GUEST_COPY_KEY = 'olumi.pendingGuestCopy.v1'

/** v2: the pending SET, a JSON array of ids. Distinct from the live pointer by construction. */
export const PENDING_GUEST_COPIES_KEY = 'olumi.pendingGuestCopy.v2'

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

function readPendingSet(): string[] {
  const raw = readKey(PENDING_GUEST_COPIES_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isScenarioUuid) : []
  } catch {
    return []
  }
}

function union(...lists: ReadonlyArray<readonly string[]>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const id of list) {
      const key = id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(id)
    }
  }
  return out
}

/** Every scenario id awaiting a copy, oldest capture first. Includes a v1 single id not yet migrated. */
export function readPendingGuestCopies(): string[] {
  const legacy = readKey(PENDING_GUEST_COPY_KEY)
  return union(readPendingSet(), isScenarioUuid(legacy) ? [legacy] : [])
}

/** Write the set; on success the v1 slot is migrated (removed). False when storage refused: nothing was migrated. */
function writePendingSet(ids: readonly string[]): boolean {
  try {
    if (ids.length === 0) localStorage.removeItem(PENDING_GUEST_COPIES_KEY)
    else localStorage.setItem(PENDING_GUEST_COPIES_KEY, JSON.stringify(ids))
  } catch {
    return false
  }
  try {
    localStorage.removeItem(PENDING_GUEST_COPY_KEY)
  } catch {
    // The v1 id is also in the set now, so reading both still yields it once.
  }
  return true
}

/**
 * Record what the visitor was working on, and return everything pending afterwards.
 *
 * Call on the guest → signed-in transition, BEFORE any navigation:
 * - recent ledger work joins the pending set (and leaves the ledger: it is no longer an offer);
 * - the live pointer, if the ledger never saw it and it is not spent, becomes an OFFER, never a silent copy;
 * - older ledger work stays in the ledger as offers.
 *
 * Recording an id the user already owns costs one refused request: the server copies only a guest-owned source and
 * answers `scenario_not_copyable` otherwise.
 */
export function capturePendingGuestCopies(now: number = Date.now()): string[] {
  const pending = readPendingGuestCopies()
  const ledger = readGuestWork()
  const recent = ledger.filter((entry) => isRecentGuestWork(entry, now)).map((entry) => entry.id)
  const next = union(pending, recent)
  // Storage refused the set: nothing leaves the ledger, so the recent work is still OFFERED rather than lost.
  if ((next.length > 0 || readKey(PENDING_GUEST_COPY_KEY) !== null) && !writePendingSet(next)) return pending
  for (const id of recent) forgetGuestWork(id)

  const current = readCurrentScenarioPointer()
  if (
    isScenarioUuid(current) &&
    current !== readKey(SPENT_GUEST_POINTER_KEY) &&
    !next.some((id) => id.toLowerCase() === current.toLowerCase()) &&
    !ledger.some((entry) => entry.id.toLowerCase() === current.toLowerCase())
  ) {
    recordGuestWorkOffer(current)
  }
  return next
}

/**
 * Release one id. Call ONLY after a successful copy, or a refusal that proves the id can never be copied. Clearing on
 * a transient failure would discard the only route back to the guest's work. Other pending ids are never touched, so a
 * late answer for one id cannot delete another captured since.
 */
export function clearPendingGuestCopy(id: string): void {
  const key = id.toLowerCase()
  const remaining = readPendingSet().filter((pendingId) => pendingId.toLowerCase() !== key)
  try {
    if (remaining.length === 0) localStorage.removeItem(PENDING_GUEST_COPIES_KEY)
    else localStorage.setItem(PENDING_GUEST_COPIES_KEY, JSON.stringify(remaining))
  } catch {
    // The id stays pending, which fails safe: the next attempt copies it again (idempotent per source and user).
  }
  try {
    if ((localStorage.getItem(PENDING_GUEST_COPY_KEY) ?? '').toLowerCase() === key) localStorage.removeItem(PENDING_GUEST_COPY_KEY)
  } catch {
    // As above.
  }
}

function clearAllPending(): void {
  try {
    localStorage.removeItem(PENDING_GUEST_COPIES_KEY)
  } catch {
    // The boundary's sweep removes it as well.
  }
  try {
    localStorage.removeItem(PENDING_GUEST_COPY_KEY)
  } catch {
    // As above.
  }
}

/**
 * On SIGNED_OUT: whatever was pending or offered belonged to the person who just left, so
 * drop it, and mark the current pointer spent so the next sign-in on this
 * browser does not re-capture the same work from it.
 */
export function forgetPendingGuestCopyOnSignOut(): void {
  clearAllPending()
  // Offers were the signed-out person's guest work too: never shown to the next account.
  clearGuestWork()
  const current = readCurrentScenarioPointer()
  if (!isScenarioUuid(current)) return
  try {
    localStorage.setItem(SPENT_GUEST_POINTER_KEY, current)
  } catch {
    // Storage unavailable: nothing was pending either, since it lives there too.
  }
}
