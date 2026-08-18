/**
 * P0-9: Inline Edge Weight/Belief Popover
 *
 * Double-click edge label to open inline editor for weight and belief.
 * - Live preview updates edge label
 * - Enter/Click outside to commit
 * - ESC to cancel
 * - Debounced updates (120ms) for INP performance
 *
 * ⭐ WHY THIS PORTALS (18 Aug 2026).
 * `StyledEdge` returns this component as a plain sibling of its edge path, and
 * `@xyflow/react` renders an edge component inside `<svg><g>…</g></svg>`
 * (derived at the installed bytes, `EdgeWrapper`). React creates the children
 * of an `<svg>` in the SVG NAMESPACE, so unportalled this whole subtree was
 * built as SVG-namespaced `div`s — unknown SVG elements, which the SVG
 * rendering model does not lay out as HTML boxes. `position: fixed` cannot mean
 * anything on such an element, and even in the HTML namespace it would have
 * resolved against the viewport TRANSFORM rather than the viewport, because a
 * transformed ancestor becomes the containing block for `fixed` descendants.
 *
 * The coordinates this component is handed are `event.clientX/clientY` from
 * `handleLabelDoubleClick` — i.e. VIEWPORT coordinates — so `fixed` is the
 * right declaration and `document.body` is the right parent. Same pattern, and
 * same reason, as `nodes/shared/NodePopover.tsx`.
 *
 * Consequence for typography: this is a floating PANEL surface OUTSIDE the
 * canvas transform, so DS v5 §2.2's panel scale (`panelHeader` 14px /
 * `panelMeta` 11px) governs it and the §2.3 canvas scale does not. It is
 * therefore correctly excluded from the canvas counter-scale census, by the
 * same earned mechanism as `NodePopover`. Pinned by
 * `__tests__/EdgeEditPopover.mount.spec.tsx`.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { typography } from '../../styles/typography'

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

  const handleBeliefKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
    setBelief(prev => clamp01(parseFloat((prev + delta).toFixed(2))))
  }

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
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onClose()
    }
  }, [onClose])

  return createPortal(
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
      aria-label="Edit edge weight and belief"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${typography.panelHeader} text-gray-900`}>Edit Edge</h3>
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

      {/* Belief Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="belief-slider" className={`${typography.panelMeta} text-gray-700`}>
            Belief
          </label>
          <span className={`${typography.panelMeta} font-mono text-gray-600`}>{belief.toFixed(2)}</span>
        </div>
        <input
          id="belief-slider"
          aria-label="Belief slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={belief}
          onChange={(e) => setBelief(parseFloat(e.target.value))}
          onKeyDown={handleBeliefKeyDown}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
      </div>

      {/* Footer hint */}
      <div className={`${typography.panelMeta} text-gray-500 pt-2 border-t border-gray-200`}>
        Press Enter to save, ESC to cancel. Arrow keys: 
        ±0.01 (Shift: ±0.05)
      </div>
    </div>,
    document.body,
  )
}
