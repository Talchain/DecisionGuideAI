/**
 * Edge Label Toggle (P1 Polish - Task D)
 *
 * Toggle between human-readable and numeric edge labels:
 * - Human: "Strong boost", "Moderate drag (uncertain)"
 * - Numeric: "w 0.60 • b 85%"
 *
 * Features:
 * - Live updates (no reload required)
 * - Cross-tab synchronisation
 * - Accessible switch with clear labels
 * - Keyboard navigation (Space/Enter)
 * - WCAG AA compliant
 */

import { useEdgeLabelMode } from '../store/edgeLabelMode'
import { Type, Binary } from 'lucide-react'
import { typography } from '../../styles/typography'

interface EdgeLabelToggleProps {
  className?: string
  showLabel?: boolean
}

export function EdgeLabelToggle({ className = '', showLabel = true }: EdgeLabelToggleProps) {
  const mode = useEdgeLabelMode(state => state.mode)
  const setMode = useEdgeLabelMode(state => state.setMode)

  const handleToggle = () => {
    setMode(mode === 'human' ? 'numeric' : 'human')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  const isNumeric = mode === 'numeric'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className={`${typography.caption} font-medium text-gray-700 dark:text-gray-300`}>
          Edge labels:
        </span>
      )}

      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="switch"
        aria-checked={isNumeric}
        aria-label={`Edge label mode: ${mode === 'human' ? 'Human-readable' : 'Numeric'}. Click to switch to ${mode === 'human' ? 'numeric' : 'human-readable'} mode`}
        title={
          mode === 'human'
            ? 'Showing human-readable labels (e.g., "Strong boost"). Click to switch to numeric (e.g., "w 0.60 • b 85%")'
            : 'Showing numeric labels (e.g., "w 0.60 • b 85%"). Click to switch to human-readable (e.g., "Strong boost")'
        }
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600"
        data-testid="edge-label-toggle"
      >
        {/* Icon indicator */}
        {mode === 'human' ? (
          <Type className="w-4 h-4 text-info-600 dark:text-info-400" aria-hidden="true" />
        ) : (
          <Binary className="w-4 h-4 text-warning-600 dark:text-warning-400" aria-hidden="true" />
        )}

        {/* Mode label */}
        <span className={`${typography.caption} font-medium text-gray-900 dark:text-gray-100`}>
          {mode === 'human' ? 'Human' : 'Numeric'}
        </span>

        {/* Visual switch indicator */}
        <div
          className={`relative w-8 h-4 rounded-full transition-colors ${
            isNumeric
              ? 'bg-warning-500 dark:bg-warning-600'
              : 'bg-info-500 dark:bg-info-600'
          }`}
          aria-hidden="true"
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 ease-in-out ${
              isNumeric ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </button>
    </div>
  )
}
