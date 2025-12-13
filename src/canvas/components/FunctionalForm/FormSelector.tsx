/**
 * FormSelector - Expert mode manual form selection
 *
 * Brief 11.6: Advanced dropdown or radio selector for power users
 * Shows all available forms with plain language names and descriptions.
 */

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { typography } from '../../../styles/typography'
import {
  FORM_DISPLAY_NAMES,
  EdgeFunctionTypeEnum,
  type EdgeFunctionType,
} from '../../domain/edges'
import type { FormSelectorProps } from './types'

/** All available function types */
const FORM_OPTIONS = EdgeFunctionTypeEnum.options

/**
 * FormCurvePreview - Small SVG preview of the form curve
 */
const FormCurvePreview = memo(function FormCurvePreview({
  form,
  size = 24,
}: {
  form: EdgeFunctionType
  size?: number
}) {
  const pathMap: Record<EdgeFunctionType, string> = {
    linear: 'M 0 24 L 24 0',
    diminishing_returns: 'M 0 24 Q 12 0 24 0',
    threshold: 'M 0 24 L 12 24 L 12 0 L 24 0',
    s_curve: 'M 0 24 Q 6 24 12 12 Q 18 0 24 0',
    noisy_or: 'M 0 24 Q 8 16 12 8 Q 16 4 24 0',
    noisy_and_not: 'M 0 4 Q 8 8 12 16 Q 16 20 24 24', // Decreasing curve (base → blocked)
    logistic: 'M 0 22 Q 8 20 12 12 Q 16 4 24 2',
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="text-current"
      aria-hidden="true"
    >
      <path
        d={pathMap[form] || pathMap.linear}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
})

/**
 * FormOption - Single option in the selector
 */
interface FormOptionProps {
  form: EdgeFunctionType
  selected: boolean
  onSelect: () => void
  showDescription?: boolean
}

const FormOption = memo(function FormOption({
  form,
  selected,
  onSelect,
  showDescription = true,
}: FormOptionProps) {
  const info = FORM_DISPLAY_NAMES[form]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors
        ${selected
          ? 'bg-teal-100 border border-teal-300'
          : 'hover:bg-sand-100 border border-transparent'
        }
      `}
      role="option"
      aria-selected={selected}
      data-testid={`form-option-${form}`}
    >
      {/* Curve preview */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded flex items-center justify-center
          ${selected ? 'bg-teal-200 text-teal-700' : 'bg-sand-200 text-sand-600'}
        `}
      >
        <FormCurvePreview form={form} size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`
              ${typography.body} font-medium
              ${selected ? 'text-teal-800' : 'text-ink-700'}
            `}
          >
            {info?.name || form}
          </span>
          {info?.icon && (
            <span className="text-sm font-mono text-ink-400" aria-hidden="true">
              {info.icon}
            </span>
          )}
          {selected && (
            <Check className="w-4 h-4 text-teal-600 ml-auto" aria-hidden="true" />
          )}
        </div>
        {showDescription && info?.shortDescription && (
          <p
            className={`
              ${typography.caption} mt-0.5
              ${selected ? 'text-teal-700' : 'text-ink-500'}
            `}
          >
            {info.shortDescription}
          </p>
        )}
      </div>
    </button>
  )
})

/**
 * FormSelector - Dropdown or radio-button form selector
 */
export const FormSelector = memo(function FormSelector({
  value,
  onChange,
  variant = 'dropdown',
  disabled = false,
  label,
  showDescriptions = true,
}: FormSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedInfo = FORM_DISPLAY_NAMES[value]

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close dropdown on escape
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSelect = useCallback(
    (form: EdgeFunctionType) => {
      onChange(form)
      setOpen(false)
    },
    [onChange]
  )

  // Radio button variant
  if (variant === 'radio') {
    return (
      <div
        data-testid="form-selector-radio"
        role="radiogroup"
        aria-label={label || 'Select relationship form'}
        className="space-y-1"
      >
        {label && (
          <p className={`${typography.caption} font-medium text-ink-600 mb-2`}>
            {label}
          </p>
        )}
        {FORM_OPTIONS.map((form) => (
          <FormOption
            key={form}
            form={form}
            selected={value === form}
            onSelect={() => handleSelect(form)}
            showDescription={showDescriptions}
          />
        ))}
      </div>
    )
  }

  // Dropdown variant (default)
  return (
    <div ref={containerRef} className="relative" data-testid="form-selector-dropdown">
      {label && (
        <label className={`${typography.caption} font-medium text-ink-600 block mb-1.5`}>
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left
          ${disabled
            ? 'bg-sand-100 border-sand-200 text-ink-400 cursor-not-allowed'
            : 'bg-white border-sand-300 hover:border-sand-400 text-ink-700'
          }
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="w-6 h-6 rounded bg-sand-100 flex items-center justify-center text-sand-600">
          <FormCurvePreview form={value} size={16} />
        </div>
        <span className={`${typography.body} flex-1`}>
          {selectedInfo?.name || value}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-sand-200 shadow-lg max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Select relationship form"
        >
          <div className="p-1">
            {FORM_OPTIONS.map((form) => (
              <FormOption
                key={form}
                form={form}
                selected={value === form}
                onSelect={() => handleSelect(form)}
                showDescription={showDescriptions}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default FormSelector
