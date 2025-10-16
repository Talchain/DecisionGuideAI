import { useCanvasStore } from '../store'

interface EmptyStateOverlayProps {
  onDismiss: () => void
}

export function EmptyStateOverlay({ onDismiss }: EmptyStateOverlayProps) {
  const { nodes, addNode } = useCanvasStore()

  // Only show if no nodes
  if (nodes.length > 0) return null

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Canvas</h2>
        
        <p className="text-gray-600 mb-6">
          Get started by adding your first node, or try one of these quick actions:
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => {
              addNode({ x: 250, y: 200 })
              onDismiss()
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
              onDismiss()
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
            onClick={onDismiss}
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
            onClick={onDismiss}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Don't show this again
          </button>
          <button
            onClick={() => {
              // Open keyboard cheatsheet
              onDismiss()
            }}
            className="text-sm text-[#EA7B4B] hover:text-[#EA7B4B]/80 font-medium"
          >
            View Keyboard Shortcuts
          </button>
        </div>
      </div>
    </div>
  )
}
