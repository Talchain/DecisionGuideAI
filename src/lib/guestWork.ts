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
 * - ONE producer seam: every guest TURN (the two turn transports call `noteGuestTurn`). A turn is the user doing work
 *   with Olumi: a message, a chip, an edit sent as an event. Opening or viewing a decision is not.
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

/**
 * ONE KEY PER DECISION: `olumi.guestWork.v1:<scenario id>` → `{ lastActiveAt, label }`. Never one shared array: two tabs
 * that read-modify-write one key lose each other's writes (Codex r1 P1-2), while a per-decision key is only ever written
 * for its own decision. The boundary sweep removes the prefix (`userScopedKeys.USER_SCOPED_STORAGE_PREFIXES`).
 */
export const GUEST_WORK_PREFIX = 'olumi.guestWork.v1:'

/**
 * Work this recent is what the user was doing when they signed in. A day covers "worked as a guest, then signed in"
 * in one sitting or across a lunch break; a decision last touched days ago is offered instead of copied.
 */
export const RECENT_GUEST_WORK_MS = 24 * 60 * 60 * 1000

/**
 * Housekeeping bound. Only OLDER work (offers) is ever trimmed past it, oldest first; work inside the recent window is
 * never trimmed, so everything a guest did in one sitting reaches the account however many decisions it was (Codex r1
 * P2). A browser holding more than this many older guest decisions loses the offer for the oldest.
 */
export const GUEST_WORK_CAP = 100

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

function parseEntry(id: string, raw: string | null): GuestWorkEntry | null {
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

function readEntry(id: string): GuestWorkEntry | null {
  try {
    return parseEntry(id, localStorage.getItem(GUEST_WORK_PREFIX + id))
  } catch {
    return null
  }
}

function writeEntry(entry: GuestWorkEntry): boolean {
  try {
    localStorage.setItem(GUEST_WORK_PREFIX + entry.id, JSON.stringify({ lastActiveAt: entry.lastActiveAt, label: entry.label }))
    return true
  } catch {
    return false
  }
}

function ledgerKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(GUEST_WORK_PREFIX)) keys.push(key)
    }
  } catch {
    // Storage unavailable: no ledger.
  }
  return keys
}

/** The ledger, newest first; malformed entries are skipped. */
export function readGuestWork(): GuestWorkEntry[] {
  const entries: GuestWorkEntry[] = []
  for (const key of ledgerKeys()) {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(key)
    } catch {
      continue
    }
    const entry = parseEntry(key.slice(GUEST_WORK_PREFIX.length), raw)
    if (entry) entries.push(entry)
  }
  return entries.sort(byRecency)
}

/** Trim the oldest OLDER entries past the cap. Recent work is never trimmed. */
function trim(now: number): void {
  const entries = readGuestWork()
  let excess = entries.length - GUEST_WORK_CAP
  if (excess <= 0) return
  for (const entry of [...entries].reverse()) {
    if (excess <= 0) break
    if (isRecentGuestWork(entry, now)) continue
    forgetGuestWork(entry.id)
    excess -= 1
  }
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
  const existing = readEntry(scenarioId)
  if (writeEntry({ id: scenarioId, lastActiveAt: now, label: existing?.label ?? cleanLabel(label) })) trim(now)
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

/** Record a decision whose age is unknown as an OFFER (never overwrites an entry that has one). */
export function recordGuestWorkOffer(scenarioId: string): void {
  if (!isUuid(scenarioId) || readEntry(scenarioId) !== null) return
  writeEntry({ id: scenarioId, lastActiveAt: null, label: null })
}

/**
 * A guest's model registered on the server without a turn (an imported model or an opened example; the registration
 * adapter's one call). It is offered at sign-in, never copied silently: opening something is not working on it. A
 * later turn on it makes it recent work (Codex r1 P1-3: an import followed by another decision was neither carried nor
 * offered).
 */
export function noteGuestRegistration(scenarioId: unknown): void {
  try {
    if (!isUuid(scenarioId) || isSignedInPage()) return
    recordGuestWorkOffer(scenarioId)
  } catch {
    // As `noteGuestTurn`.
  }
}

/** Remove one decision: it was copied, refused for good, or the user said it is not theirs. */
export function forgetGuestWork(scenarioId: string): void {
  try {
    localStorage.removeItem(GUEST_WORK_PREFIX + scenarioId)
  } catch {
    // It stays offered, which fails safe.
  }
}

export function clearGuestWork(): void {
  for (const key of ledgerKeys()) {
    try {
      localStorage.removeItem(key)
    } catch {
      // The boundary's sweep removes the prefix as well.
    }
  }
}

/** Worked on within the window. A clock that moved backwards by more than the window counts as not recent. */
export function isRecentGuestWork(entry: GuestWorkEntry, now: number = Date.now()): boolean {
  if (entry.lastActiveAt === null) return false
  const age = now - entry.lastActiveAt
  return age <= RECENT_GUEST_WORK_MS && age >= -RECENT_GUEST_WORK_MS
}
