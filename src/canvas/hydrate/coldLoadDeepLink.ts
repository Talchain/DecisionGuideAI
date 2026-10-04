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
 * THE RULE. On the first committed canvas mount of a page, a CEE-addressable route Y with an empty canvas SUPERSEDES the
 * remembered scenario Z (`resolveRestoredScenarioId`, the same rule the restore binds by). In this order:
 *
 *   1. PRESERVE the main slot, byte for byte, under its OWN stamp: `olumi-canvas-autosave:<stamp>`. It may be ahead of
 *      the server: edits are local first, canvas-only links and positions never reach CEE, and a draft can sit in the
 *      write-back window. The stamp, not the pointer, says whose graph it is. A slot that states no readable stamp is
 *      ambiguous and nothing is superseded. A slot already stamped Y is Y's own and stays where it is.
 *   2. THE POINTER becomes Y (DL ruling, 4 Oct). `resolveBootLoadSource` rests on one invariant: the autosave's id is a
 *      COPY OF THE POINTER (`useAutosave` stamps the store's id), so it is never ahead of it. Read back.
 *   3. THE MAIN SLOT becomes Y's own preserved copy (only if it parses and is stamped Y), or nothing.
 *
 * Any step that does not hold puts the ORIGINAL pointer back exactly (absent stays absent) and rolls the preserve back.
 * A rollback that cannot be completed keeps the copy: a copy is recovery evidence and is never deleted on a failure.
 * Then the store holds Y. `ReactFlowGraph`'s boot reads storage after this, restores Y's own copy (or nothing) through
 * its unchanged path, and `settleKeyedAutosaveCopy` retires a copy once that restore, or a newer one, is on screen.
 *
 * ⚠ WHEN. In a LAYOUT effect of the route's gate (`useColdLoadDeepLinkGate`), never in render: a render can be thrown
 * away, and a write made by one would outlive it. The gate decides at render with a PURE read; when a supersede is due
 * it renders nothing, applies at commit, and only then mounts the route's body. Every hook in the body therefore first
 * renders with Y (no first-commit effect ever runs on Z: measured, `useConversation`'s once-per-mount restore otherwise
 * asks for Z's transcript), and nothing paints in between.
 *
 * NOT CHANGED. A link opened later in the page (an in-app navigation), a canvas already on screen (a guest's draft), a
 * remembered id equal to the route, and a browser that remembers nothing (#2383's fresh guest) all behave as before.
 */

import { useLayoutEffect, useState } from 'react'
import * as scenarios from '../store/scenarios'
import { useCanvasStore } from '../store'
import { isUUID } from '../../services/turn-request-builder'
import { isCeeAddressableScenarioId } from './bootGraphRead'

/** `scenarios.ts`'s AUTOSAVE_KEY, which it does not export. Pinned by a row that drives the real `saveAutosave`. */
export const MAIN_AUTOSAVE_SLOT = 'olumi-canvas-autosave'
const POINTER_KEY = 'olumi-canvas-current-scenario-id'

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

/** A read that cannot throw: `undefined` when storage refused. */
function read(key: string): string | null | undefined {
  try {
    return localStorage.getItem(key)
  } catch {
    return undefined
  }
}
/** A write that cannot throw: whether it was accepted. */
function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** The stamp a slot's bytes carry, when they parse as an autosave stamped with a well-formed id. */
function stampOf(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  try {
    const id = (JSON.parse(raw) as { scenarioId?: unknown } | null)?.scenarioId
    return typeof id === 'string' && isUUID(id) ? id : null
  } catch {
    return null
  }
}
function timestampOf(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null
  try {
    const t = (JSON.parse(raw) as { timestamp?: unknown } | null)?.timestamp
    return typeof t === 'number' && Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

/** The scenario a cold boot of this browser would restore. */
export function rememberedScenarioId(): string | null {
  const pointer = read(POINTER_KEY)
  return resolveRestoredScenarioId(pointer ?? null, stampOf(read(MAIN_AUTOSAVE_SLOT)))
}

/**
 * What the first canvas mount of this page should do for `route`, decided by READS ONLY:
 *   'supersede' — another scenario is remembered (the three writes above);
 *   'promote'   — the route IS remembered, its main slot is empty, and its own preserved copy is waiting (a promotion
 *                 that could not complete earlier is retried, so a copy is never stranded);
 *   null        — nothing to do (also for every later mount, and for an ambiguous main slot).
 */
export type ColdLoadPlan = { readonly kind: 'supersede' | 'promote'; readonly route: string }
export function planColdLoadDeepLink(route: string | null | undefined): ColdLoadPlan | null {
  if (settled || !isCeeAddressableScenarioId(route)) return null
  const st = useCanvasStore.getState()
  if (st.nodes.length > 0 || st.edges.length > 0) return null
  const main = read(MAIN_AUTOSAVE_SLOT)
  const pointer = read(POINTER_KEY)
  if (main === undefined || pointer === undefined) return null
  // A main slot that states no readable owner is ambiguous: never move it under a guess.
  if (main !== null && stampOf(main) === null) return null
  const remembered = resolveRestoredScenarioId(pointer, stampOf(main))
  if (remembered === null) return null
  if (remembered !== route) return { kind: 'supersede', route }
  const own = read(keyedAutosaveSlot(route))
  return main === null && stampOf(own) === route ? { kind: 'promote', route } : null
}

/** Apply `plan` (re-validated by the caller). 'applied' when the pointer and the store now name the route. */
function applyColdLoadPlan(plan: ColdLoadPlan): 'applied' | 'declined' {
  const { route } = plan
  const originalPointer = read(POINTER_KEY)
  const main = read(MAIN_AUTOSAVE_SLOT)
  const own = read(keyedAutosaveSlot(route))
  if (originalPointer === undefined || main === undefined || own === undefined) return 'declined'
  const promotable = stampOf(own) === route ? own : null

  // 1. PRESERVE the main slot under its own stamp, unless it is already the route's.
  const owner = main === null ? null : stampOf(main)
  const mainIsTheRoutes = owner === route
  let undoPreserve = (): boolean => true
  if (main !== null && owner !== null && !mainIsTheRoutes) {
    const ownerKey = keyedAutosaveSlot(owner)
    const previousCopy = read(ownerKey)
    if (previousCopy === undefined || !write(ownerKey, main)) return 'declined'
    // Never deletes evidence it cannot replace: a failed restore of the earlier copy leaves the (newer) duplicate.
    undoPreserve = () => write(ownerKey, previousCopy)
  }
  const undoPointer = (): boolean =>
    read(POINTER_KEY) === originalPointer || (write(POINTER_KEY, originalPointer) && read(POINTER_KEY) === originalPointer)
  // 2. THE POINTER. Undone first on a failure: only once it is back does a rolled-back preserve leave nothing to recover.
  if (!write(POINTER_KEY, route) || read(POINTER_KEY) !== route) {
    if (undoPointer()) undoPreserve()
    return 'declined'
  }

  // 3. THE MAIN SLOT: the route's own copy, or (unless the slot is already the route's) nothing.
  const next = mainIsTheRoutes ? main : promotable
  if (next !== main && (!write(MAIN_AUTOSAVE_SLOT, next) || read(MAIN_AUTOSAVE_SLOT) !== next)) {
    // A promotion that does not take declines the whole claim, and is retried on the next cold load ('promote').
    if (undoPointer()) {
      undoPreserve()
      return 'declined'
    }
    // The pointer cannot be put back, so it names the route. The remembered graph must then not sit under it (it is
    // safe in its preserved copy), and the route is adopted so that the store and the pointer agree.
    write(MAIN_AUTOSAVE_SLOT, null)
  }

  useCanvasStore.setState({ currentScenarioId: route })
  return 'applied'
}

let settled = false
let claimedRoute: string | null = null

/**
 * The page's first committed canvas mount, settled once: applies the plan for `route` when `apply` (the gate decided at
 * render that one is due), and only marks the page settled otherwise. 'not_first' for every later call.
 */
export function claimColdLoadDeepLink(
  route: string | null | undefined,
  apply = true,
): 'applied' | 'declined' | 'not_first' {
  if (settled) return 'not_first'
  const plan = apply ? planColdLoadDeepLink(route) : null
  settled = true
  if (plan === null || applyColdLoadPlan(plan) !== 'applied') return 'declined'
  claimedRoute = plan.route
  return 'applied'
}

/**
 * The route's gate. A pure decision at render; the writes at commit; the body mounts only after them, so its first
 * render already holds the route's scenario. Renders the body at once whenever nothing is due (the common case).
 */
export function useColdLoadDeepLinkGate(route: string | null | undefined): boolean {
  const [ready, setReady] = useState(() => planColdLoadDeepLink(route) === null)
  useLayoutEffect(() => {
    claimColdLoadDeepLink(route, !ready)
    if (!ready) setReady(true)
    // Mount only: the first committed mount decides once per page; a later route change is an in-app navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ready
}

/** The route this page's cold load adopted, if any: the store's id then came from a link (`useServerGraphHydration`). */
export function coldLoadClaimedRoute(): string | null {
  return claimedRoute
}

/**
 * After the boot restore put `boundId`'s graph on screen, a preserved copy of it is retired when what was restored is
 * that copy (the same bytes) or a NEWER slot stamped with the same id (the scenario was re-entered since). Otherwise it
 * is kept: a copy is never lost to a restore that did not take it.
 */
export function settleKeyedAutosaveCopy(boundId: string | null): boolean {
  if (!boundId) return false
  const key = keyedAutosaveSlot(boundId)
  const keyed = read(key)
  const main = read(MAIN_AUTOSAVE_SLOT)
  if (typeof keyed !== 'string' || typeof main !== 'string') return false
  const sameBytes = keyed === main
  const keyedAt = timestampOf(keyed)
  const mainAt = timestampOf(main)
  const newerOwn = stampOf(main) === boundId && keyedAt !== null && mainAt !== null && mainAt >= keyedAt
  return (sameBytes || newerOwn) && write(key, null)
}

export function __resetColdLoadDeepLinkForTests(): void {
  settled = false
  claimedRoute = null
}
