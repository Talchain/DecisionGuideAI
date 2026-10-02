/**
 * ACCOUNTS "Invite a colleague": VIEWER MODE, decided by ONE flag that comes from
 * the server's `scenario_access` (owner ruling 522325 on #85; file list 5947724883).
 *
 * A colleague the owner shared with opens the SAME canvas route as the owner.
 * The model and the latest Run reach them through CEE's graph read, which
 * admits a member. The Supabase row load returns null for them, because
 * `scenarios` RLS stays owner-only, and that settles the boot gate exactly as a
 * guest's would. This module answers ONE question for the surfaces that write:
 * "is the decision on screen one this user may only VIEW?"
 *
 * ── THE SERVER IS THE AUTHORITY ─────────────────────────────────────────────
 * Every writer already refuses a member: the DB doors and the owner-only CEE
 * routes (#2448's harness ran against the live bodies). So the flag is
 * presentation plus quiet. Surfaces hide their edit controls and skip their
 * background writes, so a viewer never sees a refused-write error. Nothing
 * here grants anything.
 *
 * ── FAIL DIRECTION ──────────────────────────────────────────────────────────
 * The flag is ON only for an exact `'viewer'` answer for THIS route. A failed
 * or unknown answer leaves it OFF. That is deliberate: an owner whose access
 * read failed must keep their composer. A viewer misread as an owner only sees
 * controls the server refuses. Guests are never viewers: no persistence
 * session means no access read.
 *
 * ── THE BELT ────────────────────────────────────────────────────────────────
 * While the flag is on, a fetch guard answers every request to a CEE route that
 * CHANGES STATE with a local 403 `viewer_read_only`, without sending it. The
 * routes are the owner's lease list ("writers that must refuse a member",
 * 5947474393): turn, turn stop, graph register, versions save/restore, decision
 * records, copy, draft, orchestrate, collab. Reads, including the graph read
 * (a POST), pass untouched. The guard is installed the first time a viewer flag
 * turns on and is a pass-through whenever it is off, so an owner or guest
 * session never runs it at all.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { getScenarioAccess } from '../services/scenarioSharingService'

let viewerScenarioId: string | null = null
const listeners = new Set<() => void>()

function setViewerScenario(next: string | null): void {
  if (next === viewerScenarioId) return
  viewerScenarioId = next
  if (next !== null) installWriteBelt()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Non-React read, for callbacks and background writers. */
export function isViewerSession(): boolean {
  return viewerScenarioId !== null
}

/** The scenario this tab is viewing read-only, or null. */
export function viewerScenario(): string | null {
  return viewerScenarioId
}

/** True while the decision on screen is one this user may only view. */
export function useIsViewer(): boolean {
  return useSyncExternalStore(subscribe, isViewerSession, isViewerSession)
}

/**
 * The ONE writer of the flag, called by the canvas route. Asks the server once per
 * (route, persistence session). A stale route's answer never sets the flag for
 * another route, and leaving the route clears it.
 */
export function useScenarioViewerAccess(routeId: string | null | undefined, isPersistenceActive: boolean): void {
  useEffect(() => {
    if (!routeId || !isPersistenceActive) {
      setViewerScenario(null)
      return
    }
    let live = true
    setViewerScenario(null)
    void getScenarioAccess(routeId).then((access) => {
      if (live) setViewerScenario(access === 'viewer' ? routeId : null)
    })
    return () => {
      live = false
      setViewerScenario(null)
    }
  }, [routeId, isPersistenceActive])
}

// ── The belt ─────────────────────────────────────────────────────────────────

/**
 * CEE routes that change state, matched on the PATHNAME with a segment boundary,
 * so `/proxy/v5/turning` or `/scenarios/x/graph` (the read) never match.
 */
const STATE_CHANGING_CEE_ROUTES: readonly RegExp[] = [
  /\/proxy\/v5\/turn(?:\/|$)/,
  /^\/bff\/orchestrate\//,
  /^\/bff\/collab\//,
  /^\/bff\/cee\/turn(?:\/|$)/,
  /^\/bff\/cee\/draft-graph$/,
  /^\/bff\/cee\/scenarios\/[^/]+\/graph\/register$/,
  /^\/bff\/cee\/scenarios\/[^/]+\/versions\/(?:save|restore)$/,
  /^\/bff\/cee\/scenarios\/[^/]+\/copy$/,
  /^\/bff\/cee\/decision-records\//,
]

function pathnameOf(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return new URL(raw, globalThis.location?.origin ?? 'http://localhost').pathname
  } catch {
    return null
  }
}

/** Pure: would the belt refuse this request while a viewer flag is on? */
export function isStateChangingCeeRequest(input: RequestInfo | URL): boolean {
  const pathname = pathnameOf(input)
  return pathname !== null && STATE_CHANGING_CEE_ROUTES.some((re) => re.test(pathname))
}

let beltInstalled = false

function installWriteBelt(): void {
  if (beltInstalled || typeof globalThis.fetch !== 'function') return
  beltInstalled = true
  const passThrough = globalThis.fetch.bind(globalThis)
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (viewerScenarioId !== null && isStateChangingCeeRequest(input)) {
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'viewer_read_only' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return passThrough(input, init)
  }
}

/** Test seam: forget the flag and the belt (each spec file gets a fresh module anyway). */
export function __resetViewerModeForTests(): void {
  viewerScenarioId = null
  beltInstalled = false
  listeners.clear()
}
