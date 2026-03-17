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
import { BiasIcon, IconBtn } from './primitives'
import { Check, Pencil, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ImprovementItem, ImprovementCategory } from './hooks/usePreAnalysisData'
import { cleanFactorLabel } from '../../../components/results/utils/cleanFactorLabel'
import { typography } from '@/styles/typography'

/** Badge colours by category */
const categoryBadgeColors: Record<ImprovementCategory, string> = {
  fix: 'bg-danger',        // orange/carrot
  verify: 'bg-goal',       // amber/sun
  add_evidence: 'bg-info', // blue/sky
  strengthen: 'bg-option', // purple/lilac
}

interface M1TopActionsProps {
  /** Top 3 priority items */
  topActions: ImprovementItem[]
  /** Handler for adding evidence to an edge */
  onAddEvidence?: (edgeId: string, evidence: string) => void
  /** Handler for confirming a factor value */
  onConfirm?: (nodeId: string) => void
  /** Handler for marking a factor as assumption */
  onAssumption?: (nodeId: string) => void
  /** Handler for editing a node on canvas */
  onEdit?: (nodeId: string) => void
  /** Handler for resetting source back to AI for re-review */
  onResetSource?: (nodeId: string) => void
  /** Handler for hovering over an element */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  /** Handler for clearing hover */
  onHoverLeave?: () => void
}


export function M1TopActions({ topActions, onAddEvidence, onConfirm, onAssumption, onEdit, onResetSource, onHoverEnter, onHoverLeave }: M1TopActionsProps) {
  // Track which evidence item is showing the input
  const [activeEvidenceInput, setActiveEvidenceInput] = useState<string | null>(null)
  const [evidenceValue, setEvidenceValue] = useState('')
  // Track reviewed state per Verify item: { itemKey: 'confirmed' | 'assumption' }
  const [reviewedItems, setReviewedItems] = useState<Record<string, 'confirmed' | 'assumption'>>({})
  // Track which reviewed items are expanded
  const [expandedReviewed, setExpandedReviewed] = useState<Record<string, boolean>>({})

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
        const badgeColor = categoryBadgeColors[item.category]
        const isEvidenceItem = item.category === 'add_evidence'
        const showInput = activeEvidenceInput === item.key
        const reviewedState = reviewedItems[item.key]
        const isReviewedExpanded = expandedReviewed[item.key]

        // Determine hover target - use focus (node/edge) or action targetId (edge)
        const hoverTarget = item.focus
          ? { type: item.focus.type, id: item.focus.id }
          : item.action?.targetId
            ? { type: item.action.targetType || 'edge' as const, id: item.action.targetId }
            : null

        // Collapsed state for reviewed Verify items
        if (item.category === 'verify' && reviewedState) {
          return (
            <div
              key={item.key}
              className="relative flex flex-col gap-2 p-3 rounded-lg border border-panel-border"
            >
              {/* Collapsed row */}
              <button
                type="button"
                onClick={() => setExpandedReviewed(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className="w-full flex items-center gap-3 text-left cursor-pointer"
              >
                {/* Numbered index */}
                <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-white ${typography.panelMeta} flex items-center justify-center`}>
                  {index + 1}
                </span>
                {isReviewedExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" />
                )}
                <span className={`${typography.panelBody} text-text-light truncate`}>{cleanFactorLabel(item.label).label}</span>
                <span className={`shrink-0 ${typography.panelBody} text-text-light`}>·</span>
                <span className={`shrink-0 ${typography.panelBody} text-success flex items-center gap-1`}>
                  Reviewed <Check className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Expanded content */}
              {isReviewedExpanded && (
                <div className="ml-8 pl-2">
                  <div className="flex items-center gap-2 py-1">
                    <span className={`${typography.panelBody} text-text-light`}>
                      {reviewedState === 'confirmed' ? 'Confirmed as correct' : 'Marked as assumption'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Reset node source back to AI so item reappears for re-review
                        if (item.action?.targetId && onResetSource) {
                          onResetSource(item.action.targetId)
                        }
                        setReviewedItems(prev => {
                          const next = { ...prev }
                          delete next[item.key]
                          return next
                        })
                        setExpandedReviewed(prev => {
                          const next = { ...prev }
                          delete next[item.key]
                          return next
                        })
                      }}
                      className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        }

        return (
          <div
            key={item.key}
            className="relative flex flex-col gap-2 p-3 rounded-lg border border-panel-border cursor-pointer hover:bg-black/[0.02]"
            onMouseEnter={() => {
              if (hoverTarget && onHoverEnter) {
                onHoverEnter(hoverTarget.type as 'node' | 'edge', hoverTarget.id)
              }
            }}
            onMouseLeave={() => onHoverLeave?.()}
          >
            <div className="flex items-start gap-3">
              {/* Numbered index - colour based on category */}
              <span className={`flex-shrink-0 w-5 h-5 rounded-full ${badgeColor} text-white ${typography.panelMeta} flex items-center justify-center`}>
                {index + 1}
              </span>

              {/* Content - flex-1 min-w-0 ensures text wraps within bounds */}
              <div className="flex-1 min-w-0 pr-2">
                <p className={`${typography.panelHeader} text-text-header`}>
                  {cleanFactorLabel(item.label).label}
                </p>
                <p className={`${typography.panelBody} text-text-light mt-0.5`}>
                  {item.detail}
                </p>
              </div>

              {/* Fixed action column - anchored bottom-right */}
              <div className="flex items-center gap-0.5 shrink-0 ml-auto self-end">
                {/* Verify items: show Confirm, Assumption, Edit icons */}
                {item.category === 'verify' && (
                  <>
                    {onConfirm && (
                      <IconBtn
                        icon={Check}
                        tooltip="Confirm this value"
                        variant="confirm"
                        onClick={() => {
                          if (item.action?.targetId) {
                            setReviewedItems(prev => ({ ...prev, [item.key]: 'confirmed' }))
                            onConfirm(item.action.targetId)
                          }
                        }}
                      />
                    )}
                    {onAssumption && (
                      <IconBtn
                        icon={HelpCircle}
                        tooltip={"Accept as assumption. Won\u2019t ask again"}
                        variant="assume"
                        onClick={() => {
                          if (item.action?.targetId) {
                            setReviewedItems(prev => ({ ...prev, [item.key]: 'assumption' }))
                            onAssumption(item.action.targetId)
                          }
                        }}
                      />
                    )}
                    {onEdit && (
                      <IconBtn
                        icon={Pencil}
                        tooltip="Edit on canvas"
                        variant="edit"
                        onClick={() => {
                          if (item.action?.targetId) {
                            onEdit(item.action.targetId)
                          }
                        }}
                      />
                    )}
                  </>
                )}

                {/* + Source CTA for evidence items */}
                {isEvidenceItem && onAddEvidence && !showInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveEvidenceInput(item.key)
                      setEvidenceValue('')
                    }}
                    className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
                  >
                    + Source
                  </button>
                )}

                {/* BiasIcon for Fix and Strengthen (not Verify or Evidence) */}
                {item.bias && (item.category === 'fix' || item.category === 'strengthen') && (
                  <BiasIcon
                    bias={item.bias}
                    why={item.detail}
                  />
                )}
              </div>
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
                  className={`flex-1 px-2 py-1 ${typography.panelMeta} border border-panel-border rounded bg-panel text-text-body focus:outline-none focus:ring-1 focus:ring-info`}
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
                  className={`px-2 py-1 ${typography.panelMeta} bg-info hover:bg-success text-text-on-color rounded disabled:opacity-50`}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setActiveEvidenceInput(null)
                    setEvidenceValue('')
                  }}
                  className={`px-2 py-1 ${typography.panelMeta} text-text-light hover:text-text-body`}
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
