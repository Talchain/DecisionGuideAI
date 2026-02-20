/**
 * AllImprovements - Accordion with all improvement items
 *
 * Expanded by default in M1 mode.
 * Right-side of accordion header: total item count pill.
 * Four CategorySection sub-components in order: Fix, Verify, Add evidence, Strengthen.
 * Each CategorySection only renders if category has items.
 *
 * Interactive Actions:
 * - Confirm: Updates factor source to 'user_confirmed'
 * - Assumption: Updates factor source to 'user_assumption'
 * - Edit: Focuses node on canvas for editing
 * - Add Source: Opens inline evidence input for edge
 * - Add Baseline: Creates baseline option node
 */

import { useState, useCallback } from 'react'
import { Accordion, Pill, NodeLink, IconBtn, BiasIcon } from './primitives'
import { Check, Pencil, Plus, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ImprovementItem, ImprovementCategory, TiersData } from './hooks/usePreAnalysisData'

/** Action handlers for improvement items */
export interface ImprovementActionHandlers {
  /** Confirm action - mark factor as user-confirmed */
  onConfirm?: (nodeId: string) => void
  /** Assumption action - mark factor as user assumption */
  onAssumption?: (nodeId: string) => void
  /** Edit action - focus node on canvas for editing */
  onEdit?: (nodeId: string) => void
  /** Add evidence action - add evidence to edge */
  onAddEvidence?: (edgeId: string, evidence: string) => void
  /** Add baseline action - create baseline option node */
  onAddBaseline?: () => void
  /** Add option action - create new option node */
  onAddOption?: () => void
  /** Add risk action - create new risk node */
  onAddRisk?: () => void
  /** Reset source action - revert factor source back to AI for re-review */
  onResetSource?: (nodeId: string) => void
}

interface AllImprovementsProps {
  /** Improvements grouped by category */
  improvementsByCategory: Record<ImprovementCategory, ImprovementItem[]>
  /** Improvements grouped by tier (three-tier hierarchy) */
  tiers: TiersData
  /** Total count of all improvements */
  totalImprovements: number
  /** Click handler for node/edge focus */
  onFocus?: (type: 'node' | 'edge', id: string) => void
  /** Action handlers for interactive actions */
  actionHandlers?: ImprovementActionHandlers
  /** Handler for hovering over an element */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  /** Handler for clearing hover */
  onHoverLeave?: () => void
  /** Count of reviewed factors (derived from node data) */
  reviewedCount?: number
  /** Total count of reviewable factors (derived from node data) */
  totalReviewableCount?: number
}

/** Tier configuration for three-tier hierarchy */
interface TierConfig {
  title: string
  border: string
  defaultExpanded: boolean
}

/** Tier display configs */
const tierConfig: Record<string, TierConfig> = {
  mustAddress: {
    title: 'Must address',
    border: 'border-l-danger', // carrot
    defaultExpanded: true,
  },
  reviewAssumptions: {
    title: 'Review assumptions',
    border: 'border-l-goal', // sun
    defaultExpanded: true,
  },
  optional: {
    title: 'More improvements',
    border: 'border-l-info', // sky
    defaultExpanded: false,
  },
}

/** Tier Section Props */
interface TierSectionProps {
  tierKey: string
  config: TierConfig
  items: ImprovementItem[]
  isExpanded: boolean
  onToggleExpand: () => void
  onFocus?: (type: 'node' | 'edge', id: string) => void
  actionHandlers?: ImprovementActionHandlers
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** For review assumptions tier: progress tracking (derived from node data) */
  reviewedCount?: number
  totalCount?: number
}

/** Tier section component with accordion */
function TierSection({
  tierKey,
  config,
  items,
  isExpanded,
  onToggleExpand,
  onFocus,
  actionHandlers,
  onHoverEnter,
  onHoverLeave,
  reviewedCount,
  totalCount,
}: TierSectionProps) {
  // For optional tier: collapse add_evidence items into summary row
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)

  // For reviewAssumptions: always show tier (even when empty) to display state
  // For other tiers: hide when no items
  const isReviewTier = tierKey === 'reviewAssumptions'
  const showCompletionState = isReviewTier && items.length === 0 && totalCount !== undefined && totalCount > 0
  // Empty state: no assumptions to review — show explainer text
  const showEmptyState = isReviewTier && items.length === 0 && (totalCount === undefined || totalCount === 0)
  if (items.length === 0 && !showCompletionState && !showEmptyState) return null

  // Split optional tier items: strengthen items render normally, add_evidence collapsed
  const isOptionalTier = tierKey === 'optional'
  const evidenceItems = isOptionalTier ? items.filter(i => i.category === 'add_evidence') : []
  const nonEvidenceItems = isOptionalTier ? items.filter(i => i.category !== 'add_evidence') : items

  // Build section title with progress for reviewAssumptions
  // Hide progress counter when no assumptions to review
  // For optional tier, show count in title instead of status bar headline
  let sectionTitle = config.title
  if (isReviewTier && reviewedCount !== undefined && totalCount !== undefined && totalCount > 0) {
    sectionTitle = `${config.title} (${reviewedCount} of ${totalCount} done)`
  } else if (isOptionalTier && items.length > 0) {
    sectionTitle = `${config.title} (${items.length})`
  }

  return (
    <div className={`rounded-lg border border-panel-border border-l-[3px] ${config.border}`}>
      {/* Section header - clickable accordion */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <span className="text-sm font-semibold text-text-body">{sectionTitle}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs rounded-full px-2 py-0.5 ${showCompletionState ? 'text-success bg-success-light' : showEmptyState ? 'text-text-light bg-factor-light' : 'text-text-light bg-factor-light'}`}>
            {showCompletionState ? '✓' : showEmptyState ? '—' : (
              isReviewTier && totalCount != null ? totalCount : items.length
            )}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-light" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-light" />
          )}
        </div>
      </button>

      {/* Progress bar for reviewAssumptions tier (v1.1) */}
      {isReviewTier && reviewedCount !== undefined && totalCount !== undefined && totalCount > 0 && (
        <div className="px-3 pb-1">
          <div className="w-full h-1.5 bg-factor-light rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${Math.round((reviewedCount / totalCount) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Section content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {showCompletionState ? (
            <p className="text-sm text-success py-1">All reviewed</p>
          ) : showEmptyState ? (
            <p className="text-sm text-text-light py-1">
              All values came from your brief or are set by your options. Nothing needs review.
            </p>
          ) : (
            <>
              {/* Non-evidence items render normally */}
              {nonEvidenceItems.map((item, index) => (
                <div
                  key={item.key}
                  style={index > 0 ? {
                    borderTop: '1px solid rgba(238, 230, 216, 0.5)',
                    paddingTop: '8px',
                  } : undefined}
                >
                  <ImprovementRow
                    item={item}
                    onFocus={onFocus}
                    actionHandlers={actionHandlers}
                    onHoverEnter={onHoverEnter}
                    onHoverLeave={onHoverLeave}
                  />
                </div>
              ))}

              {/* Evidence items: summary always visible, individual items behind toggle */}
              {evidenceItems.length > 0 && (
                <div
                  style={nonEvidenceItems.length > 0 ? {
                    borderTop: '1px solid rgba(238, 230, 216, 0.5)',
                    paddingTop: '8px',
                  } : undefined}
                >
                  {/* Summary line — always visible on expand */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-body">
                      {evidenceItems.length} edge{evidenceItems.length !== 1 ? 's' : ''} without evidence
                    </p>
                    <button
                      type="button"
                      onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                      className="text-xs font-medium text-info hover:underline cursor-pointer"
                    >
                      {evidenceExpanded ? 'Collapse' : 'View all'}
                    </button>
                  </div>

                  {/* Individual edge items — only when user explicitly requests */}
                  {evidenceExpanded && (
                    <div className="mt-2 space-y-2">
                      {evidenceItems.map((item, index) => (
                        <div
                          key={item.key}
                          style={index > 0 ? {
                            borderTop: '1px solid rgba(225, 216, 199, 0.4)',
                            paddingTop: '8px',
                          } : undefined}
                        >
                          <ImprovementRow
                            item={item}
                            onFocus={onFocus}
                            actionHandlers={actionHandlers}
                            onHoverEnter={onHoverEnter}
                            onHoverLeave={onHoverLeave}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Category display config - no backgrounds, sentence case labels */
const categoryConfig: Record<ImprovementCategory, {
  label: string
  border: string
  containerBorder: string
  rowBorderColor: string
}> = {
  fix: {
    label: 'Fix',
    border: 'border-l-danger',
    containerBorder: 'border-panel-border', // Keep default for Fix
    rowBorderColor: 'rgba(234, 123, 75, 0.2)', // danger at 20%
  },
  verify: {
    label: 'Verify',
    border: 'border-l-warning',
    containerBorder: 'border-panel-border',
    rowBorderColor: 'rgba(255, 166, 86, 0.2)', // warning at 20%
  },
  add_evidence: {
    label: 'Add evidence',
    border: 'border-l-panel-border',
    containerBorder: 'border-panel-border',
    rowBorderColor: 'rgba(225, 216, 199, 0.4)', // #E1D8C7 at 40%
  },
  strengthen: {
    label: 'Strengthen',
    border: 'border-l-panel-border',
    containerBorder: 'border-panel-border',
    rowBorderColor: 'rgba(170, 167, 228, 0.2)', // option color at 20%
  },
}

/** Category order */
const categoryOrder: ImprovementCategory[] = ['fix', 'verify', 'add_evidence', 'strengthen']

interface CategorySectionProps {
  category: ImprovementCategory
  items: ImprovementItem[]
  onFocus?: (type: 'node' | 'edge', id: string) => void
  actionHandlers?: ImprovementActionHandlers
  /** Items being removed (showing exit transition) */
  removingItems?: Set<string>
  /** Whether section is expanded (for collapsible sections like add_evidence) */
  isExpanded?: boolean
  /** Toggle expansion callback */
  onToggleExpand?: () => void
  /** Handler for hovering over an element */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  /** Handler for clearing hover */
  onHoverLeave?: () => void
}

function CategorySection({ category, items, onFocus, actionHandlers, removingItems, isExpanded, onToggleExpand, onHoverEnter, onHoverLeave }: CategorySectionProps) {
  if (items.length === 0) return null

  const config = categoryConfig[category]

  // For add_evidence, show collapsed summary by default
  if (category === 'add_evidence' && !isExpanded) {
    return (
      <div className={`rounded-lg border ${config.containerBorder} border-l-[3px] ${config.border} py-2 px-2.5`}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-body">
            {items.length} edge{items.length !== 1 ? 's' : ''} without evidence
          </p>
          <button
            onClick={onToggleExpand}
            className="text-xs font-medium text-info hover:underline cursor-pointer"
          >
            View all
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${config.containerBorder} border-l-[3px] ${config.border} py-2 px-2.5`}>
      {/* Category label - sentence case, no uppercase transform */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-text-light tracking-wide">
          {config.label}
        </p>
        {/* Show collapse button for expanded add_evidence */}
        {category === 'add_evidence' && isExpanded && onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="text-xs font-medium text-info hover:underline cursor-pointer"
          >
            Collapse
          </button>
        )}
      </div>

      {/* Items with category-coloured borders between rows */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.key}
            style={index > 0 ? {
              borderTop: `1px solid ${config.rowBorderColor}`,
              paddingTop: '8px',
            } : undefined}
          >
            <ImprovementRow
              item={item}
              onFocus={onFocus}
              actionHandlers={actionHandlers}
              isRemoving={removingItems?.has(item.key)}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

interface ImprovementRowProps {
  item: ImprovementItem
  onFocus?: (type: 'node' | 'edge', id: string) => void
  actionHandlers?: ImprovementActionHandlers
  /** Whether this item is being removed (showing exit transition) */
  isRemoving?: boolean
  /** Handler for hovering over an element */
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  /** Handler for clearing hover */
  onHoverLeave?: () => void
}

function ImprovementRow({ item, onFocus, actionHandlers, isRemoving, onHoverEnter, onHoverLeave }: ImprovementRowProps) {
  const [showEvidenceInput, setShowEvidenceInput] = useState(false)
  const [evidenceValue, setEvidenceValue] = useState('')
  const [exitLabel, setExitLabel] = useState<string | null>(null)
  // Reviewed state for Verify items: 'confirmed' | 'assumption' | null
  const [reviewedState, setReviewedState] = useState<'confirmed' | 'assumption' | null>(null)
  // Whether the reviewed item is expanded (to change response)
  const [isReviewedExpanded, setIsReviewedExpanded] = useState(false)

  const handleFocusClick = () => {
    if (item.focus && onFocus) {
      onFocus(item.focus.type, item.focus.id)
    }
  }

  // Handle action button click
  const handleActionClick = useCallback(() => {
    const { kind, targetId } = item.action || {}
    if (!kind) return

    switch (kind) {
      case 'confirm':
        if (targetId && actionHandlers?.onConfirm) {
          setExitLabel('Confirmed')
          actionHandlers.onConfirm(targetId)
        }
        break
      case 'assumption':
        if (targetId && actionHandlers?.onAssumption) {
          setExitLabel('Assumption')
          actionHandlers.onAssumption(targetId)
        }
        break
      case 'edit':
        if (targetId && actionHandlers?.onEdit) {
          actionHandlers.onEdit(targetId)
        }
        break
      case 'add':
        // For edges, show inline evidence input (only if handler exists)
        if (item.action?.targetType === 'edge' && actionHandlers?.onAddEvidence) {
          setShowEvidenceInput(true)
        }
        break
      case 'add_baseline':
        if (actionHandlers?.onAddBaseline) {
          actionHandlers.onAddBaseline()
        }
        break
      case 'add_option':
        if (actionHandlers?.onAddOption) {
          actionHandlers.onAddOption()
        }
        break
      case 'add_risk':
        if (actionHandlers?.onAddRisk) {
          actionHandlers.onAddRisk()
        }
        break
    }
  }, [item.action, actionHandlers])

  // Handle evidence submission with input sanitisation
  const handleEvidenceSubmit = useCallback(() => {
    const { targetId } = item.action || {}
    // Sanitise: trim and collapse whitespace
    const sanitised = evidenceValue.trim().replace(/\s+/g, ' ')
    // Reject empty/whitespace-only
    if (!sanitised || !targetId || !actionHandlers?.onAddEvidence) return

    actionHandlers.onAddEvidence(targetId, sanitised)
    setShowEvidenceInput(false)
    setEvidenceValue('')
  }, [item.action, evidenceValue, actionHandlers])

  // Get action icon based on kind
  const getActionIcon = () => {
    switch (item.action?.kind) {
      case 'confirm':
        return Check
      case 'edit':
        return Pencil
      case 'add':
      case 'add_baseline':
      case 'add_option':
      case 'add_risk':
        return Plus
      case 'assumption':
        return HelpCircle
      default:
        return null
    }
  }

  // Determine if action is enabled (has a handler)
  const isActionEnabled = () => {
    const { kind } = item.action || {}
    if (!kind) return false

    switch (kind) {
      case 'confirm':
        return !!actionHandlers?.onConfirm
      case 'assumption':
        return !!actionHandlers?.onAssumption
      case 'edit':
        return !!actionHandlers?.onEdit
      case 'add':
        return item.action?.targetType === 'edge' // Always enabled for evidence input
      case 'add_baseline':
        return !!actionHandlers?.onAddBaseline
      case 'add_option':
        return !!actionHandlers?.onAddOption
      case 'add_risk':
        return !!actionHandlers?.onAddRisk
      default:
        return false
    }
  }

  const ActionIcon = getActionIcon()
  const actionEnabled = isActionEnabled()

  // Determine hover target from focus or action targetId
  const hoverTarget = item.focus
    ? { type: item.focus.type, id: item.focus.id }
    : item.action?.targetId
      ? { type: (item.action.targetType || 'edge') as 'node' | 'edge', id: item.action.targetId }
      : null

  // Hover handlers for the row
  const handleRowMouseEnter = () => {
    if (hoverTarget && onHoverEnter) {
      onHoverEnter(hoverTarget.type, hoverTarget.id)
    }
  }

  const handleRowMouseLeave = () => {
    onHoverLeave?.()
  }

  // Show exit transition for non-Verify items
  if (isRemoving || (exitLabel && item.category !== 'verify')) {
    return (
      <div className="flex items-center gap-2 opacity-50 transition-opacity duration-500">
        <span className="text-sm text-text-body">{item.label}</span>
        <Pill size="small" variant={exitLabel === 'Confirmed' ? 'success' : 'info'}>
          {exitLabel || 'Removed'}
        </Pill>
      </div>
    )
  }

  // Collapsed state for reviewed Verify items
  if (item.category === 'verify' && reviewedState) {
    return (
      <div className="rounded-md -mx-1 px-1">
        {/* Collapsed row */}
        <button
          type="button"
          onClick={() => setIsReviewedExpanded(!isReviewedExpanded)}
          className="w-full flex items-center gap-2 text-left cursor-pointer hover:bg-black/[0.02] rounded-md py-0.5"
        >
          {isReviewedExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" />
          )}
          <span className="text-sm text-text-light line-clamp-2">{item.label}</span>
          <span className="shrink-0 text-sm text-text-light">·</span>
          <span className="shrink-0 text-sm text-success flex items-center gap-1">
            Reviewed <Check className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Expanded content - ability to change response */}
        {isReviewedExpanded && (
          <div className="mt-2 ml-5 pl-1 border-l-2 border-panel-border">
            <div className="flex items-center gap-2 py-1">
              <span className="text-sm text-text-light">
                {reviewedState === 'confirmed' ? 'Confirmed as correct' : 'Marked as assumption'}
              </span>
              <button
                type="button"
                onClick={() => {
                  // Reset node source back to AI so item reappears for re-review
                  if (item.action?.targetId && actionHandlers?.onResetSource) {
                    actionHandlers.onResetSource(item.action.targetId)
                  }
                  setReviewedState(null)
                  setIsReviewedExpanded(false)
                }}
                className="text-xs text-info hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Strengthen items: merged question + context in one paragraph, then CTAs
  if (item.category === 'strengthen') {
    return (
      <div
        className="space-y-2 cursor-pointer hover:bg-black/[0.02] rounded-md -mx-1 px-1"
        onMouseEnter={handleRowMouseEnter}
        onMouseLeave={handleRowMouseLeave}
      >
        {/* Merged question + context */}
        <p className="text-sm text-text-header text-left">{item.label}</p>
        {/* CTA pill buttons */}
        <div className="flex items-center gap-2">
          {item.action && (
            <button
              type="button"
              onClick={handleActionClick}
              disabled={!actionEnabled}
              className="text-xs font-medium text-info border border-info/30 rounded-xl px-2.5 py-0.5 bg-transparent hover:border-info hover:bg-info/5 disabled:opacity-50 cursor-pointer"
            >
              {item.action.label}
            </button>
          )}
          {/* Secondary CTA for "no negative effects" item */}
          {item.key === 'no_negative_effects' && actionHandlers?.onEdit && (
            <button
              type="button"
              onClick={() => {
                if (item.focus?.id) {
                  actionHandlers.onEdit(item.focus.id)
                }
              }}
              className="text-xs font-medium text-info border border-info/30 rounded-xl px-2.5 py-0.5 bg-transparent hover:border-info hover:bg-info/5 cursor-pointer"
            >
              Add a negative relationship
            </button>
          )}
        </div>
      </div>
    )
  }

  // Verify items: single-line format "label · value"
  // Label wraps, value and icons never collapse
  if (item.category === 'verify') {
    // Build full text for title tooltip (shows on hover when truncated)
    const fullText = item.detail ? `${item.label} · ${item.detail}` : item.label

    return (
      <div
        className="cursor-pointer hover:bg-black/[0.02] rounded-md -mx-1 px-1"
        onMouseEnter={handleRowMouseEnter}
        onMouseLeave={handleRowMouseLeave}
      >
        <div className="flex items-center gap-2">
          {/* Text content - flex-1 min-w-0, label wraps (v1.1: no truncation) */}
          <div className="flex-1 min-w-0 flex items-baseline flex-wrap text-sm" title={fullText}>
            {/* Label: line-clamp-2 for long factor labels */}
            <span className="text-text-body line-clamp-2">
              {item.focus ? (
                <NodeLink
                  targetId={item.focus.id}
                  targetType={item.focus.type}
                  onClick={handleFocusClick}
                  className="hover:underline"
                >
                  {item.label}
                </NodeLink>
              ) : (
                item.label
              )}
            </span>
            {/* Value never collapses */}
            {item.detail && (
              <span className="shrink-0 text-text-light"> · {item.detail}</span>
            )}
            {/* Source badge (Task 5) */}
            {item.sourceBadge === 'brief' && (
              <span className="shrink-0 text-xs text-text-light bg-success-light rounded px-1.5 py-0.5 ml-1">From brief</span>
            )}
            {item.sourceBadge === 'ai' && (
              <span className="shrink-0 text-xs text-text-light bg-warning-light rounded px-1.5 py-0.5 ml-1">AI estimate</span>
            )}
          </div>

          {/* Fixed action column - shrink-0 prevents collapse */}
          <div className="flex items-center gap-1 shrink-0">
            <>
              {actionHandlers?.onConfirm && (
                  <IconBtn
                    icon={Check}
                    tooltip="Confirm this value is correct"
                    variant="confirm"
                    onClick={() => {
                      if (item.action?.targetId) {
                        setReviewedState('confirmed')
                        actionHandlers.onConfirm(item.action.targetId)
                      }
                    }}
                  />
                )}
                {actionHandlers?.onAssumption && (
                  <IconBtn
                    icon={HelpCircle}
                    tooltip={"Accept as assumption \u2014 won\u2019t ask again"}
                    variant="assume"
                    onClick={() => {
                      if (item.action?.targetId) {
                        setReviewedState('assumption')
                        actionHandlers.onAssumption(item.action.targetId)
                      }
                    }}
                  />
                )}
                {actionHandlers?.onEdit && (
                  <IconBtn
                    icon={Pencil}
                    tooltip="Edit on canvas"
                    variant="edit"
                    onClick={() => {
                      if (item.action?.targetId) {
                        // For edges, use onFocus to focus the edge on canvas
                        // For nodes, use onEdit to focus the node
                        if (item.action?.targetType === 'edge' && onFocus) {
                          onFocus('edge', item.action.targetId)
                        } else {
                          actionHandlers.onEdit(item.action.targetId)
                        }
                      }
                    }}
                  />
                )}
            </>
          </div>
        </div>

        {/* Uncertainty drivers sub-line (Task 5a) */}
        {item.uncertaintyDrivers && item.uncertaintyDrivers.length > 0 && (
          <p className="text-xs text-text-light italic mt-0.5 ml-0.5">
            ⤷ {item.uncertaintyDrivers.join(', ')}
          </p>
        )}
        {/* Verification hint (secondary to raw_value) */}
        {item.hint && (
          <p className="text-xs text-text-light mt-0.5 ml-0.5">
            {item.hint}
          </p>
        )}
      </div>
    )
  }

  // Fix, Add Evidence, and other rows
  return (
    <div
      className="cursor-pointer hover:bg-black/[0.02] rounded-md -mx-1 px-1"
      onMouseEnter={handleRowMouseEnter}
      onMouseLeave={handleRowMouseLeave}
    >
      <div className="flex items-start gap-2">
        {/* Text content - flex-1 min-w-0 enables truncation/wrapping */}
        <div className="flex-1 min-w-0">
          {item.focus ? (
            <NodeLink
              targetId={item.focus.id}
              targetType={item.focus.type}
              onClick={handleFocusClick}
              className="text-sm text-left hover:underline"
            >
              {item.label}
            </NodeLink>
          ) : (
            <span className="text-sm text-text-body text-left">{item.label}</span>
          )}
          {item.detail && (
            <p className="text-sm text-text-light mt-0.5 text-left">{item.detail}</p>
          )}
        </div>

        {/* Fixed action column - shrink-0 prevents collapse, self-end for Fix rows */}
        <div className={`flex items-center gap-1 shrink-0${item.category === 'fix' ? ' self-end' : ''}`}>
          {/* BiasIcon for non-Fix categories only (Task 4: remove from Fix rows) */}
          {item.bias && item.category !== 'fix' && (
            <BiasIcon
              bias={item.bias}
              why={item.detail}
            />
          )}

          {/* Action button for Fix/Evidence categories */}
          {item.action && ActionIcon && (
            <IconBtn
              icon={ActionIcon}
              tooltip={item.action.label}
              variant={item.action.kind === 'confirm' ? 'confirm' : item.action.kind === 'edit' ? 'edit' : 'default'}
              onClick={handleActionClick}
              disabled={!actionEnabled}
            />
          )}
        </div>
      </div>

      {/* Inline evidence input for Add Evidence category */}
      {showEvidenceInput && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={evidenceValue}
            onChange={(e) => setEvidenceValue(e.target.value)}
            placeholder="Enter evidence source (URL or description)"
            maxLength={500}
            className="flex-1 px-2 py-1 text-xs border border-panel-border rounded bg-panel text-text-body focus:outline-none focus:ring-1 focus:ring-info"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEvidenceSubmit()
              if (e.key === 'Escape') {
                setShowEvidenceInput(false)
                setEvidenceValue('')
              }
            }}
          />
          <button
            onClick={handleEvidenceSubmit}
            disabled={!evidenceValue.trim().replace(/\s+/g, ' ')}
            className="px-2 py-1 text-xs bg-info text-white rounded disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => {
              setShowEvidenceInput(false)
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
}

export function AllImprovements({
  improvementsByCategory,
  tiers,
  totalImprovements,
  onFocus,
  actionHandlers,
  onHoverEnter,
  onHoverLeave,
  reviewedCount,
  totalReviewableCount,
}: AllImprovementsProps) {
  // Track expanded state for each tier
  const [mustAddressExpanded, setMustAddressExpanded] = useState(tierConfig.mustAddress.defaultExpanded)
  const [reviewAssumptionsExpanded, setReviewAssumptionsExpanded] = useState(tierConfig.reviewAssumptions.defaultExpanded)
  const [optionalExpanded, setOptionalExpanded] = useState(tierConfig.optional.defaultExpanded)

  return (
    <div className="space-y-3" data-testid="all-improvements-tiers">
      {/* Must address tier */}
      <TierSection
        tierKey="mustAddress"
        config={tierConfig.mustAddress}
        items={tiers.mustAddress.items}
        isExpanded={mustAddressExpanded}
        onToggleExpand={() => setMustAddressExpanded(prev => !prev)}
        onFocus={onFocus}
        actionHandlers={actionHandlers}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />

      {/* Review assumptions tier */}
      <TierSection
        tierKey="reviewAssumptions"
        config={tierConfig.reviewAssumptions}
        items={tiers.reviewAssumptions.items}
        isExpanded={reviewAssumptionsExpanded}
        onToggleExpand={() => setReviewAssumptionsExpanded(prev => !prev)}
        onFocus={onFocus}
        actionHandlers={actionHandlers}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
        reviewedCount={reviewedCount ?? 0}
        totalCount={totalReviewableCount ?? 0}
      />

      {/* Optional improvements tier */}
      <TierSection
        tierKey="optional"
        config={tierConfig.optional}
        items={tiers.optional.items}
        isExpanded={optionalExpanded}
        onToggleExpand={() => setOptionalExpanded(prev => !prev)}
        onFocus={onFocus}
        actionHandlers={actionHandlers}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />
    </div>
  )
}

export default AllImprovements
