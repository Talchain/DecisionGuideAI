/**
 * BeliefInput - Dual-mode belief input (slider + natural language)
 *
 * Features:
 * - Slider mode: Direct numeric input with visual feedback
 * - Natural language mode: text parsed by CEE's belief-elicitation engine
 * - Shows SuggestionCard for the parsed value
 * - Handles needs_clarification with clickable options
 * - Accept applies value, Override opens slider
 * - Accessible (keyboard, screen reader)
 *
 * Used in node/edge editing panels for belief/confidence values.
 *
 * ⭐ ROADMAP 2.364 — WIRED. What this file used to be: it called
 * `httpV1Adapter.elicitBelief(...)` and imported
 * `type { BeliefElicitResponse } from '../../adapters/plot/types'`. NEITHER
 * EVER EXISTED. `httpV1Adapter` is the PLoT adapter and its method manifest is
 * `run/templates/template/limits/health/validate/runBundle`; `git log -S
 * BeliefElicitResponse -- src/adapters/plot/types.ts` is empty over the file's
 * whole history. Both errors sat in the typecheck ratchet baseline
 * (`typecheck-baseline-identities.txt`, TS2339 + TS2305) rather than in
 * anyone's way, because the component has no render-tree import site — dead
 * code calling a phantom API. The engines were built in CEE, not PLoT.
 *
 * The request shape changed with the destination and had to: CEE's
 * `CEEElicitBeliefInput` is `.strict()` and wants
 * `{node_id, node_label, user_expression, target_type}` — the old
 * `{text, factor_context, scenario_name}` would have 400'd even once a method
 * existed. `factorContext` is therefore REQUIRED here now, with `node_id`
 * non-optional: CEE refuses an empty id, and a control that cannot name its
 * factor cannot elicit for it.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  MessageSquare,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useBeliefElicitation } from '../hooks/useBeliefElicitation'
import { SuggestionCard } from './SuggestionCard'
import { typography } from '../../styles/typography'

interface BeliefInputProps {
  /** Current value (0-1 for probability, or raw value) */
  value: number
  /** Called when value changes */
  onChange: (value: number) => void
  /** Label for the input (e.g., "Confidence", "Probability") */
  label: string
  /**
   * The factor this belief is about. REQUIRED — CEE's elicit input refuses an
   * empty `node_id`/`node_label`, and the id is what makes the suggestion
   * addressable to a factor rather than to whatever is on screen.
   */
  factorContext: {
    nodeId: string
    nodeLabel: string
  }
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
  min = 0,
  max = 1,
  step = 0.01,
  formatValue = (v) => `${(v * 100).toFixed(0)}%`,
  disabled = false,
  placeholder = "Type your estimate (e.g., 'around 60-70%')",
}: BeliefInputProps) {
  const [mode, setMode] = useState<InputMode>('slider')
  const [nlText, setNlText] = useState('')
  const [isOverriding, setIsOverriding] = useState(false)

  const [textInput, setTextInput] = useState<HTMLInputElement | null>(null)

  const { suggestion, loading, error, request, reset } = useBeliefElicitation({
    nodeId: factorContext.nodeId,
    nodeLabel: factorContext.nodeLabel,
  })

  // Focus text input when switching to natural language mode
  useEffect(() => {
    if (mode === 'natural-language' && textInput) {
      textInput.focus()
    }
  }, [mode, textInput])

  // Clear suggestion when switching modes
  useEffect(() => {
    if (mode === 'slider') {
      reset()
      setNlText('')
      setIsOverriding(false)
    }
  }, [mode, reset])

  // Debounced elicitation on text change
  const handleTextChange = useCallback((text: string) => {
    setNlText(text)
    request(text)
  }, [request])

  // Handle accepting suggestion
  const handleAccept = useCallback((suggestedValue: number) => {
    // Clamp to min/max
    const clampedValue = Math.min(max, Math.max(min, suggestedValue))
    onChange(clampedValue)
    reset()
    setNlText('')
    setMode('slider') // Return to slider after accepting
  }, [onChange, min, max, reset])

  // Handle override (switch to slider mode)
  const handleOverride = useCallback(() => {
    setIsOverriding(true)
    // Keep suggestion visible but enable slider editing
  }, [])

  // Handle selecting clarification option
  const handleSelectOption = useCallback((optionValue: number) => {
    const clampedValue = Math.min(max, Math.max(min, optionValue))
    onChange(clampedValue)
    reset()
    setNlText('')
    setMode('slider')
  }, [onChange, min, max, reset])

  // Handle slider change
  const handleSliderChange = useCallback((newValue: number) => {
    onChange(newValue)
    if (isOverriding) {
      reset()
      setIsOverriding(false)
    }
  }, [onChange, isOverriding, reset])

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
              ref={setTextInput}
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
