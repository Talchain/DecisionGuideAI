/**
 * M4: Health Status Bar
 * Shows graph health score and issue count
 */

import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import type { GraphHealth } from '../validation/types'

interface HealthStatusBarProps {
  health: GraphHealth
  onShowIssues: () => void
  onQuickFix?: () => void
}

export function HealthStatusBar({ health, onShowIssues, onQuickFix }: HealthStatusBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const errorCount = health.issues.filter((i) => i.severity === 'error').length
  const warningCount = health.issues.filter((i) => i.severity === 'warning').length
  const infoCount = health.issues.filter((i) => i.severity === 'info').length
  const fixableCount = health.issues.filter((i) => i.suggestedFix).length

  // Color based on status
  const statusColors = {
    healthy: 'bg-green-50 border-green-200 text-green-800',
    warnings: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    errors: 'bg-red-50 border-red-200 text-red-800',
  }

  const statusIcons = {
    healthy: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    warnings: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    errors: <AlertCircle className="w-5 h-5 text-red-600" />,
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${statusColors[health.status]}`}>
      {/* Main bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-black/5"
      >
        <div className="flex items-center gap-3">
          {statusIcons[health.status]}
          <div className="text-left">
            <div className="font-medium text-sm">
              Graph Health: {health.status === 'healthy' ? 'Good' : health.status}
            </div>
            <div className="text-xs opacity-80">Score: {health.score}/100</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {health.issues.length > 0 && (
            <div className="flex gap-2 text-xs">
              {errorCount > 0 && <span className="font-medium">{errorCount} errors</span>}
              {warningCount > 0 && <span>{warningCount} warnings</span>}
              {infoCount > 0 && <span>{infoCount} info</span>}
            </div>
          )}
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && health.issues.length > 0 && (
        <div className="border-t border-current/20 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{health.issues.length} issues found</span>
            <div className="flex gap-2">
              {fixableCount > 0 && onQuickFix && (
                <button
                  onClick={onQuickFix}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                >
                  <Wrench className="w-3 h-3" />
                  Quick Fix ({fixableCount})
                </button>
              )}
              <button
                onClick={onShowIssues}
                className="px-3 py-1 bg-white/50 rounded text-xs font-medium hover:bg-white/80"
              >
                View Details
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-current transition-all duration-300"
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
