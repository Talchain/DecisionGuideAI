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

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { hasStoredSupabaseSession } from '../../lib/storedSupabaseSession'
import { createSignInTransitionTracker, handleAuthObservation } from '../../lib/guestCopyOnSignIn'
import { forgetPendingGuestCopyOnSignOut } from '../../lib/pendingGuestCopy'

export default function GuestCopyOnSignIn(): null {
  const navigate = useNavigate()
  const location = useLocation()
  // Read ONCE, on the first render — before any effect (the auth SDK's own
  // init, a page's verifyOtp) can write a session — so a real guest sign-in is
  // never mistaken for a restore. The same reason as OptionalAuthProvider's seed.
  const [startedWithStoredSession] = useState(hasStoredSupabaseSession)
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
    const tracker = createSignInTransitionTracker(startedWithStoredSession)
    // One auth GENERATION per signed-in person. A sign-out or a different user
    // ends it, and a copy started under an ended generation clears, adopts,
    // announces and navigates nothing.
    let generation = 0
    let lastUserId: string | null = null
    let unsubscribe: (() => void) | undefined
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const userId = session?.user?.id ?? null
        if (event === 'SIGNED_OUT') {
          generation += 1
          forgetPendingGuestCopyOnSignOut()
        } else if (userId !== null && lastUserId !== null && userId !== lastUserId) {
          generation += 1
        }
        if (userId !== null) lastUserId = userId
        const started = generation
        const run = handleAuthObservation(tracker.observe(Boolean(session)), session?.access_token, {
          isCurrent: () => generation === started,
          viewAllowsAdoption: (source) => {
            const routed = /^\/scenario\/([^/]+)/.exec(pathRef.current)
            return routed === null || routed[1] === source
          },
        })
        void run?.then((results) => {
          // Only a copy this tab actually ADOPTED may move the view: if the user
          // opened something else meanwhile, adoption declined and so does this.
          // At most one adopts (only the decision on screen can).
          const adopted = results.find((result) => result.kind === 'copied' && result.adopted)
          if (adopted?.kind !== 'copied' || generation !== started) return
          const path = pathRef.current
          if (path === '/canvas' || path === `/scenario/${adopted.sourceScenarioId}`) {
            navigateRef.current(`/scenario/${adopted.scenarioId}`, { replace: true })
          }
        })
      })
      unsubscribe = () => data?.subscription?.unsubscribe?.()
    } catch {
      // Auth unavailable (a stubbed or failing client): there is no sign-in to
      // follow, and the shell must still boot — `OptionalAuthProvider`'s rule.
    }
    return () => unsubscribe?.()
  }, [startedWithStoredSession])

  return null
}
