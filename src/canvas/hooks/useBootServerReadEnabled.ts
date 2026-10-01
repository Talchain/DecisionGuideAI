/**
 * ⛔ THE BOOT RACE (DL 380e54 #85 5937384802; repro CANVAS 5937336419, amended 5937354495): ON A SIGNED-IN OPEN, THE CEE
 * GRAPH READ AND THE SUPABASE LOAD RAN UNCOORDINATED, AND WHICHEVER LANDED SECOND WON.
 *
 * `CanvasMVP` runs two effects for the same route id: `loadSupabaseScenario` (signed in only) and
 * `useServerGraphHydration` (every session). `loadScenario` → `hydrateGraphSlice` applies `DECISION_CONTEXT_CLEAR`, which
 * nulls `serverGraphIdentity`, `runDelta`, `limitVerdicts`, `bootAdmittedRevision` and `lastServerGraphHash`. When the
 * CEE read landed FIRST, the Supabase load wiped what it had just established, and nothing restored it. Measured on a
 * store probe: `serverGraphIdentity` went `cee-identity-1` → null on that order and survived the other.
 *
 * It was the COMMON order, not a rare one: `/scenario/:id` mounts the canvas with no auth gate, `useAuth().loading` starts
 * true, and `isPersistenceActive` reads false until auth resolves. So the CEE read started during auth loading, and the
 * Supabase load fired after it.
 *
 * THE RULE: the CEE read is ENABLED only when
 *   - auth has resolved (or its wait has passed `AUTH_WAIT_BOUND_MS`, so a hung auth never leaves the canvas blank), AND
 *   - this is a guest session (no Supabase load exists), OR the CURRENT Supabase load (route + generation) for THIS route
 *     has SETTLED (success or failure), OR its wait has passed `SUPABASE_LOAD_WAIT_BOUND_MS` (a hung load never leaves the
 *     canvas without its CEE state).
 * The CEE merge then runs over the Supabase-hydrated canvas: the path it was designed for ("values from CEE, layout from
 * local"). Guests wait only for auth to resolve.
 *
 * ROUND 2 (DL ruling #2422 5939155228; CODEX UI BUDDY CR 5939083741): every read is keyed to its LOAD GENERATION.
 *   1. LATE AUTH: auth resolves after the bound → the guest-path read has run → the signed-in load wipes it → that load's
 *      settle is a new epoch → exactly ONE more read restores it.
 *   2. HUNG LOAD: the wait is bounded; a load that lands after the bound wipes the restored graph, and its settle is a new
 *      epoch → exactly ONE more read restores it (the FENCE: the final state is always CEE over Supabase, the designed
 *      order). A hard discard of the late load would live in `useScenario.loadScenario` (`:891`), outside this PR.
 *   3. A→B→A: settlement names route AND generation, so a stale A's settle never enables a fresh A, and B's late settle
 *      never disables or enables anything (only the CURRENT generation may settle).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * How long a CEE read waits for auth before it proceeds anyway. Auth resolves from `getSession` (a local read in the
 * common case); this bounds the pathological one (Supabase unreachable and `getSession` never settling), where the canvas
 * must still open. If auth then resolves to a signed-in user AFTER the bound, the Supabase load runs after that read, and
 * its settle grants one more read (rule 1 in the header).
 */
export const AUTH_WAIT_BOUND_MS = 4000

/**
 * How long a signed-in CEE read waits for the route's Supabase load (rule 2). Bounds the same pathology on the load side.
 * A load that lands after it is fenced by one more read.
 */
export const SUPABASE_LOAD_WAIT_BOUND_MS = 6000

/** One Supabase load of one route. `gen` is unique per load attempt; only the CURRENT generation may settle. */
export interface SupabaseLoad {
  readonly routeId: string
  readonly gen: number
  readonly settled: boolean
}

export interface BootServerReadInputs {
  readonly authLoading: boolean
  readonly authWaitExpired: boolean
  readonly isPersistenceActive: boolean
  readonly routeId: string | null | undefined
  /** The CURRENT load (any route), or null before the first. */
  readonly load: SupabaseLoad | null
  /** The wait on THIS route's current load (or on its start) has passed `SUPABASE_LOAD_WAIT_BOUND_MS`. */
  readonly loadWaitExpired: boolean
}

function loadForRoute(i: BootServerReadInputs): SupabaseLoad | null {
  return i.load !== null && i.routeId && i.load.routeId === i.routeId ? i.load : null
}

/** Pure: may the CEE graph read start now? (See the header for the rule.) */
export function serverReadEnabled(i: BootServerReadInputs): boolean {
  if (i.authLoading && !i.authWaitExpired) return false
  if (!i.isPersistenceActive || !i.routeId) return true
  return loadForRoute(i)?.settled === true || i.loadWaitExpired
}

/**
 * WHICH read of the route this is: part of `useServerGraphHydration`'s once-only key, so each value is read at most once.
 * It moves only when a load of this route starts or settles, so a route gets one read per load generation, and none for a
 * stale generation:
 *   `no-supabase-load`          guest, no route, or the route's load has not started
 *   `supabase-load-pending:<g>` load <g> is in flight (read only once its wait has passed the bound)
 *   `after-supabase-load:<g>`   load <g> has settled (the ordinary signed-in read, and the one more read after a late load)
 */
export function bootServerReadEpoch(i: BootServerReadInputs): string {
  if (!i.isPersistenceActive || !i.routeId) return 'no-supabase-load'
  const load = loadForRoute(i)
  if (load === null) return 'no-supabase-load'
  return load.settled ? `after-supabase-load:${load.gen}` : `supabase-load-pending:${load.gen}`
}

/**
 * `CanvasMVP`'s ONE writer of the load record. `track` starts a new generation for the route and settles it (success or
 * failure) only while it is still the current one, so a superseded load's late settle changes nothing (rule 3).
 */
export function useSupabaseLoadTracker(): {
  load: SupabaseLoad | null
  track: (routeId: string, loading: Promise<unknown>) => void
} {
  const genRef = useRef(0)
  const [load, setLoad] = useState<SupabaseLoad | null>(null)
  const track = useCallback((routeId: string, loading: Promise<unknown>) => {
    genRef.current += 1
    const gen = genRef.current
    setLoad({ routeId, gen, settled: false })
    const settle = () => setLoad((cur) => (cur !== null && cur.gen === gen ? { ...cur, settled: true } : cur))
    loading.then(settle, settle)
  }, [])
  return { load, track }
}

/**
 * What `CanvasMVP` passes to `useServerGraphHydration`: `enabled` (the gate) and `readEpoch` (the once-only key).
 */
export function useBootServerRead(
  routeId: string | null | undefined,
  isPersistenceActive: boolean,
  load: SupabaseLoad | null,
): { enabled: boolean; readEpoch: string } {
  const { loading: authLoading } = useAuth()
  const [authWaitExpired, setAuthWaitExpired] = useState(false)
  useEffect(() => {
    if (!authLoading) return
    const t = setTimeout(() => {
      setAuthWaitExpired(true)
      // eslint-disable-next-line no-console
      console.warn('[boot] auth did not resolve within', AUTH_WAIT_BOUND_MS, 'ms; the server graph read proceeds without it')
    }, AUTH_WAIT_BOUND_MS)
    return () => clearTimeout(t)
  }, [authLoading])

  // The load wait, keyed to the route AND the generation it waits on: a new load (or a new route) restarts the bound.
  const authBlocked = authLoading && !authWaitExpired
  const current = load !== null && routeId && load.routeId === routeId ? load : null
  const waitKey = !authBlocked && isPersistenceActive && routeId && current?.settled !== true
    ? `${routeId}#${current?.gen ?? 'none'}`
    : null
  const [expiredWaitKey, setExpiredWaitKey] = useState<string | null>(null)
  useEffect(() => {
    if (waitKey === null) return
    const t = setTimeout(() => {
      setExpiredWaitKey(waitKey)
      // eslint-disable-next-line no-console
      console.warn('[boot] the scenario load did not settle within', SUPABASE_LOAD_WAIT_BOUND_MS, 'ms; the server graph read proceeds')
    }, SUPABASE_LOAD_WAIT_BOUND_MS)
    return () => clearTimeout(t)
  }, [waitKey])

  const inputs: BootServerReadInputs = {
    authLoading,
    authWaitExpired,
    isPersistenceActive,
    routeId,
    load,
    loadWaitExpired: waitKey !== null && expiredWaitKey === waitKey,
  }
  return { enabled: serverReadEnabled(inputs), readEpoch: bootServerReadEpoch(inputs) }
}
