import { useState } from 'react'
import { useLayoutStore } from '../layoutStore'
import { useCanvasStore } from '../store'

export function LayoutOptionsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  
  const {
    direction,
    nodeSpacing,
    layerSpacing,
    respectLocked,
    setDirection,
    setNodeSpacing,
    setLayerSpacing,
    setRespectLocked,
  } = useLayoutStore()
  
  const applyLayout = useCanvasStore(s => s.applyLayout)

  const handleApplyLayout = async () => {
    setIsApplying(true)
    try {
      await applyLayout()
      setIsOpen(false)
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        aria-label="Layout options"
      >
        🔧 Layout
      </button>
    )
  }

  return (
    <div className="fixed top-24 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 z-[2000]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Layout Options</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close layout options"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['DOWN', 'RIGHT', 'UP', 'LEFT'] as const).map(dir => (
              <button
                key={dir}
                onClick={() => setDirection(dir)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  direction === dir
                    ? 'bg-[#EA7B4B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {dir === 'DOWN' && '⬇️ Top-Bottom'}
                {dir === 'RIGHT' && '➡️ Left-Right'}
                {dir === 'UP' && '⬆️ Bottom-Top'}
                {dir === 'LEFT' && '⬅️ Right-Left'}
              </button>
            ))}
          </div>
        </div>

        {/* Node Spacing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Spacing: {nodeSpacing}px
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={nodeSpacing}
            onChange={(e) => setNodeSpacing(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#EA7B4B]"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10px</span>
            <span>100px</span>
          </div>
        </div>

        {/* Layer Spacing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Layer Spacing: {layerSpacing}px
          </label>
          <input
            type="range"
            min="20"
            max="150"
            step="10"
            value={layerSpacing}
            onChange={(e) => setLayerSpacing(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#EA7B4B]"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>20px</span>
            <span>150px</span>
          </div>
        </div>

        {/* Respect Locked */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-700">Respect Locked Nodes</span>
          <input
            type="checkbox"
            checked={respectLocked}
            onChange={(e) => setRespectLocked(e.target.checked)}
            className="w-4 h-4 text-[#EA7B4B] rounded focus:ring-[#EA7B4B]"
          />
        </label>

        {/* Apply Button */}
        <button
          onClick={handleApplyLayout}
          disabled={isApplying}
          className="w-full px-4 py-3 bg-[#EA7B4B] text-white rounded-lg hover:bg-[#EA7B4B]/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Applying...
            </span>
          ) : (
            'Apply Layout'
          )}
        </button>
      </div>
    </div>
  )
}
