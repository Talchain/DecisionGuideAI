/**
 * M1TopActions - Coach section placeholder
 *
 * Blue-tinted background card with static coaching sentence.
 * Max 3 items from topActions with numbered index, label, detail, optional BiasIcon.
 * Category background/border treatment matching the item's source category.
 *
 * This section always renders in M1 — M2 Coach replaces it later.
 */

import { useState, useCallback } from 'react'
import { BiasIcon } from './primitives'
import type { ImprovementItem, ImprovementCategory } from './hooks/usePreAnalysisData'

interface M1TopActionsProps {
  /** Top 3 priority items */
  topActions: ImprovementItem[]
  /** Handler for adding evidence to an edge */
  onAddEvidence?: (edgeId: string, evidence: string) => void
  /** Handler for hovering over an element */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  /** Handler for clearing hover */
  onHoverLeave?: () => void
}

/** Category styling - border colors only, no background tints */
const categoryStyles: Record<ImprovementCategory, { border: string }> = {
  fix: {
    border: 'border-l-danger',
  },
  verify: {
    border: 'border-l-warning',
  },
  add_evidence: {
    border: 'border-l-panel-border',
  },
  strengthen: {
    border: 'border-l-panel-border',
  },
}

export function M1TopActions({ topActions, onAddEvidence, onHoverEnter, onHoverLeave }: M1TopActionsProps) {
  // Track which evidence item is showing the input
  const [activeEvidenceInput, setActiveEvidenceInput] = useState<string | null>(null)
  const [evidenceValue, setEvidenceValue] = useState('')

  // Handle evidence submission
  const handleEvidenceSubmit = useCallback((edgeId: string) => {
    const sanitised = evidenceValue.trim().replace(/\s+/g, ' ')
    if (!sanitised || !onAddEvidence) return

    onAddEvidence(edgeId, sanitised)
    setActiveEvidenceInput(null)
    setEvidenceValue('')
  }, [evidenceValue, onAddEvidence])

  if (topActions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {topActions.map((item, index) => {
        const styles = categoryStyles[item.category]
        const isEvidenceItem = item.category === 'add_evidence'
        const showInput = activeEvidenceInput === item.key

        // Determine hover target - use focus (node/edge) or action targetId (edge)
        const hoverTarget = item.focus
          ? { type: item.focus.type, id: item.focus.id }
          : item.action?.targetId
            ? { type: item.action.targetType || 'edge' as const, id: item.action.targetId }
            : null

        return (
          <div
            key={item.key}
            className={`
              relative flex flex-col gap-2 p-3 rounded-lg border border-panel-border border-l-[3px] cursor-pointer
              hover:bg-black/[0.02] ${styles.border}
            `}
            onMouseEnter={() => {
              if (hoverTarget && onHoverEnter) {
                onHoverEnter(hoverTarget.type as 'node' | 'edge', hoverTarget.id)
              }
            }}
            onMouseLeave={() => onHoverLeave?.()}
          >
            <div className="flex items-start gap-3">
              {/* Numbered index */}
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-info text-white text-xs font-semibold flex items-center justify-center">
                {index + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-header">
                  {item.label}
                </p>
                <p className="text-sm text-text-light mt-0.5">
                  {item.detail}
                </p>
              </div>

              {/* + Source CTA for evidence items */}
              {isEvidenceItem && onAddEvidence && !showInput && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveEvidenceInput(item.key)
                    setEvidenceValue('')
                  }}
                  className="flex-shrink-0 text-xs font-medium text-info hover:underline cursor-pointer"
                >
                  + Source
                </button>
              )}

              {/* Optional BiasIcon - positioned top-right of card */}
              {item.bias && !isEvidenceItem && (
                <BiasIcon
                  bias={item.bias}
                  why={item.detail}
                  className="absolute top-2 right-2"
                />
              )}
            </div>

            {/* Inline evidence input */}
            {showInput && (
              <div className="flex items-center gap-2 ml-8">
                <input
                  type="text"
                  value={evidenceValue}
                  onChange={(e) => setEvidenceValue(e.target.value)}
                  placeholder="Enter evidence source (URL or description)"
                  maxLength={500}
                  className="flex-1 px-2 py-1 text-xs border border-panel-border rounded bg-panel text-text-body focus:outline-none focus:ring-1 focus:ring-info"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && item.action?.targetId) {
                      handleEvidenceSubmit(item.action.targetId)
                    }
                    if (e.key === 'Escape') {
                      setActiveEvidenceInput(null)
                      setEvidenceValue('')
                    }
                  }}
                />
                <button
                  onClick={() => item.action?.targetId && handleEvidenceSubmit(item.action.targetId)}
                  disabled={!evidenceValue.trim()}
                  className="px-2 py-1 text-xs bg-info text-white rounded disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setActiveEvidenceInput(null)
                    setEvidenceValue('')
                  }}
                  className="px-2 py-1 text-xs text-text-light hover:text-text-body"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default M1TopActions
