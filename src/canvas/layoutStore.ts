import { create } from 'zustand'
import type { CanvasSize } from './utils/layout'

type Direction = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'

interface LayoutOptions {
  direction: Direction
  nodeSpacing: number
  layerSpacing: number
  respectLocked: boolean
  /** Runtime canvas pixel dimensions, set by the UI before triggering layout. */
  canvasSize: CanvasSize | null
  /**
   * Node width (px) used in the most recent layout pass.
   * BaseNode reads this to size itself to match ELK's assumptions.
   * null = no layout has run yet; BaseNode uses its own default.
   */
  layoutNodeWidth: number | null
  setDirection: (dir: Direction) => void
  setNodeSpacing: (spacing: number) => void
  setLayerSpacing: (spacing: number) => void
  setRespectLocked: (respect: boolean) => void
  setCanvasSize: (size: CanvasSize) => void
  setLayoutNodeWidth: (width: number) => void
}

// v5: nodeSpacing reduced 30 → 20 — modest further horizontal compression.
// 4-node row drops 1466 → 1436 (−30 px); 5-node row 1840 → 1800 (−40 px);
// 6-node row 2214 → 2164 (−50 px) at NODE_CARD_MAX_W=320. effectiveNodeSpacing
// now equals COLLISION_GAP=20, so the post-layout collision guard is inert at
// the default spacing — it only fires when ELK/multi-row splitting drives
// nodes closer than 20 px.
// v5 also introduces v4→v5 migration in loadPersistedOptions: default-like
// nodeSpacing=30 maps to the new default 20; other v4 settings (custom
// nodeSpacing, direction, layerSpacing, respectLocked) carry over unchanged.
// Earlier bumps (v3→v4, etc.) read only the current key and so reset all
// customisation; this is the first revision with an explicit migration.
// v4: nodeSpacing reduced 60 → 30 — horizontal gap tightened so 4-node tiers
// fit a tighter footprint at typical laptop viewports. Layer (vertical)
// spacing left at 48 from v3; the horizontal change addresses the observed
// 4-node row width issue (1556 → 1466 at NODE_CARD_MAX_W=320) without
// further vertical compression.
// v3: layerSpacing reduced 90 → 48 (cumulative −47 % across two passes:
// 90 → 68 (−25 %), then 68 → 48 (−30 %)) so tiers sit closer vertically.
// Earlier bump: v1 → v2 changed 80/120 → 60/90.
const KEY = 'canvas-layout-options-v5'
const KEY_V4 = 'canvas-layout-options-v4'

type PersistedOptions = Partial<Pick<LayoutOptions, 'direction' | 'nodeSpacing' | 'layerSpacing' | 'respectLocked'>>

function tryParse(key: string): PersistedOptions | null {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return null
    return JSON.parse(saved) as PersistedOptions
  } catch {
    return null
  }
}

function loadPersistedOptions(): Pick<LayoutOptions, 'direction' | 'nodeSpacing' | 'layerSpacing' | 'respectLocked'> {
  const defaults = { direction: 'DOWN' as Direction, nodeSpacing: 20, layerSpacing: 48, respectLocked: true }

  // v5 (current) — written by persist() after any user change since this revision.
  const v5 = tryParse(KEY)
  if (v5) {
    return {
      direction: v5.direction ?? defaults.direction,
      nodeSpacing: v5.nodeSpacing ?? defaults.nodeSpacing,
      layerSpacing: v5.layerSpacing ?? defaults.layerSpacing,
      respectLocked: v5.respectLocked ?? defaults.respectLocked,
    }
  }
  // v4 → v5 migration: map default-like nodeSpacing=30 to the new default
  // 20; custom nodeSpacing (≠ 30), direction, layerSpacing, and
  // respectLocked carry over unchanged. Parsed independently of v5 so a
  // corrupt v5 entry still falls back to a valid v4 entry. The v4 entry is
  // left in place until the next persist() call writes v5.
  const v4 = tryParse(KEY_V4)
  if (v4) {
    return {
      direction: v4.direction ?? defaults.direction,
      nodeSpacing: v4.nodeSpacing === 30
        ? defaults.nodeSpacing
        : (v4.nodeSpacing ?? defaults.nodeSpacing),
      layerSpacing: v4.layerSpacing ?? defaults.layerSpacing,
      respectLocked: v4.respectLocked ?? defaults.respectLocked,
    }
  }
  return defaults
}

function persist(state: Pick<LayoutOptions, 'direction' | 'nodeSpacing' | 'layerSpacing' | 'respectLocked'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      direction: state.direction,
      nodeSpacing: state.nodeSpacing,
      layerSpacing: state.layerSpacing,
      respectLocked: state.respectLocked,
    }))
  } catch {
    // localStorage unavailable (e.g. SSR, private browsing quota) — ignore
  }
}

export const useLayoutStore = create<LayoutOptions>((set, get) => ({
  ...loadPersistedOptions(),
  canvasSize: null,
  layoutNodeWidth: null,

  setDirection: (dir) => {
    set({ direction: dir })
    persist(get())
  },
  setNodeSpacing: (spacing) => {
    set({ nodeSpacing: spacing })
    persist(get())
  },
  setLayerSpacing: (spacing) => {
    set({ layerSpacing: spacing })
    persist(get())
  },
  setRespectLocked: (respect) => {
    set({ respectLocked: respect })
    persist(get())
  },
  setCanvasSize: (size) => {
    set({ canvasSize: size })
  },
  setLayoutNodeWidth: (width) => {
    set({ layoutNodeWidth: width })
  },
}))
