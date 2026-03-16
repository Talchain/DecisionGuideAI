/**
 * SignedStrengthSlider — bidirectional slider for edge effect strength
 *
 * B.I.6: Range -1 to +1, step 0.01
 * Writes: weight = Math.abs(value), direction = value >= 0 ? 'positive' : 'negative'
 * Adapter's computeSignedMean() reconstructs signed strength from weight + direction.
 *
 * Track fill: var(--success) for positive, var(--danger) for negative
 * Endpoints: "Hurts" (left), "Helps" (right), "Neutral" at centre
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import { getEffectSizeCoaching } from './coachingText'

interface SignedStrengthSliderProps {
  /** Current signed value (-1 to +1) */
  value: number
  /** Callback with new signed value, debounced internally */
  onChange: (signedValue: number) => void
  /** Debounce delay in ms (default 120) */
  debounceMs?: number
  /** Disabled state */
  disabled?: boolean
  /** C1: Standard deviation for uncertainty band overlay */
  std?: number
}

export function SignedStrengthSlider({
  value,
  onChange,
  debounceMs = 120,
  disabled = false,
  std,
}: SignedStrengthSliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync local state when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setLocalValue(newValue)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(newValue)
    }, debounceMs)
  }, [onChange, debounceMs])

  const isNegative = localValue < 0
  const absValue = Math.abs(localValue)
  const displayColor = isNegative ? 'text-danger' : localValue > 0 ? 'text-success' : 'text-text-light'
  const directionLabel = isNegative ? 'Hurts' : localValue > 0 ? 'Helps' : 'Neutral'

  // D.2: Effect size coaching nudge from local state for instant feedback
  const effectCoaching = getEffectSizeCoaching(absValue)

  // Calculate fill gradient position (centre-out)
  const fillPercent = absValue * 50 // 0-50% from centre
  const fillLeft = isNegative ? `${50 - fillPercent}%` : '50%'
  const fillWidth = `${fillPercent}%`
  const fillColor = isNegative ? 'var(--danger)' : 'var(--success)'

  return (
    <div>
      {/* Endpoint labels */}
      <div className="flex items-center justify-between mb-1">
        <span className={`${typography.panelMeta} text-danger`}>Hurts</span>
        <span className={`${typography.panelMeta} text-text-light`}>Neutral</span>
        <span className={`${typography.panelMeta} text-success`}>Helps</span>
      </div>

      {/* Slider with custom track fill */}
      <div className="relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 h-1.5 bg-panel-border rounded-full" />
        {/* C1: Uncertainty band — shows +/- std around current value */}
        {std != null && std > 0 && (() => {
          const bandLow = Math.max(-1, localValue - std)
          const bandHigh = Math.min(1, localValue + std)
          // Map from [-1, 1] to [0%, 100%]
          const bandLeftPct = ((bandLow + 1) / 2) * 100
          const bandWidthPct = ((bandHigh - bandLow) / 2) * 100
          return (
            <div
              className="absolute h-3 rounded-full bg-info/20"
              style={{
                left: `${bandLeftPct}%`,
                width: `${bandWidthPct}%`,
              }}
              aria-hidden="true"
              data-testid="uncertainty-band"
            />
          )
        })()}
        {/* Centre marker */}
        <div className="absolute left-1/2 -translate-x-px w-0.5 h-3 bg-text-light rounded-full" />
        {/* Fill from centre */}
        <div
          className="absolute h-1.5 rounded-full transition-all duration-100"
          style={{
            left: fillLeft,
            width: fillWidth,
            backgroundColor: fillColor,
          }}
        />
        {/* Native range input */}
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          className="relative w-full h-6 appearance-none bg-transparent cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-text-light [&::-webkit-slider-thumb]:shadow-sm
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-text-light
            [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={localValue}
          aria-valuetext={`${directionLabel}: ${localValue.toFixed(2)}`}
          aria-label="Effect on target"
        />
      </div>

      {/* Value display */}
      <div className="flex items-center justify-between mt-1">
        <span className={`${typography.panelMeta} ${displayColor}`}>
          {directionLabel}
        </span>
        <span className={`${typography.panelBody} ${displayColor} tabular-nums`}>
          {localValue >= 0 ? '+' : ''}{localValue.toFixed(2)}
        </span>
      </div>

      {/* D.2: Effect size coaching nudge */}
      <p className={`${typography.panelMeta} ${effectCoaching.colorClass} mt-1`}>
        {effectCoaching.text}
      </p>
    </div>
  )
}
