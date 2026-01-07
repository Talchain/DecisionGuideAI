/**
 * ThresholdInput Component
 *
 * Optional success threshold input for probability_of_goal calculation.
 * Allows users to define what "success" means numerically.
 *
 * Field specification:
 * - Label: "Success threshold (optional)"
 * - Help text: "Define what success looks like in numbers"
 * - Type: Number input
 * - Optional: User can leave blank
 */

import { useState, useEffect, useCallback } from 'react'
import { Target, HelpCircle } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ThresholdInputProps {
  /** Current threshold value (null if not set) */
  value: number | null
  /** Callback when threshold changes */
  onChange: (value: number | null) => void
  /** Optional unit label from goal node (e.g., "$", "%", "units") */
  unit?: string
  /** Compact display mode */
  compact?: boolean
}

export function ThresholdInput({
  value,
  onChange,
  unit,
  compact = false,
}: ThresholdInputProps) {
  // Local state for controlled input (allows empty string while typing)
  const [inputValue, setInputValue] = useState(value?.toString() ?? '')

  // Sync local state when prop changes
  useEffect(() => {
    setInputValue(value?.toString() ?? '')
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value
      setInputValue(rawValue)

      // Parse and propagate to parent
      if (rawValue === '') {
        onChange(null)
      } else {
        const parsed = parseFloat(rawValue)
        if (!isNaN(parsed)) {
          onChange(parsed)
        }
      }
    },
    [onChange]
  )

  const handleBlur = useCallback(() => {
    // On blur, clean up the display value
    if (inputValue === '' || inputValue === '-') {
      setInputValue('')
      onChange(null)
    } else {
      const parsed = parseFloat(inputValue)
      if (!isNaN(parsed)) {
        setInputValue(parsed.toString())
      }
    }
  }, [inputValue, onChange])

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="threshold-input-compact">
        <Target className="h-4 w-4 text-ink-400 flex-shrink-0" aria-hidden="true" />
        <input
          type="number"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Threshold..."
          className="w-24 text-sm border border-sand-200 rounded px-2 py-1 bg-white placeholder:text-ink-400"
          aria-label="Success threshold"
        />
        {unit && <span className="text-sm text-ink-500">{unit}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="threshold-input">
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="goal-threshold"
          className={`${typography.caption} font-medium text-ink-700`}
        >
          Success threshold
        </label>
        <span className={`${typography.caption} text-ink-400`}>(optional)</span>
        <div className="group relative">
          <HelpCircle
            className="h-3.5 w-3.5 text-ink-400 cursor-help"
            aria-hidden="true"
          />
          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-10">
            <div className="px-2 py-1 bg-ink-800 text-white text-xs rounded shadow-lg whitespace-nowrap">
              Define what success looks like in numbers
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="goal-threshold"
          type="number"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., 100000"
          className="flex-1 px-3 py-2 border border-sand-200 rounded-lg bg-white text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          aria-describedby="threshold-help"
        />
        {unit && (
          <span className={`${typography.bodySmall} text-ink-600 min-w-[3rem]`}>
            {unit}
          </span>
        )}
      </div>
      <p id="threshold-help" className={`${typography.caption} text-ink-500`}>
        When set, shows probability of reaching this target for each option.
      </p>
    </div>
  )
}
