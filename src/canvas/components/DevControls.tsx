/**
 * DevControls - Debug toggle for development and QA
 *
 * Provides a toggle to include debug metadata in API requests.
 * Hidden in production builds unless explicitly enabled.
 */

import { useState } from 'react'
import { Bug } from 'lucide-react'

export interface DevControlsProps {
  /** Current debug state */
  debug: boolean
  /** Callback when debug state changes */
  onDebugChange: (debug: boolean) => void
  /** Optional className */
  className?: string
}

export function DevControls({ debug, onDebugChange, className = '' }: DevControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`relative ${className}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Developer controls"
        aria-expanded={isExpanded}
        data-testid="btn-dev-controls"
      >
        <Bug className="w-3.5 h-3.5" />
        <span>Dev</span>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700">Developer Controls</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Debug toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => onDebugChange(e.target.checked)}
              className="w-4 h-4 text-info border-gray-300 rounded focus:ring-2 focus:ring-info"
              data-testid="toggle-debug"
            />
            <div>
              <div className="text-xs font-medium text-gray-700">Debug Mode</div>
              <div className="text-[10px] text-gray-500">Include debug metadata in API requests</div>
            </div>
          </label>

          {/* Status indicator */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-[10px]">
              <div className={`w-2 h-2 rounded-full ${debug ? 'bg-semantic-success' : 'bg-gray-300'}`} />
              <span className="text-gray-600">
                Debug: <span className="font-medium">{debug ? 'ON' : 'OFF'}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
