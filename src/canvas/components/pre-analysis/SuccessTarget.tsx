/**
 * SuccessTarget - Success target section for Pre-Analysis Panel
 *
 * Shows goal label and success threshold value. States:
 * - No target set: "No target set" + [Add target] CTA with inline input
 * - Value present: "{goal_label}: {value}" + [Edit] + [Confirm]
 * - Confirmed: "{goal_label}: {value} · Confirmed ✓" collapsed, expandable to edit
 *
 * Persistence: Uses goal node data field for confirmed status to survive undo/redo.
 */

import { useState, useCallback, useEffect } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { CURRENCY_SYMBOLS } from '../../utils/labelUtils'
import { typography } from '@/styles/typography'

interface SuccessTargetProps {
  /** Currently selected goal node */
  goalNode: Node | null
  /** All goal nodes (for dropdown when multiple) */
  goalNodes?: Node[]
  /** Success threshold value */
  successThreshold: number | null
  /** Whether threshold was auto-derived */
  isThresholdAutoDerived: boolean
  /** Whether threshold is confirmed by user */
  isThresholdConfirmed: boolean
  /** Source text explaining where threshold came from */
  thresholdProvenance?: string | null
  /** Source badge type: 'brief' or 'ai' */
  thresholdSourceBadge?: 'brief' | 'ai' | null
  /** Callback when threshold changes */
  onThresholdChange?: (value: number | null) => void
  /** Callback when threshold is confirmed */
  onThresholdConfirm?: () => void
  /** Callback to clear confirmed status (for editing) */
  onThresholdEdit?: () => void
  /** Callback when goal selection changes */
  onGoalChange?: (goalId: string) => void
  /** Raw goal threshold from CEE (user-facing value, e.g. 200) */
  goalThresholdRaw?: number | null
  /** Goal threshold unit from CEE (e.g. "customers") */
  goalThresholdUnit?: string | null
}

export function SuccessTarget({
  goalNode,
  goalNodes = [],
  successThreshold,
  isThresholdAutoDerived,
  isThresholdConfirmed,
  thresholdProvenance,
  onThresholdChange,
  onThresholdConfirm,
  onThresholdEdit,
  onGoalChange,
  goalThresholdRaw,
  goalThresholdUnit,
  thresholdSourceBadge,
}: SuccessTargetProps) {
  // Local state for inline input
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  // Expanded state for confirmed target
  const [isExpanded, setIsExpanded] = useState(false)
  // Local draft value for edit input — prevents snapping back to stale goalThresholdRaw
  const [editDraft, setEditDraft] = useState<string>('')

  const goalLabel = goalNode ? ((goalNode.data as { label?: string })?.label ?? goalNode.id) : 'Goal'

  // Full border colour: danger (no goal), success (confirmed), info (unconfirmed)
  const borderColor = !goalNode
    ? 'border-danger/30'
    : isThresholdConfirmed
      ? 'border-success/30'
      : 'border-info/30'

  // Raw→normalised conversion factor: normalised = raw × factor
  // e.g. raw=200, normalised=0.2 → factor=0.001
  const rawToNormFactor = (goalThresholdRaw != null && goalThresholdRaw !== 0 && successThreshold != null && successThreshold !== 0)
    ? successThreshold / goalThresholdRaw
    : null

  // Initial display value for edit inputs — raw when available, normalised as fallback
  const editDisplayValue = goalThresholdRaw ?? successThreshold

  // Seed editDraft from display value when edit section opens
  useEffect(() => {
    if (isExpanded) {
      setEditDraft(editDisplayValue != null ? String(editDisplayValue) : '')
    }
  }, [isExpanded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convert user-entered raw value back to normalised for the store
  const toNormalised = (raw: number): number =>
    rawToNormFactor != null ? raw * rawToNormFactor : raw

  // Format threshold value for display — prefer raw + unit for user-facing values
  // CURRENCY_SYMBOLS imported from '../../utils/labelUtils'
  const formatValue = (value: number | null): string => {
    if (value === null) return ''
    // If we have a raw value + unit from CEE, show with correct position
    if (goalThresholdRaw != null && goalThresholdUnit) {
      const isCurrency = CURRENCY_SYMBOLS.has(goalThresholdUnit)
      const formatted = goalThresholdRaw.toLocaleString()
      return isCurrency ? `${goalThresholdUnit}${formatted}` : `${formatted} ${goalThresholdUnit}`
    }
    if (goalThresholdRaw != null) {
      return goalThresholdRaw.toLocaleString()
    }
    return value.toLocaleString()
  }

  // Placeholder text for input — show unit hint when available
  const inputPlaceholder = goalThresholdUnit
    ? `Enter target (${goalThresholdUnit})`
    : 'Enter target value'

  // Label for edit inputs — include unit when available
  const editLabel = goalThresholdUnit
    ? `Target value (${goalThresholdUnit})`
    : 'Target value'

  const hasMultipleGoals = goalNodes.length > 1
  const getNodeLabel = (node: Node): string =>
    (node.data as { label?: string })?.label ?? node.id

  // Render goal name: dropdown when multiple goals, static text when single
  const renderGoalName = () => {
    if (hasMultipleGoals && onGoalChange) {
      return (
        <select
          value={goalNode?.id ?? ''}
          onChange={(e) => onGoalChange(e.target.value)}
          title={goalLabel}
          className={`${typography.panelHeader} text-text-header bg-transparent border-none p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 truncate max-w-full`}
        >
          {goalNodes.map(g => (
            <option key={g.id} value={g.id}>{getNodeLabel(g)}</option>
          ))}
        </select>
      )
    }
    return (
      <p className={`${typography.panelHeader} text-text-header line-clamp-2`} title={goalLabel}>{goalLabel}</p>
    )
  }

  // Handle input submission
  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    const parsed = parseFloat(trimmed)
    if (Number.isNaN(parsed)) return

    onThresholdChange?.(parsed)
    setShowInput(false)
    setInputValue('')
  }, [inputValue, onThresholdChange])

  // Handle edit click - clear confirmed and show edit input
  const handleEditClick = useCallback(() => {
    onThresholdEdit?.()
    setIsExpanded(true)
  }, [onThresholdEdit])

  // No goal node - show missing-goal card
  if (!goalNode) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3 hover:bg-panel-hover transition-colors`}>
        <div className="flex items-center justify-between">
          <span className={`${typography.panelBody} text-text-light`}>No goal selected</span>
        </div>
      </div>
    )
  }

  // Confirmed state - compact single line, expandable for editing
  if (isThresholdConfirmed && successThreshold !== null) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3 hover:bg-panel-hover transition-colors`}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 text-left cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" />
          )}
          <span className={`${typography.panelHeader} text-text-header truncate`}>{goalLabel}</span>
          <span className="text-text-light shrink-0">·</span>
          <span className={`${typography.panelHeader} text-text-header shrink-0`}>{formatValue(successThreshold)}</span>
          <Check className="w-3.5 h-3.5 text-success shrink-0" />
        </button>

        {/* Expanded content - edit option */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-panel-border">
            <div className="flex items-center gap-3">
              <label className={`${typography.panelBody} text-text-light shrink-0`}>{editLabel}</label>
              <input
                type="number"
                value={editDraft}
                onChange={(e) => {
                  const val = e.target.value
                  setEditDraft(val)
                  if (val === '') {
                    onThresholdChange?.(null)
                  } else {
                    const parsed = parseFloat(val)
                    if (!Number.isNaN(parsed)) {
                      onThresholdChange?.(toNormalised(parsed))
                    }
                  }
                  // Clear confirmed status when editing
                  onThresholdEdit?.()
                }}
                className="flex-1 px-2 py-1.5 text-sm border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-2 focus:ring-info"
              />
              <button
                type="button"
                onClick={onThresholdConfirm}
                className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-info rounded-lg hover:bg-success`}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // No target set - show add target CTA with hint
  if (successThreshold === null) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3 hover:bg-panel-hover transition-colors`}>
        {showInput ? (
          <div className="flex items-center gap-3">
            <label className={`${typography.panelBody} text-text-light shrink-0`}>Target for {goalLabel}</label>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') {
                  setShowInput(false)
                  setInputValue('')
                }
              }}
              className="flex-1 px-2 py-1.5 text-sm border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-2 focus:ring-info"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50`}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false)
                setInputValue('')
              }}
              className={`px-2 py-1.5 ${typography.panelMeta} text-text-light hover:text-text-body`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              {renderGoalName()}
              <button
                type="button"
                onClick={() => setShowInput(true)}
                className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
              >
                Add target
              </button>
            </div>
            <p className={`${typography.panelMeta} text-text-light mt-1`}>
              Add a target to see each option's probability of success
            </p>
          </div>
        )}
      </div>
    )
  }

  // Value present but not confirmed - show edit and confirm CTAs
  return (
    <div className={`rounded-lg border ${borderColor} bg-panel p-3`}>
      {/* Goal name — dropdown when multiple, static when single */}
      {renderGoalName()}

      {/* Success target line */}
      <div className="flex items-center gap-2 mt-1">
        <span className={`${typography.panelBody} text-text-light shrink-0`}>Success target:</span>
        <span className={`${typography.panelHeader} text-text-header`}>{formatValue(successThreshold)}</span>
        {thresholdSourceBadge === 'brief' && (
          <span className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-success/30 rounded-full px-2 py-0.5 shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" aria-hidden="true" />
            From brief
          </span>
        )}
        {thresholdSourceBadge === 'ai' && (
          <span className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-warning/30 rounded-full px-2 py-0.5 shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" aria-hidden="true" />
            AI estimate
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            type="button"
            onClick={onThresholdConfirm}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full border border-success/30 text-success hover:bg-success-light cursor-pointer"
            title="Confirm target"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleEditClick}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full border border-panel-border text-text-light hover:bg-panel-hover cursor-pointer"
            title="Edit target"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Provenance text - only shown when threshold is auto-derived (not user-edited) */}
      {thresholdProvenance && isThresholdAutoDerived && (
        <p className={`${typography.panelMeta} text-text-light mt-1`}>Source: {thresholdProvenance}</p>
      )}

      {/* Inline edit when expanded */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-panel-border">
          <div className="flex items-center gap-3">
            <label className={`${typography.panelBody} text-text-light shrink-0`}>{editLabel}</label>
            <input
              type="number"
              value={editDraft}
              onChange={(e) => {
                const val = e.target.value
                setEditDraft(val)
                if (val === '') {
                  onThresholdChange?.(null)
                } else {
                  const parsed = parseFloat(val)
                  if (!Number.isNaN(parsed)) {
                    onThresholdChange?.(toNormalised(parsed))
                  }
                }
              }}
              autoFocus
              className="flex-1 px-2 py-1.5 text-sm border border-panel-border rounded-lg bg-panel text-text-body focus:outline-none focus:ring-2 focus:ring-info"
            />
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false)
                onThresholdConfirm?.()
              }}
              className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-info rounded-lg hover:bg-success`}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuccessTarget
