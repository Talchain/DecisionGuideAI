/**
 * M4: Issues Panel
 * N2: Enhanced with "Why this matters" explainers and Fix Next
 * Detailed view of validation issues with quick fix actions
 */

import { useState } from 'react'
import { typography } from '../../styles/typography'
import { AlertCircle, AlertTriangle, Info, Wrench, X, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import type { ValidationIssue, IssueSeverity } from '../validation/types'
import { ISSUE_EXPLAINERS } from '../health/issueExplainers'

interface IssuesPanelProps {
  issues: ValidationIssue[]
  onFixIssue: (issue: ValidationIssue) => void
  onFixAll?: () => void
  onClose: () => void
}

const severityIcons: Record<IssueSeverity, JSX.Element> = {
  error: <AlertCircle className="w-4 h-4 text-danger" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  info: <Info className="w-4 h-4 text-info" />,
}

const severityColors: Record<IssueSeverity, string> = {
  error: 'bg-panel border-danger/30',
  warning: 'bg-panel border-warning/30',
  info: 'bg-panel border-info/30',
}

export function IssuesPanel({ issues, onFixIssue, onFixAll, onClose }: IssuesPanelProps) {
  const [fixedCount, setFixedCount] = useState(0)

  const errorIssues = issues.filter((i) => i.severity === 'error')
  const warningIssues = issues.filter((i) => i.severity === 'warning')
  const infoIssues = issues.filter((i) => i.severity === 'info')

  // Get next fixable issue (highest impact first: error > warning > info)
  const fixableIssues = issues.filter((i) => i.suggestedFix)
  const nextIssue = fixableIssues[0]

  const handleFixNext = () => {
    if (nextIssue) {
      onFixIssue(nextIssue)
      setFixedCount(prev => prev + 1)
    }
  }

  return (
    <div className="bg-panel border-l border-panel-border w-80 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${typography.panelHeader} text-text-header`}>Graph Issues</h3>
          <button onClick={onClose} className="p-1 hover:bg-panel-hover rounded" aria-label="Close issues panel">
            <X className="w-4 h-4 text-text-body" />
          </button>
        </div>

        {/* Action buttons */}
        {fixableIssues.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleFixNext}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-info-600 text-text-on-color rounded-lg ${typography.panelBody} hover:bg-info-700 transition-colors`}
              type="button"
              aria-label="Fix next issue"
            >
              <Zap className="w-3.5 h-3.5" />
              Fix Next
            </button>
            {onFixAll && fixableIssues.length > 1 && (
              <button
                onClick={onFixAll}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-text-body text-text-on-color rounded-lg ${typography.panelBody} hover:bg-text-header transition-colors`}
                type="button"
                aria-label="Fix all issues"
              >
                <Wrench className="w-3.5 h-3.5" />
                Fix All ({fixableIssues.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {issues.length === 0 ? (
          <div className="text-center py-8 text-text-light">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className={typography.panelBody}>No issues found</p>
            <p className={`${typography.panelMeta} mt-1`}>Your graph is healthy!</p>
          </div>
        ) : (
          <>
            {errorIssues.length > 0 && (
              <IssueSection
                title="Errors"
                issues={errorIssues}
                onFixIssue={onFixIssue}
              />
            )}

            {warningIssues.length > 0 && (
              <IssueSection
                title="Warnings"
                issues={warningIssues}
                onFixIssue={onFixIssue}
              />
            )}

            {infoIssues.length > 0 && (
              <IssueSection
                title="Info"
                issues={infoIssues}
                onFixIssue={onFixIssue}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function IssueSection({
  title,
  issues,
  onFixIssue,
}: {
  title: string
  issues: ValidationIssue[]
  onFixIssue: (issue: ValidationIssue) => void
}) {
  return (
    <div className="space-y-2">
      <h4 className={`${typography.panelMeta} text-text-light uppercase tracking-wide`}>
        {title} ({issues.length})
      </h4>
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} onFix={onFixIssue} />
      ))}
    </div>
  )
}

function IssueCard({
  issue,
  onFix,
}: {
  issue: ValidationIssue
  onFix: (issue: ValidationIssue) => void
}) {
  const [showExplainer, setShowExplainer] = useState(false)
  const explainer = ISSUE_EXPLAINERS[issue.type]

  return (
    <div className={`border rounded-lg p-3 ${severityColors[issue.severity]}`}>
      <div className="flex items-start gap-2">
        {severityIcons[issue.severity]}
        <div className="flex-1 min-w-0">
          <div className={`${typography.panelBody} text-text-header`}>{issue.message}</div>

          {/* Why this matters explainer */}
          {explainer && (
            <button
              onClick={() => setShowExplainer(!showExplainer)}
              className={`mt-1 flex items-center gap-1 ${typography.panelMeta} text-text-body hover:text-text-header transition-colors`}
              type="button"
              aria-expanded={showExplainer}
              aria-label="Toggle why this matters"
            >
              {showExplainer ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="font-medium">Why this matters</span>
            </button>
          )}

          {showExplainer && explainer && (
            <div className={`mt-2 px-2 py-1.5 bg-white bg-opacity-50 rounded ${typography.panelMeta} text-text-body border border-panel-border`}>
              {explainer}
            </div>
          )}

          {/* Affected elements */}
          {(issue.nodeIds || issue.edgeIds) && (
            <div className={`mt-1 ${typography.panelMeta} text-text-body`}>
              {issue.nodeIds && issue.nodeIds.length > 0 && (
                <div>Nodes: {issue.nodeIds.join(', ')}</div>
              )}
              {issue.edgeIds && issue.edgeIds.length > 0 && (
                <div>Edges: {issue.edgeIds.join(', ')}</div>
              )}
            </div>
          )}

          {/* Fix button */}
          {issue.suggestedFix && (
            <button
              onClick={() => onFix(issue)}
              className={`mt-2 flex items-center gap-1 px-2 py-1 bg-info-600 text-text-on-color rounded ${typography.panelMeta} hover:bg-info-700`}
              type="button"
              aria-label="Apply quick fix"
            >
              <Wrench className="w-3 h-3" />
              Quick Fix
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
