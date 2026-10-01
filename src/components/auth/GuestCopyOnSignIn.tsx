/**
 * ACCOUNTS B3 — the one place a guest → signed-in transition starts the copy.
 *
 * Mounted once at the app shell, inside the router, so EVERY sign-in path is
 * covered: password on /login, magic link and invite on /auth/confirm (a new
 * page load), /auth/callback, and another tab signing in. `LoginPage` alone
 * would only see password sign-in.
 *
 * Renders nothing and never blocks sign-in: the copy runs after the auth event,
 * and its outcome only refreshes the list (via `GUEST_COPIED_EVENT`) and, when
 * the user is still looking at the guest decision, opens the copy instead.
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { hasStoredSupabaseSession } from '../../lib/storedSupabaseSession'
import { createSignInTransitionTracker, handleAuthObservation } from '../../lib/guestCopyOnSignIn'
import { forgetPendingGuestCopyOnSignOut } from '../../lib/pendingGuestCopy'

export default function GuestCopyOnSignIn(): null {
  const navigate = useNavigate()
  const location = useLocation()
  // Read at outcome time, not subscription time: the copy lands after the
  // sign-in has already navigated. Held in refs so the subscription below is made
  // ONCE: under a non-data router `navigate` changes identity on every route
  // change, and resubscribing would reset the tracker and re-send a pending copy
  // on each navigation.
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    const tracker = createSignInTransitionTracker(hasStoredSupabaseSession())
    let unsubscribe: (() => void) | undefined
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') forgetPendingGuestCopyOnSignOut()
        const run = handleAuthObservation(tracker.observe(Boolean(session)), session?.access_token)
        void run?.then((result) => {
          if (result.kind !== 'copied') return
          // Still on the guest decision (the canvas, or its own route): open the
          // copy. Anywhere else (the hub after sign-in), the refreshed list shows it.
          const path = pathRef.current
          if (path === '/canvas' || path === `/scenario/${result.sourceScenarioId}`) {
            navigateRef.current(`/scenario/${result.scenarioId}`, { replace: true })
          }
        })
      })
      unsubscribe = () => data?.subscription?.unsubscribe?.()
    } catch {
      // Auth unavailable (a stubbed or failing client): there is no sign-in to
      // follow, and the shell must still boot — `OptionalAuthProvider`'s rule.
    }
    return () => unsubscribe?.()
  }, [])

  return null
}
