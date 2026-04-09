/**
 * SuccessTarget - Goal and constraints card for Pre-Analysis Panel (v6 wireframe)
 *
 * Layout: Goal diamond shape (18px) left-aligned. Beside it: goal label (clickable → inspector),
 * success target row with value + "Brief" pill + feasibility pill + confirm/edit actions.
 * Below: constraint rows. Below: CTAs.
 */

import { useState, useCallback, useEffect } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil, AlertTriangle } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { CURRENCY_SYMBOLS } from '../../utils/labelUtils'
import { Pill } from './primitives'
import Tooltip from '../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { DiscussWithAiButton } from './DiscussWithAiButton'

/** Goal constraint — accepts CEEGoalConstraint shape */
interface GoalConstraint {
  id: string
  label: string
  operator?: string
  value?: number | string
}

interface SuccessTargetProps {
  goalNode: Node | null
  goalNodes?: Node[]
  successThreshold: number | null
  isThresholdAutoDerived: boolean
  isThresholdConfirmed: boolean
  thresholdProvenance?: string | null
  thresholdSourceBadge?: 'brief' | 'ai' | null
  onThresholdChange?: (value: number | null) => void
  onThresholdConfirm?: () => void
  onThresholdEdit?: () => void
  onGoalChange?: (goalId: string) => void
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (nodeId: string) => void
  onHoverLeave?: () => void
  goalThresholdRaw?: number | null
  goalThresholdUnit?: string | null
  constraintFeasibilityWarning?: boolean
  /** Goal constraints from CEE */
  goalConstraints?: GoalConstraint[]
  /** Callback to send message to conversation panel */
  onSendMessage?: (text: string) => void
}

/** 14px diamond shape for goal nodes — clip-path approach for correct --goal colour */
function GoalDiamond() {
  return (
    <div
      className="w-3.5 h-3.5 bg-goal shrink-0 mt-0.5"
      style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
      aria-hidden="true"
    />
  )
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
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  goalThresholdRaw,
  goalThresholdUnit,
  thresholdSourceBadge,
  constraintFeasibilityWarning,
  goalConstraints,
  onSendMessage,
}: SuccessTargetProps) {
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [editDraft, setEditDraft] = useState<string>('')
  const [showConstraintInput, setShowConstraintInput] = useState(false)
  const [constraintInput, setConstraintInput] = useState('')

  const goalLabel = goalNode ? ((goalNode.data as { label?: string })?.label ?? goalNode.id) : 'Goal'

  const borderColor = !goalNode
    ? 'border-danger/30'
    : isThresholdConfirmed
      ? 'border-success/30'
      : 'border-info/30'

  const rawToNormFactor = (goalThresholdRaw != null && goalThresholdRaw !== 0 && successThreshold != null && successThreshold !== 0)
    ? successThreshold / goalThresholdRaw
    : null

  const editDisplayValue = goalThresholdRaw ?? successThreshold

  useEffect(() => {
    if (isExpanded) {
      setEditDraft(editDisplayValue != null ? String(editDisplayValue) : '')
    }
  }, [isExpanded]) // eslint-disable-line react-hooks/exhaustive-deps

  const toNormalised = (raw: number): number =>
    rawToNormFactor != null ? raw * rawToNormFactor : raw

  const formatValue = (value: number | null): string => {
    if (value === null) return ''
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

  // Derive placeholder with unit context
  const isCurrency = goalThresholdUnit ? CURRENCY_SYMBOLS.has(goalThresholdUnit) : false
  const isPercent = goalThresholdUnit === '%'
  const inputPlaceholder = isCurrency
    ? 'e.g. 20000'
    : isPercent
      ? 'e.g. 75'
      : goalThresholdUnit
        ? `What number would count as success? (${goalThresholdUnit})`
        : 'What number would count as success?'

  const editLabel = goalThresholdUnit
    ? `Target value (${goalThresholdUnit})`
    : 'Target value'

  const hasMultipleGoals = goalNodes.length > 1
  const getNodeLabel = (node: Node): string =>
    (node.data as { label?: string })?.label ?? node.id

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const parsed = parseFloat(trimmed)
    if (Number.isNaN(parsed)) return
    onThresholdChange?.(parsed)
    setInputValue('')
  }, [inputValue, onThresholdChange])

  const handleEditClick = useCallback(() => {
    onThresholdEdit?.()
    setIsExpanded(true)
  }, [onThresholdEdit])

  const handleAddConstraint = useCallback(() => {
    const trimmed = constraintInput.trim()
    if (!trimmed) return
    const dispatch = useGuidanceStore.getState()._dispatchAction
    if (dispatch) {
      dispatch({
        action_type: 'add_constraint',
        parameters: { description: trimmed },
        label: 'Add constraint',
        message: `I'd like to add a constraint: ${trimmed}`,
        source: 'pre_analysis',
      })
    } else {
      onSendMessage?.(`I'd like to add a constraint: ${trimmed}`)
    }
    setConstraintInput('')
    setShowConstraintInput(false)
  }, [constraintInput, onSendMessage])

  const constraints = goalConstraints ?? []

  // Render goal name with diamond shape
  const renderGoalHeader = () => {
    const goalNameEl = hasMultipleGoals && onGoalChange ? (
      <select
        value={goalNode?.id ?? ''}
        onChange={(e) => onGoalChange(e.target.value)}
        title={goalLabel}
        className={`${typography.panelHeader} text-text-header bg-transparent border-none p-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 truncate max-w-full`}
      >
        {goalNodes.map(g => (
          <option key={g.id} value={g.id}>{getNodeLabel(g)}</option>
        ))}
      </select>
    ) : (
      <button
        type="button"
        onClick={() => goalNode && onFocusNode?.(goalNode.id)}
        onMouseEnter={() => goalNode && onHoverEnter?.(goalNode.id)}
        onMouseLeave={onHoverLeave}
        className={`${typography.panelHeader} text-info line-clamp-2 text-left hover:underline cursor-pointer`}
        title={goalLabel}
      >
        {goalLabel}
      </button>
    )

    return (
      <div className="flex items-start gap-2">
        <GoalDiamond />
        {goalNameEl}
        {thresholdSourceBadge === 'brief' && (
          <Pill size="small" variant="success" className="ml-auto flex-shrink-0">From brief</Pill>
        )}
        {thresholdSourceBadge === 'ai' && (
          <Pill size="small" variant="warning" className="ml-auto flex-shrink-0">Estimated</Pill>
        )}
      </div>
    )
  }

  // No goal node
  if (!goalNode) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3`}>
        <div className="flex items-center gap-2">
          <GoalDiamond />
          <span className={`${typography.panelBody} text-text-light`}>No goal selected</span>
        </div>
      </div>
    )
  }

  // Confirmed state — compact single line, expandable
  if (isThresholdConfirmed && successThreshold !== null) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3 space-y-2`}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 text-left cursor-pointer"
        >
          <GoalDiamond />
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" />
          )}
          <span className={`${typography.panelHeader} text-text-header truncate`} title={goalLabel}>{goalLabel}</span>
          <span className="text-text-light shrink-0">·</span>
          <span className={`${typography.panelHeader} text-text-header shrink-0`}>{formatValue(successThreshold)}</span>
          <Check className="w-3.5 h-3.5 text-success shrink-0" />
        </button>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-panel-border flex flex-col gap-2">
            <label className={`${typography.panelBody} text-text-light`}>{editLabel}</label>
            <div className="flex items-center gap-2">
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
                  onThresholdEdit?.()
                }}
                className={`flex-1 min-w-0 px-2 py-1.5 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              />
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false)
                  onThresholdConfirm?.()
                }}
                className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-info rounded-full hover:bg-success shrink-0`}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Constraints */}
        {constraints.length > 0 && (
          <div className="space-y-1">
            {constraints.map((c, i) => (
              <div key={c.id ?? i} className="flex items-center justify-between gap-2">
                <span className={`${typography.panelMeta} text-text-body`}>
                  Constraint: {c.label}{c.operator && c.value != null ? ` ${c.operator} ${c.value}` : ''}
                </span>
                <Pill size="small" variant="success">From brief</Pill>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // No target set — always-visible inline input
  if (successThreshold === null) {
    return (
      <div className={`rounded-lg border ${borderColor} bg-panel p-3`}>
        <div className="flex flex-col gap-2">
          {renderGoalHeader()}
          <div className="flex items-center gap-2">
            <span className={`${typography.panelMeta} text-text-light shrink-0`}>Target:</span>
            {isCurrency && goalThresholdUnit && (
              <span className={`${typography.panelBody} text-text-light shrink-0`}>{goalThresholdUnit}</span>
            )}
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              className={`flex-1 min-w-0 px-2 py-1.5 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            />
            {isPercent && (
              <span className={`${typography.panelBody} text-text-light shrink-0`}>%</span>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-primary rounded-full hover:bg-primary-hover disabled:opacity-50 shrink-0`}
            >
              Save
            </button>
          </div>
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage('Can you help me reconsider whether this goal is framed correctly?')}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer self-start`}
            >
              Reframe goal with AI
            </button>
          )}
        </div>
      </div>
    )
  }

  // Value present but not confirmed
  const discussGoalLabel = (goalNode?.data as { label?: string } | undefined)?.label ?? 'this goal'
  return (
    <div className={`relative rounded-lg border ${borderColor} bg-panel p-3 pr-7 space-y-2`}>
      {/* P1-2: Discuss-with-AI sparkle, bottom-right of the goal target card */}
      <div className="absolute bottom-1 right-1">
        <DiscussWithAiButton element={{ kind: 'goal', label: discussGoalLabel }} />
      </div>
      {/* Goal header with diamond */}
      {renderGoalHeader()}

      {/* Success target line */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className={`${typography.panelBody} text-text-light shrink-0 mt-0.5`}>Success target:</span>
        <span className={`${typography.panelHeader} text-text-header`}>{formatValue(successThreshold)}</span>
        {constraintFeasibilityWarning && (
          <Tooltip delay={300} content="Target is near the upper range of what the model predicts. Consider whether this is achievable.">
            <span className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-warning/30 rounded-full px-2 py-0.5 shrink-0`}>
              <AlertTriangle size={10} className="text-warning shrink-0" />
              Near range limit
            </span>
          </Tooltip>
        )}
      </div>

      {/* Provenance */}
      {thresholdProvenance && isThresholdAutoDerived && (
        <p className={`${typography.panelMeta} text-text-light`}>Source: {thresholdProvenance}</p>
      )}

      {/* Inline edit when expanded */}
      {isExpanded && (
        <div className="pt-2 border-t border-panel-border flex flex-col gap-2">
          <label className={`${typography.panelBody} text-text-light`}>{editLabel}</label>
          <div className="flex items-center gap-2">
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
              className={`flex-1 min-w-0 px-2 py-1.5 ${typography.panelBody} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            />
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false)
                onThresholdConfirm?.()
              }}
              className={`px-3 py-1.5 ${typography.panelMeta} text-text-on-color bg-info rounded-full hover:bg-success shrink-0`}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Constraints */}
      {constraints.length > 0 && (
        <div className="space-y-1 pt-1">
          {constraints.map((c, i) => (
            <div key={c.id ?? i} className="flex items-center justify-between gap-2">
              <span className={`${typography.panelMeta} text-text-body`}>
                Constraint: {c.label}{c.operator && c.value != null ? ` ${c.operator} ${c.value}` : ''}
              </span>
              <Pill size="small" variant="success">From brief</Pill>
            </div>
          ))}
        </div>
      )}

      {/* Confirm / Edit — bottom right */}
      {!isExpanded && (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onThresholdConfirm}
            className="w-[22px] h-[22px] flex items-center justify-center rounded-full border border-success/30 text-success hover:bg-panel-hover cursor-pointer"
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
      )}

      {/* CTAs */}
      <div className="flex items-center gap-2 pt-1 justify-start">
        {showConstraintInput ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={constraintInput}
              onChange={(e) => setConstraintInput(e.target.value)}
              placeholder="e.g. Budget must stay under $50k"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddConstraint()
                if (e.key === 'Escape') {
                  setShowConstraintInput(false)
                  setConstraintInput('')
                }
              }}
              className={`flex-1 min-w-0 px-2 py-1 ${typography.panelMeta} border border-panel-border rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            />
            <button
              type="button"
              onClick={handleAddConstraint}
              disabled={!constraintInput.trim()}
              className={`px-2 py-1 ${typography.panelMeta} text-text-on-color bg-primary rounded-full hover:bg-primary-hover disabled:opacity-50 shrink-0`}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowConstraintInput(false); setConstraintInput('') }}
              className={`${typography.panelMeta} text-text-light hover:text-text-body shrink-0`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowConstraintInput(true)}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
            >
              Add constraint
            </button>
            {onSendMessage && (
              <button
                type="button"
                onClick={() => onSendMessage('Can you help me reconsider whether this goal is framed correctly?')}
                className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
              >
                Reframe goal with AI
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SuccessTarget
