import { useState } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import type { LayoutPreset, LayoutSpacing } from '../layout/types'
import { BottomSheet } from './BottomSheet'
import { GuidedLayoutDialog } from './GuidedLayoutDialog'
import { typography } from '../../styles/typography'

export function LayoutPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [showGuidedModal, setShowGuidedModal] = useState(false)
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

  const handleGuidedLayout = () => {
    setIsOpen(false)
    setShowGuidedModal(true)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
        aria-label="Auto-layout your diagram"
        data-testid="btn-layout"
        title="Auto-layout your diagram"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
        </svg>
      </button>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Auto-Layout">
        <div className="space-y-4">
          {/* Presets */}
          <div>
            <label className={`block ${typography.label} text-gray-700 mb-2`}>Layout Style</label>
            <div className="space-y-2">
              <button onClick={() => handleApplyLayout('grid')} className={`w-full px-3 py-2 text-left ${typography.body} bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors`} data-testid="layout-preset-grid">
                <div className="font-medium">📊 Neat Grid</div>
                <div className={`${typography.caption} text-gray-500`}>Arrange in rows and columns</div>
              </button>
              <button onClick={() => handleApplyLayout('hierarchy')} className={`w-full px-3 py-2 text-left ${typography.body} bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors`} data-testid="layout-preset-hierarchy">
                <div className="font-medium">🌳 Hierarchy</div>
                <div className={`${typography.caption} text-gray-500`}>Top-down tree structure</div>
              </button>
              <button onClick={() => handleApplyLayout('flow')} className={`w-full px-3 py-2 text-left ${typography.body} bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors`} data-testid="layout-preset-flow">
                <div className="font-medium">➡️ Flow</div>
                <div className={`${typography.caption} text-gray-500`}>Left-to-right flow</div>
              </button>
              <button onClick={handleGuidedLayout} className={`w-full px-3 py-2 text-left ${typography.body} bg-carrot-500/10 hover:bg-carrot-500/20 rounded border border-carrot-500/30 transition-colors`}>
                <div className="font-medium text-carrot-500">✨ Guided Layout</div>
                <div className={`${typography.caption} text-gray-600`}>Smart semantic layout</div>
              </button>
            </div>
          </div>

          {/* Spacing */}
          <div>
            <label className={`block ${typography.label} text-gray-700 mb-2`}>Spacing</label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as LayoutSpacing[]).map(s => (
                <button key={s} onClick={() => setSpacing(s)} className={`flex-1 px-2 py-1 ${typography.caption} rounded transition-colors ${spacing === s ? 'bg-carrot-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      <GuidedLayoutDialog 
        isOpen={showGuidedModal} 
        onClose={() => setShowGuidedModal(false)} 
      />
    </>
  )
}
