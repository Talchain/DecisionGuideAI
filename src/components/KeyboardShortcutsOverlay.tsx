/**
 * N6: Keyboard Shortcuts Overlay
 * Press ? to toggle
 */

import { X } from 'lucide-react'

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { key: '⌘/Ctrl + R', description: 'Run analysis' },
  { key: '⌘/Ctrl + Z', description: 'Undo' },
  { key: '⌘/Ctrl + Shift + Z', description: 'Redo' },
  { key: '⌘/Ctrl + D', description: 'Toggle Documents drawer' },
  { key: 'T', description: 'Toggle Templates panel' },
  { key: 'I', description: 'Toggle Inspector panel' },
  { key: 'H', description: 'Toggle Results/History panel' },
  { key: 'Escape', description: 'Close active panel' },
  { key: '?', description: 'Show this help' }
]

export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="Close shortcuts overlay"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-900 rounded border border-gray-300">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> or{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded">?</kbd> to close
        </div>
      </div>
    </div>
  )
}
