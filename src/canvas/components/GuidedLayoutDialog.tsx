/**
 * Guided Layout Dialog with Apply/Cancel pattern
 * Staged changes only - no canvas mutation until Apply
 */

import { useState, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import { BottomSheet } from './BottomSheet'
import type { LayoutPolicy, RiskPlacement } from '../layout/policy'
import { DEFAULT_LAYOUT_POLICY } from '../layout/policy'

interface GuidedLayoutDialogProps {
  isOpen: boolean
  onClose: () => void
}

type SpacingPreset = 'compact' | 'normal' | 'roomy'

const SPACING_PRESETS: Record<SpacingPreset, { x: number; y: number }> = {
  compact: { x: 80, y: 64 },
  normal: { x: 120, y: 96 },
  roomy: { x: 160, y: 128 }
}

export function GuidedLayoutDialog({ isOpen, onClose }: GuidedLayoutDialogProps) {
  const applyGuidedLayout = useCanvasStore(s => s.applyGuidedLayout)
  const nodes = useCanvasStore(s => s.nodes)
  const { showToast } = useToast()
  
  // Staged UI state (not applied until user clicks Apply)
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR')
  const [spacing, setSpacing] = useState<SpacingPreset>('normal')
  const [placeGoalsFirst, setPlaceGoalsFirst] = useState(true)
  const [placeOutcomesLast, setPlaceOutcomesLast] = useState(true)
  const [riskPlacement, setRiskPlacement] = useState<RiskPlacement>('adjacent')
  const [respectLocked, setRespectLocked] = useState(true)
  
  // Reset to defaults when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDirection('LR')
      setSpacing('normal')
      setPlaceGoalsFirst(true)
      setPlaceOutcomesLast(true)
      setRiskPlacement('adjacent')
      setRespectLocked(true)
    }
  }, [isOpen])
  
  const canApply = nodes.length >= 2
  
  const handleApply = () => {
    if (!canApply) {
      showToast('Add at least two nodes to apply layout', 'info')
      return
    }
    
    // Build policy from staged UI state
    const policy: Partial<LayoutPolicy> = {
      direction,
      spacing: SPACING_PRESETS[spacing],
      respectLocked,
      layers: {
        ...DEFAULT_LAYOUT_POLICY.layers,
        goal: placeGoalsFirst ? 'first' : 'middle',
        outcome: placeOutcomesLast ? 'last' : 'middle',
        risk: riskPlacement
      }
    }
    
    applyGuidedLayout(policy)
    showToast('Layout applied — press ⌘Z to undo.', 'success')
    onClose()
  }
  
  const handleCancel = () => {
    // Discard staged changes
    onClose()
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canApply) {
      e.preventDefault()
      handleApply()
    }
  }
  
  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={handleCancel} 
      title="Guided Layout"
    >
      <div className="space-y-6" onKeyDown={handleKeyDown}>
        {/* Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Direction
          </label>
          <div className="flex gap-2" role="group" aria-label="Layout direction">
            <button
              onClick={() => setDirection('LR')}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                direction === 'LR'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-pressed={direction === 'LR'}
              data-testid="direction-lr"
            >
              Left → Right
            </button>
            <button
              onClick={() => setDirection('TB')}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                direction === 'TB'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-pressed={direction === 'TB'}
              data-testid="direction-tb"
            >
              Top → Bottom
            </button>
          </div>
        </div>
        
        {/* Spacing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Spacing
          </label>
          <div className="flex gap-2" role="group" aria-label="Node spacing">
            {(['compact', 'normal', 'roomy'] as SpacingPreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => setSpacing(preset)}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  spacing === preset
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-pressed={spacing === preset}
                data-testid={`spacing-${preset}`}
              >
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Semantic Toggles */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Semantics
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={placeGoalsFirst}
              onChange={(e) => setPlaceGoalsFirst(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              data-testid="toggle-goals-first"
            />
            <span className="text-sm text-gray-700">Place Goals first</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={placeOutcomesLast}
              onChange={(e) => setPlaceOutcomesLast(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              data-testid="toggle-outcomes-last"
            />
            <span className="text-sm text-gray-700">Place Outcomes last</span>
          </label>
          
          <div>
            <label className="block text-sm text-gray-700 mb-2">
              Keep Risks near their source
            </label>
            <div className="flex gap-2" role="group" aria-label="Risk placement">
              {(['adjacent', 'sameColumn', 'auto'] as RiskPlacement[]).map(placement => (
                <button
                  key={placement}
                  onClick={() => setRiskPlacement(placement)}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                    riskPlacement === placement
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-pressed={riskPlacement === placement}
                  data-testid={`risk-${placement}`}
                >
                  {placement === 'sameColumn' ? 'Same Column' : placement.charAt(0).toUpperCase() + placement.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Constraints */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={respectLocked}
              onChange={(e) => setRespectLocked(e.target.checked)}
              className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              data-testid="toggle-respect-locked"
            />
            <span className="text-sm text-gray-700">Respect locked node positions</span>
          </label>
        </div>
        
        {/* Helper text when < 2 nodes */}
        {!canApply && (
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
            Add at least two nodes to apply layout
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            data-testid="guided-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${
              canApply
                ? 'bg-primary text-white hover:bg-primary-hover'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            data-testid="guided-apply"
            autoFocus
          >
            Apply
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
