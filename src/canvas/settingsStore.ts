import { create } from 'zustand'

interface CanvasSettings {
  showGrid: boolean
  gridSize: 8 | 16 | 24
  snapToGrid: boolean
  showAlignmentGuides: boolean
  highContrastMode: boolean
  setShowGrid: (show: boolean) => void
  setGridSize: (size: 8 | 16 | 24) => void
  setSnapToGrid: (snap: boolean) => void
  setShowAlignmentGuides: (show: boolean) => void
  setHighContrastMode: (enabled: boolean) => void
  loadSettings: () => void
}

const KEY = 'canvas-settings-v1'

export const useSettingsStore = create<CanvasSettings>((set, get) => ({
  showGrid: true,
  gridSize: 16,
  snapToGrid: false,
  showAlignmentGuides: true,
  highContrastMode: false,
  
  setShowGrid: (show) => {
    set({ showGrid: show })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setGridSize: (size) => {
    set({ gridSize: size })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setSnapToGrid: (snap) => {
    set({ snapToGrid: snap })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setShowAlignmentGuides: (show) => {
    set({ showAlignmentGuides: show })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  setHighContrastMode: (enabled) => {
    set({ highContrastMode: enabled })
    localStorage.setItem(KEY, JSON.stringify(get()))
  },
  loadSettings: () => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        set({
          showGrid: parsed.showGrid ?? true,
          gridSize: parsed.gridSize ?? 16,
          snapToGrid: parsed.snapToGrid ?? false,
          showAlignmentGuides: parsed.showAlignmentGuides ?? true,
          highContrastMode: parsed.highContrastMode ?? false,
        })
      }
    } catch (e) {
      console.warn('Failed to load settings:', e)
    }
  },
}))
