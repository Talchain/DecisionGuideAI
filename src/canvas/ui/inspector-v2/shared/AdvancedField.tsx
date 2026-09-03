/**
 * AdvancedField — single field row for the technical detail editor.
 * Two-column layout: label left (panelMeta, text-text-light), input right.
 * Supports number, text, select, textarea, and readonly types.
 * Validation on blur for number fields.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { typography } from '../../../../styles/typography'

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
   */
  const validate = useCallback((raw: string): string | null => {
    if (type !== 'number') return null
    const num = parseFloat(raw)
    if (!Number.isFinite(num)) return 'Must be a finite number'
    if (min != null && num < min) return `Min: ${min}`
    if (max != null && num > max) return `Max: ${max}`
    return null
  }, [type, min, max])

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
      const err = validate(localValue)
      if (err) {
        setError(err)
        return
      }
      // ⚠ MOVES IN STEP WITH `validate` ABOVE, AND MUST. This is the same
      // question asked a second time; leaving it on `isNaN` would make the
      // commit guard and the validator disagree about what a number is — one
      // name, two predicates, which is the defect one level up.
      const num = parseFloat(localValue)
      if (Number.isFinite(num)) onChange(num)
    } else {
      onChange(localValue)
    }
  }, [type, localValue, onChange, validate])

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
        <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
      </div>

      {/* Input — full width */}
      <div>
        {type === 'select' ? (
          <select
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
        {error ? (
          <p className={`${typography.panelMeta} text-danger mt-0.5`}>{error}</p>
        ) : helperText ? (
          <p className={`${typography.panelMeta} text-text-light mt-0.5`}>{helperText}</p>
        ) : null}
      </div>
    </div>
  )
}
