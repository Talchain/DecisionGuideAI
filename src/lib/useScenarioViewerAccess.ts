/**
 * ACCOUNTS viewer mode: THE ONE WRITER of the flag in `lib/viewerMode`, called by
 * the canvas route. Kept apart from that core so the store and the edit guards
 * read the flag without importing a Supabase client.
 */
import { useEffect } from 'react'
import { getScenarioAccess } from '../services/scenarioSharingService'
import { setOwnerScenario, setViewerScenario } from './viewerMode'

/**
 * The ONE writer of the flag, called by the canvas route. Asks the server once per
 * (route, signed-in user). A stale answer (another route, or another account
 * signed in from a second tab) never sets the flag, and leaving clears it.
 */
export function useScenarioViewerAccess(
  routeId: string | null | undefined,
  isPersistenceActive: boolean,
  userId: string | null,
): void {
  useEffect(() => {
    const clear = () => {
      setViewerScenario(null)
      setOwnerScenario(null)
    }
    if (!routeId || !isPersistenceActive || !userId) {
      clear()
      return
    }
    let live = true
    clear()
    void getScenarioAccess(routeId).then((access) => {
      if (!live) return
      setViewerScenario(access === 'viewer' ? routeId : null)
      setOwnerScenario(access === 'owner' ? routeId : null)
    })
    return () => {
      live = false
      clear()
    }
  }, [routeId, isPersistenceActive, userId])
}
