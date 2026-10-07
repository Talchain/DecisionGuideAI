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

export const GUEST_WORK_KEY = 'olumi.guestWork.v1'

/**
 * Work this recent is what the user was doing when they signed in. A day covers "worked as a guest, then signed in"
 * in one sitting or across a lunch break; a decision last touched days ago is offered instead of copied.
 */
export const RECENT_GUEST_WORK_MS = 24 * 60 * 60 * 1000

/** Newest kept. A guest with more decisions than this in one browser loses only the OFFER for the oldest. */
export const GUEST_WORK_CAP = 20

/** The first thing the user typed, kept so an offer can be recognised. Cut at a word, never mid-word. */
const LABEL_MAX = 160

export interface GuestWorkEntry {
  readonly id: string
  /** When this browser last sent a turn for it. `null`: seen only as the pointer at a sign-in, so its age is unknown. */
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

/** The ledger, newest first; malformed rows are dropped. */
export function readGuestWork(): GuestWorkEntry[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(GUEST_WORK_KEY)
  } catch {
    return []
  }
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const entries: GuestWorkEntry[] = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue
    const { id, lastActiveAt, label } = row as Record<string, unknown>
    if (!isUuid(id) || seen.has(id.toLowerCase())) continue
    const at = typeof lastActiveAt === 'number' && Number.isFinite(lastActiveAt) ? lastActiveAt : null
    seen.add(id.toLowerCase())
    entries.push({ id, lastActiveAt: at, label: cleanLabel(label) })
  }
  return entries.sort(byRecency)
}

function writeGuestWork(entries: readonly GuestWorkEntry[]): boolean {
  try {
    if (entries.length === 0) localStorage.removeItem(GUEST_WORK_KEY)
    else localStorage.setItem(GUEST_WORK_KEY, JSON.stringify([...entries].sort(byRecency).slice(0, GUEST_WORK_CAP)))
    return true
  } catch {
    return false
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
  const entries = readGuestWork()
  const existing = entries.find((e) => e.id.toLowerCase() === scenarioId.toLowerCase())
  const rest = entries.filter((e) => e !== existing)
  writeGuestWork([{ id: scenarioId, lastActiveAt: now, label: existing?.label ?? cleanLabel(label) }, ...rest])
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

/** Record a decision whose age is unknown (the pointer at a sign-in, never seen by the ledger) as an offer. */
export function recordGuestWorkOffer(scenarioId: string): void {
  if (!isUuid(scenarioId)) return
  const entries = readGuestWork()
  if (entries.some((e) => e.id.toLowerCase() === scenarioId.toLowerCase())) return
  writeGuestWork([...entries, { id: scenarioId, lastActiveAt: null, label: null }])
}

/** Remove one decision: it was copied, refused for good, or the user said it is not theirs. */
export function forgetGuestWork(scenarioId: string): void {
  const entries = readGuestWork()
  const next = entries.filter((e) => e.id.toLowerCase() !== scenarioId.toLowerCase())
  if (next.length !== entries.length) writeGuestWork(next)
}

export function clearGuestWork(): void {
  try {
    localStorage.removeItem(GUEST_WORK_KEY)
  } catch {
    // The boundary's sweep removes the key as well.
  }
}

/** Worked on within the window. A clock that moved backwards by more than the window counts as not recent. */
export function isRecentGuestWork(entry: GuestWorkEntry, now: number = Date.now()): boolean {
  if (entry.lastActiveAt === null) return false
  const age = now - entry.lastActiveAt
  return age <= RECENT_GUEST_WORK_MS && age >= -RECENT_GUEST_WORK_MS
}
