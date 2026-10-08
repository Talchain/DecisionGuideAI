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
import { isThinClientSession } from '../thinClient/thinClient'

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
 * The id a restored autosave is bound to: the autosave's OWN STAMP when it is well formed, else the pointer.
 *
 * ⛔ P0, 5 Oct 2026 (CORE PLATFORM, DL 0df0e1). This used to prefer the pointer, on the premise that the autosave's id
 * is a copy of the pointer and never ahead of it. A signed-in switch broke that premise (`useScenario.loadScenario`
 * moved the store, and so the stamp, but not the pointer), and the pointer-first rule then bound scenario A2's bytes to
 * A1. The next whole-graph register wrote A2's model into A1 on the server (request af95a22f; incoming identity = A2's).
 *
 * The stamp is written in the same record as the bytes (`saveAutosave`), so it always names the scenario they belong
 * to; the pointer is a separate key that can drift. Stamp-first can never pair one scenario's bytes with another's id.
 * When the two disagree, a cold deep link now SUPERSEDES (the slot is kept under its own keyed copy) and a routeless
 * boot restores the slot as the scenario that wrote it. Only an ABSENT stamp yields to the pointer; a legacy non-UUID stamp
 * that differs from it binds nothing (draft mode).
 * Pinned by `__tests__/bootSlotOwner.p0.spec.ts`.
 */
export function resolveRestoredScenarioId(
  pointerId: string | null,
  autosaveScenarioId: string | null | undefined,
): string | null {
  if (autosaveScenarioId && isUUID(autosaveScenarioId)) return autosaveScenarioId
  // A stamp that is present but not a UUID (a legacy local id) still names whose bytes these are: they are never bound to
  // a pointer that names another scenario. Draft mode instead (Codex #2503 r1).
  if (typeof autosaveScenarioId === 'string' && autosaveScenarioId.length > 0 && autosaveScenarioId !== pointerId) return null
  if (pointerId && isUUID(pointerId)) return pointerId
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
/** The same tab fence and notice as Save; the first Canvas mount may be much later than this page's boot. */
function localWriteAllowed(): boolean {
  const reason = scenarios.getIdentityWriteBlockReason()
  if (reason === null) return true
  scenarios.showIdentityWriteBlockedToast(reason)
  return false
}
/** A write that cannot throw: whether it was accepted, rechecking the fence even during recovery. */
function write(key: string, value: string | null): boolean {
  if (!localWriteAllowed()) return false
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * The stamp a slot's bytes carry, when they parse as an autosave stamped with a well-formed id AND written under this
 * browser's current identity (CAN-F2w, `scenarios.belongsToThisIdentity`). Another identity's slot is unowned: never
 * remembered, preserved, promoted, retired or refreshed.
 */
function stampOf(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  try {
    const slot = JSON.parse(raw) as { scenarioId?: unknown; identityEpoch?: unknown } | null
    if (!scenarios.belongsToThisIdentity(slot?.identityEpoch)) return null
    const id = slot?.scenarioId
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
  // THIN CLIENT: no slot holds a model to preserve or promote, so a route simply IS the scenario on screen.
  if (isThinClientSession()) {
    return route != null && st.currentScenarioId !== route ? { kind: 'supersede', route } : null
  }
  const main = read(MAIN_AUTOSAVE_SLOT)
  const pointer = read(POINTER_KEY)
  if (main === undefined || pointer === undefined) return null
  // A main slot that states no readable owner is ambiguous: never move it under a guess.
  if (main !== null && stampOf(main) === null) return null
  const stamp = main === null ? null : stampOf(main)
  // A routeless mount targets the scenario the boot will actually show: the pointer's own saved record when it has one
  // (`resolveBootLoadSource` then loads that record, not a slot stamped otherwise), else the slot's owner.
  const pointerHasRecord = typeof pointer === 'string' && isUUID(pointer) && scenarios.getScenario(pointer) !== undefined
  const remembered = pointerHasRecord ? pointer : resolveRestoredScenarioId(pointer, stamp)
  const target = route ?? remembered
  if (target === null) return null
  // Supersede when EITHER record names another scenario (P0, 5 Oct): the slot's stamp (whose bytes these are) or the
  // pointer (what the store seeds from). With stamp-first binding alone, a pointer that drifted from a slot that is
  // already the route's would seed the body's first render with the stale id.
  const namesAnother = (id: string | null | undefined): boolean => typeof id === 'string' && isUUID(id) && id !== target
  if (namesAnother(stamp) || namesAnother(pointer)) return { kind: 'supersede', route: target }
  return main === null && stampOf(read(keyedAutosaveSlot(target))) === target ? { kind: 'promote', route: target } : null
}

/** Set when this page could not verify which scenario the main slot belongs to: the boot then restores no autosave. */
let bootRestoreBlocked = false
/** Read by `ReactFlowGraph`'s boot: true only after a claim this page could neither complete nor verifiably undo. */
export function coldLoadBlocksBootRestore(): boolean {
  return bootRestoreBlocked
}

/** Apply `plan` (re-validated by the caller). 'applied' when the store (and, for a guest, the pointer) now names the route. */
function applyColdLoadPlan(plan: ColdLoadPlan): 'applied' | 'declined' {
  const { route } = plan
  // THIN CLIENT: the store takes the route, and NOTHING is written. No slot holds a model to stamp, so the pointer has
  // nothing to agree with; it names a scenario only once that scenario's row has been admitted (`useScenario.loadScenario`
  // writes it after the read, #2503). A link this account cannot open must leave no trace of it in the browser: J1's J9
  // measured `olumi-canvas-current-scenario-id` = A's scenario in B's fresh browser after B's refused link (#87 5998666452).
  if (isThinClientSession()) {
    useCanvasStore.setState({ currentScenarioId: route })
    return 'applied'
  }
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
  // An unreadable epoch can stop the read-only planner before it reaches a write. Report that refusal at commit too.
  // Thin route adoption only moves memory; its server read remains available and has no browser slot to claim.
  if (!isThinClientSession() && !localWriteAllowed()) {
    settled = true
    return 'declined'
  }
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
  if (!boundId || isThinClientSession()) return false
  if (!localWriteAllowed()) return false
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
  if (isThinClientSession()) return false
  if (!localWriteAllowed()) return false
  const key = keyedAutosaveSlot(id)
  const copy = read(key)
  const main = read(MAIN_AUTOSAVE_SLOT)
  if (typeof copy !== 'string' || typeof main !== 'string' || main === copy) return false
  return isNewerOwnSlot(main, copy, id) && write(key, main)
}

export function __resetColdLoadDeepLinkForTests(): void {
  settled = false
  claimedRoute = null
  bootRestoreBlocked = false
  stopWatching?.()
  stopWatching = null
}
