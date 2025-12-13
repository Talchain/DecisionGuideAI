/**
 * SliderWithLabel - Consistent slider UI for weights, thresholds, and parameters
 * Provides accessible slider with label, value display, and optional number input.
 */

import { memo, useCallback, useRef, useEffect } from 'react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

export interface SliderWithLabelProps {
  /** Unique ID for accessibility */
  id: string
  /** Label text */
  label: string
  /** Current value */
  value: number
  /** Called when value changes */
  onChange: (value: number) => void
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step size */
  step?: number
  /** Format value for display */
  formatValue?: (value: number) => string
  /** Tooltip content for label */
  tooltip?: string
  /** Show number input alongside slider */
  showInput?: boolean
  /** Debounce delay in ms (0 for immediate) */
  debounceMs?: number
  /** Optional: Disabled state */
  disabled?: boolean
  /** Optional: Additional className */
  className?: string
}

const defaultFormat = (v: number) => v.toFixed(2)

export const SliderWithLabel = memo(function SliderWithLabel({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  formatValue = defaultFormat,
  tooltip,
  showInput = false,
  debounceMs = 0,
  disabled = false,
  className = '',
}: SliderWithLabelProps) {
  const timerRef = useRef<NodeJS.Timeout>()

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleChange = useCallback(
    (newValue: number) => {
      const clamped = Math.max(min, Math.min(max, newValue))

      if (debounceMs > 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
        timerRef.current = setTimeout(() => {
          onChange(clamped)
        }, debounceMs)
      } else {
        onChange(clamped)
      }
    },
    [onChange, min, max, debounceMs]
  )

  const labelElement = (
    <label
      htmlFor={id}
      className={`block ${typography.label} text-ink-700 mb-1`}
    >
      {label}
    </label>
  )

  return (
    <div className={className}>
      {tooltip ? (
        <Tooltip content={tooltip} position="right">
          {labelElement}
        </Tooltip>
      ) : (
        labelElement
      )}

      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={`
            flex-1 h-2 rounded-lg appearance-none cursor-pointer
            bg-sand-200
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-sky-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-colors
            [&::-webkit-slider-thumb]:hover:bg-sky-600
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-sky-500
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue(value)}
        />

        {showInput ? (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => handleChange(parseFloat(e.target.value) || min)}
            disabled={disabled}
            className={`
              w-16 px-2 py-1 text-xs text-right tabular-nums
              border border-sand-200 rounded-lg
              focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={`${label} value`}
          />
        ) : (
          <span
            className={`
              w-12 text-right tabular-nums
              ${typography.label} text-ink-600
            `}
          >
            {formatValue(value)}
          </span>
        )}
      </div>
    </div>
  )
})
