import { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../store'

const STORAGE_KEY = 'canvas.welcome.dismissed'

interface EmptyStateOverlayProps {
  onDismiss: () => void
}

export function EmptyStateOverlay({ onDismiss }: EmptyStateOverlayProps) {
  const { nodes, addNode } = useCanvasStore()
  const contentRef = useRef<HTMLDivElement>(null)

  // Check if dismissed before
  const isDismissed = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'

  // Only show if no nodes and not dismissed
  if (nodes.length > 0 || isDismissed) return null

  const handleDismiss = useCallback((persist = false) => {
    if (persist && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    onDismiss()
  }, [onDismiss])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      handleDismiss(false)
    }
  }, [handleDismiss])

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleDismiss])

  return (
    <div 
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div ref={contentRef} className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg mx-4 relative">
        <button
          onClick={() => handleDismiss(false)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close welcome overlay"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 id="welcome-title" className="text-2xl font-bold text-gray-900 mb-4 pr-8">Welcome to Canvas</h2>
        
        <p className="text-gray-600 mb-6">
          Get started by adding your first node, or try one of these quick actions:
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => {
              addNode({ x: 250, y: 200 })
              handleDismiss(false)
            }}
            className="w-full px-4 py-3 bg-[#EA7B4B] text-white rounded-lg hover:bg-[#EA7B4B]/90 transition-colors text-left flex items-center gap-3"
          >
            <span className="text-2xl">➕</span>
            <div>
              <div className="font-medium">Add Your First Node</div>
              <div className="text-sm opacity-90">Start building your decision graph</div>
            </div>
          </button>

          <button
            onClick={() => {
              // Open import dialog would go here
              handleDismiss(false)
            }}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left flex items-center gap-3"
          >
            <span className="text-2xl">📁</span>
            <div>
              <div className="font-medium">Import Existing Canvas</div>
              <div className="text-sm text-gray-600">Load from JSON file</div>
            </div>
          </button>

          <button
            onClick={() => handleDismiss(false)}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-left flex items-center gap-3"
          >
            <span className="text-2xl">⌘</span>
            <div>
              <div className="font-medium">Open Command Palette</div>
              <div className="text-sm text-gray-600">Press ⌘K for quick actions</div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={() => handleDismiss(true)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Don't show this again
          </button>
          <button
            onClick={() => {
              // Open keyboard cheatsheet
              handleDismiss(false)
            }}
            className="text-sm text-[#EA7B4B] hover:text-[#EA7B4B]/80 font-medium transition-colors"
          >
            View Keyboard Shortcuts
          </button>
        </div>
      </div>
    </div>
  )
}
