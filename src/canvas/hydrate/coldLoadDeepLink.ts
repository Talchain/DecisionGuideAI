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

import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as scenarios from '../store/scenarios'
import { useCanvasStore } from '../store'
import { isUUID } from '../../services/turn-request-builder'
import { isCeeAddressableScenarioId } from './bootGraphRead'
import { flushWorkToAutosave } from '../persist/crashFlush'

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
 * What the first canvas mount of this page should do, decided by READS ONLY. The target is the route, or, on a routeless
 * mount (`/canvas`), the remembered scenario:
 *   'supersede' — a route names a scenario other than the remembered one (the three writes above);
 *   'promote'   — the target's main slot is empty and its own preserved copy is waiting: after "Start fresh" (nothing
 *                 remembered), after a promotion that could not complete, or on a routeless return. A copy is never
 *                 stranded;
 *   null        — nothing to do (also for every later mount, an unaddressable route, and an ambiguous main slot).
 */
export type ColdLoadPlan = { readonly kind: 'supersede' | 'promote'; readonly route: string }
export function planColdLoadDeepLink(route: string | null | undefined): ColdLoadPlan | null {
  if (settled) return null
  if (route != null && !isCeeAddressableScenarioId(route)) return null
  const st = useCanvasStore.getState()
  if (st.nodes.length > 0 || st.edges.length > 0) return null
  const main = read(MAIN_AUTOSAVE_SLOT)
  const pointer = read(POINTER_KEY)
  if (main === undefined || pointer === undefined) return null
  // A main slot that states no readable owner is ambiguous: never move it under a guess.
  if (main !== null && stampOf(main) === null) return null
  const remembered = resolveRestoredScenarioId(pointer, stampOf(main))
  const target = route ?? remembered
  if (target === null) return null
  if (remembered !== null && remembered !== target) return { kind: 'supersede', route: target }
  return main === null && stampOf(read(keyedAutosaveSlot(target))) === target ? { kind: 'promote', route: target } : null
}

/** Set when this page could not verify which scenario the main slot belongs to: the boot then restores no autosave. */
let bootRestoreBlocked = false
/** Read by `ReactFlowGraph`'s boot: true only after a claim this page could neither complete nor verifiably undo. */
export function coldLoadBlocksBootRestore(): boolean {
  return bootRestoreBlocked
}

/** Apply `plan` (re-validated by the caller). 'applied' when the pointer and the store now name the route. */
function applyColdLoadPlan(plan: ColdLoadPlan): 'applied' | 'declined' {
  const { route } = plan
  const originalPointer = read(POINTER_KEY)
  const originalMain = read(MAIN_AUTOSAVE_SLOT)
  const own = read(keyedAutosaveSlot(route))
  if (originalPointer === undefined || originalMain === undefined || own === undefined) return 'declined'
  const promotable = stampOf(own) === route ? own : null

  // 1. PRESERVE the main slot under its own stamp, unless it is already the route's. A copy already there is replaced
  //    only by a PROVABLY newer state of its scenario, and kept when it is provably newer itself (the older slot is then
  //    the duplicate). Two states that cannot be ordered (a missing or equal timestamp, bytes of another scenario)
  //    decline the claim: neither is destroyed.
  const owner = originalMain === null ? null : stampOf(originalMain)
  const mainIsTheRoutes = owner === route
  const ownerKey = originalMain !== null && owner !== null && !mainIsTheRoutes ? keyedAutosaveSlot(owner) : null
  let previousCopy: string | null = null
  if (ownerKey !== null && owner !== null && originalMain !== null) {
    const prev = read(ownerKey)
    if (prev === undefined) return 'declined'
    previousCopy = prev
    const keepsNewerCopy = prev !== null && prev !== originalMain && isNewerOwnSlot(prev, originalMain, owner)
    const mainIsNewer = prev === null || prev === originalMain || isNewerOwnSlot(originalMain, prev, owner)
    if (!keepsNewerCopy && !mainIsNewer) return 'declined'
    if (!keepsNewerCopy && (!write(ownerKey, originalMain) || read(ownerKey) !== originalMain)) {
      if (previousCopy !== null && read(ownerKey) !== previousCopy) write(ownerKey, previousCopy) // never a removal
      return 'declined'
    }
  }

  const adopt = (): 'applied' => {
    useCanvasStore.setState({ currentScenarioId: route })
    return 'applied'
  }
  /** The main slot is the route's or empty: what the boot reads under a pointer that names the route. */
  const mainFitsTheRoute = (): boolean => {
    const m = read(MAIN_AUTOSAVE_SLOT)
    return m === null || (typeof m === 'string' && stampOf(m) === route)
  }

  /**
   * On any step that does not hold. First undo, verifying each step: the pointer, then the main slot back to its
   * ORIGINAL bytes, and only then the preserve (by then a redundant duplicate). A copy is never removed while the bytes
   * it holds might exist nowhere else. If storage cannot be put back, make it name ONE scenario: with the pointer back,
   * an empty main slot (the copy keeps its bytes); with the pointer on the route, a main slot that is the route's or
   * empty, and the route is adopted so that the store agrees. If even that cannot be verified, this page restores no
   * autosave at boot.
   */
  const recover = (): 'applied' | 'declined' => {
    const pointerBack =
      read(POINTER_KEY) === originalPointer || (write(POINTER_KEY, originalPointer) && read(POINTER_KEY) === originalPointer)
    const mainBack =
      read(MAIN_AUTOSAVE_SLOT) === originalMain || (write(MAIN_AUTOSAVE_SLOT, originalMain) && read(MAIN_AUTOSAVE_SLOT) === originalMain)
    if (pointerBack && mainBack) {
      if (ownerKey !== null && read(ownerKey) !== previousCopy) write(ownerKey, previousCopy)
      return 'declined'
    }
    // The pointer is back but the main slot is not. Its original bytes (or a newer state of the same scenario) are in
    // the copy, so empty the slot and KEEP the copy: storage then names one scenario across a reload, and the next cold
    // load promotes the copy.
    if (pointerBack && ownerKey !== null && (read(MAIN_AUTOSAVE_SLOT) === null || (write(MAIN_AUTOSAVE_SLOT, null) && read(MAIN_AUTOSAVE_SLOT) === null))) {
      return 'declined'
    }
    if (read(POINTER_KEY) === route && (mainFitsTheRoute() || (write(MAIN_AUTOSAVE_SLOT, null) && read(MAIN_AUTOSAVE_SLOT) === null))) {
      return adopt()
    }
    bootRestoreBlocked = true
    return 'declined'
  }

  // 2. THE POINTER.
  if (!write(POINTER_KEY, route) || read(POINTER_KEY) !== route) return recover()

  // 3. THE MAIN SLOT: the route's own copy, or (unless the slot is already the route's) nothing. A promotion that does
  //    not take declines the whole claim, and is retried on the next cold load ('promote').
  const next = mainIsTheRoutes ? originalMain : promotable
  if (next !== originalMain && (!write(MAIN_AUTOSAVE_SLOT, next) || read(MAIN_AUTOSAVE_SLOT) !== next)) return recover()

  // 4. VERIFY what the boot will read: the pointer names the route, and the main slot is the route's or empty.
  if (read(POINTER_KEY) !== route || !mainFitsTheRoute()) return recover()
  return adopt()
}

let settled = false
let claimedRoute: string | null = null

/**
 * The page's first committed canvas mount, settled once: applies the plan for `route` when `apply` (the gate decided at
 * render that one is due), and only marks the page settled otherwise. 'not_first' for every later call. Either way it
 * starts the copies' freshness watch for the page.
 */
export function claimColdLoadDeepLink(
  route: string | null | undefined,
  apply = true,
): 'applied' | 'declined' | 'not_first' {
  if (settled) return 'not_first'
  const plan = apply ? planColdLoadDeepLink(route) : null
  settled = true
  watchCopyFreshness()
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

/**
 * ⭐ A LINK OPENED LATER IN THE SAME TAB SWITCHES TO ITS SCENARIO (BLOCKER22, Acceptance #87 5986279838; DL 0df0e1, its
 * own HIGH PR). Changing the address to `#/scenario/B` in a tab that holds A is a same-document navigation: the canvas
 * stays mounted, the gate above has already decided for this page, and a held scenario never adopts a link. So A stayed
 * on screen under B's address, and B's graph was never read.
 *
 * THE RULE. When the route changes after the first committed mount to a CEE-addressable B while the store holds ANOTHER
 * scenario A, in this order, in a LAYOUT effect of the route's gate (it runs before every passive effect of the body):
 *
 *   0. FENCE B's readers for this commit (`inAppSwitchFences`): the body's Supabase load and its CEE read stand down,
 *      so nothing of B is loaded over A while the switch is decided.
 *   1. UNSAVED WORK the page itself would warn about (a save in flight, unsaved changes, an edit not yet sent) DECLINES
 *      the switch. Asked of the app's own unload guards with a cancelable `beforeunload`, which also runs their flushes.
 *   2. A's work is flushed (`flushWorkToAutosave`, gated inside) and VERIFIED: the main slot must be stamped A and carry
 *      exactly the store's node and edge ids. A flush that declined or did not land declines the switch.
 *   3. STORAGE NAMES B before the reload, through the cold load's own writes (`applyColdLoadPlan`): A's slot preserved
 *      under its own stamp, the pointer B, the main slot B's own copy or nothing; verified, rolled back on failure. So
 *      the reload never has to infer whose slot it finds, whatever another tab left in the pointer.
 *   4. The store is emptied under B, so the reload's close flush has nothing of A to write under B; then the page reloads
 *      and boots B with every in-memory store clean.
 *
 * A DECLINED switch puts the address back where it was (replace), so the address names what is on screen; the user can
 * open the link in a new tab, the supported path. NOT A SWITCH: the first mount (the gate decides that); the same route;
 * a route that names no addressable scenario (`/canvas`); a store that already holds B (the app's own navigations set
 * the store first: `createScenario`, the guest copy's `adoptScenario`); an unbound canvas (a guest's draft, #2383).
 */
export type InAppSwitchOutcome = 'reloading' | 'declined:unsaved_work' | 'declined:not_preserved' | 'declined:storage'
let reloadPage: () => void = () => window.location.reload()
let switchFence: string | null = null

/** True while a same-tab switch to `route` is being decided or is reloading: B's readers stand down. */
export function inAppSwitchFences(route: string | null | undefined): boolean {
  return switchFence !== null && route === switchFence
}

/** The page's own unload guards, asked: would leaving now lose work? Their flushes run, as on a real unload. */
function leavingWouldLoseWork(): boolean {
  const probe = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(probe)
  return probe.defaultPrevented
}

/** The main slot is `held`'s and carries exactly the store's nodes and edges (by id). */
function mainSlotHoldsTheStore(held: string): boolean {
  const raw = read(MAIN_AUTOSAVE_SLOT)
  if (typeof raw !== 'string' || stampOf(raw) !== held) return false
  try {
    const slot = JSON.parse(raw) as { nodes?: Array<{ id?: unknown }>; edges?: Array<{ id?: unknown }> }
    const st = useCanvasStore.getState()
    const ids = (xs: ReadonlyArray<{ id?: unknown }> | undefined) => (xs ?? []).map((x) => String(x.id)).sort().join('\u0000')
    return Array.isArray(slot.nodes) && Array.isArray(slot.edges) && ids(slot.nodes) === ids(st.nodes) && ids(slot.edges) === ids(st.edges)
  } catch {
    return false
  }
}

/** Steps 1–4 of the rule above. `held` is the scenario on screen, `route` the link's. */
export function switchToLinkedScenario(route: string, held: string): InAppSwitchOutcome {
  if (leavingWouldLoseWork()) return 'declined:unsaved_work'
  flushWorkToAutosave()
  if (!mainSlotHoldsTheStore(held)) return 'declined:not_preserved'
  if (applyColdLoadPlan({ kind: 'supersede', route }) !== 'applied') return 'declined:storage'
  useCanvasStore.getState().hydrateGraphSlice({ nodes: [], edges: [], currentScenarioId: route })
  reloadPage()
  return 'reloading'
}

export function useInAppLinkSwitch(route: string | null | undefined): void {
  const navigate = useNavigate()
  const seen = useRef(route)
  useLayoutEffect(() => {
    const from = seen.current
    if (from === route) return
    seen.current = route
    if (switchFence !== null && route !== switchFence) switchFence = null // back from a declined switch
    if (route == null || !isCeeAddressableScenarioId(route)) return
    const held = useCanvasStore.getState().currentScenarioId ?? null
    if (held === null || held === route) return
    switchFence = route
    if (switchToLinkedScenario(route, held) === 'reloading') return
    navigate(from ? `/scenario/${encodeURIComponent(from)}` : '/canvas', { replace: true })
  }, [route, navigate])
}
export function __setReloadForTests(fn: (() => void) | null): void {
  reloadPage = fn ?? (() => window.location.reload())
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
  return (keyed === main || isNewerOwnSlot(main, keyed, boundId)) && write(key, null)
}

/**
 * `a` is PROVABLY a later state of scenario `id` than `b`: both are stamped `id`, both timestamps are finite, and `a`'s
 * is strictly later. The one ordering the preserve, the retire and the refresh all use; an equal or missing timestamp
 * orders nothing, so nothing is overwritten or retired on it.
 */
function isNewerOwnSlot(a: string, b: string, id: string): boolean {
  const aAt = timestampOf(a)
  const bAt = timestampOf(b)
  return stampOf(a) === id && stampOf(b) === id && aAt !== null && bAt !== null && aAt > bAt
}

/**
 * ⭐ A COPY FOLLOWS ITS SCENARIO'S NEWER WORK. When the page leaves scenario X by any path (an in-app switch, a load),
 * the main slot still holds X's latest local state (stamped X). An existing copy of X is refreshed from it if it is
 * newer, so a later link to X never promotes older bytes. Only an EXISTING copy is refreshed: a departure that never
 * went through a cold-load supersede creates nothing. Installed once per page by the first claim.
 */
let stopWatching: (() => void) | null = null
function watchCopyFreshness(): void {
  if (stopWatching !== null) return
  stopWatching = useCanvasStore.subscribe((state, prev) => {
    const left = prev.currentScenarioId
    if (!left || left === state.currentScenarioId) return
    refreshExistingCopy(left)
  })
}
export function refreshExistingCopy(id: string): boolean {
  const key = keyedAutosaveSlot(id)
  const copy = read(key)
  const main = read(MAIN_AUTOSAVE_SLOT)
  if (typeof copy !== 'string' || typeof main !== 'string' || main === copy) return false
  return isNewerOwnSlot(main, copy, id) && write(key, main)
}

export function __resetColdLoadDeepLinkForTests(): void {
  settled = false
  switchFence = null
  claimedRoute = null
  bootRestoreBlocked = false
  stopWatching?.()
  stopWatching = null
}
