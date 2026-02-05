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

import { useState, useCallback } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import type { Node } from '@xyflow/react'

interface SuccessTargetProps {
  /** Currently selected goal node */
  goalNode: Node | null
  /** Success threshold value */
  successThreshold: number | null
  /** Whether threshold was auto-derived */
  isThresholdAutoDerived: boolean
  /** Whether threshold is confirmed by user */
  isThresholdConfirmed: boolean
  /** Callback when threshold changes */
  onThresholdChange?: (value: number | null) => void
  /** Callback when threshold is confirmed */
  onThresholdConfirm?: () => void
  /** Callback to clear confirmed status (for editing) */
  onThresholdEdit?: () => void
}

export function SuccessTarget({
  goalNode,
  successThreshold,
  isThresholdAutoDerived,
  isThresholdConfirmed,
  onThresholdChange,
  onThresholdConfirm,
  onThresholdEdit,
}: SuccessTargetProps) {
  // Local state for inline input
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  // Expanded state for confirmed target
  const [isExpanded, setIsExpanded] = useState(false)

  const goalLabel = goalNode ? ((goalNode.data as { label?: string })?.label ?? goalNode.id) : 'Goal'

  // Format threshold value for display
  const formatValue = (value: number | null): string => {
    if (value === null) return ''
    // Simple formatting - could be enhanced with unit awareness
    return value.toLocaleString()
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

  // No goal node - don't render
  if (!goalNode) {
    return null
  }

  // Confirmed state - collapsed view
  if (isThresholdConfirmed && successThreshold !== null) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel p-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-text-light shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-text-light shrink-0" />
            )}
            <span className="text-sm text-text-body truncate">{goalLabel}</span>
            <span className="text-sm text-text-light shrink-0">: {formatValue(successThreshold)}</span>
            <span className="text-sm text-text-light shrink-0">·</span>
            <span className="text-sm text-success flex items-center gap-1 shrink-0">
              Confirmed <Check className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* Expanded content - edit option */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-panel-border">
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-light shrink-0">Target value</label>
              <input
                type="number"
                value={successThreshold ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    onThresholdChange?.(null)
                  } else {
                    const parsed = parseFloat(val)
                    if (!Number.isNaN(parsed)) {
                      onThresholdChange?.(parsed)
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
                className="px-3 py-1.5 text-xs font-medium text-white bg-info rounded-lg hover:bg-info-hover"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // No target set - show add target CTA
  if (successThreshold === null) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel p-3">
        {showInput ? (
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-light shrink-0">Target for {goalLabel}</label>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter target value"
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
              className="px-3 py-1.5 text-xs font-medium text-white bg-info rounded-lg hover:bg-info-hover disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false)
                setInputValue('')
              }}
              className="px-2 py-1.5 text-xs text-text-light hover:text-text-body"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-light">No target set</span>
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="text-xs font-medium text-info hover:underline cursor-pointer"
            >
              Add target
            </button>
          </div>
        )}
      </div>
    )
  }

  // Value present but not confirmed - show edit and confirm CTAs
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-text-body truncate">{goalLabel}</span>
          <span className="text-sm text-text-light shrink-0">: {formatValue(successThreshold)}</span>
          {isThresholdAutoDerived && (
            <span className="text-xs text-text-light bg-factor-light rounded px-1.5 py-0.5 shrink-0">Auto</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleEditClick}
            className="p-1 text-text-light hover:text-text-body rounded hover:bg-black/[0.04]"
            title="Edit target"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onThresholdConfirm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-info rounded-lg hover:bg-info-hover"
          >
            Confirm
          </button>
        </div>
      </div>

      {/* Inline edit when expanded */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-panel-border">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-light shrink-0">Target value</label>
            <input
              type="number"
              value={successThreshold ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  onThresholdChange?.(null)
                } else {
                  const parsed = parseFloat(val)
                  if (!Number.isNaN(parsed)) {
                    onThresholdChange?.(parsed)
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
              className="px-3 py-1.5 text-xs font-medium text-white bg-info rounded-lg hover:bg-info-hover"
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
