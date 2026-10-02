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
import { createSignInTransitionTracker, GUEST_COPIED_EVENT, handleAuthObservation, type GuestCopiedDetail } from '../../lib/guestCopyOnSignIn'
import { forgetPendingGuestCopyOnSignOut } from '../../lib/pendingGuestCopy'
import { adoptGuestCarry, dropGuestCarry } from '../results/modals/decisionRecordStore'

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
        void run?.then((result) => {
          // DECIDE & REVIEW S2: a copy that can never happen carries the guest's decision record nowhere.
          if (result.kind === 'not_copyable') dropGuestCarry(result.sourceScenarioId)
          // Only a copy this tab actually ADOPTED may move the view: if the user
          // opened something else meanwhile, adoption declined and so does this.
          if (result.kind !== 'copied' || !result.adopted || generation !== started) return
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
    // DECIDE & REVIEW S2 (DL ruling (B)): the guest's decision record moves ONLY with the copy of its own scenario,
    // by identity (source → copy ids), never by title.
    const onCopied = (event: Event) => {
      const detail = (event as CustomEvent<GuestCopiedDetail>).detail
      if (detail) adoptGuestCarry(detail.sourceScenarioId, detail.scenarioId)
    }
    window.addEventListener(GUEST_COPIED_EVENT, onCopied)
    return () => {
      window.removeEventListener(GUEST_COPIED_EVENT, onCopied)
      unsubscribe?.()
    }
  }, [startedWithStoredSession])

  return null
}
