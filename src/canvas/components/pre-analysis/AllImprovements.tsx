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
import { Accordion, Pill, NodeLink, BiasIcon, IconBtn } from './primitives'
import { Check, Pencil, Plus, HelpCircle } from 'lucide-react'
import type { ImprovementItem, ImprovementCategory, ImprovementActionKind } from './hooks/usePreAnalysisData'

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
}

interface AllImprovementsProps {
  /** Improvements grouped by category */
  improvementsByCategory: Record<ImprovementCategory, ImprovementItem[]>
  /** Total count of all improvements */
  totalImprovements: number
  /** Click handler for node/edge focus */
  onFocus?: (type: 'node' | 'edge', id: string) => void
  /** Action handlers for interactive actions */
  actionHandlers?: ImprovementActionHandlers
}

/** Category display config */
const categoryConfig: Record<ImprovementCategory, {
  label: string
  bg: string
  border: string
}> = {
  fix: {
    label: 'FIX',
    bg: 'bg-[rgba(234,123,75,0.07)]',
    border: 'border-l-danger',
  },
  verify: {
    label: 'VERIFY',
    bg: 'bg-[rgba(255,166,86,0.07)]',
    border: 'border-l-warning',
  },
  add_evidence: {
    label: 'ADD EVIDENCE',
    bg: 'bg-[rgba(176,168,153,0.04)]',
    border: 'border-l-panel-border',
  },
  strengthen: {
    label: 'STRENGTHEN',
    bg: 'bg-[rgba(176,168,153,0.04)]',
    border: 'border-l-panel-border',
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
}

function CategorySection({ category, items, onFocus, actionHandlers, removingItems }: CategorySectionProps) {
  if (items.length === 0) return null

  const config = categoryConfig[category]

  return (
    <div className={`rounded-lg border-l-[3px] ${config.bg} ${config.border} p-3`}>
      {/* Category label */}
      <p className="text-[10px] font-bold uppercase text-text-body tracking-wide mb-2">
        {config.label}
      </p>

      {/* Items */}
      <div className="space-y-2">
        {items.map(item => (
          <ImprovementRow
            key={item.key}
            item={item}
            onFocus={onFocus}
            actionHandlers={actionHandlers}
            isRemoving={removingItems?.has(item.key)}
          />
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
}

function ImprovementRow({ item, onFocus, actionHandlers, isRemoving }: ImprovementRowProps) {
  const [showEvidenceInput, setShowEvidenceInput] = useState(false)
  const [evidenceValue, setEvidenceValue] = useState('')
  const [exitLabel, setExitLabel] = useState<string | null>(null)

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
        // For edges, show inline evidence input
        if (item.action?.targetType === 'edge') {
          setShowEvidenceInput(true)
        }
        break
      case 'add_baseline':
        if (actionHandlers?.onAddBaseline) {
          actionHandlers.onAddBaseline()
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
      default:
        return false
    }
  }

  const ActionIcon = getActionIcon()
  const actionEnabled = isActionEnabled()

  // Show exit transition
  if (isRemoving || exitLabel) {
    return (
      <div className="flex items-center gap-2 opacity-50 transition-opacity duration-500">
        <span className="text-sm text-text-body">{item.label}</span>
        <Pill size="small" variant={exitLabel === 'Confirmed' ? 'success' : 'info'}>
          {exitLabel || 'Removed'}
        </Pill>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {/* NodeLink for focusable items */}
        <div className="flex-1 min-w-0">
          {item.focus ? (
            <NodeLink
              targetId={item.focus.id}
              targetType={item.focus.type}
              onClick={handleFocusClick}
              className="text-sm"
            >
              {item.label}
            </NodeLink>
          ) : (
            <span className="text-sm text-text-body">{item.label}</span>
          )}
          <p className="text-xs text-text-light mt-0.5">{item.detail}</p>
        </div>

        {/* Optional BiasIcon */}
        {item.bias && (
          <BiasIcon
            bias={item.bias}
            why={item.detail}
            className="flex-shrink-0"
          />
        )}

        {/* Action buttons for Verify category (Confirm + Assumption + Edit) */}
        {item.category === 'verify' && (
          <div className="flex items-center gap-1">
            {actionHandlers?.onConfirm && (
              <IconBtn
                icon={Check}
                tooltip="Confirm"
                variant="confirm"
                onClick={() => {
                  if (item.action?.targetId) {
                    setExitLabel('Confirmed')
                    actionHandlers.onConfirm(item.action.targetId)
                  }
                }}
              />
            )}
            {actionHandlers?.onAssumption && (
              <IconBtn
                icon={HelpCircle}
                tooltip="Mark as assumption"
                variant="assume"
                onClick={() => {
                  if (item.action?.targetId) {
                    setExitLabel('Assumption')
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
                    actionHandlers.onEdit(item.action.targetId)
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Single action button for other categories */}
        {item.category !== 'verify' && item.action && ActionIcon && (
          <IconBtn
            icon={ActionIcon}
            tooltip={item.action.label}
            variant={item.action.kind === 'confirm' ? 'confirm' : item.action.kind === 'edit' ? 'edit' : 'default'}
            onClick={handleActionClick}
            disabled={!actionEnabled}
          />
        )}
      </div>

      {/* Inline evidence input for Add Evidence category */}
      {showEvidenceInput && (
        <div className="flex items-center gap-2 pl-4">
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
  totalImprovements,
  onFocus,
  actionHandlers,
}: AllImprovementsProps) {
  return (
    <Accordion
      title="All Improvements"
      defaultExpanded={true}
      rightContent={
        <Pill size="small" variant="default">
          {totalImprovements}
        </Pill>
      }
      testId="all-improvements-accordion"
    >
      <div className="space-y-3">
        {categoryOrder.map(category => (
          <CategorySection
            key={category}
            category={category}
            items={improvementsByCategory[category]}
            onFocus={onFocus}
            actionHandlers={actionHandlers}
          />
        ))}
      </div>
    </Accordion>
  )
}

export default AllImprovements
