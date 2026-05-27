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

// v6: nodeSpacing reduced 20 → 15 (intended). The rendered gap stays at 20 px
// because layout.ts retains its `Math.max(20, spacing)` pre-ELK floor and the
// post-ELK `applyCollisionGuard` keeps COLLISION_GAP=20. This bump records the
// intended value and migrates returning users' persisted state; the floors
// would need to be lowered separately to make the rendered gap match.
// Migration policy: v5 default-like nodeSpacing=20 maps to v6 default 15; v4
// default-like nodeSpacing=30 also maps to 15 (a direct v4 → v6 user skips
// the intermediate v5 default). All other persisted fields carry over.
// v5: nodeSpacing reduced 30 → 20 — modest further horizontal compression.
// 4-node row drops 1466 → 1436 (−30 px); 5-node row 1840 → 1800 (−40 px);
// 6-node row 2214 → 2164 (−50 px) at NODE_CARD_MAX_W=320. effectiveNodeSpacing
// equals COLLISION_GAP=20, so the post-layout collision guard is inert at
// the default spacing — it only fires when ELK/multi-row splitting drives
// nodes closer than 20 px.
// v5 introduced v4→v5 migration in loadPersistedOptions: default-like
// nodeSpacing=30 maps to the new default 20; other v4 settings (custom
// nodeSpacing, direction, layerSpacing, respectLocked) carry over unchanged.
// Earlier bumps (v3→v4, etc.) read only the current key and so reset all
// customisation; v5 was the first revision with an explicit migration.
// v4: nodeSpacing reduced 60 → 30 — horizontal gap tightened so 4-node tiers
// fit a tighter footprint at typical laptop viewports. Layer (vertical)
// spacing left at 48 from v3; the horizontal change addresses the observed
// 4-node row width issue (1556 → 1466 at NODE_CARD_MAX_W=320) without
// further vertical compression.
// v3: layerSpacing reduced 90 → 48 (cumulative −47 % across two passes:
// 90 → 68 (−25 %), then 68 → 48 (−30 %)) so tiers sit closer vertically.
// Earlier bump: v1 → v2 changed 80/120 → 60/90.
const KEY = 'canvas-layout-options-v6'
const KEY_V5 = 'canvas-layout-options-v5'
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
  const defaults = { direction: 'DOWN' as Direction, nodeSpacing: 15, layerSpacing: 48, respectLocked: true }

  // v6 (current) — written by persist() after any user change since this revision.
  const v6 = tryParse(KEY)
  if (v6) {
    return {
      direction: v6.direction ?? defaults.direction,
      nodeSpacing: v6.nodeSpacing ?? defaults.nodeSpacing,
      layerSpacing: v6.layerSpacing ?? defaults.layerSpacing,
      respectLocked: v6.respectLocked ?? defaults.respectLocked,
    }
  }
  // v5 → v6 migration: map default-like nodeSpacing=20 (v5 default) to the
  // new v6 default 15; custom nodeSpacing (≠ 20), direction, layerSpacing,
  // and respectLocked carry over unchanged. Parsed independently of v6 so a
  // corrupt v6 entry still falls back to a valid v5 entry.
  const v5 = tryParse(KEY_V5)
  if (v5) {
    return {
      direction: v5.direction ?? defaults.direction,
      nodeSpacing: v5.nodeSpacing === 20
        ? defaults.nodeSpacing
        : (v5.nodeSpacing ?? defaults.nodeSpacing),
      layerSpacing: v5.layerSpacing ?? defaults.layerSpacing,
      respectLocked: v5.respectLocked ?? defaults.respectLocked,
    }
  }
  // v4 → v6 migration: a v4 user with default-like nodeSpacing=30 skips v5
  // entirely and lands on the v6 default 15 (same conservative-snap policy
  // as v4 → v5). Custom v4 nodeSpacing (≠ 30) and other v4 settings carry
  // over unchanged. Parsed independently of v6 and v5.
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
