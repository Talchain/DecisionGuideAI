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
 *   - this is a guest session (no Supabase load exists), OR the Supabase load for THIS route id has SETTLED (success or
 *     failure, so a failed load never blocks the read).
 * The CEE merge then runs over the Supabase-hydrated canvas: the path it was designed for ("values from CEE, layout from
 * local"). Guests wait only for auth to resolve.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * How long a CEE read waits for auth before it proceeds anyway. Auth resolves from `getSession` (a local read in the
 * common case); this bounds the pathological one (Supabase unreachable and `getSession` never settling), where the canvas
 * must still open. If auth then resolves to a signed-in user AFTER the bound, the old order can recur for that one open.
 * That is a bounded, logged degradation, never a blank canvas.
 */
export const AUTH_WAIT_BOUND_MS = 4000

export interface BootServerReadInputs {
  readonly authLoading: boolean
  readonly authWaitExpired: boolean
  readonly isPersistenceActive: boolean
  readonly routeId: string | null | undefined
  readonly supabaseSettledFor: string | null
}

/** Pure: may the CEE graph read start now? (See the header for the rule.) */
export function serverReadEnabled(i: BootServerReadInputs): boolean {
  if (i.authLoading && !i.authWaitExpired) return false
  if (!i.isPersistenceActive || !i.routeId) return true
  return i.supabaseSettledFor === i.routeId
}

/**
 * The hook `CanvasMVP` passes to `useServerGraphHydration` as `enabled`. `supabaseSettledFor` is the route id whose
 * `loadSupabaseScenario` promise has settled (`CanvasMVP` sets it in `finally`).
 */
export function useBootServerReadEnabled(
  routeId: string | null | undefined,
  isPersistenceActive: boolean,
  supabaseSettledFor: string | null,
): boolean {
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
  return serverReadEnabled({ authLoading, authWaitExpired, isPersistenceActive, routeId, supabaseSettledFor })
}
