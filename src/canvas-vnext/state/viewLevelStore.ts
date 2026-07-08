// Simple/Detailed view level for the vNext decision map.
//
// vNext-LOCAL state: this is deliberately NOT the shared canvas store's
// `viewMode` ('standard' | 'expert', sessionStorage 'canvas.viewMode') — the
// default graph's preference must be untouched by anything the vNext surface
// does. viewLevelStore.spec.tsx asserts 'canvas.viewMode' is never written.

import { create } from 'zustand'

export type ViewLevel = 'simple' | 'detailed'

export const VIEW_LEVEL_STORAGE_KEY = 'canvasVNext.viewLevel'

function readInitialLevel(): ViewLevel {
  try {
    return sessionStorage.getItem(VIEW_LEVEL_STORAGE_KEY) === 'detailed' ? 'detailed' : 'simple'
  } catch {
    return 'simple'
  }
}

interface ViewLevelState {
  level: ViewLevel
  setLevel: (level: ViewLevel) => void
}

export const useViewLevelStore = create<ViewLevelState>((set) => ({
  level: readInitialLevel(),
  setLevel: (level) => {
    try {
      sessionStorage.setItem(VIEW_LEVEL_STORAGE_KEY, level)
    } catch {
      // Session persistence unavailable — the in-memory toggle still works.
    }
    set({ level })
  },
}))
