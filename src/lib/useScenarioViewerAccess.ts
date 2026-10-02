/**
 * ACCOUNTS viewer mode: THE ONE WRITER of the flag in `lib/viewerMode`, called by
 * the canvas route. Kept apart from that core so the store and the edit guards
 * read the flag without importing a Supabase client.
 */
import { useEffect } from 'react'
import { getScenarioAccess } from '../services/scenarioSharingService'
import { setViewerScenario } from './viewerMode'

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
