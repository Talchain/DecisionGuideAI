import { create } from 'zustand'

type Direction = 'DOWN' | 'RIGHT' | 'UP' | 'LEFT'

interface LayoutOptions {
  direction: Direction
  nodeSpacing: number
  layerSpacing: number
  respectLocked: boolean
  setDirection: (dir: Direction) => void
  setNodeSpacing: (spacing: number) => void
  setLayerSpacing: (spacing: number) => void
  setRespectLocked: (respect: boolean) => void
}

// v2: bumped when defaults changed (80/120 → 60/90) so returning users
// who never customised spacing are migrated to the new values.
const KEY = 'canvas-layout-options-v2'

function loadPersistedOptions(): Pick<LayoutOptions, 'direction' | 'nodeSpacing' | 'layerSpacing' | 'respectLocked'> {
  const defaults = { direction: 'DOWN' as Direction, nodeSpacing: 60, layerSpacing: 90, respectLocked: true }
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return defaults
    const parsed = JSON.parse(saved)
    return {
      direction: parsed.direction ?? defaults.direction,
      nodeSpacing: parsed.nodeSpacing ?? defaults.nodeSpacing,
      layerSpacing: parsed.layerSpacing ?? defaults.layerSpacing,
      respectLocked: parsed.respectLocked ?? defaults.respectLocked,
    }
  } catch {
    return defaults
  }
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
}))
