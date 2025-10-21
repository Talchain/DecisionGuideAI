/**
 * Layout popover with preset selection
 * Provides grid, hierarchy, and flow layout options
 */

import { useState } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import type { LayoutPreset, LayoutSpacing } from '../layout/types'

export function LayoutPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [spacing, setSpacing] = useState<LayoutSpacing>('medium')
  const applySimpleLayout = useCanvasStore(s => s.applySimpleLayout)
  const nodes = useCanvasStore(s => s.nodes)
  const { showToast } = useToast()

  const handleApplyLayout = (preset: LayoutPreset) => {
    if (nodes.length < 2) {
      showToast('Nothing to arrange yet — add at least 2 nodes', 'info')
      return
    }

    try {
      applySimpleLayout(preset, spacing)
      setIsOpen(false)
      showToast(`${preset.charAt(0).toUpperCase() + preset.slice(1)} layout applied`, 'success')
    } catch (error) {
      console.error('[CANVAS] Layout failed:', error)
      showToast('Layout failed. Please try again.', 'error')
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-label="Auto-layout your diagram"
        data-testid="btn-layout"
        title="Auto-layout your diagram"
      >
        Layout
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(false)}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-label="Close layout options"
        data-testid="btn-layout"
      >
        Layout
      </button>

      <div
        className="absolute bottom-full mb-2 left-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
        data-testid="layout-popover"
        role="dialog"
        aria-label="Layout options"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Auto-Layout</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-2 mb-4">
          <button
            onClick={() => handleApplyLayout('grid')}
            className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            data-testid="layout-preset-grid"
          >
            <div className="font-medium">📊 Neat Grid</div>
            <div className="text-xs text-gray-500">Arrange in rows and columns</div>
          </button>

          <button
            onClick={() => handleApplyLayout('hierarchy')}
            className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            data-testid="layout-preset-hierarchy"
          >
            <div className="font-medium">🌳 Hierarchy</div>
            <div className="text-xs text-gray-500">Top-down tree structure</div>
          </button>

          <button
            onClick={() => handleApplyLayout('flow')}
            className="w-full px-3 py-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            data-testid="layout-preset-flow"
          >
            <div className="font-medium">➡️ Flow</div>
            <div className="text-xs text-gray-500">Left-to-right flow</div>
          </button>
        </div>

        {/* Spacing */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Spacing
          </label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large'] as LayoutSpacing[]).map(s => (
              <button
                key={s}
                onClick={() => setSpacing(s)}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  spacing === s
                    ? 'bg-[#EA7B4B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
