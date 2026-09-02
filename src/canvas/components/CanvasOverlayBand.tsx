/**
 * THE CANVAS OWNS ITS OVERLAY SPACE — one slot, one occupant, never over a node.
 *
 * WHY THIS FILE EXISTS. Before it, nothing owned canvas overlay space: every
 * position was a hand-written class string, and FOUR components claimed
 * top-centre independently (`CanvasLodNotice`, the chip column carrying
 * `AssistantFocusChip`/`FocusModeChip`/`FirstModelNotice`,
 * `StarterProvenanceBanner`, and `ServerGraphRetryNotice`). The only collision
 * reasoning in the codebase was PROSE — a comment in `ReactFlowGraph` and a
 * hand-written mutual exclusion inside `FirstModelNotice` — so two notices that
 * had never been considered together simply drew on top of each other.
 *
 * ⭐ IT WAS WITNESSED, not inferred. The CI-rendered reference capture at
 * staging `f59ffc26` (`e2e/visual/references/linux/fresh-draft--1280x800.png`)
 * shows both halves of the founder's report:
 *
 *   1. the first-model notice drawn OVER the decision node, hiding its title —
 *      the anchor of the whole model, unreadable;
 *   2. "Showing 9 of 19 elements" and its "Show whole model" button overlapped
 *      by the minimised Olumi pill, truncating the button's own label.
 *
 * THE RULE, and it is structural rather than advisory: overlays live in a
 * PERSISTENT BOTTOM BAND that owns a fixed slice of canvas, the band declares
 * that slice to `computeFitPadding` so the graph is never fitted underneath it,
 * and each cell renders EXACTLY ONE occupant chosen by a declared priority.
 *
 * ⚠ WHY A BAND AND NOT A MEASURED RESERVATION — the constraint that killed the
 * obvious approach. `computeFitPadding` admits a contributor only if it is
 * edge-anchored, not user-movable, NOT DISMISSIBLE and PERSISTENT (criteria 1-4
 * in that module's header). Every individual notice fails at least one: they
 * are dismissible, and they come and go. Worse, a measured (variable)
 * reservation feeds `reservedBoxWatcher` → `fitNow`, so a notice mounting or
 * being dismissed would re-fit the camera on the next `pointerup` — and
 * `CanvasLodNotice` would close that into a feedback loop (zoom out → notice
 * mounts → reservation grows → re-fit → notice unmounts → …).
 *
 * So THE BAND is the contributor, not its occupants. It is always mounted, it
 * is never dismissible, and it reserves the SAME height whether or not anything
 * occupies it. The occupants change; the reservation does not. That is what
 * makes it admissible under criteria 1-4, and what keeps the camera still.
 *
 * ⚠ WHY THE BOTTOM AND NOT THE TOP. The top band is not free: the floating
 * TopBar pill occupies x 12..526 at every width (`topBarFitInset.spec.ts`), and
 * with the dock expanded at 1280 the free run beside it is 286px — narrower
 * than any current notice. `computeFitPadding` recorded the bottom edge as the
 * one place "nothing is anchored to" (that comment is rewritten by this change,
 * because this band is now anchored there).
 *
 * ⚠ THE RIGHT GUTTER IS NOT DECORATION — IT IS HALF THE REPORTED DEFECT. The
 * minimised Olumi pill is `position: fixed`, z-300, and — contrary to the
 * "floating panel" it belongs to — it is NOT user-movable: it docks to the
 * bottom-right corner, derived from the viewport and the dock inset
 * (`computePillDockPosition`, `FloatingOlumiPanel.tsx`). At 1280x800 with the
 * dock expanded it sits at x 752..836, y 756..784 — INSIDE this band's vertical
 * range. Centring an occupant on the window (which is what `left-1/2` did) put
 * "Show whole model" underneath it. So the band reserves the pill's corner as
 * padding and centres its occupant in what is left. Moving the notices here
 * without this gutter would have REPRODUCED the defect at a new address.
 *
 * ⚠ AND WHAT THIS FILE MUST NEVER BECOME: a second place to write positions.
 * `overlayOwner.sourceScan.spec.ts` reads the migrated components' BYTES and
 * fails if any of them regrows a `top-3` / `bottom-4` / `left-1/2` string, so a
 * position cannot creep back in beside the band.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { measureDockInset } from './FloatingOlumiPanel'

/** The three slots the band offers. One occupant each, by declared priority. */
export type OverlayCell = 'bottom-left' | 'bottom-centre' | 'bottom-right'

/**
 * WHO WINS A CELL, HIGHEST FIRST. This table REPLACES the hand-written mutual
 * exclusion that used to live inside `FirstModelNotice` ("a bundled example
 * already carries its own, stronger disclosure … the starter one is the more
 * important of the two"). That judgement was right and is preserved — it is
 * simply expressed once, here, where every claimant is visible at the same
 * time, instead of as a `return null` inside one of them.
 *
 * The ordering rule is HONESTY FIRST: a sentence about the model's PROVENANCE
 * outranks one about its STANDING, which outranks one about how much of it you
 * are seeing, which outranks a rendering detail, which outranks a selection
 * chip. `StarterProvenanceBanner` leads because "this was not generated just
 * now" is the claim a user is most damaged by not seeing.
 *
 * ⚠ A CONSEQUENCE WORTH STATING OUT LOUD: `FirstModelNotice` now outranks
 * `ModelExtentNotice`, and the two fire on overlapping graphs (a post-draft fit
 * clamps at the legibility floor, which is exactly when the extent notice
 * appears). Before this change they did not compete, because the first-model
 * notice had been pushed to TOP-centre precisely to avoid the extent notice —
 * which is how it ended up over the decision node. They compete now, one wins,
 * and the loser returns once the winner is dismissed. That is the rule working,
 * not a regression: the alternative is the two of them drawn on top of
 * each other, which is what the founder photographed.
 *
 * Every id here is the occupant's own `data-testid`, so the binding is by
 * IDENTITY rather than by a value predicate another element could satisfy, and
 * `overlayOwner.sourceScan.spec.ts` asserts this table and the call sites are
 * the same set in both directions.
 */
export const OVERLAY_PRIORITY: Record<OverlayCell, readonly string[]> = {
  'bottom-left': ['lens-info-panel'],
  'bottom-centre': [
    'starter-provenance-banner',
    'first-model-notice',
    'model-extent-notice',
    'canvas-lod-notice',
    'assistant-focus-chip',
    'focus-mode-chip',
  ],
  'bottom-right': [],
}

/** The band, spelled ONCE, for `computeFitPadding` and for the geometry harness. */
export const OVERLAY_BAND_SELECTOR = '[data-canvas-overlay-band]'

/**
 * The reserved height. A CONSTANT, and it must stay one: this is the number
 * `computeFitPadding` hands to `fitView`, and a height that varied with its
 * occupants would re-fit the camera every time a notice appeared.
 */
export const OVERLAY_BAND_HEIGHT = 64
/** Gap between the band and the canvas's bottom edge. */
export const OVERLAY_BAND_BOTTOM = 12
/**
 * Left padding clears the viewport-controls toolbar, which is `fixed; left: 12;
 * bottom: 12; z-index: 1100` and ~150px tall (`CanvasFloatingToolbar.module.css`)
 * — an overlap that was in no register row before this lane.
 */
export const OVERLAY_BAND_LEFT_PAD = 64
/**
 * Right padding beyond the dock: the minimised Olumi pill's corner. Derived
 * from that component's own geometry (`PILL_W` 84 + `DEFAULT_MARGIN` 16 either
 * side). `overlayOwner.sourceScan.spec.ts` reads `FloatingOlumiPanel.tsx`'s
 * bytes and REDs if `PILL_W` grows past what this reserves, so the two cannot
 * drift apart silently.
 */
export const OVERLAY_BAND_PILL_GUTTER = 116
/** One z for the whole band — at or above the highest claimant it absorbs (the starter banner's 250). */
export const OVERLAY_BAND_Z = 250

/**
 * ⚠⚠ THE ACTIONS AND THE STATE ARE TWO CONTEXTS, AND COMBINING THEM IS AN
 * INFINITE LOOP — measured, not theorised: the first version of this file did
 * exactly that and React threw "Maximum update depth exceeded" on four of eight
 * cases.
 *
 * The mechanism is worth stating, because it is invisible in review. A
 * claimant registers in a layout effect whose dependencies must include the
 * thing it calls. If that thing is a registry object memoised over `claims`,
 * then claiming CHANGES `claims`, which makes a NEW registry, which changes the
 * effect's dependencies, which runs the CLEANUP — releasing the claim — and
 * then claims again. Nothing about it looks recursive at the call site.
 *
 * So the actions are memoised with no dependencies and never change identity,
 * and only the state context re-renders consumers.
 */
interface OverlayActions {
  claim(cell: OverlayCell, id: string): void
  release(cell: OverlayCell, id: string): void
  setTarget(cell: OverlayCell, el: HTMLElement | null): void
}

interface OverlayState {
  claims: Record<OverlayCell, ReadonlySet<string>>
  targets: Record<OverlayCell, HTMLElement | null>
}

const OverlayActionsContext = createContext<OverlayActions | null>(null)
const OverlayStateContext = createContext<OverlayState | null>(null)

/** Highest-priority id present in `claimed`, or null. Unknown ids never win. */
function resolveWinner(cell: OverlayCell, claimed: ReadonlySet<string>): string | null {
  for (const id of OVERLAY_PRIORITY[cell]) {
    if (claimed.has(id)) return id
  }
  return null
}

/**
 * What a claimant gets back.
 *
 * `granted` false means ANOTHER, higher-priority occupant holds the cell — the
 * claimant must render nothing at all (not merely hide itself, which would
 * still occupy layout and the accessibility tree).
 *
 * `target` null with `granted` true is the PROVIDER-LESS case, and it is
 * deliberate: a component rendered on its own — which is how every existing
 * component spec renders these — behaves exactly as it did before the band
 * existed and draws inline. That is what keeps those suites meaningful rather
 * than quietly turning them into tests of a null render.
 */
export interface OverlayCellGrant {
  granted: boolean
  target: HTMLElement | null
}

/**
 * @param wants whether the claimant would render AT ALL on its own terms — its
 *   own conditions, evaluated before the cell is considered. A component that
 *   has decided it has nothing to say must not hold the cell shut against one
 *   that does, so it claims only while `wants` is true. Hooks stay
 *   unconditional: callers compute `wants` first and pass it, rather than
 *   returning early above this call.
 */
export function useOverlayCell(cell: OverlayCell, id: string, wants = true): OverlayCellGrant {
  const actions = useContext(OverlayActionsContext)
  const state = useContext(OverlayStateContext)

  // Depends ONLY on the stable actions — see the note on the two contexts.
  useLayoutEffect(() => {
    if (!actions || !wants) return
    actions.claim(cell, id)
    return () => actions.release(cell, id)
  }, [actions, cell, id, wants])

  if (!actions || !state) return { granted: true, target: null }
  return {
    granted: wants && resolveWinner(cell, state.claims[cell]) === id,
    target: state.targets[cell],
  }
}

/**
 * Measures the right inset the band must keep clear: the OutputsDock (via the
 * dock's own declared authority, so this cannot drift from where the dock
 * actually is) plus the pill's corner.
 *
 * ⚠ THIS DOES NOT AFFECT THE FIT RESERVATION, and that distinction is the
 * reason it is allowed to vary at all. `computeFitPadding` reserves a BAND OF
 * FIXED HEIGHT off the bottom edge; the band's top is `flowRect.bottom - 76`
 * whatever its internal padding is. So horizontal padding may track the dock
 * freely without ever moving the camera — only the HEIGHT is load-bearing, and
 * the height is a constant.
 */
function useBandRightPad(): number {
  const [dockInset, setDockInset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const measure = () => setDockInset(measureDockInset())
    measure()
    window.addEventListener('resize', measure)
    // The dock changes width when it is expanded or collapsed, which is not a
    // window resize — observe the element itself as well.
    const dock = document.querySelector('aside[aria-label="Outputs dock"]')
    const ro =
      typeof ResizeObserver !== 'undefined' && dock ? new ResizeObserver(measure) : null
    if (ro && dock) ro.observe(dock)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  return dockInset + OVERLAY_BAND_PILL_GUTTER
}

/**
 * THE PROVIDER IS SEPARATE FROM THE BAND ELEMENT, and deliberately so.
 *
 * Context reaches descendants only, and the seven claimants are scattered
 * across ~400 lines of `ReactFlowGraph`'s tree — some of them inside other
 * providers they must stay inside (`StarterProvenanceBanner` needs the
 * conversation context). Gathering them under one element would have moved
 * components across provider boundaries to fix a POSITIONING defect, which is
 * a far larger change than the one being made. So the provider wraps the whole
 * canvas subtree and the band element is mounted at one spot inside it; every
 * claimant stays exactly where it was in the tree and merely portals.
 */
export function CanvasOverlayBandProvider({ children }: { children?: ReactNode }) {
  const [claims, setClaims] = useState<Record<OverlayCell, ReadonlySet<string>>>(() => ({
    'bottom-left': new Set(),
    'bottom-centre': new Set(),
    'bottom-right': new Set(),
  }))
  const [targets, setTargets] = useState<Record<OverlayCell, HTMLElement | null>>(() => ({
    'bottom-left': null,
    'bottom-centre': null,
    'bottom-right': null,
  }))

  const claim = useCallback((cell: OverlayCell, id: string) => {
    setClaims((prev) => {
      if (prev[cell].has(id)) return prev
      const next = new Set(prev[cell])
      next.add(id)
      return { ...prev, [cell]: next }
    })
  }, [])

  const release = useCallback((cell: OverlayCell, id: string) => {
    setClaims((prev) => {
      if (!prev[cell].has(id)) return prev
      const next = new Set(prev[cell])
      next.delete(id)
      return { ...prev, [cell]: next }
    })
  }, [])

  const setTarget = useCallback((cell: OverlayCell, el: HTMLElement | null) => {
    setTargets((prev) => (prev[cell] === el ? prev : { ...prev, [cell]: el }))
  }, [])

  // NO DEPENDENCIES BEYOND THE THREE STABLE CALLBACKS — this object's identity
  // must never change, or every claimant's registration effect re-runs and
  // releases itself. See the note on the two contexts above.
  const actions = useMemo<OverlayActions>(
    () => ({ claim, release, setTarget }),
    [claim, release, setTarget],
  )

  const state = useMemo<OverlayState>(() => ({ claims, targets }), [claims, targets])

  return (
    <OverlayActionsContext.Provider value={actions}>
      <OverlayStateContext.Provider value={state}>{children}</OverlayStateContext.Provider>
    </OverlayActionsContext.Provider>
  )
}

/**
 * The band element. Mounted UNCONDITIONALLY beside the canvas — its persistence
 * is what makes it an admissible fit contributor, so there is deliberately no
 * "render only when occupied" branch here.
 */
export function CanvasOverlayBand() {
  const actions = useContext(OverlayActionsContext)
  const rightPad = useBandRightPad()

  const setTarget = actions?.setTarget

  // One STABLE callback per cell. A `(cell) => (el) => …` factory returns a new
  // inner function on every render, so React would detach and reattach the ref
  // each time — null, then the element — and each reattach sets state, which
  // renders again. That is an infinite loop, not a performance note.
  const setLeftRef = useCallback(
    (el: HTMLDivElement | null) => setTarget?.('bottom-left', el),
    [setTarget],
  )
  const setCentreRef = useCallback(
    (el: HTMLDivElement | null) => setTarget?.('bottom-centre', el),
    [setTarget],
  )
  const setRightRef = useCallback(
    (el: HTMLDivElement | null) => setTarget?.('bottom-right', el),
    [setTarget],
  )

  return (
    <>
      <div
        data-canvas-overlay-band=""
        data-testid="canvas-overlay-band"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: OVERLAY_BAND_BOTTOM,
          height: `var(--canvas-overlay-band-h, ${OVERLAY_BAND_HEIGHT}px)`,
          paddingLeft: OVERLAY_BAND_LEFT_PAD,
          paddingRight: rightPad,
          zIndex: OVERLAY_BAND_Z,
          // The band is a spatial reservation, not a surface. Only its
          // occupants take pointer events.
          pointerEvents: 'none',
          display: 'grid',
          // `1fr auto 1fr` keeps the centre occupant centred in the content box
          // AND guarantees the three cells cannot overlap each other — the
          // non-overlap is structural rather than a thing the tests hope for.
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'end',
          columnGap: 8,
        }}
      >
        <div
          ref={setLeftRef}
          data-overlay-cell="bottom-left"
          style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', minWidth: 0, pointerEvents: 'none' }}
        />
        <div
          ref={setCentreRef}
          data-overlay-cell="bottom-centre"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', minWidth: 0, pointerEvents: 'none' }}
        />
        <div
          ref={setRightRef}
          data-overlay-cell="bottom-right"
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', minWidth: 0, pointerEvents: 'none' }}
        />
      </div>
    </>
  )
}
