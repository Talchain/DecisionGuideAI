/**
 * P0-9: Inline Edge Weight/Belief Popover
 *
 * Double-click edge label to open inline editor for weight and belief.
 * - Live preview updates edge label
 * - Enter/Click outside to commit
 * - ESC to cancel
 * - Debounced updates (120ms) for INP performance
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

export interface EdgeEditPopoverProps {
  edge: {
    id: string
    data: {
      weight: number
      belief?: number
    }
  }
  position: { x: number; y: number }
  onUpdate: (id: string, data: { weight: number; belief: number }) => void
  onClose: () => void
}

export function EdgeEditPopover({ edge, position, onUpdate, onClose }: EdgeEditPopoverProps) {
  const [weight, setWeight] = useState(edge.data.weight ?? 0.5)
  const [belief, setBelief] = useState(edge.data.belief ?? 0.5)
  const popoverRef = useRef<HTMLDivElement>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout>()

  // Debounced update for live preview (120ms for INP)
  useEffect(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    updateTimeoutRef.current = setTimeout(() => {
      // Live preview update (doesn't commit to history)
      onUpdate(edge.id, { weight, belief })
    }, 120)

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [weight, belief, edge.id, onUpdate])

  // Handle click outside to commit
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onClose()
    }
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      className="fixed bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-[3000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%) translateY(-8px)', // Center above cursor
        minWidth: '240px'
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Edit edge weight and belief"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Edit Edge</h3>
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
          <label htmlFor="weight-slider" className="text-xs font-medium text-gray-700">
            Weight
          </label>
          <span className="text-xs font-mono text-gray-600">{weight.toFixed(2)}</span>
        </div>
        <input
          id="weight-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Belief Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="belief-slider" className="text-xs font-medium text-gray-700">
            Belief
          </label>
          <span className="text-xs font-mono text-gray-600">{belief.toFixed(2)}</span>
        </div>
        <input
          id="belief-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={belief}
          onChange={(e) => setBelief(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Footer hint */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
        Press Enter to save, ESC to cancel
      </div>
    </div>
  )
}
