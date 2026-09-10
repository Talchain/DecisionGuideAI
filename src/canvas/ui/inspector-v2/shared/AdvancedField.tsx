/**
 * AdvancedField — single field row for the technical detail editor.
 * Two-column layout: label left (panelMeta, text-text-light), input right.
 * Supports number, text, select, textarea, and readonly types.
 * Validation on blur for number fields.
 */

import { useState, useCallback, useMemo, useRef, useEffect, useId } from 'react'
import { typography } from '../../../../styles/typography'
import { admitNumericField } from './numericFieldAdmission'

type FieldType = 'number' | 'text' | 'select' | 'readonly' | 'textarea'

interface SelectOption {
  value: string
  label: string
}

interface AdvancedFieldProps {
  label: string
  value: string | number | undefined
  onChange?: (value: string | number) => void
  type?: FieldType
  min?: number
  max?: number
  step?: number
  placeholder?: string
  helperText?: string
  options?: SelectOption[]
  disabled?: boolean
}

export function AdvancedField({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  placeholder,
  helperText,
  options,
  disabled = false,
}: AdvancedFieldProps) {
  const [localValue, setLocalValue] = useState(String(value ?? ''))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)
  /**
   * ⚠⚠ THE LABEL WAS A BARE `<span>`. No `htmlFor`, no `aria-label`, no
   * association of any kind — so EVERY advanced field in the inspector was an
   * unlabelled control to a screen reader, announced as nothing but its value.
   * There are 14 of them on the controllable-factor pane alone.
   *
   * It was found by accident: a spec tried `getByLabelText(/Normalised value/i)`
   * and could not reach a single field. Testing-library asks the accessibility
   * tree the same question a screen reader does, which is exactly why it could
   * not find what was plainly on screen — the text was there, the LABEL was not.
   */
  const reactId = useId()
  const fieldId = `advanced-field-${reactId}`
  const messageId = `${fieldId}-message`

  // Sync local state when prop changes externally
  useEffect(() => {
    setLocalValue(String(value ?? ''))
  }, [value])

  /**
   * ⭐⭐ `isNaN` IS NOT "IS THIS A USABLE NUMBER" — AND THE GAP WAS DRIVEN, NOT
   * REASONED ABOUT.
   *
   * ⚠ REFUTED BY EXECUTION (independent review, 3 Sep 2026). A sibling change
   * asserted this field "rejects a non-parsing input", and used that to argue a
   * non-finite goal target was unreachable. Driven with discriminating controls
   * — `42` commits, `abc` is refused — **`Infinity`, `-Infinity`, `1e400` and
   * `9e999` ALL COMMITTED.** `parseFloat` returns `±Infinity` for every one of
   * them, `isNaN(Infinity)` is `false`, and the input is `type="text"` on both
   * branches below, so there is no browser sanitisation behind this either.
   * `9e999` is a fat-finger, not an adversarial input.
   *
   * What committed then flowed into `goal_threshold_raw` through
   * `useInspectorMutations.setThreshold`, an unguarded passthrough — so this
   * one predicate is the reachable source of every non-finite magnitude in the
   * model. `Number.isFinite` is the question actually being asked, and it is
   * sign-symmetric where `isNaN` is not.
   *
   * ⚠ THE MESSAGE CHANGES WITH THE PREDICATE, DELIBERATELY. `Infinity` IS a
   * number, so "Must be a number" would now be refusing a value while denying
   * the reason — the class of copy defect this estate keeps paying for.
   *
   * ⚠ SCOPE. `parseFloat` also PREFIX-parses (`'11abc'` → `11`), which is a
   * separate question about every numeric advanced field and is deliberately
   * NOT changed here. Rowed, not folded in.
   *
   * ⭐ THE PREDICATE ITSELF NOW LIVES IN `numericFieldAdmission`, UNCHANGED —
   * same order (finite → min → max), same messages. It moved because the
   * inspector's OTHER numeric editor, `InlineNumberEditor`, declared `min`/
   * `max` and enforced neither, so the two shared editors in this directory
   * were answering one question two ways. `AdvancedField.finiteGuard.spec.tsx`
   * is what pins this call as behaviour-preserving.
   *
   * ⭐⭐ AND THE LOCAL `validate` WRAPPER IS GONE, WHICH IS THE POINT RATHER
   * THAN TIDYING. Its own note said the commit guard "MOVES IN STEP WITH
   * `validate`, AND MUST" — an obligation on whoever edits next, i.e. exactly
   * the hand-maintained mirror this estate keeps paying for. `handleBlur` now
   * asks ONCE and commits the value that same answer carries, so there is no
   * second parse left to drift out of step.
   */
  const bounds = useMemo(
    () => ({ ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) }),
    [min, max],
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const raw = e.target.value
    setLocalValue(raw)
    setError(null)

    // For selects, commit immediately
    if (type === 'select' && onChange) {
      onChange(raw)
    }
  }, [type, onChange])

  const handleBlur = useCallback(() => {
    if (type === 'readonly' || !onChange) return

    if (type === 'number') {
      // ⚠ ONE CALL, ONE ANSWER — the strongest form of the note this replaced.
      // It said the commit guard "MOVES IN STEP WITH `validate`, AND MUST",
      // because leaving one on `isNaN` would make the two disagree about what a
      // number is. Asking ONCE and using the value it returns removes the
      // possibility rather than restating the obligation: there is no second
      // parse to drift.
      const admission = admitNumericField(localValue, bounds)
      if (!admission.ok) {
        setError(admission.reason)
        return
      }
      onChange(admission.value)
    } else {
      onChange(localValue)
    }
  }, [type, localValue, onChange, bounds])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      (e.target as HTMLElement).blur()
    }
  }, [type])

  const rangePlaceholder = type === 'number' && min != null && max != null
    ? placeholder ?? `[${min}, ${max}]`
    : placeholder

  const inputClasses = `w-full h-8 px-2 rounded text-right tabular-nums bg-transparent
    ${typography.panelMeta}
    ${error ? 'border border-danger' : 'border border-panel-border'}
    focus:border-primary focus:outline-none
    transition-colors`

  // Readonly fields use inline two-column layout; editable fields use vertical stack
  if (type === 'readonly') {
    return (
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
        <span className={`${typography.panelMeta} text-text-light tabular-nums`}>{String(value ?? '—')}</span>
      </div>
    )
  }

  return (
    <div>
      {/* Label */}
      <div className="mb-1">
        <label htmlFor={fieldId} className={`${typography.panelMeta} text-text-light`}>{label}</label>
      </div>

      {/* Input — full width */}
      <div>
        {type === 'select' ? (
          <select
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={localValue}
            onChange={handleChange}
            disabled={disabled}
            className={`${inputClasses} cursor-pointer`}
          >
            {options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={3}
            className={`w-full px-2 py-1 rounded bg-transparent ${typography.panelMeta}
              ${error ? 'border border-danger' : 'border border-panel-border'}
              focus:border-primary focus:outline-none transition-colors resize-none`}
          />
        ) : (
          <input
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === 'number' ? 'text' : 'text'}
            inputMode={type === 'number' ? 'decimal' : 'text'}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={rangePlaceholder}
            step={step}
            className={inputClasses}
          />
        )}
        {/* Error / helper text */}
        {/* ⚠ The message is ANNOUNCED, not merely displayed. Without the
            `aria-describedby` above, a refusal ("Must be a finite number") is
            visible to a sighted user and silent to everyone else — the control
            simply refuses the value and never says why. `role="alert"` is
            deliberately NOT used: it would interrupt on every keystroke that
            fails to parse. */}
        {error ? (
          <p id={messageId} className={`${typography.panelMeta} text-danger mt-0.5`}>{error}</p>
        ) : helperText ? (
          <p id={messageId} className={`${typography.panelMeta} text-text-light mt-0.5`}>{helperText}</p>
        ) : null}
      </div>
    </div>
  )
}
