/**
 * ⭐ A DEEP LINK OPENED ON A COLD LOAD IS THE SCENARIO ON SCREEN, EVEN IN A BROWSER THAT REMEMBERS ANOTHER ONE
 * (Canvas lane, DL 0df0e1, 4 Oct 2026; HIGH, persisted model).
 *
 * THE DEFECT. A browser that last worked on scenario Z keeps Z in two places: the pointer
 * (`olumi-canvas-current-scenario-id`) and the single autosave slot (`olumi-canvas-autosave`, stamped Z). Opening
 * `#/scenario/Y` in that browser put Z back on the canvas: the store seeds `currentScenarioId` from the pointer at module
 * load, `ReactFlowGraph`'s boot restores Z's autosave, and `useServerGraphHydration` reads the store's id, so the link was
 * never even read. #2383 adopted a link only into an EMPTY store, which a remembered scenario never is.
 *
 * THE RULE. On the first canvas mount of a page, a CEE-addressable route Y with an empty canvas SUPERSEDES the remembered
 * scenario Z (`resolveRestoredScenarioId`, the same rule the restore binds by). Three writes, in this order:
 *
 *   1. PRESERVE Z's main slot, byte for byte, under `olumi-canvas-autosave:<Z>`. It may be ahead of the server: edits
 *      are local first, canvas-only links and positions never reach CEE, and a draft can sit in the write-back window.
 *   2. THE POINTER becomes Y (DL ruling, 4 Oct). `resolveBootLoadSource` rests on one invariant: the autosave's id is a
 *      COPY OF THE POINTER (`useAutosave` stamps the store's id), so it is never ahead of it. Leaving the pointer at Z
 *      while the store, and so the autosave, says Y breaks that, and a later routeless reload binds Y's graph to Z.
 *      Read back: if it does not hold, nothing else is written and today's behaviour stands.
 *   3. THE MAIN SLOT becomes Y's own preserved copy if it has one, else nothing. Never Z's graph under Y's pointer.
 *
 * Then the store holds Y. `ReactFlowGraph`'s boot effect reads storage after this, so it restores Y's own copy (or
 * nothing) through its unchanged path, and `restoreAutosaveGraph` deletes the key only once that restore has run.
 *
 * ⚠ WHY THIS RUNS IN THE ROUTE'S RENDER AND NOT IN AN EFFECT. Every hook below the route captures `currentScenarioId`
 * in its first render, and React flushes that commit's passive effects BEFORE re-rendering for a layout effect's update.
 * So a layout-effect supersede still runs every first-commit effect with Z: `useConversation`'s once-per-mount transcript
 * restore would put Z's chat beside Y's model. Nothing can read the scenario before the route renders, so the route's
 * render is the one place that precedes every reader. It is idempotent: once per page (`settled`), and its writes leave
 * storage in a state where a repeat finds nothing to supersede.
 *
 * NOT CHANGED. A link opened later in the page (an in-app navigation), a canvas already on screen (a guest's draft), a
 * remembered id equal to the route, and a browser that remembers nothing (#2383's fresh guest) all behave as before.
 */

import * as scenarios from '../store/scenarios'
import { useCanvasStore } from '../store'
import { isUUID } from '../../services/turn-request-builder'
import { isCeeAddressableScenarioId } from './bootGraphRead'

/** `scenarios.ts`'s AUTOSAVE_KEY, which it does not export. Pinned by a row that drives the real `saveAutosave`. */
export const MAIN_AUTOSAVE_SLOT = 'olumi-canvas-autosave'

/**
 * Where a superseded scenario's main slot is kept, verbatim, until a link brings that scenario back. The key belongs to
 * `scenarios.ts`, whose `deleteScenario` removes it with the record (no resurrection of a deleted model).
 */
export function keyedAutosaveSlot(scenarioId: string): string {
  return scenarios.keyedAutosaveKey(scenarioId)
}

/**
 * The id a restored autosave is bound to: the pointer when it is well formed, else the autosave's own stamp. Moved here
 * unchanged from `ReactFlowGraph.tsx`, which re-exports it (see `bindRestoredScenarioId` there for why the pointer wins).
 */
export function resolveRestoredScenarioId(
  pointerId: string | null,
  autosaveScenarioId: string | null | undefined,
): string | null {
  if (pointerId && isUUID(pointerId)) return pointerId
  if (autosaveScenarioId && isUUID(autosaveScenarioId)) return autosaveScenarioId
  return null
}

/** A removal that cannot throw: this runs in the route's render, and storage can fail at any call. */
function removeQuietly(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage unavailable: there is nothing it could still be holding for us.
  }
}

/** The scenario a cold boot of this browser would restore. */
export function rememberedScenarioId(): string | null {
  return resolveRestoredScenarioId(scenarios.getCurrentScenarioId(), scenarios.loadAutosave()?.scenarioId)
}

/**
 * The three writes above, for `route`. Returns 'applied' when the pointer and the store now name `route`, else
 * 'declined' with storage and the store exactly as they were (a preserve already written is rolled back).
 */
export function supersedeRememberedScenario(route: string): 'applied' | 'declined' {
  const remembered = rememberedScenarioId()
  if (remembered === null || remembered === route) return 'declined'
  const keyedRemembered = keyedAutosaveSlot(remembered)
  let previousCopy: string | null
  try {
    previousCopy = localStorage.getItem(keyedRemembered)
    const main = localStorage.getItem(MAIN_AUTOSAVE_SLOT)
    if (main !== null) localStorage.setItem(keyedRemembered, main)
  } catch {
    return 'declined'
  }
  // Roll the preserve back: a copy left behind could go stale and come back later through a link to this scenario.
  const rollBackPreserve = (): void => {
    try {
      if (previousCopy === null) localStorage.removeItem(keyedRemembered)
      else localStorage.setItem(keyedRemembered, previousCopy)
    } catch {
      removeQuietly(keyedRemembered)
    }
  }
  scenarios.setCurrentScenarioId(route)
  if (scenarios.getCurrentScenarioId() !== route) {
    rollBackPreserve()
    return 'declined'
  }
  let mainIsTheRoutes: boolean
  try {
    const own = localStorage.getItem(keyedAutosaveSlot(route))
    if (own === null) localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    else localStorage.setItem(MAIN_AUTOSAVE_SLOT, own)
    mainIsTheRoutes = true
  } catch {
    // The preserved copy did not fit back: empty the slot instead.
    removeQuietly(MAIN_AUTOSAVE_SLOT)
    try {
      mainIsTheRoutes = localStorage.getItem(MAIN_AUTOSAVE_SLOT) === null
    } catch {
      mainIsTheRoutes = false
    }
  }
  if (!mainIsTheRoutes) {
    // Storage would leave the remembered graph under the route's pointer. Undo, and today's behaviour stands.
    scenarios.setCurrentScenarioId(remembered)
    rollBackPreserve()
    return 'declined'
  }
  useCanvasStore.setState({ currentScenarioId: route })
  return 'applied'
}

let settled = false
let claimedRoute: string | null = null

/**
 * Called by the canvas route FIRST, before any hook reads the scenario id. Decides once per page.
 * 'not_first' for every later mount; 'declined' or 'applied' for the first.
 */
export function claimColdLoadDeepLink(route: string | null | undefined): 'applied' | 'declined' | 'not_first' {
  if (settled) return 'not_first'
  settled = true
  if (!isCeeAddressableScenarioId(route)) return 'declined'
  const st = useCanvasStore.getState()
  if (st.nodes.length > 0 || st.edges.length > 0) return 'declined'
  if (supersedeRememberedScenario(route) !== 'applied') return 'declined'
  claimedRoute = route
  return 'applied'
}

/** The route this page's cold load adopted, if any: the store's id then came from a link (`useServerGraphHydration`). */
export function coldLoadClaimedRoute(): string | null {
  return claimedRoute
}

/**
 * After the boot restore put `boundId`'s graph on screen: the preserved copy it came from has done its job. Deleted only
 * when the main slot still holds exactly that copy's bytes, so a copy is never lost to a restore that did not take it.
 */
export function settleKeyedAutosaveCopy(boundId: string | null): boolean {
  if (!boundId) return false
  try {
    const key = keyedAutosaveSlot(boundId)
    const keyed = localStorage.getItem(key)
    if (keyed === null || keyed !== localStorage.getItem(MAIN_AUTOSAVE_SLOT)) return false
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function __resetColdLoadDeepLinkForTests(): void {
  settled = false
  claimedRoute = null
}
