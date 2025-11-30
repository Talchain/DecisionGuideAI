/**
 * Full inspector modal - opens on double-click or expand button
 * Centered modal overlay with full NodeInspector or EdgeInspector
 * British English: visualisation, colour
 */

import { memo, useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NodeInspector } from '../ui/NodeInspector'
import { EdgeInspector } from '../ui/EdgeInspector'

interface InspectorModalProps {
  nodeId: string | null
  edgeId: string | null
  onClose: () => void
}

export const InspectorModal = memo(({ nodeId, edgeId, onClose }: InspectorModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const clearSelection = useCanvasStore(s => s.clearSelection)

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }, [onClose])

  // Handle close and clear selection
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    // Focus first focusable element
    firstFocusable?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable?.focus()
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable?.focus()
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [])

  if (!nodeId && !edgeId) return null

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-modal-title"
    >
      <div
        ref={modalRef}
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl">
          <h2 id="inspector-modal-title" className="text-sm font-semibold text-gray-900">
            {nodeId ? 'Node Properties' : 'Edge Properties'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close inspector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-0">
          {nodeId && (
            <NodeInspector
              nodeId={nodeId}
              onClose={handleClose}
            />
          )}
          {edgeId && !nodeId && (
            <EdgeInspector
              edgeId={edgeId}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  )
})

InspectorModal.displayName = 'InspectorModal'
