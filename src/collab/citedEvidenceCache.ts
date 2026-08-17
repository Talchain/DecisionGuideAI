/**
 * COLLAB — the cache and hook behind render-time citation resolution.
 *
 * Deliberately the same shape as `roundRosterCache.ts`: three states, a short
 * absolute TTL, in-flight dedup, a subscription so instances that did not
 * initiate the fetch still re-render, and a failure that is CACHED rather than
 * retried on sight. Those decisions were argued out for the roster and every
 * reason holds here; a second cache written to a different pattern is how two
 * surfaces start disagreeing about the same round.
 *
 * ── ⭐ WHY THIS FETCH IS NOT FOLDED INTO THE ROSTER CACHE ──────────────────
 * `fetchRoundRoster`'s header rejected `/reveal` for NAME resolution on data
 * minimisation: pulling every participant's number and verbatim wording into the
 * canvas to render one person's name is disproportionate, and `/preview` returns
 * the roster and nothing else. That reasoning is correct and it is why the roster
 * cache must keep using `/preview`.
 *
 * It does NOT forbid this fetch, and the distinction is the purpose. Here the
 * evidence content IS the thing being rendered — the owner asked to see what was
 * cited — so the projection that carries evidence is the proportionate one, not
 * an overreach. And it costs nothing in disclosure: the caller is the round's
 * OWNER, who already reads this exact view in full on `/scenario/:id/panel`.
 *
 * ── ⚠ IT IS FETCHED ONLY WHEN A CITATION EXISTS ───────────────────────────
 * The hook returns `no_citation` without touching the network for every value
 * that was not applied with a citation — which is almost every value on almost
 * every graph. So the heavier request is bought only by the factors that have
 * something to show, and an ordinary graph makes zero of them.
 *
 * ── FRESHNESS IS AN R-2 CONCERN, SAME AS THE ROSTER ───────────────────────
 * A cached citation carries `author_label`, which is CEE's `pseudonym ??
 * display_name`. When the owner redacts a participant, CEE starts serving the
 * pseudonym, and a cache without an expiry would keep rendering the detached
 * name for the life of the tab. The TTL bounds that window and is deliberately
 * not "cache for the session".
 */

import { useEffect, useState } from 'react'

import { fetchOwnerDisagreement, type DisagreementView } from './collabService'
import { readCitation, resolveCitedEvidence, type CitedEvidenceResolution } from './citedEvidence'
import { requireOwnerAccessToken } from './ownerAccessToken'

/**
 * How long a disagreement answer (success OR failure) is reused.
 *
 * Five minutes, matching `ROSTER_TTL_MS`. The two caches hold R-2-sensitive
 * labels from the same round and a redaction must reach both on the same
 * schedule; different windows would let one surface name somebody the other had
 * already stopped naming.
 */
export const CITED_EVIDENCE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  /** null = asked and could not answer. */
  view: DisagreementView | null
  storedAt: number
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<DisagreementView | null>>()
const subscribers = new Set<() => void>()

function notify(): void {
  // A copy, because a subscriber may unsubscribe itself while being called.
  for (const fn of [...subscribers]) fn()
}

export function subscribeToCitedEvidence(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

function fresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && Date.now() - entry.storedAt < CITED_EVIDENCE_TTL_MS
}

/**
 * The synchronous read a render uses.
 *
 * `undefined` means "nothing known yet", which resolves to `view_unavailable` —
 * a transient state whose honest rendering is no citation line, never an
 * assertion that nothing was cited.
 */
export function peekDisagreement(roundId: string): DisagreementView | null | undefined {
  const entry = cache.get(roundId)
  return fresh(entry) ? entry.view : undefined
}

/**
 * Ensure a round's disagreement view is being fetched, and return it when it
 * lands.
 *
 * Never rejects: a failure is a cached `null`. A surface that cannot resolve a
 * citation must keep rendering the value and its attribution, and a thrown
 * promise inside a render is how a missing citation becomes a blank panel.
 */
export function ensureDisagreement(roundId: string): Promise<DisagreementView | null> {
  if (roundId === '') return Promise.resolve(null)

  const entry = cache.get(roundId)
  if (fresh(entry)) return Promise.resolve(entry.view)

  const existing = inFlight.get(roundId)
  if (existing !== undefined) return existing

  const request = (async (): Promise<DisagreementView | null> => {
    try {
      const accessToken = await requireOwnerAccessToken()
      const view = await fetchOwnerDisagreement(accessToken, roundId)
      cache.set(roundId, { view, storedAt: Date.now() })
      return view
    } catch {
      // Signed out, a round the caller does not own, a round still open (CEE
      // refuses `collab_round_open` and it is RIGHT to), a network failure. All
      // are "cannot show the citation" at the surface, and none is worth
      // distinguishing there.
      cache.set(roundId, { view: null, storedAt: Date.now() })
      return null
    } finally {
      inFlight.delete(roundId)
      notify()
    }
  })()

  inFlight.set(roundId, request)
  return request
}

/**
 * The React half of render-time citation resolution.
 *
 * Never suspends and never throws, for the same reason `useParticipantName`
 * does not: the first paint of a cited factor happens before any view can have
 * arrived, so the FIRST answer is always `view_unavailable` and the surface must
 * already be truthful in that state. A citation appearing a moment later ADDS a
 * line; it never replaces a placeholder, because there is no placeholder.
 */
export function useCitedEvidence(elicitedFrom: unknown): CitedEvidenceResolution {
  const ref = readCitation(elicitedFrom)
  const roundId = ref?.round_id ?? ''

  // A revision counter, not the view itself: the cache owns the data, and
  // duplicating it into component state is how two copies start disagreeing.
  const [, bumpRevision] = useState(0)

  useEffect(() => {
    if (roundId === '') return
    const unsubscribe = subscribeToCitedEvidence(() => bumpRevision((n) => n + 1))
    void ensureDisagreement(roundId)
    return unsubscribe
  }, [roundId])

  // Resolution happens during RENDER from the cache's current answer, so a view
  // that was already warm renders the citation on the FIRST paint with no
  // intermediate frame.
  return resolveCitedEvidence(
    elicitedFrom,
    roundId === '' ? undefined : peekDisagreement(roundId),
  )
}

/** Test seam. Never called by product code. */
export function __resetCitedEvidenceCacheForTests(): void {
  cache.clear()
  inFlight.clear()
  subscribers.clear()
}
