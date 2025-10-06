// src/components/KeyboardShortcuts.tsx
// Keyboard shortcuts help panel

interface KeyboardShortcutsProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null

  const shortcuts = [
    { category: 'Tools', items: [
      { key: 'V', description: 'Select tool' },
      { key: 'H', description: 'Pan tool' },
      { key: 'C', description: 'Connect mode (link nodes)' },
      { key: 'N', description: 'Add node (at viewport center)' },
    ]},
    { category: 'Actions', items: [
      { key: 'Del / ⌫', description: 'Delete selected node' },
      { key: 'Esc', description: 'Deselect / Exit mode' },
      { key: 'Shift + Drag', description: 'Pan canvas' },
      { key: 'Scroll', description: 'Zoom in/out' },
    ]},
    { category: 'Canvas', items: [
      { key: 'Drag', description: 'Draw on whiteboard' },
      { key: 'Drag Node', description: 'Move node' },
      { key: 'Click Node', description: 'Select node' },
      { key: 'Double-Click', description: 'Rename node (Enter to save)' },
    ]},
  ]

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-indigo-600 mb-2">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-semibold text-gray-800">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Your workspace autosaves every 2 seconds • Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono">Esc</kbd> to close this panel
          </p>
        </div>
      </div>
    </div>
  )
}
