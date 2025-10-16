import { useEffect } from 'react'

interface KeyboardCheatsheetProps {
  isOpen: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string
  description: string
  category: string
}

const shortcuts: Shortcut[] = [
  // Editing
  { keys: 'Double-click', description: 'Edit node label', category: 'Editing' },
  { keys: 'Enter', description: 'Commit edit', category: 'Editing' },
  { keys: 'Escape', description: 'Cancel edit', category: 'Editing' },
  
  // Selection
  { keys: '⌘/Ctrl + A', description: 'Select all', category: 'Selection' },
  { keys: 'Click + Drag', description: 'Marquee select', category: 'Selection' },
  { keys: 'Shift + Click', description: 'Toggle selection', category: 'Selection' },
  
  // Actions
  { keys: '⌘/Ctrl + D', description: 'Duplicate selected', category: 'Actions' },
  { keys: '⌘/Ctrl + C', description: 'Copy selected', category: 'Actions' },
  { keys: '⌘/Ctrl + X', description: 'Cut selected', category: 'Actions' },
  { keys: '⌘/Ctrl + V', description: 'Paste', category: 'Actions' },
  { keys: 'Delete/Backspace', description: 'Delete selected', category: 'Actions' },
  
  // History
  { keys: '⌘/Ctrl + Z', description: 'Undo', category: 'History' },
  { keys: '⌘/Ctrl + Shift + Z', description: 'Redo', category: 'History' },
  { keys: '⌘/Ctrl + Y', description: 'Redo (alt)', category: 'History' },
  
  // Navigation
  { keys: 'Arrow Keys', description: 'Nudge selected (1px)', category: 'Navigation' },
  { keys: 'Shift + Arrow', description: 'Nudge selected (10px)', category: 'Navigation' },
  { keys: 'Mouse Wheel', description: 'Pan canvas', category: 'Navigation' },
  { keys: '⌘/Ctrl + Wheel', description: 'Zoom canvas', category: 'Navigation' },
  
  // Tools
  { keys: '⌘/Ctrl + K', description: 'Command Palette', category: 'Tools' },
  { keys: '⌘/Ctrl + S', description: 'Save Snapshot', category: 'Tools' },
  { keys: 'Right-click', description: 'Context Menu', category: 'Tools' },
  { keys: '?', description: 'This cheatsheet', category: 'Tools' },
]

export function KeyboardCheatsheet({ isOpen, onClose }: KeyboardCheatsheetProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <div 
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close shortcuts"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {categories.map(category => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                    >
                      <span className="text-gray-700">{shortcut.description}</span>
                      <kbd className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono text-gray-800">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">?</kbd> anytime to view this cheatsheet
          </p>
        </div>
      </div>
    </div>
  )
}
