/**
 * UtilityWeightPanel - Configure utility weights for advanced ranking mode
 *
 * Features:
 * - Weight sliders for each outcome node (sum normalized to 100%)
 * - "Suggest weights" button calls PLoT /v1/suggest/utility-weights
 * - SuggestionCard integration for AI suggestions
 * - Alternative weighting presets as clickable chips
 * - Normalization warning when weights don't sum to 100%
 */

import { useState, useMemo } from 'react'
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  Loader2,
  Scale,
} from 'lucide-react'
import { useUtilityWeights } from '../hooks/useUtilityWeights'
import { SuggestionCard } from './SuggestionCard'
import { typography } from '../../styles/typography'
import type { WeightingPreset } from '../../adapters/plot/types'

interface OutcomeNode {
  id: string
  label: string
}

interface UtilityWeightPanelProps {
  /** Outcome nodes to weight */
  outcomeNodes: OutcomeNode[]
  /** Graph context for AI suggestions */
  graph?: {
    nodes: Array<{ id: string; type?: string; label?: string }>
    edges: Array<{ source: string; target: string }>
  }
  /** Optional user goal for context */
  userGoal?: string
  /** Optional scenario name */
  scenarioName?: string
  /** Initial weights (if previously set) */
  initialWeights?: Record<string, number>
  /** Called when weights change */
  onWeightsChange?: (weights: Record<string, number>) => void
  /** Whether panel is disabled */
  disabled?: boolean
}

export function UtilityWeightPanel({
  outcomeNodes,
  graph,
  userGoal,
  scenarioName,
  initialWeights,
  onWeightsChange,
  disabled = false,
}: UtilityWeightPanelProps) {
  const {
    weights,
    loading,
    error,
    suggestion,
    alternatives,
    isNormalized,
    totalWeight,
    suggestWeights,
    updateWeight,
    applySuggestions,
    applyPreset,
    normalizeWeights,
    resetToEqual,
  } = useUtilityWeights({
    outcomeNodes,
    graph,
    userGoal,
    scenarioName,
    initialWeights,
    onWeightsChange,
  })

  const [showSuggestion, setShowSuggestion] = useState(false)

  // Format weight as percentage
  const formatPercent = (value: number) => `${Math.round(value * 100)}%`

  // Handle suggestion accept
  const handleAcceptSuggestion = () => {
    applySuggestions()
    setShowSuggestion(false)
  }

  // Handle suggestion override (just close and keep manual editing)
  const handleOverrideSuggestion = () => {
    setShowSuggestion(false)
  }

  // Preset icon mapping
  const getPresetIcon = (preset: WeightingPreset): string => {
    if (preset.icon) return preset.icon
    // Default icons based on common preset names
    const labelLower = preset.label.toLowerCase()
    if (labelLower.includes('growth')) return '📈'
    if (labelLower.includes('balance')) return '⚖️'
    if (labelLower.includes('conserv')) return '🛡️'
    if (labelLower.includes('profit')) return '💰'
    if (labelLower.includes('sustain')) return '🌱'
    return '🎯'
  }

  if (outcomeNodes.length === 0) {
    return (
      <div className="p-4 bg-sand-50 rounded-lg border border-sand-200">
        <p className={`${typography.caption} text-ink-500 text-center`}>
          No outcome nodes available. Add outcome nodes to configure weights.
        </p>
      </div>
    )
  }

  return (
    <div
      className="space-y-4"
      data-testid="utility-weight-panel"
      role="region"
      aria-label="Utility weight configuration"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.label} text-ink-800`}>
            Outcome Weights
          </span>
        </div>
        <button
          type="button"
          onClick={suggestWeights}
          disabled={disabled || loading || !graph}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${disabled || loading || !graph
              ? 'bg-sand-100 text-sand-400 cursor-not-allowed'
              : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            }`}
          aria-label="Get AI-suggested weights"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {loading ? 'Suggesting...' : 'Suggest weights'}
        </button>
      </div>

      {/* Normalization warning */}
      {!isNormalized && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-banana-50 border border-banana-200"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 text-banana-600 flex-shrink-0" aria-hidden="true" />
          <span className={`${typography.caption} text-banana-800 flex-1`}>
            Weights sum to {formatPercent(totalWeight)} (should be 100%)
          </span>
          <button
            type="button"
            onClick={normalizeWeights}
            disabled={disabled}
            className="text-xs font-medium text-banana-700 hover:text-banana-900 underline"
          >
            Normalize
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-carrot-50 border border-carrot-200">
          <AlertTriangle className="h-4 w-4 text-carrot-600 flex-shrink-0" aria-hidden="true" />
          <span className={`${typography.caption} text-carrot-800`}>{error}</span>
        </div>
      )}

      {/* AI Suggestion Card */}
      {suggestion && showSuggestion && (
        <SuggestionCard
          suggestion={{
            suggested_value: suggestion.suggestions,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            provenance: 'cee',
          }}
          label="Weight Distribution"
          formatValue={() => suggestion.suggestions.map(s => `${s.label}: ${formatPercent(s.suggested_weight)}`).join(', ')}
          onAccept={handleAcceptSuggestion}
          onOverride={handleOverrideSuggestion}
        />
      )}

      {/* Show suggestion prompt when we have a new suggestion */}
      {suggestion && !showSuggestion && (
        <button
          type="button"
          onClick={() => setShowSuggestion(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className={typography.caption}>
            View AI-suggested weights ({suggestion.confidence} confidence)
          </span>
        </button>
      )}

      {/* Weight sliders */}
      <div className="space-y-3">
        {weights.map(entry => (
          <div key={entry.node_id} className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`weight-${entry.node_id}`}
                className={`${typography.caption} text-ink-700 truncate max-w-[60%]`}
                title={entry.label}
              >
                {entry.label}
              </label>
              <span className={`${typography.caption} font-medium text-ink-800 tabular-nums`}>
                {formatPercent(entry.weight)}
              </span>
            </div>
            <input
              id={`weight-${entry.node_id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={entry.weight}
              onChange={(e) => updateWeight(entry.node_id, parseFloat(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-sand-200 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-sky-500
                [&::-webkit-slider-thumb]:cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`${entry.label} weight`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(entry.weight * 100)}
              aria-valuetext={formatPercent(entry.weight)}
            />
            {entry.reasoning && (
              <p className={`${typography.caption} text-ink-400 italic`}>
                {entry.reasoning}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Alternative presets */}
      {alternatives.length > 0 && (
        <div className="space-y-2">
          <span className={`${typography.caption} text-ink-500`}>
            Quick presets:
          </span>
          <div className="flex flex-wrap gap-2">
            {alternatives.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors
                  ${disabled
                    ? 'bg-sand-50 text-sand-400 border-sand-200 cursor-not-allowed'
                    : 'bg-white text-ink-700 border-sand-300 hover:bg-sand-50 hover:border-sand-400'
                  }`}
                title={preset.description}
              >
                <span>{getPresetIcon(preset)}</span>
                <span className={typography.caption}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-sand-100">
        <button
          type="button"
          onClick={resetToEqual}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
            ${disabled
              ? 'bg-sand-100 text-sand-400 cursor-not-allowed'
              : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
            }`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Equal split
        </button>
        {!isNormalized && (
          <button
            type="button"
            onClick={normalizeWeights}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${disabled
                ? 'bg-sand-100 text-sand-400 cursor-not-allowed'
                : 'bg-mint-100 text-mint-700 hover:bg-mint-200'
              }`}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Normalize to 100%
          </button>
        )}
      </div>

      {/* Total indicator */}
      <div
        className={`px-3 py-2 rounded-lg text-center ${
          isNormalized
            ? 'bg-mint-50 border border-mint-200'
            : 'bg-banana-50 border border-banana-200'
        }`}
      >
        <span className={`${typography.caption} ${isNormalized ? 'text-mint-700' : 'text-banana-700'}`}>
          Total: {formatPercent(totalWeight)}
          {isNormalized && ' ✓'}
        </span>
      </div>
    </div>
  )
}
