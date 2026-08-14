/**
 * COLLAB — the round-roster cache behind render-time participant names (D1).
 *
 * ── WHY A CACHE AT ALL ────────────────────────────────────────────────────
 * Name resolution happens during RENDER, on a surface that re-renders whenever
 * the inspector's node changes. Without memoisation every render of an
 * attributed factor is a network request, and several attributed factors from
 * one round would each fetch the same roster. So the cache is not an
 * optimisation bolted on afterwards — it is what makes render-time resolution
 * a sane thing to do at all.
 *
 * ── THREE STATES, NOT TWO ─────────────────────────────────────────────────
 * `undefined` (never asked) · a roster · `null` (asked, and it did not work).
 * The third is stored rather than retried-on-sight, because a signed-out owner
 * or a round on another scenario fails EVERY time and a render-triggered retry
 * loop would hammer the seam for as long as the panel is open.
 *
 * ⚠ FRESHNESS IS AN R-2 CONCERN, WHICH IS WHY THE TTL EXISTS AND IS SHORT.
 * A cached label is a cached PERSON'S NAME. When the owner redacts a
 * participant, CEE starts serving the pseudonym — and any cache without an
 * expiry would keep rendering the detached name for the life of the tab, which
 * is the redaction routine failing quietly at the last hop. The TTL bounds that
 * window to `ROSTER_TTL_MS`; it is deliberately not "cache for the session".
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ─────────────────────────────
 * It never falls back to `openRoundRecord`'s `localStorage` names. That record
 * exists so an owner can return to an open round, and its copy of a name
 * survives the redaction that replaced it — reading it here would reinstate
 * exactly what R-2 detached. The only name source is the server.
 */

import { fetchRoundRoster } from './collabService'
import { requireOwnerAccessToken } from './ownerAccessToken'
import type { RosterEntry } from './participantNames'

/**
 * How long a roster answer (success OR failure) is reused.
 *
 * Five minutes: long enough that opening several attributed factors costs one
 * request, short enough that a redaction reaches every open tab without a
 * reload. Both arms share it — a failure that outlived a sign-in would leave
 * the surface permanently unable to name anybody.
 */
export const ROSTER_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  /** null = asked and could not answer. */
  roster: readonly RosterEntry[] | null
  storedAt: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<readonly RosterEntry[] | null>>()

/** Listeners woken when an entry lands, so a render can be re-run. */
const subscribers = new Set<() => void>()

function notify(): void {
  // A copy, because a subscriber may unsubscribe itself while being called.
  for (const fn of [...subscribers]) fn()
}

export function subscribeToRosters(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

function fresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && Date.now() - entry.storedAt < ROSTER_TTL_MS
}

/**
 * The synchronous read a render uses.
 *
 * `undefined` means "nothing known yet" and is what makes the caller's first
 * paint honest: it resolves to `roster_unavailable`, whose copy still says the
 * value came from the panel. It never means "no participants".
 */
export function peekRoster(roundId: string): readonly RosterEntry[] | null | undefined {
  const entry = cache.get(roundId)
  return fresh(entry) ? entry.roster : undefined
}

/**
 * Ensure a roster is being fetched, and return it when it lands.
 *
 * Idempotent per round while a request is in flight — the dedup is the whole
 * reason several attributed factors from one round cost one request. Never
 * rejects: a failure is a cached `null`, because a surface that cannot name
 * somebody must keep rendering, and a thrown promise inside a render is how a
 * missing name becomes a blank panel.
 */
export function ensureRoster(roundId: string): Promise<readonly RosterEntry[] | null> {
  if (roundId === '') return Promise.resolve(null)

  const entry = cache.get(roundId)
  if (fresh(entry)) return Promise.resolve(entry.roster)

  const existing = inFlight.get(roundId)
  if (existing !== undefined) return existing

  const request = (async (): Promise<readonly RosterEntry[] | null> => {
    try {
      const accessToken = await requireOwnerAccessToken()
      const view = await fetchRoundRoster(accessToken, roundId)
      // PICKED, never spread. The response also carries `status` per row and the
      // round's whole target manifest; the resolver's contract is two fields,
      // and a spread would quietly widen what the cache holds about a person.
      const roster: RosterEntry[] = Array.isArray(view?.roster)
        ? view.roster
            .filter(
              (row): row is { participant_id: string; display_name: string; status: string } =>
                row !== null &&
                typeof row === 'object' &&
                typeof row.participant_id === 'string' &&
                typeof row.display_name === 'string',
            )
            .map((row) => ({
              participant_id: row.participant_id,
              display_name: row.display_name,
            }))
        : []
      cache.set(roundId, { roster, storedAt: Date.now() })
      return roster
    } catch {
      // Signed out, a round the caller does not own, a network failure. All
      // three are "cannot name them" at the surface, and none is worth
      // distinguishing there — the copy is the same and it is truthful.
      cache.set(roundId, { roster: null, storedAt: Date.now() })
      return null
    } finally {
      inFlight.delete(roundId)
      notify()
    }
  })()

  inFlight.set(roundId, request)
  return request
}

/** Test seam. Never called by product code. */
export function __resetRosterCacheForTests(): void {
  cache.clear()
  inFlight.clear()
  subscribers.clear()
}
