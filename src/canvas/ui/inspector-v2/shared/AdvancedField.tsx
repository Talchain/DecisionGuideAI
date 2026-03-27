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

  const validate = useCallback((raw: string): string | null => {
    if (type !== 'number') return null
    const num = parseFloat(raw)
    if (isNaN(num)) return 'Must be a number'
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
      const num = parseFloat(localValue)
      if (!isNaN(num)) onChange(num)
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

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-2 min-h-[32px]">
      {/* Label */}
      <div className="flex items-center h-8">
        <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
      </div>

      {/* Input */}
      <div className="w-[140px]">
        {type === 'readonly' ? (
          <div className={`${typography.panelMeta} text-text-light h-8 flex items-center justify-end tabular-nums`}>
            {String(value ?? '—')}
          </div>
        ) : type === 'select' ? (
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
