/**
 * ⭐ S-G GUEST → ACCOUNT CONTINUITY: THE GUEST-WORK LEDGER (lane SIGNIN-IMPORT, DL 0fd71f, 7 Oct 2026; HIGH).
 *
 * Paul's definition of complete: "sign-in carries the work the user was actually doing; no stale import, nothing lost."
 *
 * ── WHY A LEDGER ────────────────────────────────────────────────────────────
 * A guest decision has no owner on the server, so only THIS browser can say which guest decisions are its work, and
 * when it last worked on them. Before this module the sign-in copy read one thing: the live pointer
 * (`olumi-canvas-current-scenario-id`), which has no date. On 7 Oct Paul signed in on production and the copy took
 * his 28 Sep guest decision, because that browser still pointed at it (prod CEE logs: last turns 28 Sep, one view on
 * 5 Oct, then the copy at 08:40:58Z). It was nine days old and not what he came to do.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * - Producers: every guest TURN (the two turn transports call `noteGuestTurn`) is work: a message, a chip, an edit sent
 *   as an event. A model registered without a turn (an import, an opened example; `registerScenarioGraph`) is recorded
 *   as SEEN, of unknown age. Opening or viewing a decision is neither.
 * - At sign-in (`pendingGuestCopy.capturePendingGuestCopies`): work from the last `RECENT_GUEST_WORK_MS` is CARRIED
 *   into the account automatically. Anything older, and a pointer this ledger never saw, is OFFERED on "My decisions"
 *   (`GuestWorkOfferBanner`): the user chooses. Nothing is copied silently that the user was not doing.
 * - Nothing is lost by the choice: an offer stays until the user answers it, and the guest row is never written.
 *
 * ── BOUNDARIES ──────────────────────────────────────────────────────────────
 * Sign-out and a lapse clear the ledger (`forgetPendingGuestCopyOnSignOut`; `userScopedKeys` sweep): what it holds
 * was recorded before THAT person signed in, so it is never offered to the next account (ACCOUNTS owner ruling, 2 Oct).
 * A signed-in page records nothing: its decisions are already the account's.
 *
 * Never throws. Storage unavailable means no ledger, which degrades to "offer, never copy silently".
 */
import { isPersistenceSessionActive } from './persistenceSession'
import { hasStoredSupabaseSession } from './storedSupabaseSession'
import { IDENTITY_EPOCH_STORAGE_KEY } from './auth/userScopedKeys'

/**
 * TWO KEY FAMILIES, ONE KEY PER DECISION IN EACH. Never one shared array: two tabs that read-modify-write one key lose
 * each other's writes (Codex r1 P1-2).
 * - `olumi.guestWork.v1:<id>` → `{ lastActiveAt, label }`: written ONLY by a guest turn.
 * - `olumi.guestWorkSeen.v1:<id>` → `1`: a decision of unknown age (the pointer at a sign-in, an imported or opened
 *   model). Written ONLY by those, so it can never overwrite a turn's entry (Codex r2 P1-2: a registration racing a
 *   turn in another tab demoted recent work to an unnamed offer). A turn entry, when present, wins on read.
 * The boundary sweep removes both prefixes (`userScopedKeys.USER_SCOPED_STORAGE_PREFIXES`).
 *
 * NO CAP, so nothing is ever trimmed (Codex r2 P1-2 trim race, P2 aged overflow). An entry is ~100 bytes; a sign-out, a
 * lapse, a copy or "Not mine" removes it.
 */
export const GUEST_WORK_PREFIX = 'olumi.guestWork.v1:'
export const GUEST_WORK_SEEN_PREFIX = 'olumi.guestWorkSeen.v1:'

/**
 * Work this recent is what the user was doing when they signed in. A day covers "worked as a guest, then signed in"
 * in one sitting or across a lunch break; a decision last touched days ago is offered instead of copied.
 */
export const RECENT_GUEST_WORK_MS = 24 * 60 * 60 * 1000

/** The first thing the user typed, kept so an offer can be recognised. Cut at a word, never mid-word. */
const LABEL_MAX = 160

export interface GuestWorkEntry {
  readonly id: string
  /** When this browser last sent a turn for it. `null`: its age is unknown (a pointer or an import), so it is offered. */
  readonly lastActiveAt: number | null
  /** The first message the user typed in it, or `null`. */
  readonly label: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length === 0) return null
  if (text.length <= LABEL_MAX) return text
  const cut = text.slice(0, LABEL_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function byRecency(a: GuestWorkEntry, b: GuestWorkEntry): number {
  return (b.lastActiveAt ?? -Infinity) - (a.lastActiveAt ?? -Infinity)
}

function parseTurnEntry(id: string, raw: string | null): GuestWorkEntry | null {
  if (raw === null || !isUuid(id)) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null
    if (!value || typeof value !== 'object') return null
    const at = typeof value.lastActiveAt === 'number' && Number.isFinite(value.lastActiveAt) ? value.lastActiveAt : null
    return { id, lastActiveAt: at, label: cleanLabel(value.label) }
  } catch {
    return null
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function keysWith(prefix: string): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(prefix)) keys.push(key)
    }
  } catch {
    // Storage unavailable: no ledger.
  }
  return keys
}

/** The ledger, newest first: every decision with a turn entry, then every decision only seen. Malformed keys skipped. */
export function readGuestWork(): GuestWorkEntry[] {
  const byId = new Map<string, GuestWorkEntry>()
  for (const key of keysWith(GUEST_WORK_PREFIX)) {
    const entry = parseTurnEntry(key.slice(GUEST_WORK_PREFIX.length), read(key))
    if (entry) byId.set(entry.id, entry)
  }
  for (const key of keysWith(GUEST_WORK_SEEN_PREFIX)) {
    const id = key.slice(GUEST_WORK_SEEN_PREFIX.length)
    if (isUuid(id) && !byId.has(id)) byId.set(id, { id, lastActiveAt: null, label: null })
  }
  return [...byId.values()].sort(byRecency)
}

function isSignedInPage(): boolean {
  return isPersistenceSessionActive() || hasStoredSupabaseSession()
}

/**
 * Record that a guest worked on `scenarioId` now. A no-op on a signed-in page, for a non-UUID id, or when storage
 * refuses. The label is kept from the first time one is given (the brief, usually).
 */
export function noteGuestWork(scenarioId: unknown, label: unknown = null, now: number = Date.now()): void {
  if (!isUuid(scenarioId) || isSignedInPage()) return
  const existing = parseTurnEntry(scenarioId, read(GUEST_WORK_PREFIX + scenarioId))
  try {
    localStorage.setItem(
      GUEST_WORK_PREFIX + scenarioId,
      JSON.stringify({ lastActiveAt: now, label: existing?.label ?? cleanLabel(label) }),
    )
  } catch {
    // Not recorded: at sign-in this decision is at worst offered (the pointer), never copied silently.
  }
}

/**
 * The turn transports' one call. A typed composer message also names the decision for a later offer; a chip, a
 * retry or an event records the work but not a label.
 */
export function noteGuestTurn(payload: unknown, now: number = Date.now()): void {
  try {
    if (!payload || typeof payload !== 'object') return
    const p = payload as Record<string, unknown>
    const typed = p.kind === 'message' && p.source === 'composer'
    noteGuestWork(p.scenario_id, typed ? p.message : null, now)
  } catch {
    // Recording is a convenience for the sign-in; a turn must never fail because of it.
  }
}

/** Record a decision of unknown age as an OFFER. Its own key family, so it never touches a turn's entry. */
export function recordGuestWorkOffer(scenarioId: string): void {
  if (!isUuid(scenarioId)) return
  try {
    localStorage.setItem(GUEST_WORK_SEEN_PREFIX + scenarioId, '1')
  } catch {
    // Not offered; the guest row is unchanged on the server.
  }
}

/** The identity epoch (`scenarios.IDENTITY_EPOCH_KEY`): rotated by every identity boundary, never by a first sign-in. */
export function readIdentityEpoch(): string | null {
  return read(IDENTITY_EPOCH_STORAGE_KEY)
}

/** Taken when a guest's model registration STARTS; settled when it is acknowledged. */
export interface GuestRegistrationTicket {
  readonly epoch: string | null
}

/**
 * A model registration is starting. A ticket only for a guest (no token, no signed-in page): the decision it creates is
 * guest work even if the acknowledgement lands after this guest signs in (Codex r2 P1-1, lost-work case).
 */
export function beginGuestRegistration(accessToken: string | null | undefined): GuestRegistrationTicket | null {
  try {
    if (accessToken || isSignedInPage()) return null
    return { epoch: readIdentityEpoch() }
  } catch {
    return null
  }
}

/**
 * The registration was acknowledged: the guest's model exists on the server without a turn (an imported model, an
 * opened example), so it is OFFERED at sign-in, never copied silently. Recorded only if no identity boundary ran since
 * it started (Codex r2 P1-1, boundary case: a late ack after A signed out must not become an offer for B).
 */
export function completeGuestRegistration(ticket: GuestRegistrationTicket | null, scenarioId: unknown): void {
  try {
    if (ticket === null || !isUuid(scenarioId) || readIdentityEpoch() !== ticket.epoch) return
    recordGuestWorkOffer(scenarioId)
  } catch {
    // As `noteGuestTurn`.
  }
}

/** Remove one decision: it was copied, refused for good, or the user said it is not theirs. */
export function forgetGuestWork(scenarioId: string): void {
  for (const prefix of [GUEST_WORK_PREFIX, GUEST_WORK_SEEN_PREFIX]) {
    try {
      localStorage.removeItem(prefix + scenarioId)
    } catch {
      // It stays offered, which fails safe.
    }
  }
}

export function clearGuestWork(): void {
  for (const key of [...keysWith(GUEST_WORK_PREFIX), ...keysWith(GUEST_WORK_SEEN_PREFIX)]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // The boundary's sweep removes the prefixes as well.
    }
  }
}

/** Worked on within the window. A clock that moved backwards by more than the window counts as not recent. */
export function isRecentGuestWork(entry: GuestWorkEntry, now: number = Date.now()): boolean {
  if (entry.lastActiveAt === null) return false
  const age = now - entry.lastActiveAt
  return age <= RECENT_GUEST_WORK_MS && age >= -RECENT_GUEST_WORK_MS
}
