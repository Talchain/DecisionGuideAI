import { create } from 'zustand'

export type FloatingPanelSource = 'system-first-use' | 'user'

export interface FloatingPanelPosition {
  x: number
  y: number
}

export interface FloatingPanelSize {
  width: number
  height: number
}

export interface FloatingPanelState {
  /** Whether the floating Olumi panel is currently visible. */
  isOpen: boolean
  /** Whether the user has dragged or resized the panel since it opened.
   *  Auto-dock only fires when source === 'system-first-use' && !userRepositioned. */
  userRepositioned: boolean
  /** Who opened it: the system (first-use composer) or the user (from a tab). */
  source: FloatingPanelSource
  /** Minimised: collapses to a small restore pill at the panel's current
   *  position. Distinct from `!isOpen` which fully unmounts. */
  isMinimised: boolean
  /** Top-left position. null = compute on first open (centred on canvas). */
  position: FloatingPanelPosition | null
  /** Current panel size. */
  size: FloatingPanelSize
  /** Transient flag set by the post-graph auto-reposition path so the floating
   *  panel can apply a scoped CSS slide transition on left/top without
   *  affecting drag responsiveness. Cleared by FloatingOlumiPanel after the
   *  transition window completes. Never set under prefers-reduced-motion. */
  isAutoRepositioning: boolean
  /** Open the floating panel. Pass source='system-first-use' for the first-use
   *  flow (auto-dockable) or 'user' for any user-driven open (never auto-docks). */
  open: (source: FloatingPanelSource) => void
  /** Close the floating panel. Used by Dock button and auto-dock. */
  close: () => void
  /** Toggle (used by chevron). User-driven, so source becomes 'user'. */
  toggle: () => void
  /** Collapse to the restore pill — preserves position/size/source/draft. */
  minimise: () => void
  /** Restore from the pill back to the full panel. */
  restore: () => void
  /** Commit a final position after a pointer drag. Sets userRepositioned. */
  setPosition: (pos: FloatingPanelPosition) => void
  /** Commit a final size after a pointer resize. Sets userRepositioned. */
  setSize: (size: FloatingPanelSize) => void
  /** Commit a system-computed position (e.g. the centred default after open).
   *  Only writes if `position` is currently null. Does NOT flip
   *  userRepositioned — preserves the auto-dock invariant. */
  setInitialPosition: (pos: FloatingPanelPosition) => void
  /** Orchestrate the post-graph auto-reposition: arm the slide transition
   *  flag, defer the position write to the next animation frame so the
   *  panel's mount paint has a real "from" coordinate, then owner-clear
   *  the flag after the transition window. Owned by the store (not any
   *  component) so re-render cleanup cannot cancel its scheduled writes.
   *  Under prefers-reduced-motion: writes the position synchronously, no
   *  transition, no deferred clear.
   *  Direct setState bypasses setPosition's userRepositioned flip so an
   *  automatic reposition doesn't look like a user drag. */
  performAutoReposition: (anchor: FloatingPanelPosition, options?: { reducedMotion?: boolean }) => void
  /** Reset state (used on page load / scenario change). */
  reset: () => void
}

const DEFAULT_SIZE: FloatingPanelSize = { width: 400, height: 550 }

const INITIAL: Pick<FloatingPanelState, 'isOpen' | 'userRepositioned' | 'source' | 'isMinimised' | 'position' | 'size' | 'isAutoRepositioning'> = {
  isOpen: false,
  userRepositioned: false,
  source: 'user',
  isMinimised: false,
  position: null,
  size: DEFAULT_SIZE,
  isAutoRepositioning: false,
}

// Module-scope handles for the active auto-reposition transition's timers.
// Stored outside the Zustand state because they're transient orchestration
// details (no need to subscribe), and the store factory closes over them so
// repeated `performAutoReposition` calls can supersede a still-pending
// transition cleanly. Never null after the first call until the next call.
let _autoRepositionRafId: number | null = null
let _autoRepositionClearId: number | null = null

export const useFloatingPanelState = create<FloatingPanelState>((set, get) => ({
  ...INITIAL,
  open: (source) => set({ isOpen: true, source, userRepositioned: false, isMinimised: false }),
  close: () => set({ isOpen: false, isMinimised: false }),
  toggle: () => {
    const cur = get()
    if (cur.isOpen) set({ isOpen: false, isMinimised: false })
    else set({ isOpen: true, source: 'user', userRepositioned: false, isMinimised: false })
  },
  minimise: () => set({ isMinimised: true }),
  restore: () => set({ isMinimised: false }),
  setPosition: (position) => set({ position, userRepositioned: true }),
  setSize: (size) => set({ size, userRepositioned: true }),
  setInitialPosition: (position) =>
    set((s) => (s.position === null ? { position } : s)),
  performAutoReposition: (anchor, options) => {
    const reducedMotion = options?.reducedMotion ?? false

    // Supersede any still-pending transition. Cancels orphan rAFs and the
    // 450ms clear from a prior call so repeated triggers don't leak timers
    // and don't write stale anchors on top of fresher ones. Safe even on
    // first invocation (both ids are null).
    if (typeof window !== 'undefined') {
      if (_autoRepositionRafId !== null) window.cancelAnimationFrame(_autoRepositionRafId)
      if (_autoRepositionClearId !== null) window.clearTimeout(_autoRepositionClearId)
    }
    _autoRepositionRafId = null
    _autoRepositionClearId = null

    if (reducedMotion) {
      // Instant settle: no transition, no deferred clear.
      set({ position: anchor, isAutoRepositioning: false })
      return
    }
    // Arm the slide flag synchronously so the panel's NEXT layout effect
    // run writes the CSS transition declaration. The position write is
    // deferred to the next animation frame so the panel's mount paint at
    // the centred default has a real visible "from" coordinate to animate
    // from. The 450ms clear timeout is owned here — outside any component
    // lifecycle — so a panel unmount or a parent re-render cannot cancel
    // it. The window must outlast the 300ms transition with margin.
    set({ isAutoRepositioning: true })
    if (typeof window !== 'undefined') {
      _autoRepositionRafId = window.requestAnimationFrame(() => {
        _autoRepositionRafId = null
        set({ position: anchor })
      })
      _autoRepositionClearId = window.setTimeout(() => {
        _autoRepositionClearId = null
        set({ isAutoRepositioning: false })
      }, 450)
    } else {
      // SSR / test environments without a DOM: write synchronously and
      // skip the timers. The flag clears immediately so subsequent renders
      // never observe a stale `true`.
      set({ position: anchor, isAutoRepositioning: false })
    }
  },
  reset: () => {
    // Cancel any in-flight auto-reposition timers and clear the flag — a
    // reset (page load, scenario switch) must not leave orphan timers that
    // later overwrite the freshly-reset state.
    if (typeof window !== 'undefined') {
      if (_autoRepositionRafId !== null) window.cancelAnimationFrame(_autoRepositionRafId)
      if (_autoRepositionClearId !== null) window.clearTimeout(_autoRepositionClearId)
    }
    _autoRepositionRafId = null
    _autoRepositionClearId = null
    set(INITIAL)
  },
}))

/**
 * Returns true if the floating panel may auto-dock when the system signals
 * the first graph has been generated. False once the user has dragged or
 * resized the panel, or when the panel was opened by the user (chevron, tab).
 */
export function canAutoDock(state: Pick<FloatingPanelState, 'source' | 'userRepositioned'>): boolean {
  return state.source === 'system-first-use' && !state.userRepositioned
}

/**
 * WOULD FRONTING THE FLOATING PANEL PUT A WINDOW ON SCREEN THAT THE USER NEVER
 * CHOSE? (19 Aug 2026 — UX gate point 7a.)
 *
 * ⚠ THIS IS A DIFFERENT QUESTION FROM `canAutoDock`, AND THE TWO MUST NOT BE
 * COLLAPSED (platform trap 21 — two concepts under similar names is how one
 * fix re-opens another's defect). `canAutoDock` asks whether the post-draft
 * transition MAY MOVE OR MINIMISE the panel without overriding a user choice.
 * This asks whether an AUTOMATIC REVEAL may RESTORE it. They share the
 * ownership half on purpose — one definition of "the system opened this and
 * the user has never touched it", so the two cannot drift — and diverge on the
 * half that decides this one: whether the panel is currently OUT OF SIGHT.
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * After the first draft, `FirstUseComposer` minimises the transcript-less hero
 * to the pill so the model gets the canvas. `isOpen` stays TRUE while minimised
 * (the panel is kept mounted at `display: none`). `FloatingOlumiPanel`'s focus
 * channel registers on `isOpen`, and its handler calls `restore()`. So from
 * that moment every automatic reveal — and `withOlumiReveal` wraps EVERY
 * guidance-store send, so analysis coaching is one — re-opened a full 400x550
 * window over the graph. The user never chose floating; the product chose it
 * for them, once, and then for the rest of the session.
 *
 * Measured on the deployed build `4d1e650b`, fresh guest, at fit-to-view:
 * 40% / 33% / 28% of the graph hidden at 1280 / 1440 / 1512, 9 of 14 nodes
 * obscured at 1280, and the node carrying the product's own "Leading option"
 * badge 58% covered before the user had done anything. Its position confirms
 * the mechanism arithmetically: the gate measured `x=436, y=240`, which is
 * exactly `performReposition`'s bottom-right anchor computed while the dock was
 * expanded (`1280 - 428 - 400 - 16` and `800 - 544 - 16`) — i.e. the panel the
 * user saw was the MINIMISED hero, restored at the anchor it was minimised from.
 *
 * ── WHAT THIS DOES NOT DO (founder ruling, do not violate) ────────────────
 *
 * > "DO NOT remove floating/concurrent Olumi… FLOATING AND LAYOUT-RESERVING ARE
 * > DIFFERENT CONCEPTS… FIX THE COMPOSITION, NOT THE CAPABILITY."
 *
 * Floating stays fully available and fully functional. Only the mode an
 * AUTOMATIC reveal opens in changes. Every user-owned state is excluded by the
 * predicate itself and still restores to floating:
 *   - `source === 'user'`  — opened from the chevron, the tab, or a float-out;
 *   - `userRepositioned`   — dragged or resized, i.e. positioned by choice;
 *   - `!isMinimised`       — already on screen, so it IS the surface the user
 *                            has, and a reveal must front it (`revealOlumi`).
 * The pill's own `onClick={restore}` is untouched, so floating is one click
 * away at all times, and the dock's float-out control is unchanged.
 */
export function revealWouldImposeFloating(
  state: Pick<FloatingPanelState, 'source' | 'userRepositioned' | 'isMinimised'>,
): boolean {
  return state.isMinimised && canAutoDock(state)
}
