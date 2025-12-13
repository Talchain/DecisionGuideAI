/**
 * EdgeFunctionTypeSelector - Select and configure edge function types
 * Integrates with CEE suggestions for AI-powered recommendations.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'
import { AcceptOverrideControl } from './AcceptOverrideControl'
import { ProvenanceBadge, type ProvenanceType } from './ProvenanceBadge'
import { SliderWithLabel } from './SliderWithLabel'
import { FunctionPreview, FUNCTION_TYPE_INFO, EDGE_FUNCTION_TYPES, type EdgeFunctionType, type FunctionParams } from './FunctionPreview'
import { useEdgeFunctionSuggestion } from '../hooks/useEdgeFunctionSuggestion'
import { EDGE_CONSTRAINTS } from '../domain/edges'

export interface EdgeFunctionTypeSelectorProps {
  /** Edge ID for fetching suggestions */
  edgeId: string
  /** Current function type */
  value: EdgeFunctionType
  /** Current function parameters */
  params?: FunctionParams
  /** Called when function type changes */
  onChange: (type: EdgeFunctionType, params?: FunctionParams) => void
  /** Current provenance of the function type */
  provenance?: string
  /** Called when provenance changes */
  onProvenanceChange?: (provenance: string) => void
}

export const EdgeFunctionTypeSelector = memo(function EdgeFunctionTypeSelector({
  edgeId,
  value,
  params,
  onChange,
  provenance,
  onProvenanceChange,
}: EdgeFunctionTypeSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showParams, setShowParams] = useState(value !== 'linear')
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // Fetch CEE suggestion for this edge
  const { suggestion, loading: suggestionLoading } = useEdgeFunctionSuggestion({
    edgeId,
    autoFetch: true,
  })

  // Determine if suggestion should be shown
  const showSuggestion = useMemo(() => {
    if (!suggestion || suggestionDismissed) return false
    if (provenance === 'accepted' || provenance === 'user-modified') return false
    // Don't show if current value matches suggestion
    if (value === suggestion.function_type) return false
    return true
  }, [suggestion, suggestionDismissed, provenance, value])

  // Handle accepting suggestion
  const handleAcceptSuggestion = useCallback((suggestedType: EdgeFunctionType) => {
    onChange(suggestedType, suggestion?.suggested_params)
    onProvenanceChange?.('accepted')
    setSuggestionDismissed(true)
  }, [onChange, suggestion, onProvenanceChange])

  // Handle override (just dismiss suggestion and show dropdown)
  const handleOverride = useCallback(() => {
    setSuggestionDismissed(true)
    setIsDropdownOpen(true)
  }, [])

  // Handle function type change
  const handleTypeChange = useCallback((type: EdgeFunctionType) => {
    const defaultParams: FunctionParams | undefined = type === 'linear' ? undefined : {
      threshold: EDGE_CONSTRAINTS.functionParams.threshold.default,
      curvature: EDGE_CONSTRAINTS.functionParams.curvature.default,
      midpoint: EDGE_CONSTRAINTS.functionParams.midpoint.default,
      steepness: EDGE_CONSTRAINTS.functionParams.steepness.default,
    }
    onChange(type, defaultParams)
    onProvenanceChange?.('user-modified')
    setIsDropdownOpen(false)
    setShowParams(type !== 'linear')
  }, [onChange, onProvenanceChange])

  // Handle parameter change
  const handleParamChange = useCallback((paramName: keyof FunctionParams, paramValue: number) => {
    const newParams = { ...params, [paramName]: paramValue }
    onChange(value, newParams)
    onProvenanceChange?.('user-modified')
  }, [value, params, onChange, onProvenanceChange])

  // Map provenance string to ProvenanceType
  const provenanceType = useMemo((): ProvenanceType | null => {
    if (!provenance) return null
    if (provenance === 'ai-suggested' || provenance === 'suggested') return 'ai-suggested'
    if (provenance === 'user-modified' || provenance === 'user') return 'user-modified'
    if (provenance === 'accepted') return 'accepted'
    if (provenance === 'template') return 'template'
    if (provenance === 'inferred') return 'inferred'
    return null
  }, [provenance])

  return (
    <div className="space-y-3">
      {/* Label with tooltip */}
      <div className="flex items-center justify-between">
        <Tooltip content="How input values transform to output for this connection" position="right">
          <label className={`${typography.label} text-ink-700`}>
            Function Type
          </label>
        </Tooltip>
        {provenanceType && (
          <ProvenanceBadge type={provenanceType} compact />
        )}
      </div>

      {/* CEE Suggestion Banner */}
      {showSuggestion && suggestion && (
        <AcceptOverrideControl
          suggestedValue={suggestion.function_type}
          formatValue={(type) => FUNCTION_TYPE_INFO[type].label}
          confidence={suggestion.confidence}
          rationale={suggestion.rationale}
          onAccept={handleAcceptSuggestion}
          onOverride={handleOverride}
          suggestionLabel="AI suggests"
          testIdPrefix="edge-function-suggestion"
        />
      )}

      {/* Loading state for suggestion */}
      {suggestionLoading && !suggestion && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-sand-50 border border-sand-200">
          <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
          <span className={`${typography.caption} text-ink-500`}>
            Getting AI suggestion...
          </span>
        </div>
      )}

      {/* Function type dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            w-full flex items-center justify-between gap-2 px-3 py-2
            rounded-lg border border-sand-200 bg-white
            hover:border-sand-300 transition-colors
            ${typography.body} text-ink-900
          `}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
        >
          <div className="flex items-center gap-3">
            <FunctionPreview type={value} params={params} width={40} height={30} />
            <span>{FUNCTION_TYPE_INFO[value].label}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && (
          <div
            className="absolute z-50 w-full mt-1 py-1 bg-white rounded-lg border border-sand-200 shadow-lg"
            role="listbox"
          >
            {EDGE_FUNCTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left
                  hover:bg-sand-50 transition-colors
                  ${value === type ? 'bg-sky-50' : ''}
                `}
                role="option"
                aria-selected={value === type}
              >
                <FunctionPreview
                  type={type}
                  width={40}
                  height={30}
                  color={value === type ? '#0ea5e9' : '#71717a'}
                />
                <div className="flex-1 min-w-0">
                  <div className={`${typography.label} text-ink-900`}>
                    {FUNCTION_TYPE_INFO[type].label}
                  </div>
                  <div className={`${typography.caption} text-ink-500 truncate`}>
                    {FUNCTION_TYPE_INFO[type].description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Function parameters (for non-linear types) */}
      {value !== 'linear' && showParams && (
        <div className="pl-2 pt-2 border-l-2 border-sand-200 space-y-3">
          {value === 'threshold' && (
            <SliderWithLabel
              id="func-threshold"
              label="Threshold"
              value={params?.threshold ?? EDGE_CONSTRAINTS.functionParams.threshold.default}
              onChange={(v) => handleParamChange('threshold', v)}
              min={EDGE_CONSTRAINTS.functionParams.threshold.min}
              max={EDGE_CONSTRAINTS.functionParams.threshold.max}
              step={EDGE_CONSTRAINTS.functionParams.threshold.step}
              formatValue={(v) => `${(v * 100).toFixed(0)}%`}
              tooltip="Input value where output jumps from 0 to 1"
              showInput
            />
          )}

          {value === 'diminishing_returns' && (
            <SliderWithLabel
              id="func-curvature"
              label="Curvature"
              value={params?.curvature ?? EDGE_CONSTRAINTS.functionParams.curvature.default}
              onChange={(v) => handleParamChange('curvature', v)}
              min={EDGE_CONSTRAINTS.functionParams.curvature.min}
              max={EDGE_CONSTRAINTS.functionParams.curvature.max}
              step={EDGE_CONSTRAINTS.functionParams.curvature.step}
              formatValue={(v) => v.toFixed(1)}
              tooltip="Lower values = more diminishing returns (0.5 = square root)"
              showInput
            />
          )}

          {value === 's_curve' && (
            <>
              <SliderWithLabel
                id="func-midpoint"
                label="Midpoint"
                value={params?.midpoint ?? EDGE_CONSTRAINTS.functionParams.midpoint.default}
                onChange={(v) => handleParamChange('midpoint', v)}
                min={EDGE_CONSTRAINTS.functionParams.midpoint.min}
                max={EDGE_CONSTRAINTS.functionParams.midpoint.max}
                step={EDGE_CONSTRAINTS.functionParams.midpoint.step}
                formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                tooltip="Input value where output is at 50%"
                showInput
              />
              <SliderWithLabel
                id="func-steepness"
                label="Steepness"
                value={params?.steepness ?? EDGE_CONSTRAINTS.functionParams.steepness.default}
                onChange={(v) => handleParamChange('steepness', v)}
                min={EDGE_CONSTRAINTS.functionParams.steepness.min}
                max={EDGE_CONSTRAINTS.functionParams.steepness.max}
                step={EDGE_CONSTRAINTS.functionParams.steepness.step}
                formatValue={(v) => v.toFixed(1)}
                tooltip="How sharp the transition is (higher = sharper)"
                showInput
              />
            </>
          )}

          {/* Live preview with current params */}
          <div className="pt-2">
            <div className={`${typography.caption} text-ink-500 mb-1`}>Preview</div>
            <FunctionPreview
              type={value}
              params={params}
              width={120}
              height={80}
              showLabels
            />
          </div>
        </div>
      )}
    </div>
  )
})
