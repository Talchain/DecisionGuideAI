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
import { Check, Pencil, Plus, HelpCircle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import type { ImprovementItem, ImprovementCategory, TiersData } from './hooks/usePreAnalysisData'
import { typography } from '@/styles/typography'
import { classifyUnit } from '@/canvas/utils/labelUtils'
import { ContestedEdgeCard } from '../model-tab/ContestedEdgeCard'
import { DetailToggleContext } from '../model-tab/DetailToggleContext'
import type { ValidationMetadata, UserAction } from '../../domain/validation'
import type { Edge, Node } from '@xyflow/react'

function SubgroupDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`}>{label}</span>
      <div className="flex-1 h-px bg-panel-border" />
    </div>
  )
}

/**
 * ConfidenceSpectrum — gradient bar with positioned dots per factor.
 * Hollow ring = factor uses default range (no explicit cap / range_derivation_source).
 * Filled dot = factor has explicit range.
 */
function ConfidenceSpectrum({ items }: { items: ImprovementItem[] }) {
  // Only show factor items (nodes), not edge items
  const factorItems = items.filter(i => i.focus?.type === 'node')
  if (factorItems.length === 0) return null

  // Position dots by subgroup: AI estimate left, brief middle, reviewed right
  // Within each zone, spread evenly
  const zones: Record<string, { start: number; end: number; color: string; borderColor: string }> = {
    contested: { start: 5, end: 20, color: 'bg-warning', borderColor: 'border-warning' },
    cee_inference: { start: 10, end: 30, color: 'bg-warning', borderColor: 'border-warning' },
    brief_extraction: { start: 45, end: 70, color: 'bg-info', borderColor: 'border-info' },
    user_reviewed: { start: 78, end: 95, color: 'bg-success', borderColor: 'border-success' },
  }

  const dots = factorItems.map((item, idx) => {
    const zone = zones[item.subgroup ?? ''] ?? zones.cee_inference
    const groupItems = factorItems.filter(i => (i.subgroup ?? '') === (item.subgroup ?? ''))
    const groupIdx = groupItems.indexOf(item)
    const spread = zone.end - zone.start
    const position = groupItems.length === 1
      ? (zone.start + zone.end) / 2
      : zone.start + (spread * groupIdx) / (groupItems.length - 1)

    // Detect default range: use range_derivation_source if available, fall back to cap
    // range_derivation_source is the authoritative signal; cap is an acceptable fallback
    const hasExplicitRange = item.cap != null // TODO: use range_derivation_source when available on ImprovementItem

    return (
      <Tooltip key={item.key} delay={200} content={`${item.label}${hasExplicitRange ? '' : ' · default range'}`}>
        <span
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full cursor-pointer transition-transform hover:scale-[1.4] ${
            hasExplicitRange
              ? `${zone.color}`
              : `bg-transparent border-2 ${zone.borderColor}`
          }`}
          style={{ left: `${position}%` }}
        />
      </Tooltip>
    )
  })

  return (
    <div className="px-3 pb-1">
      <div className="flex justify-between mb-1.5">
        <span className={`${typography.panelMeta} text-text-light`}>AI estimate</span>
        <span className={`${typography.panelMeta} text-text-light`}>From brief</span>
        <span className={`${typography.panelMeta} text-text-light`}>Verified</span>
      </div>
      <div
        className="relative h-4 rounded-lg border border-panel-border"
        // Middle stop derived from --info; the warning/success stops still match
        // brand.css exactly (#FFA656 / #67C89E) and are left for the follow-up
        // sweep. Only the blue had orphaned (it held the pre-D1 #52A3C8).
        style={{ background: 'linear-gradient(to right, rgba(255,166,86,0.12), color-mix(in srgb, var(--info) 12%, transparent), rgba(103,200,158,0.12))' }}
      >
        {dots}
      </div>
    </div>
  )
}

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
  /** Inline value edit — update factor observed state with user-provided raw value */
  onInlineEditValue?: (nodeId: string, rawValue: number, cap: number | null) => void
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
  /** Contested edges with full validation metadata for calibration card rendering */
  contestedEdges?: Array<{ edge: Edge; validation: ValidationMetadata }>
  /** All graph nodes for edge card label resolution */
  nodes?: Node[]
  /** Handler for resolving a contested edge */
  onResolveEdge?: (edgeId: string, action: UserAction, customMean?: number) => void
  /** Pre-analysis sensitivity factor influence map for "Drives N%" labels */
  factorInfluenceMap?: Map<string, number>
}

/** Tier configuration for three-tier hierarchy */
interface TierConfig {
  title: string
  defaultExpanded: boolean
}

/** Info tooltip text for each tier */
const TIER_INFO_TOOLTIP: Record<string, string> = {
  reviewAssumptions: 'Values the AI used to build your model. Updating them with your knowledge significantly improves accuracy.',
  optional: 'Lower-priority suggestions to strengthen your model. Address the most influential ones first.',
}

/** Tier display configs */
const tierConfig: Record<string, TierConfig> = {
  mustAddress: {
    title: 'Must address',
    defaultExpanded: true,
  },
  reviewAssumptions: {
    title: 'Your expertise',
    defaultExpanded: true,
  },
  optional: {
    title: 'More improvements',
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
  /** Contested edges for calibration card rendering */
  contestedEdges?: Array<{ edge: Edge; validation: ValidationMetadata }>
  /** All graph nodes for edge card label resolution */
  nodes?: Node[]
  /** Handler for resolving contested edges */
  onResolveEdge?: (edgeId: string, action: UserAction, customMean?: number) => void
  /** Factor influence map for "Drives N%" labels */
  factorInfluenceMap?: Map<string, number>
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
  contestedEdges,
  nodes,
  onResolveEdge,
  factorInfluenceMap,
}: TierSectionProps) {
  // For optional tier: collapse add_evidence items into summary row
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)
  // For reviewAssumptions: collapse brief_extraction items by default
  const [briefExpanded, setBriefExpanded] = useState(false)

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
    sectionTitle = `${config.title} (contributed to ${reviewedCount} of ${totalCount})`
  } else if (isOptionalTier && items.length > 0) {
    sectionTitle = nonEvidenceItems.length > 0
      ? `${config.title} (${nonEvidenceItems.length})`
      : config.title
  }

  return (
    <div className="rounded-lg border border-panel-border">
      {/* Section header - clickable accordion */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-1.5">
          <span className={`${typography.panelHeader} text-text-body`}>{sectionTitle}</span>
          {TIER_INFO_TOOLTIP[tierKey] && (
            <Tooltip delay={300} content={TIER_INFO_TOOLTIP[tierKey]}>
              <Info size={14} className="text-text-light" />
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showEmptyState && (
            <span className={`${typography.panelMeta} rounded-full px-1.5 py-0.5 bg-transparent border ${showCompletionState ? 'border-success/30 text-text-body' : isReviewTier ? 'border-warning/30 text-text-body' : isOptionalTier ? 'border-info/30 text-text-body' : 'border-panel-border text-text-light'}`}>
              {showCompletionState ? (
                <span className="inline-flex items-center justify-center">
                  <Check size={12} className="text-success" />
                </span>
              ) : (
                isReviewTier && totalCount != null ? totalCount : nonEvidenceItems.length
              )}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-light" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-light" />
          )}
        </div>
      </button>

      {/* Progress bar for reviewAssumptions tier (v1.1) */}
      {isReviewTier && reviewedCount !== undefined && totalCount !== undefined && totalCount > 0 && (
        <Tooltip delay={300} content="Track your contributions to the model">
        <div className="px-3 pb-1">
          <div className="w-full h-1.5 bg-panel-border rounded-full overflow-hidden">
            <div
              className="h-full bg-goal rounded-full transition-all duration-300"
              style={{ width: `${Math.round((reviewedCount / totalCount) * 100)}%` }}
            />
          </div>
        </div>
        </Tooltip>
      )}

      {/* Confidence spectrum for reviewAssumptions tier — factor dots by source */}
      {isReviewTier && isExpanded && nonEvidenceItems.length > 0 && (
        <ConfidenceSpectrum items={nonEvidenceItems} />
      )}

      {/* Section content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {showCompletionState ? (
            <p className={`${typography.panelBody} text-success py-1`}>All reviewed</p>
          ) : showEmptyState ? (
            <p className={`${typography.panelBody} text-text-light py-1`}>
              All values came from your brief or are set by your options. Nothing needs review.
            </p>
          ) : (
            <>
              {/* Non-evidence items render normally */}
              {(() => {
                // Precompute per-subgroup counts for divider labels
                const subgroupCounts: Record<string, number> = {}
                nonEvidenceItems.forEach(i => {
                  if (i.subgroup) subgroupCounts[i.subgroup] = (subgroupCounts[i.subgroup] ?? 0) + 1
                })
                // In reviewAssumptions tier: separate brief_extraction items for collapsible rendering
                const briefItems = isReviewTier ? nonEvidenceItems.filter(i => i.subgroup === 'brief_extraction') : []
                const visibleItems = isReviewTier ? nonEvidenceItems.filter(i => i.subgroup !== 'brief_extraction') : nonEvidenceItems
                const rendered = visibleItems.map((item, index) => {
                  const prevItem = index > 0 ? visibleItems[index - 1] : undefined
                  const subgroupChanged = item.subgroup != null && item.subgroup !== prevItem?.subgroup
                  const count = item.subgroup ? subgroupCounts[item.subgroup] : undefined
                  const dividerLabel = item.subgroup === 'contested' ? `Contested relationships${count != null ? ` (${count})` : ''}`
                    : item.subgroup === 'cee_inference' ? `AI estimates${count != null ? ` (${count})` : ''}`
                    : item.subgroup === 'brief_extraction' ? `From your brief${count != null ? ` (${count})` : ''}`
                    : item.subgroup === 'user_reviewed' ? `Reviewed${count != null ? ` (${count})` : ''}` : null
                  // For contested subgroup items, render ContestedEdgeCard instead of ImprovementRow
                  const isContestedItem = item.subgroup === 'contested'
                  const contestedMatch = isContestedItem && contestedEdges
                    ? contestedEdges.find(ce => `contested_${ce.edge.id}` === item.key)
                    : undefined

                  return (
                    <div
                      key={item.key}
                      style={!subgroupChanged && index > 0 ? {
                        borderTop: '1px solid rgba(238, 230, 216, 0.5)',
                        paddingTop: '8px',
                      } : undefined}
                    >
                      {subgroupChanged && dividerLabel && (
                        <SubgroupDivider label={dividerLabel} />
                      )}
                      {contestedMatch && nodes && onResolveEdge ? (
                        <DetailToggleContext.Provider value={{ showDetail: false, setShowDetail: () => {} }}>
                          <ContestedEdgeCard
                            edge={contestedMatch.edge}
                            nodes={nodes}
                            validation={contestedMatch.validation}
                            isFragile={false}
                            onResolve={onResolveEdge}
                          />
                        </DetailToggleContext.Provider>
                      ) : (
                        <ImprovementRow
                          item={item}
                          onFocus={onFocus}
                          actionHandlers={actionHandlers}
                          onHoverEnter={onHoverEnter}
                          onHoverLeave={onHoverLeave}
                          factorInfluence={factorInfluenceMap?.get(item.focus?.id ?? '')}
                        />
                      )}
                    </div>
                  )
                })

                // Add brief_extraction collapsible section after visible items
                if (briefItems.length > 0) {
                  rendered.push(
                    <div key="brief-collapsible">
                      <SubgroupDivider label={`From your brief (${briefItems.length})`} />
                      {!briefExpanded ? (
                        <button
                          type="button"
                          onClick={() => setBriefExpanded(true)}
                          className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1`}
                        >
                          Show {briefItems.length} confirmed value{briefItems.length !== 1 ? 's' : ''}
                        </button>
                      ) : (
                        <>
                          {briefItems.map((item, bi) => (
                            <div
                              key={item.key}
                              style={bi > 0 ? {
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
                                factorInfluence={factorInfluenceMap?.get(item.focus?.id ?? '')}
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setBriefExpanded(false)}
                            className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1`}
                          >
                            Hide
                          </button>
                        </>
                      )}
                    </div>
                  )
                }

                return rendered
              })()}

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
                    <p className={`${typography.panelBody} text-text-body`}>
                      {evidenceItems.length} edge{evidenceItems.length !== 1 ? 's' : ''} without evidence
                    </p>
                    <button
                      type="button"
                      onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                      className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
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
  rowBorderColor: string
}> = {
  fix: {
    label: 'Fix',
    rowBorderColor: 'rgba(234, 123, 75, 0.2)', // danger at 20%
  },
  verify: {
    label: 'Verify',
    rowBorderColor: 'rgba(255, 166, 86, 0.2)', // warning at 20%
  },
  add_evidence: {
    label: 'Add evidence',
    rowBorderColor: 'rgba(225, 216, 199, 0.4)', // panel-border at 40%
  },
  strengthen: {
    label: 'Strengthen',
    rowBorderColor: 'rgba(170, 167, 228, 0.2)', // option at 20%
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
      <div className="rounded-lg border border-panel-border py-2 px-2.5">
        <div className="flex items-center justify-between">
          <p className={`${typography.panelBody} text-text-body`}>
            {items.length} edge{items.length !== 1 ? 's' : ''} without evidence
          </p>
          <button
            onClick={onToggleExpand}
            className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
          >
            View all
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-panel-border py-2 px-2.5">
      {/* Category label - sentence case, no uppercase transform */}
      <div className="flex items-center justify-between mb-2">
        <p className={`${typography.panelHeader} text-text-light tracking-wide`}>
          {config.label}
        </p>
        {/* Show collapse button for expanded add_evidence */}
        {category === 'add_evidence' && isExpanded && onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
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
  /** Factor influence score (0–1) for "Drives N%" label */
  factorInfluence?: number
}

function ImprovementRow({ item, onFocus, actionHandlers, isRemoving, onHoverEnter, onHoverLeave, factorInfluence }: ImprovementRowProps) {
  const [showEvidenceInput, setShowEvidenceInput] = useState(false)
  const [evidenceValue, setEvidenceValue] = useState('')
  const [exitLabel, setExitLabel] = useState<string | null>(null)
  // Reviewed state for Verify items: 'confirmed' | 'assumption' | null
  const [reviewedState, setReviewedState] = useState<'confirmed' | 'assumption' | null>(null)
  // Whether the reviewed item is expanded (to change response)
  const [isReviewedExpanded, setIsReviewedExpanded] = useState(false)
  // Inline value editor for verify items
  const [showValueEditor, setShowValueEditor] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleOpenValueEditor = () => {
    setEditValue(item.rawValue != null ? String(item.rawValue) : '')
    setShowValueEditor(true)
  }
  const handleValueSave = () => {
    const trimmed = editValue.trim()
    if (!trimmed) return
    const parsed = parseFloat(trimmed)
    if (isNaN(parsed)) return
    if (item.action?.targetId && actionHandlers?.onInlineEditValue) {
      actionHandlers.onInlineEditValue(item.action.targetId, parsed, item.cap ?? null)
    }
    setShowValueEditor(false)
  }
  const handleValueCancel = () => {
    setShowValueEditor(false)
    setEditValue('')
  }

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
      <div className="flex items-center gap-2 opacity-50 transition-opacity duration-400">
        <span className={`${typography.panelBody} text-text-body`}>{item.label}</span>
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
          className="w-full flex items-center gap-2 text-left cursor-pointer hover:bg-black/[0.02] rounded-full py-0.5"
        >
          {isReviewedExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" />
          )}
          <span className={`${typography.panelBody} text-text-light line-clamp-2`}>{item.label}</span>
          <span className={`shrink-0 ${typography.panelBody} text-text-light`}>·</span>
          <span className={`shrink-0 ${typography.panelBody} text-success flex items-center gap-1`}>
            Reviewed <Check className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Expanded content - ability to change response */}
        {isReviewedExpanded && (
          <div className="mt-2 ml-5 pl-1">
            <div className="flex items-center gap-2 py-1">
              <span className={`${typography.panelBody} text-text-light`}>
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

  // Strengthen items: merged question + context in one paragraph, then CTAs
  if (item.category === 'strengthen') {
    return (
      <div
        className="space-y-2 cursor-pointer hover:bg-black/[0.02] rounded-md -mx-1 px-1"
        onMouseEnter={handleRowMouseEnter}
        onMouseLeave={handleRowMouseLeave}
      >
        {/* Merged question + context */}
        <p className={`${typography.panelBody} text-text-header text-left`}>{item.label}</p>
        {/* CTA pill buttons */}
        <div className="flex items-center gap-2">
          {item.action && (
            <button
              type="button"
              onClick={handleActionClick}
              disabled={!actionEnabled}
              className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success disabled:opacity-50 cursor-pointer`}
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
              className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
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
        className="cursor-pointer hover:bg-factor-light rounded-md -mx-1 px-1"
        onMouseEnter={handleRowMouseEnter}
        onMouseLeave={handleRowMouseLeave}
      >
        <div className="flex items-center gap-2">
          {/* Text content - flex-1 min-w-0, label wraps (v1.1: no truncation) */}
          <div className={`flex-1 min-w-0 flex items-baseline flex-wrap ${typography.panelBody}`} title={fullText}>
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
            {/* Value — clickable to open inline editor for verify items with onInlineEditValue */}
            {item.detail && (
              (actionHandlers?.onInlineEditValue && item.action?.targetType === 'node') ? (
                <Tooltip delay={300} content="Click to update with your own figure">
                <button
                  type="button"
                  onClick={handleOpenValueEditor}
                  className="shrink-0 text-text-light hover:text-info cursor-pointer border-b border-dashed border-panel-border hover:border-info"
                >
                  {' · '}{item.detail}
                </button>
                </Tooltip>
              ) : (
                <span className="shrink-0 text-text-light"> · {item.detail}</span>
              )
            )}
            {/* Source badge */}
            {item.sourceBadge === 'brief' && (
              <Tooltip delay={300} content="Extracted from your decision brief">
              <span className={`shrink-0 inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-success/30 rounded-full px-2 py-0.5 ml-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" aria-hidden="true" />
                From brief
              </span>
              </Tooltip>
            )}
            {item.sourceBadge === 'ai' && (
              <Tooltip delay={300} content="Olumi estimated this because your brief didn't specify it">
              <span className={`shrink-0 inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-warning/30 rounded-full px-2 py-0.5 ml-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" aria-hidden="true" />
                AI estimate
              </span>
              </Tooltip>
            )}
            {/* Influence label from pre-analysis sensitivity (Task 4b) */}
            {factorInfluence != null && factorInfluence > 0 && (
              <span className={`shrink-0 ${typography.panelMeta} text-text-light ml-1`}>
                Drives {Math.round(factorInfluence * 100)}%
              </span>
            )}
          </div>

          {/* Fixed action column - always visible on touch/narrow (Task 8) */}
          <div className="assumption-actions flex items-center gap-0.5 shrink-0 ml-auto self-end">
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
                    tooltip={"Accept as assumption. Won\u2019t ask again"}
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
                    tooltip="Edit this value"
                    variant="edit"
                    onClick={() => {
                      if (item.action?.targetId) {
                        // For edges, use onFocus to focus the edge on canvas
                        // For nodes with inline edit, open inline editor; otherwise open inspector
                        if (item.action?.targetType === 'edge' && onFocus) {
                          onFocus('edge', item.action.targetId)
                        } else if (actionHandlers?.onInlineEditValue && item.action?.targetType === 'node') {
                          handleOpenValueEditor()
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
          <p className={`${typography.panelMeta} text-text-light italic mt-0.5 ml-0.5`}>
            ⤷ {item.uncertaintyDrivers.join(', ')}
          </p>
        )}
        {/* Verification hint (secondary to raw_value) */}
        {item.hint && (
          <p className={`${typography.panelMeta} text-text-light mt-0.5 ml-0.5`}>
            {item.hint}
          </p>
        )}

        {/* Inline value editor */}
        {showValueEditor && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={item.rawValue != null ? String(item.rawValue) : 'Enter value'}
              className={`flex-1 px-2 py-1 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info max-w-[120px]`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleValueSave()
                if (e.key === 'Escape') handleValueCancel()
              }}
            />
            {item.unit && classifyUnit(item.unit).kind !== 'placeholder' && (
              <span className={`${typography.panelMeta} text-text-light`}>{item.unit}</span>
            )}
            <button
              type="button"
              onClick={handleValueSave}
              disabled={!editValue.trim() || isNaN(parseFloat(editValue.trim()))}
              className={`px-3 py-1 ${typography.panelMeta} bg-primary text-text-on-color rounded-full hover:opacity-90 disabled:opacity-40 transition-colors`}
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleValueCancel}
              className={`${typography.panelMeta} text-text-light hover:text-text-body`}
            >
              Cancel
            </button>
          </div>
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
              className={`${typography.panelBody} text-left hover:underline`}
            >
              {item.label}
            </NodeLink>
          ) : (
            <span className={`${typography.panelBody} text-text-body text-left`}>{item.label}</span>
          )}
          {item.detail && (
            <p className={`${typography.panelBody} text-text-light mt-0.5 text-left`}>{item.detail}</p>
          )}
        </div>

        {/* Fixed action column - anchored bottom-right */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto self-end">
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
            className={`flex-1 px-2 py-1 ${typography.panelMeta} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
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
            className={`px-2 py-1 ${typography.panelMeta} bg-info hover:bg-success text-text-on-color rounded disabled:opacity-50`}
          >
            Save
          </button>
          <button
            onClick={() => {
              setShowEvidenceInput(false)
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
  contestedEdges,
  nodes,
  onResolveEdge,
  factorInfluenceMap,
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
        contestedEdges={contestedEdges}
        nodes={nodes}
        onResolveEdge={onResolveEdge}
        factorInfluenceMap={factorInfluenceMap}
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
