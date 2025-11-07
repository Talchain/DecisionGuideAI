/**
 * Confidence Badge Component
 *
 * Displays confidence level (Low/Medium/High) with semantic colors
 * and a short reason that expands on hover/focus.
 */

interface ConfidenceBadgeProps {
  level: 'low' | 'medium' | 'high'
  reason: string
}

export function ConfidenceBadge({ level, reason }: ConfidenceBadgeProps) {
  const config = {
    low: {
      label: 'Low Confidence',
      classes: 'bg-red-50 border-red-200 text-red-600',
      icon: '⚠️'
    },
    medium: {
      label: 'Medium Confidence',
      classes: 'bg-yellow-50 border-yellow-200 text-yellow-600',
      icon: '📊'
    },
    high: {
      label: 'High Confidence',
      classes: 'bg-green-50 border-green-200 text-green-600',
      icon: '✓'
    }
  }

  const { label, classes, icon } = config[level]

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border cursor-default ${classes}`}
      title={reason}
    >
      <span className="text-base leading-none">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">
          {label}
        </div>
        <div className="text-xs text-gray-400 leading-tight">
          {reason}
        </div>
      </div>
    </div>
  )
}
