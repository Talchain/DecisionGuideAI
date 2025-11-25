/**
 * ScoreChip Component
 *
 * Displays scores (confidence, influence, etc.) with traffic-light colors.
 * Part of Phase 1A.3 for visual score indicators.
 */

import { typography } from '../../styles/typography'

interface ScoreChipProps {
  value: number // 0-100 for confidence, 0-1 for influence
  type: 'confidence' | 'influence'
  label?: string
  showValue?: boolean
}

/**
 * Get traffic-light color class based on score value
 */
function getColorClass(value: number, type: 'confidence' | 'influence'): {
  bg: string
  border: string
  text: string
} {
  if (type === 'confidence') {
    // Confidence: 0-100%
    if (value >= 70) {
      return {
        bg: 'bg-success-50',
        border: 'border-success-300',
        text: 'text-success-800',
      }
    }
    if (value >= 40) {
      return {
        bg: 'bg-warning-50',
        border: 'border-warning-300',
        text: 'text-warning-800',
      }
    }
    return {
      bg: 'bg-danger-50',
      border: 'border-danger-300',
      text: 'text-danger-800',
    }
  } else {
    // Influence: 0-1
    if (value >= 0.7) {
      return {
        bg: 'bg-success-50',
        border: 'border-success-300',
        text: 'text-success-800',
      }
    }
    if (value >= 0.4) {
      return {
        bg: 'bg-warning-50',
        border: 'border-warning-300',
        text: 'text-warning-800',
      }
    }
    return {
      bg: 'bg-danger-50',
      border: 'border-danger-300',
      text: 'text-danger-800',
    }
  }
}

/**
 * Get label text based on score value
 */
function getScoreLabel(value: number, type: 'confidence' | 'influence'): string {
  if (type === 'confidence') {
    if (value >= 90) return 'Very high'
    if (value >= 70) return 'High'
    if (value >= 50) return 'Moderate'
    if (value >= 30) return 'Low'
    return 'Very low'
  } else {
    if (value >= 0.8) return 'Very high'
    if (value >= 0.6) return 'High'
    if (value >= 0.4) return 'Moderate'
    if (value >= 0.2) return 'Low'
    return 'Very low'
  }
}

/**
 * Format value for display
 */
function formatValue(value: number, type: 'confidence' | 'influence'): string {
  if (type === 'confidence') {
    return `${Math.round(value)}%`
  } else {
    return value.toFixed(1)
  }
}

export function ScoreChip({ value, type, label, showValue = true }: ScoreChipProps) {
  const colors = getColorClass(value, type)
  const scoreLabel = label ?? getScoreLabel(value, type)
  const formattedValue = formatValue(value, type)

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colors.bg} ${colors.border}`}
      data-testid="score-chip"
    >
      {/* Traffic light indicator dot */}
      <div
        className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`}
        aria-hidden="true"
      />
      <span className={`${typography.caption} font-medium ${colors.text}`}>
        {scoreLabel}
        {showValue && <span className="ml-1 tabular-nums">({formattedValue})</span>}
      </span>
    </div>
  )
}
