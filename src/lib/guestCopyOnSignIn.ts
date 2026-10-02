/**
 * ACCOUNTS B3 — when a guest signs in, copy the decision they were building into
 * their account (CEE #2493), then point the canvas at the COPY.
 *
 * The copy is a NEW owned scenario: title + graph, no Run, no conversation. The
 * guest row is never written. So after a copy the canvas must not keep showing
 * the guest's local state under the new id: the guest autosave carries the guest
 * graph AND its analysis, and a pointer moved on its own would let the boot
 * restore paint the guest's Run onto a copy that has none. `adoptScenario` is
 * the store's existing "open another scenario on a clean slate" (example D1
 * uses it): it clears the autosave, resets every scenario-scoped field and
 * adopts the id. It runs ONLY while the pointer still names the guest source,
 * so a user who has already opened something else is never pulled away.
 *
 * DL #85 5942022182 condition 3: called once on sign-in; a failure never blocks
 * sign-in (nothing here is awaited by the sign-in path, and nothing throws).
 */

import { capturePendingGuestCopy, clearPendingGuestCopy, readCurrentScenarioPointer, readPendingGuestCopy } from './pendingGuestCopy'
import { requestGuestCopy } from '../services/guestCopyService'

/** Window event fired after a copy lands, so "My decisions" can refetch. */
export const GUEST_COPIED_EVENT = 'accounts:guest-copied'

export interface GuestCopiedDetail {
  sourceScenarioId: string
  scenarioId: string
  created: boolean
}

export type GuestCopyRun =
  | { kind: 'nothing_pending' }
  | { kind: 'copied'; sourceScenarioId: string; scenarioId: string; created: boolean; adopted: boolean }
  | { kind: 'not_copyable'; sourceScenarioId: string }
  | { kind: 'retry_later'; sourceScenarioId: string; reason: string }
  /** The account changed (or signed out) while the request ran: nothing was cleared, adopted or announced. */
  | { kind: 'stale'; sourceScenarioId: string }

export interface GuestCopyDeps {
  request?: typeof requestGuestCopy
  /**
   * Open the copy on a clean canvas, only if the canvas still shows the guest
   * source. Returns whether it adopted. Defaults to the canvas store.
   */
  adopt?: (sourceScenarioId: string, copyScenarioId: string, isCurrent: () => boolean) => Promise<boolean>
  /** False once the auth generation that started this run has ended (sign-out, account change). */
  isCurrent?: () => boolean
  /**
   * False while the view names a DIFFERENT scenario (e.g. its route is loading
   * one). Adopting then would bump the canvas epoch and make that in-flight open
   * refuse to apply (#2418's fence), leaving the copy's empty canvas under the
   * other decision's route.
   */
  viewAllowsAdoption?: (sourceScenarioId: string) => boolean
}

async function adoptInCanvasStore(sourceScenarioId: string, copyScenarioId: string, isCurrent: () => boolean): Promise<boolean> {
  // Loaded on demand: the store belongs to the lazily loaded canvas routes, and
  // this runs at most once per sign-in.
  const { useCanvasStore } = await import('../canvas/store')
  // ⚠ RE-CHECKED HERE, SYNCHRONOUSLY WITH THE ADOPTION, not before the await:
  // the user can open another decision while the store loads, and
  // `useScenario.loadScenario` changes the LIVE store without writing the disk
  // pointer. Both must still name the guest source, or adopting would wipe the
  // decision now on screen.
  const store = useCanvasStore.getState()
  if (!isCurrent() || store.currentScenarioId !== sourceScenarioId || readCurrentScenarioPointer() !== sourceScenarioId) {
    return false
  }
  store.adoptScenario(copyScenarioId)
  return true
}

let inFlight: { token: string; run: Promise<GuestCopyRun> } | null = null

/**
 * Copy whatever guest id is pending. Concurrent calls WITH THE SAME TOKEN share
 * one request (two auth events in a tick, StrictMode's double mount). A
 * different token is a different sign-in and never joins another's run.
 */
export function runPendingGuestCopy(accessToken: string, deps: GuestCopyDeps = {}): Promise<GuestCopyRun> {
  if (inFlight && inFlight.token === accessToken) return inFlight.run
  const entry = { token: accessToken, run: copyPending(accessToken, deps) }
  inFlight = entry
  void entry.run.finally(() => {
    if (inFlight === entry) inFlight = null
  })
  return entry.run
}

async function copyPending(accessToken: string, deps: GuestCopyDeps): Promise<GuestCopyRun> {
  const source = readPendingGuestCopy()
  if (source === null) return { kind: 'nothing_pending' }
  const isCurrent = deps.isCurrent ?? (() => true)

  const outcome = await (deps.request ?? requestGuestCopy)(source, accessToken)

  if (!isCurrent()) return { kind: 'stale', sourceScenarioId: source }
  if (outcome.kind === 'retry_later') {
    // Kept: 401, 429, 503, a network failure, or an unrecognised answer. The next
    // sign-in or signed-in page load tries again.
    return { kind: 'retry_later', sourceScenarioId: source, reason: outcome.reason }
  }
  if (outcome.kind === 'not_copyable') {
    // Terminal: absent, owned, no model, too large or malformed. It will never copy.
    clearPendingGuestCopy(source)
    return { kind: 'not_copyable', sourceScenarioId: source }
  }

  clearPendingGuestCopy(source)
  let adopted = false
  if (readCurrentScenarioPointer() === source) {
    try {
      const viewAllows = deps.viewAllowsAdoption ?? (() => true)
      adopted = await (deps.adopt ?? adoptInCanvasStore)(source, outcome.scenarioId, () => isCurrent() && viewAllows(source))
    } catch {
      // The copy exists and is listed either way; only the canvas stays put.
    }
  }
  const detail: GuestCopiedDetail = { sourceScenarioId: source, scenarioId: outcome.scenarioId, created: outcome.created }
  try {
    window.dispatchEvent(new CustomEvent<GuestCopiedDetail>(GUEST_COPIED_EVENT, { detail }))
  } catch {
    // No window (non-browser host): nothing is listening.
  }
  return { kind: 'copied', ...detail, adopted }
}

export type AuthObservation = 'transition' | 'restored' | 'none'

/**
 * Tells a real guest → signed-in transition apart from a session that merely
 * reappears.
 *
 * ⚠ `SIGNED_IN` IS NOT "JUST SIGNED IN". gotrue also emits it when it recovers a
 * stored session and when a tab regains focus, so capturing on every
 * `SIGNED_IN` would re-record a returning user's OWN pointer and re-send the
 * copy on every focus. A transition is a session arriving after this page has
 * seen NO session.
 *
 * ⚠ THE EVENT STREAM ALONE CAN MISS IT. On a magic-link or invite page load,
 * `verifyOtp` can finish before `INITIAL_SESSION` reaches a new subscriber, and
 * then the first event already carries the session. So the tracker is seeded
 * from a synchronous read of storage at mount: no stored session then means the
 * page started signed out.
 *
 * - `transition`: capture the guest pointer, then copy.
 * - `restored`: the first session of a page that started signed in. Copy only
 *   what an earlier attempt left pending; capture nothing.
 * - `none`: do nothing.
 */
export function createSignInTransitionTracker(startedWithStoredSession: boolean) {
  let sawNoSession = !startedWithStoredSession
  let handledThisPage = false
  return {
    observe(hasSession: boolean): AuthObservation {
      if (!hasSession) {
        sawNoSession = true
        return 'none'
      }
      if (sawNoSession) {
        sawNoSession = false
        handledThisPage = true
        return 'transition'
      }
      if (!handledThisPage) {
        handledThisPage = true
        return 'restored'
      }
      return 'none'
    },
  }
}

/**
 * Apply one auth observation from inside an `onAuthStateChange` callback.
 *
 * The capture is SYNCHRONOUS, so it lands before the sign-in navigates anywhere
 * that could rewrite the pointer. The request is SCHEDULED out of the callback:
 * supabase-js runs callbacks under its auth lock, and this codebase never chains
 * work inside one (see `OptionalAuthProvider`'s deferred profile fetch).
 */
export function handleAuthObservation(
  verdict: AuthObservation,
  accessToken: string | null | undefined,
  deps: GuestCopyDeps = {},
  schedule: (run: () => void) => void = (run) => { setTimeout(run, 0) },
): Promise<GuestCopyRun> | null {
  if (verdict === 'none' || !accessToken) return null
  if (verdict === 'transition') capturePendingGuestCopy()
  if (readPendingGuestCopy() === null) return null
  return new Promise<GuestCopyRun>((resolve) => {
    schedule(() => { void runPendingGuestCopy(accessToken, deps).then(resolve) })
  })
}
