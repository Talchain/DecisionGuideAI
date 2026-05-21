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
