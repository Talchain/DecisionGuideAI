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
  /** Reset state (used on page load / scenario change). */
  reset: () => void
}

const DEFAULT_SIZE: FloatingPanelSize = { width: 400, height: 500 }

const INITIAL: Pick<FloatingPanelState, 'isOpen' | 'userRepositioned' | 'source' | 'isMinimised' | 'position' | 'size'> = {
  isOpen: false,
  userRepositioned: false,
  source: 'user',
  isMinimised: false,
  position: null,
  size: DEFAULT_SIZE,
}

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
  reset: () => set(INITIAL),
}))

/**
 * Returns true if the floating panel may auto-dock when the system signals
 * the first graph has been generated. False once the user has dragged or
 * resized the panel, or when the panel was opened by the user (chevron, tab).
 */
export function canAutoDock(state: Pick<FloatingPanelState, 'source' | 'userRepositioned'>): boolean {
  return state.source === 'system-first-use' && !state.userRepositioned
}
