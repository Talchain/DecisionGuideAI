/**
 * M4: Issues Panel
 * Detailed view of validation issues with quick fix actions
 */

import { AlertCircle, AlertTriangle, Info, Wrench, X } from 'lucide-react'
import type { ValidationIssue, IssueSeverity } from '../validation/types'

interface IssuesPanelProps {
  issues: ValidationIssue[]
  onFixIssue: (issue: ValidationIssue) => void
  onClose: () => void
}

const severityIcons: Record<IssueSeverity, JSX.Element> = {
  error: <AlertCircle className="w-4 h-4 text-red-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
  info: <Info className="w-4 h-4 text-blue-600" />,
}

const severityColors: Record<IssueSeverity, string> = {
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-blue-50 border-blue-200',
}

export function IssuesPanel({ issues, onFixIssue, onClose }: IssuesPanelProps) {
  const errorIssues = issues.filter((i) => i.severity === 'error')
  const warningIssues = issues.filter((i) => i.severity === 'warning')
  const infoIssues = issues.filter((i) => i.severity === 'info')

  return (
    <div className="bg-white border-l border-gray-200 w-80 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Graph Issues</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {issues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No issues found</p>
            <p className="text-xs mt-1">Your graph is healthy!</p>
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
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
  return (
    <div className={`border rounded-lg p-3 ${severityColors[issue.severity]}`}>
      <div className="flex items-start gap-2">
        {severityIcons[issue.severity]}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{issue.message}</div>

          {/* Affected elements */}
          {(issue.nodeIds || issue.edgeIds) && (
            <div className="mt-1 text-xs text-gray-600">
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
              className="mt-2 flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
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
