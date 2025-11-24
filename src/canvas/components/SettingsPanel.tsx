import { useState } from 'react'
import { useSettingsStore } from '../settingsStore'

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    showGrid,
    gridSize,
    snapToGrid,
    showAlignmentGuides,
    highContrastMode,
    setShowGrid,
    setGridSize,
    setSnapToGrid,
    setShowAlignmentGuides,
    setHighContrastMode,
  } = useSettingsStore()

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-3 bg-white rounded-full shadow-panel transition-shadow border border-gray-200"
        aria-label="Open settings"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-2xl shadow-panel border border-gray-200 p-6 z-[2000]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Grid Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">Show Grid</span>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary"
          />
        </label>

        {/* Grid Size Slider */}
        {showGrid && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grid Size: {gridSize}px
            </label>
            <input
              type="range"
              min="8"
              max="24"
              step="8"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as 8 | 16 | 24)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>8px</span>
              <span>16px</span>
              <span>24px</span>
            </div>
          </div>
        )}

        {/* Snap to Grid */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">Snap to Grid</span>
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary"
          />
        </label>

        {/* Alignment Guides */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">Alignment Guides</span>
          <input
            type="checkbox"
            checked={showAlignmentGuides}
            onChange={(e) => setShowAlignmentGuides(e.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary"
          />
        </label>

        {/* High Contrast */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">High Contrast Mode</span>
          <input
            type="checkbox"
            checked={highContrastMode}
            onChange={(e) => setHighContrastMode(e.target.checked)}
            className="w-4 h-4 text-primary rounded focus:ring-primary"
          />
        </label>
      </div>
    </div>
  )
}
