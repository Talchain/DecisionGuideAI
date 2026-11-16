/**
 * On the core lane the address IS the scenario (`/#/scenario/<uuid>`, `olumiCore/team/sid.ts`). The route's cold-load gate decides once per
 * page (`canvas/hydrate/coldLoadDeepLink.ts`), so changing the address without a reload left the previous scenario's title, model and
 * record link on screen, and a press there was saved in that scenario (Codex 006 #1). Here the canvas store and the View follow every
 * address that names a core scenario: the previous View is dropped at once (`use` clears it before it reads), so nothing of the scenario
 * left behind is drawn while the new one loads. Writes are checked against the address as well (`team/api.ts` `writeTargetsAddress`).
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../canvas/store'
import { setCurrentScenarioId } from '../canvas/store/scenarios'
import { scenarioIdWrite } from '../canvas/stores/unboundModelBinding'
import { coreScenarioIdOf } from '../olumiCore/team/sid'
import { useViewStore } from './store'

/** Moves the page to the addressed scenario; true when it moved. An address naming no core scenario moves nothing. */
export function followAddress(route: string | null | undefined): boolean {
  if (typeof route !== 'string' || coreScenarioIdOf(route) === null) return false
  const now = useCanvasStore.getState().currentScenarioId
  if (now === route && useViewStore.getState().uuid === route) return false
  if (now !== route) {
    useCanvasStore.setState(scenarioIdWrite(now, route))
    setCurrentScenarioId(route)
  }
  void useViewStore.getState().use(route)
  return true
}

export function useAddressIsTheScenario(on: boolean, route: string | null | undefined): void {
  useEffect(() => { if (on) followAddress(route) }, [on, route])
}
