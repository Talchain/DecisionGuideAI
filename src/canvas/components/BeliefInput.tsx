/**
 * BeliefInput - Dual-mode belief input (slider + natural language)
 *
 * Features:
 * - Slider mode: Direct numeric input with visual feedback
 * - Natural language mode: Text input parsed by CEE /v1/elicit/belief
 * - Shows SuggestionCard for AI-parsed values
 * - Handles needs_clarification with clickable options
 * - Accept applies value, Override opens slider
 * - Accessible (keyboard, screen reader)
 *
 * Used in node/edge editing panels for belief/confidence values.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  MessageSquare,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { httpV1Adapter } from '../../adapters/plot/httpV1Adapter'
import type { BeliefElicitResponse } from '../../adapters/plot/types'
import { SuggestionCard } from './SuggestionCard'
import { typography } from '../../styles/typography'

interface BeliefInputProps {
  /** Current value (0-1 for probability, or raw value) */
  value: number
  /** Called when value changes */
  onChange: (value: number) => void
  /** Label for the input (e.g., "Confidence", "Probability") */
  label: string
  /** Optional: context about the factor being estimated */
  factorContext?: {
    label: string
    node_id?: string
  }
  /** Optional: scenario context for better interpretation */
  scenarioName?: string
  /** Min value (default: 0) */
  min?: number
  /** Max value (default: 1) */
  max?: number
  /** Step increment (default: 0.01) */
  step?: number
  /** Format value for display (default: percentage) */
  formatValue?: (value: number) => string
  /** Disabled state */
  disabled?: boolean
  /** Placeholder for natural language input */
  placeholder?: string
}

type InputMode = 'slider' | 'natural-language'

export function BeliefInput({
  value,
  onChange,
  label,
  factorContext,
  scenarioName,
  min = 0,
  max = 1,
  step = 0.01,
  formatValue = (v) => `${(v * 100).toFixed(0)}%`,
  disabled = false,
  placeholder = "Type your estimate (e.g., 'around 60-70%')",
}: BeliefInputProps) {
  const [mode, setMode] = useState<InputMode>('slider')
  const [nlText, setNlText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<BeliefElicitResponse | null>(null)
  const [isOverriding, setIsOverriding] = useState(false)

  const textInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Focus text input when switching to natural language mode
  useEffect(() => {
    if (mode === 'natural-language' && textInputRef.current) {
      textInputRef.current.focus()
    }
  }, [mode])

  // Clear suggestion when switching modes
  useEffect(() => {
    if (mode === 'slider') {
      setSuggestion(null)
      setNlText('')
      setError(null)
      setIsOverriding(false)
    }
  }, [mode])

  // Elicit belief from natural language
  const elicitBelief = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < 3) {
      setSuggestion(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await httpV1Adapter.elicitBelief({
        text: text.trim(),
        factor_context: factorContext,
        scenario_name: scenarioName,
      })

      setSuggestion(response)
    } catch (err: any) {
      const errorMessage = err?.error || err?.message || 'Failed to parse input'
      setError(errorMessage)
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }, [factorContext, scenarioName])

  // Debounced elicitation on text change
  const handleTextChange = useCallback((text: string) => {
    setNlText(text)
    setError(null)

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce API call (500ms after typing stops)
    debounceRef.current = setTimeout(() => {
      elicitBelief(text)
    }, 500)
  }, [elicitBelief])

  // Handle accepting suggestion
  const handleAccept = useCallback((suggestedValue: number) => {
    // Clamp to min/max
    const clampedValue = Math.min(max, Math.max(min, suggestedValue))
    onChange(clampedValue)
    setSuggestion(null)
    setNlText('')
    setMode('slider') // Return to slider after accepting
  }, [onChange, min, max])

  // Handle override (switch to slider mode)
  const handleOverride = useCallback(() => {
    setIsOverriding(true)
    // Keep suggestion visible but enable slider editing
  }, [])

  // Handle selecting clarification option
  const handleSelectOption = useCallback((optionValue: number) => {
    const clampedValue = Math.min(max, Math.max(min, optionValue))
    onChange(clampedValue)
    setSuggestion(null)
    setNlText('')
    setMode('slider')
  }, [onChange, min, max])

  // Handle slider change
  const handleSliderChange = useCallback((newValue: number) => {
    onChange(newValue)
    if (isOverriding) {
      setSuggestion(null)
      setIsOverriding(false)
    }
  }, [onChange, isOverriding])

  return (
    <div className="space-y-3" data-testid="belief-input">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className={`${typography.label} text-ink-700`}>{label}</span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setMode('slider')}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${
              mode === 'slider'
                ? 'bg-sky-100 text-sky-700'
                : 'text-ink-400 hover:text-ink-600 hover:bg-sand-100'
            }`}
            aria-label="Switch to slider mode"
            aria-pressed={mode === 'slider'}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMode('natural-language')}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${
              mode === 'natural-language'
                ? 'bg-sky-100 text-sky-700'
                : 'text-ink-400 hover:text-ink-600 hover:bg-sand-100'
            }`}
            aria-label="Switch to natural language mode"
            aria-pressed={mode === 'natural-language'}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Slider mode */}
      {(mode === 'slider' || isOverriding) && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
              disabled={disabled}
              className="flex-1 h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-sky-500
                [&::-webkit-slider-thumb]:cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`${label} slider`}
            />
            <span className={`${typography.body} text-ink-800 font-medium min-w-[4rem] text-right`}>
              {formatValue(value)}
            </span>
          </div>
          {/* Scale labels */}
          <div className="flex justify-between px-1">
            <span className={`${typography.caption} text-ink-400`}>{formatValue(min)}</span>
            <span className={`${typography.caption} text-ink-400`}>{formatValue(max)}</span>
          </div>
        </div>
      )}

      {/* Natural language mode */}
      {mode === 'natural-language' && !isOverriding && (
        <div className="space-y-3">
          {/* Text input */}
          <div className="relative">
            <input
              ref={textInputRef}
              type="text"
              value={nlText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled || loading}
              className={`w-full px-3 py-2 rounded-lg border transition-colors
                ${error ? 'border-carrot-300 focus:ring-carrot-500' : 'border-sand-300 focus:ring-sky-500'}
                focus:outline-none focus:ring-2 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed
                ${typography.body} text-ink-800 placeholder:text-ink-400`}
              aria-label={`${label} natural language input`}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 text-ink-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-carrot-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className={typography.caption}>{error}</span>
            </div>
          )}

          {/* Suggestion card */}
          {suggestion && (
            <SuggestionCard
              suggestion={{
                suggested_value: suggestion.suggested_value,
                confidence: suggestion.confidence,
                reasoning: suggestion.reasoning,
                provenance: suggestion.provenance,
                needs_clarification: suggestion.needs_clarification,
                clarifying_question: suggestion.clarifying_question,
                options: suggestion.options,
              }}
              label={label}
              formatValue={formatValue}
              onAccept={handleAccept}
              onOverride={handleOverride}
              onSelectOption={handleSelectOption}
              isOverriding={isOverriding}
            />
          )}

          {/* Current value indicator (when no suggestion) */}
          {!suggestion && !loading && nlText.trim().length === 0 && (
            <p className={`${typography.caption} text-ink-500`}>
              Current value: {formatValue(value)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
