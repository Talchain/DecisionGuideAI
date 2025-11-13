/**
 * ConnectPrompt - P0-8
 * Shows prompt to connect newly created node to nearby nodes
 */

interface ConnectPromptProps {
  targetNodeLabel: string
  position: { x: number; y: number }
  onConfirm: () => void
  onCancel: () => void
}

export function ConnectPrompt({ targetNodeLabel, position, onConfirm, onCancel }: ConnectPromptProps) {
  return (
    <div
      className="fixed z-[3000] bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, 10px)'
      }}
    >
      <p className="text-sm text-gray-700 mb-3">
        Connect to <strong>{targetNodeLabel}</strong>?
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-info-500 hover:bg-info-600 rounded focus:outline-none focus:ring-2 focus:ring-info-500"
          autoFocus
        >
          Connect
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
