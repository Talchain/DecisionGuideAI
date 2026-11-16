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
import { useViewChat } from './ViewChat'

/** Moves the page to the addressed scenario; true when it moved. An address naming no core scenario moves nothing. */
export function followAddress(route: string | null | undefined): boolean {
  if (typeof route !== 'string' || coreScenarioIdOf(route) === null) return false
  const now = useCanvasStore.getState().currentScenarioId, shown = useViewStore.getState().uuid
  if (now === route && shown === route) return false
  // Words typed for another scenario, or before any (a brief on a blank canvas), are never sent into this one: the composer is emptied and
  // the last refusal dropped (006 #1 and its delta review: text typed on A was still in the composer on B, one press from being saved in B).
  // A held challenge is kept, since it carries its own scenario and op (`ViewChat` `resendOf`), and its words return when the page is back on it.
  // A refused move (`gone`) is keyed by its scenario already.
  if (shown !== route) {
    const held = useViewChat.getState().held
    useViewChat.setState({ text: held !== null && held.uuid === route ? held.text : '', said: null })
  }
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
