/**
 * ModelHealthSection — Persistent panel section showing real-time structural health checks.
 *
 * Runs client-side checks after every graph mutation. Displays compact status line
 * with expandable issue list. Issues are clickable to select affected elements on canvas.
 *
 * Design system: bg-panel, Inter font, Lucide icons only, no emoji.
 * Severity: blocker = danger, warning = warning.
 */

import { useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useModelHealth, type HealthIssue, type HealthSeverity } from '../hooks/useModelHealth'
import { useCanvasStore } from '../store'

/** Severity badge with icon + colour */
function SeverityBadge({ severity }: { severity: HealthSeverity }) {
  if (severity === 'blocker') {
    return (
      <span
        className="inline-flex items-center gap-1 text-danger"
        style={{ fontSize: 10, fontWeight: 600 }}
      >
        <XCircle size={12} />
        Blocker
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-warning"
      style={{ fontSize: 10, fontWeight: 600 }}
    >
      <AlertTriangle size={12} />
      Warning
    </span>
  )
}

/** Edge-related issue keys that should focus an edge rather than a node */
const EDGE_ISSUE_PREFIXES = ['extreme-weight-', 'duplicate-edge-']

/** Single issue row */
function IssueRow({ issue }: { issue: HealthIssue }) {
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const selectEdgeWithoutHistory = useCanvasStore(s => s.selectEdgeWithoutHistory)

  const handleClick = useCallback(() => {
    if (issue.affectedIds.length === 0) return
    const targetId = issue.affectedIds[0]
    // Determine whether the affected element is an edge or node based on issue type
    const isEdgeIssue = EDGE_ISSUE_PREFIXES.some(p => issue.key.startsWith(p))
    if (isEdgeIssue) {
      selectEdgeWithoutHistory(targetId)
    } else {
      selectNodeWithoutHistory(targetId)
    }
  }, [issue.affectedIds, issue.key, selectNodeWithoutHistory, selectEdgeWithoutHistory])

  return (
    <div
      className="flex items-start gap-2 py-2 cursor-pointer hover:bg-panel-hover rounded px-2 -mx-2 transition-colors"
      style={{ fontSize: 11, lineHeight: 1.4 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
      data-testid={`health-issue-${issue.key}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <SeverityBadge severity={issue.severity} />
      </div>
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text-body, #3F3F3E)' }}>
          {issue.title}
        </div>
        <div style={{ color: 'var(--text-light, #706D6D)', marginTop: 1 }}>
          {issue.description}
        </div>
      </div>
    </div>
  )
}

/** Main component — compact status line with expandable issue list */
export function ModelHealthSection() {
  const issues = useModelHealth()
  const [isExpanded, setIsExpanded] = useState(false)

  const blockerCount = issues.filter(i => i.severity === 'blocker').length
  const hasIssues = issues.length > 0

  return (
    <div
      className="border-b border-panel-border"
      style={{ padding: '8px 12px' }}
      data-testid="model-health-section"
    >
      {/* Compact status line */}
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
        style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-body, #3F3F3E)' }}
        aria-expanded={isExpanded}
        data-testid="model-health-toggle"
      >
        {hasIssues ? (
          <>
            {blockerCount > 0 ? (
              <XCircle size={14} className="text-danger flex-shrink-0" />
            ) : (
              <AlertTriangle size={14} className="text-warning flex-shrink-0" />
            )}
            <span>
              Model health: {issues.length} issue{issues.length !== 1 ? 's' : ''}
              {blockerCount > 0 && (
                <span className="text-danger" style={{ fontWeight: 600 }}>
                  {' '}({blockerCount} blocker{blockerCount !== 1 ? 's' : ''})
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} className="text-success flex-shrink-0" />
            <span>Model health: ready</span>
          </>
        )}
        <span className="ml-auto flex-shrink-0">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded issue list */}
      {isExpanded && hasIssues && (
        <div className="mt-2 space-y-1" data-testid="model-health-issues">
          {issues
            .sort((a, b) => (a.severity === 'blocker' ? -1 : 1) - (b.severity === 'blocker' ? -1 : 1))
            .map(issue => (
              <IssueRow key={issue.key} issue={issue} />
            ))
          }
        </div>
      )}

      {isExpanded && !hasIssues && (
        <div style={{ fontSize: 11, color: 'var(--text-light, #706D6D)', marginTop: 4 }}>
          All structural checks pass. The model is ready for analysis.
        </div>
      )}
    </div>
  )
}

/**
 * ModelHealthBadge — Ambient indicator for tab headers or status bars.
 * Shows issue count when issues exist.
 */
export function ModelHealthBadge() {
  const issues = useModelHealth()
  if (issues.length === 0) return null

  const blockerCount = issues.filter(i => i.severity === 'blocker').length

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${
        blockerCount > 0 ? 'bg-danger text-text-on-color' : 'bg-warning text-text-on-color'
      }`}
      style={{ fontSize: 10, fontWeight: 600, minWidth: 16, height: 16, padding: '0 4px' }}
      title={`${issues.length} model health issue${issues.length !== 1 ? 's' : ''}`}
      data-testid="model-health-badge"
    >
      {issues.length}
    </span>
  )
}
