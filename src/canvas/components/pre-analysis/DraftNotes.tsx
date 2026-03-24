/**
 * DraftNotes — Collapsed accordion showing constraints, auto-fixes, and repairs.
 * Data sources: data.modelAdjustments, data.repairActions (from hook),
 * ceeAnalysisReady.goal_constraints (passed as prop).
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'

/** Accepts CEEGoalConstraint shape */
interface GoalConstraint {
  id: string
  label: string
  operator?: string
  value?: number | string
  probability?: number | null
}

interface DraftNotesProps {
  modelAdjustments: Array<{ code?: string; field?: string; reason?: string; target?: string }>
  repairActions: string[]
  postRunRepairs?: string[]
  goalConstraints?: GoalConstraint[]
  onSendMessage?: (text: string) => void
}

/** Format raw adjustment/repair text for display:
 * - Truncate floats > 2dp
 * - "synthesised prior [0.20, 0.60]" → "with estimated range 0.20 to 0.60"
 * - "Reclassified unreachable factor" → "Moved outside your control"
 */
function formatDraftText(text: string): string {
  return text
    // Truncate all floats to 2dp first
    .replace(/\d+\.\d{3,}/g, m => parseFloat(m).toFixed(2))
    // "synthesised prior [X, Y]" → "estimated range X to Y" with both values normalised to 2dp
    .replace(
      /with synthesised prior \[([^,]+),\s*([^\]]+)\]/gi,
      (_match, a, b) => {
        const va = parseFloat(a)
        const vb = parseFloat(b)
        const fa = Number.isFinite(va) ? va.toFixed(2) : a.trim()
        const fb = Number.isFinite(vb) ? vb.toFixed(2) : b.trim()
        return `with estimated range ${fa} to ${fb}`
      },
    )
    // "Reclassified unreachable factor X ..." → "Moved X outside your control"
    .replace(/Reclassified unreachable factor\s+(.+?)(?:\s+to\s+external|\s*$)/gi, 'Moved $1 outside your control (reclassified to external)')
}

export function DraftNotes({
  modelAdjustments,
  repairActions,
  postRunRepairs = [],
  goalConstraints = [],
  onSendMessage,
}: DraftNotesProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Constraints with probability set have been evaluated; others are pending
  const appliedConstraints = goalConstraints.filter(c => c.probability != null)
  const unappliedConstraints = goalConstraints.filter(c => c.probability == null)
  const allRepairs = [...repairActions, ...postRunRepairs]

  const totalItems = appliedConstraints.length + unappliedConstraints.length +
    modelAdjustments.length + allRepairs.length

  if (totalItems === 0) {
    return (
      <div className="rounded-lg border border-panel-border px-3 py-2" data-testid="draft-notes">
        <span className={`${typography.panelMeta} text-text-light`}>
          No draft notes for this model.
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-panel-border" data-testid="draft-notes">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-panel-hover"
      >
        <span className={`${typography.panelMeta} text-text-light`}>
          Draft notes · {totalItems} items
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-light" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-light" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2.5 space-y-2">
          {appliedConstraints.length > 0 && (
            <div className="space-y-0.5">
              <p className={`${typography.panelMeta} text-text-light`}>Constraints applied</p>
              {appliedConstraints.map((c, i) => (
                <p key={c.id ?? i} className={`${typography.panelMeta} text-text-body pl-2`}>
                  {c.label}{c.operator && c.value != null ? ` ${c.operator} ${c.value}` : ''}
                </p>
              ))}
            </div>
          )}

          {unappliedConstraints.length > 0 && (
            <div className="space-y-0.5">
              <p className={`${typography.panelMeta} text-text-light`}>Constraints not applied</p>
              {unappliedConstraints.map((c, i) => (
                <div key={c.id ?? i} className="flex items-center gap-2 pl-2">
                  <span className={`${typography.panelMeta} text-text-body flex-1`}>
                    {c.label}{c.operator && c.value != null ? ` ${c.operator} ${c.value}` : ''}
                  </span>
                  {onSendMessage && (
                    <button
                      type="button"
                      onClick={() => onSendMessage(`I'd like to add a factor for this constraint: ${c.label}`)}
                      className={`${typography.panelMeta} text-info hover:underline cursor-pointer shrink-0`}
                    >
                      Add factor
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {modelAdjustments.length > 0 && (
            <div className="space-y-0.5">
              <p className={`${typography.panelMeta} text-text-light`}>Auto-fixes</p>
              {modelAdjustments.map((adj, i) => (
                <p key={i} className={`${typography.panelMeta} text-text-body pl-2`}>
                  {formatDraftText(adj.reason ?? adj.code ?? 'Adjustment applied')}
                </p>
              ))}
            </div>
          )}

          {allRepairs.length > 0 && (
            <div className="space-y-0.5">
              <p className={`${typography.panelMeta} text-text-light`}>Repairs</p>
              {allRepairs.map((r, i) => (
                <p key={i} className={`${typography.panelMeta} text-text-body pl-2`}>{formatDraftText(r)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
