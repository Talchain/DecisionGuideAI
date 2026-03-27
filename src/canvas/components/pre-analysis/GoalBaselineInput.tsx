/**
 * GoalBaselineInput — Inline input for setting the goal node's current baseline value.
 *
 * Three states:
 * 1. Pill CTA: "Set current value" outlined pill (no baseline set, input closed)
 * 2. Input row: Label + numeric input + confirm/cancel icon buttons (input open)
 * 3. Display: "Baseline: {value}" + Edit link (baseline already set)
 *
 * Lives inside the Decision Quality section of the pre-analysis panel.
 * Value is stored on the goal node's observedState.value via the onConfirm callback.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Check, X, Pencil, AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'

interface GoalBaselineInputProps {
  /** Current baseline value from goal node's observedState.value */
  currentValue: number | null
  /** Goal node label for display */
  goalLabel: string
  /** Unit context from goal node (e.g. "customers", "$") */
  unit?: string | null
  /** Whether a goal node exists */
  hasGoalNode: boolean
  /** Called when user confirms a value */
  onConfirm: (value: number) => void
  /** Called when user clears/undoes the value */
  onClear: () => void
  /** Called when input opens — triggers canvas highlight */
  onInputOpen?: () => void
  /** Called when input closes — clears canvas highlight */
  onInputClose?: () => void
}

export function GoalBaselineInput({
  currentValue,
  goalLabel,
  unit,
  hasGoalNode,
  onConfirm,
  onClear,
  onInputOpen,
  onInputClose,
}: GoalBaselineInputProps) {
  // All hooks must run unconditionally (Rules of Hooks)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const openInput = useCallback(() => {
    setIsEditing(true)
    setInputValue(currentValue != null ? String(currentValue) : '')
    setError(null)
    onInputOpen?.()
  }, [currentValue, onInputOpen])

  const closeInput = useCallback(() => {
    setIsEditing(false)
    setInputValue('')
    setError(null)
    onInputClose?.()
  }, [onInputClose])

  const validate = useCallback((val: string): number | null => {
    const trimmed = val.trim()
    if (trimmed === '') return null
    const parsed = parseFloat(trimmed)
    if (Number.isNaN(parsed)) return null
    return parsed
  }, [])

  const handleConfirm = useCallback(() => {
    const parsed = validate(inputValue)
    if (parsed === null) {
      setError('Enter a numeric value')
      return
    }
    setPreviousValue(currentValue)
    onConfirm(parsed)
    closeInput()
    // Show undo link for 5 seconds
    setShowUndo(true)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = setTimeout(() => setShowUndo(false), 5000)
  }, [inputValue, validate, currentValue, onConfirm, closeInput])

  const handleCancel = useCallback(() => {
    closeInput()
  }, [closeInput])

  const handleBlur = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed === '' || !Number.isNaN(parseFloat(trimmed))) {
      setError(null)
    } else {
      setError('Enter a numeric value')
    }
  }, [inputValue])

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setShowUndo(false)
    if (previousValue != null) {
      onConfirm(previousValue)
    } else {
      onClear()
    }
    setPreviousValue(null)
  }, [previousValue, onConfirm, onClear])

  const formatDisplayValue = (value: number): string => {
    const formatted = value.toLocaleString()
    if (unit) return `${formatted} ${unit}`
    return formatted
  }

  // No goal node — empty state (after all hooks)
  if (!hasGoalNode) {
    return (
      <div className="py-1.5" data-testid="goal-baseline-empty">
        <p className={`${typography.panelBody} text-text-light`}>No goal defined yet.</p>
      </div>
    )
  }

  // State 2: Input row (editing)
  if (isEditing) {
    return (
      <div
        className="py-1.5 transition-[height,opacity] duration-200"
        data-testid="goal-baseline-input"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-baseline-value" className={`${typography.panelHeader} text-text-header`}>
            Current value
          </label>
          <div className="flex items-center gap-2">
            <input
              id="goal-baseline-value"
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                if (error) setError(null)
              }}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm()
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              placeholder={unit ? `Value (${unit})` : 'Enter value'}
              className={`flex-1 min-w-0 min-h-[44px] px-3 py-2 ${typography.panelBody} bg-panel border ${
                error ? 'border-danger' : 'border-panel-border'
              } rounded-lg text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
              data-testid="goal-baseline-number-input"
            />
            <button
              type="button"
              onClick={handleConfirm}
              aria-label="Confirm"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-success/30 text-success hover:bg-panel-hover cursor-pointer shrink-0"
              data-testid="goal-baseline-confirm"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-panel-border text-text-light hover:bg-panel-hover cursor-pointer shrink-0"
              data-testid="goal-baseline-cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-1.5" data-testid="goal-baseline-error">
              <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
              <span className={`${typography.panelMeta} text-danger`}>{error}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // State 3: Display state (baseline already set)
  if (currentValue != null) {
    return (
      <div className="py-1.5" data-testid="goal-baseline-display">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`${typography.panelBody} text-text-body`}>
              Baseline: {formatDisplayValue(currentValue)}
            </span>
            <button
              type="button"
              onClick={openInput}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer`}
              data-testid="goal-baseline-edit"
            >
              Edit
            </button>
            {showUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className={`${typography.panelBody} text-info hover:underline cursor-pointer`}
                data-testid="goal-baseline-undo"
              >
                Undo
              </button>
            )}
          </div>
          <p className={`${typography.panelMeta} text-text-light`}>
            Analysis will show improvement from this starting point.
          </p>
        </div>
      </div>
    )
  }

  // State 1: Pill CTA (no baseline set)
  return (
    <div className="flex items-start gap-2 py-1.5" data-testid="goal-baseline-pill">
      <div className="flex-1 min-w-0 space-y-1">
        <p className={`${typography.panelBody} text-text-body`}>
          No current baseline set. Analysis will show target reach likelihood, not improvement from today
        </p>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${typography.panelMeta} border border-option/30 text-text-body bg-transparent`}>
            Framing
          </span>
          <button
            type="button"
            onClick={openInput}
            className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
            data-testid="goal-baseline-set-cta"
          >
            Set current value
          </button>
        </div>
      </div>
    </div>
  )
}

export default GoalBaselineInput
