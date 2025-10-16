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
  loadOptions: () => void
}

const KEY = 'canvas-layout-options-v1'

export const useLayoutStore = create<LayoutOptions>((set, get) => ({
  direction: 'DOWN',
  nodeSpacing: 50,
  layerSpacing: 75,
  respectLocked: true,
  
  setDirection: (dir) => {
    set({ direction: dir })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setNodeSpacing: (spacing) => {
    set({ nodeSpacing: spacing })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setLayerSpacing: (spacing) => {
    set({ layerSpacing: spacing })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setRespectLocked: (respect) => {
    set({ respectLocked: respect })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  loadOptions: () => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        set({
          direction: parsed.direction ?? 'DOWN',
          nodeSpacing: parsed.nodeSpacing ?? 50,
          layerSpacing: parsed.layerSpacing ?? 75,
          respectLocked: parsed.respectLocked ?? true,
        })
      }
    } catch (e) {
      console.warn('Failed to load layout options:', e)
    }
  },
}))
