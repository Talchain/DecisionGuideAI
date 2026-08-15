/**
 * P0-9: Inline Edge Weight/Belief Popover
 *
 * Double-click edge label to edit canonical relationship strength.
 * - Enter/Click outside to commit
 * - ESC to cancel
 * Unsupported legacy belief is deliberately read-only elsewhere.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface EdgeEditPopoverProps {
  edge: {
    id: string
    data: {
      weight: number
      /** Retained for call-site/test compatibility; deliberately never edited. */
      belief?: number
    }
  }
  position: { x: number; y: number }
  onUpdate: (id: string, data: { weight: number }) => void
  onClose: () => void
}

export function EdgeEditPopover({ edge, position, onUpdate, onClose }: EdgeEditPopoverProps) {
  const [weight, setWeight] = useState(edge.data.weight ?? 0.5)
  const popoverRef = useRef<HTMLDivElement>(null)

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

  const handleWeightKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key, shiftKey } = event
    const step = shiftKey ? 0.05 : 0.01
    let delta = 0

    if (key === 'ArrowUp' || key === 'ArrowRight') {
      delta = step
    } else if (key === 'ArrowDown' || key === 'ArrowLeft') {
      delta = -step
    } else {
      return
    }

    event.preventDefault()
    setWeight(prev => clamp01(parseFloat((prev + delta).toFixed(2))))
  }

  const commitAndClose = useCallback(() => {
    if (weight !== edge.data.weight) onUpdate(edge.id, { weight })
    onClose()
  }, [edge.data.weight, edge.id, onClose, onUpdate, weight])

  // Handle click outside to commit
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        commitAndClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [commitAndClose])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commitAndClose()
    }
  }, [commitAndClose, onClose])

  return (
    <div
      ref={popoverRef}
      className="fixed bg-white border border-gray-300 rounded-lg shadow-panel p-4 z-[3000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%) translateY(-8px)', // Center above cursor
        minWidth: '240px'
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Edit relationship strength"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${typography.panelHeader} text-gray-900`}>Edit relationship strength</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Weight Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="weight-slider" className={`${typography.panelMeta} text-gray-700`}>
            Weight
          </label>
          <span className={`${typography.panelMeta} font-mono text-gray-600`}>{weight.toFixed(2)}</span>
        </div>
        <input
          id="weight-slider"
          aria-label="Weight slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value))}
          onKeyDown={handleWeightKeyDown}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      <p className={`${typography.panelMeta} text-gray-500 mb-3`}>
        Relationship likelihood and uncertainty use the shared-model values and cannot be edited here yet.
      </p>

      {/* Footer hint */}
      <div className={`${typography.panelMeta} text-gray-500 pt-2 border-t border-gray-200`}>
        Press Enter to save, ESC to cancel. Arrow keys: 
        ±0.01 (Shift: ±0.05)
      </div>
    </div>
  )
}
