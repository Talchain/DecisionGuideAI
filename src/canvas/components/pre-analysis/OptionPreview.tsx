/**
 * OptionPreview — Collapsible section showing what each option does.
 *
 * Highest-value pre-analysis check: "Did the AI understand my options?"
 * Shows direction arrows by comparing intervention values to current observed_state.
 *
 * Data source: ceeAnalysisReady.options[] via usePreAnalysisData().optionPreviews
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Pill } from './primitives'
import type { OptionPreviewData } from './hooks/usePreAnalysisData'

interface OptionPreviewProps {
  options: OptionPreviewData[]
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

/**
 * Pluralise a unit when count !== 1.
 * "months" → "month" for 1, "developers" → "developer" for 1, etc.
 */
function pluraliseUnit(unit: string, count: number): string {
  if (count === 1 && unit.length > 1) {
    // Handle -ies → -y: "enquiries" → "enquiry", "currencies" → "currency"
    if (unit.endsWith('ies')) return unit.slice(0, -3) + 'y'
    // Simple deplural: "months" → "month", "developers" → "developer"
    if (unit.endsWith('s')) return unit.slice(0, -1)
  }
  return unit
}

/**
 * Presentation-layer denormalisation (UI-PRES-004 debt).
 * Converts normalised intervention value to human-readable using cap + unit.
 * When CEE emits raw_interventions this helper becomes a pass-through.
 *
 * Discrete detection: when the intervention value is an integer within [0, cap],
 * treat it as already raw (skip ×cap). This prevents "2 × 2 = 4 developers"
 * when CEE means "hire 2 developers".
 *
 * Binary detection: when cap is absent and value is 0 or 1 integer, show
 * "to 1" / "to 0" without the "(scale 0–1)" qualifier.
 *
 * Returns: "to $5,000", "to 9 months", "unchanged", "to 0.80 (scale 0–1)"
 */
function formatInterventionDisplay(
  normalisedValue: number,
  cap: number | null,
  unit: string | null,
  direction: 'up' | 'down' | 'same',
  currentRawValue?: number | null,
): string {
  // Don't claim 'unchanged' from direction alone — direction='same' can mean
  // "no observed state to compare". The raw-value check below handles confirmed-same.

  // Qualitative detection: no unit AND (no cap, or cap=1 which is just normalised ceiling)
  const isQualitative = unit == null && (cap == null || cap === 1)

  // --- Determine raw value ---
  let rawValue: number

  if (isQualitative) {
    // Binary factors (0/1) show as integer, rest map to qualitative level
    if (Number.isInteger(normalisedValue) && (normalisedValue === 0 || normalisedValue === 1)) {
      rawValue = normalisedValue
    } else {
      const level = normalisedValue <= 0.20 ? 'very low'
        : normalisedValue <= 0.40 ? 'low'
        : normalisedValue <= 0.60 ? 'moderate'
        : normalisedValue <= 0.80 ? 'high'
        : 'very high'
      return `to ${level}`
    }
  } else if (cap == null) {
    rawValue = normalisedValue
  } else {
    // Discrete: integer value within [0, cap] → already raw, skip ×cap
    const isDiscreteRaw = Number.isInteger(normalisedValue) &&
      normalisedValue >= 0 && normalisedValue <= cap
    rawValue = isDiscreteRaw ? normalisedValue : normalisedValue * cap
  }

  // --- Unchanged detection (compare raw values) ---
  if (currentRawValue != null && Number.isFinite(currentRawValue)) {
    // Round both for comparison to avoid floating-point mismatch
    const ivrRounded = Math.round(rawValue * 1000) / 1000
    const crvRounded = Math.round(currentRawValue * 1000) / 1000
    if (ivrRounded === crvRounded) return 'unchanged'
  }

  // --- Format display value ---
  const isDiscrete = cap != null && Number.isInteger(cap) && Number.isInteger(rawValue)
  const display = isDiscrete
    ? Math.round(rawValue)
    : (cap != null && cap >= 10 ? Math.round(rawValue) : +rawValue.toFixed(1))

  // Show ~ when rounding changed the displayed value (continuous only)
  const approx = !isDiscrete && display !== rawValue ? '~' : ''

  if (unit === '$' || unit === '£') return `to ${approx}${unit}${display.toLocaleString()}`
  if (unit === '%') return `to ${approx}${display}%`
  if (unit) return `to ${approx}${display} ${pluraliseUnit(unit, display)}`
  return `to ${approx}${display}`
}

function InterventionArrow({ direction }: { direction: 'up' | 'down' | 'same' }) {
  if (direction === 'up') return <ArrowUp className="w-3 h-3 text-success" />
  if (direction === 'down') return <ArrowDown className="w-3 h-3 text-danger" />
  return <Minus className="w-3 h-3 text-text-light" />
}

export function OptionPreview({
  options,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
}: OptionPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (options.length === 0) return null

  return (
    <div className="rounded-lg border border-panel-border" data-testid="option-preview">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-text-light" />
          <span className="text-sm font-semibold text-text-body">Your options</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill size="small" variant="success">{options.length}</Pill>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-light" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-light" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {options.map((opt, idx) => (
            <div
              key={opt.id}
              className={`py-2 ${idx > 0 ? 'border-t border-panel-border' : ''}`}
              onMouseEnter={() => onHoverEnter?.('node', opt.id)}
              onMouseLeave={() => onHoverLeave?.()}
            >
              {/* Option label + status badge */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFocusNode?.(opt.id)}
                  className="text-sm font-semibold text-text-header hover:underline cursor-pointer text-left"
                >
                  {opt.label}
                </button>
                <Pill
                  size="small"
                  variant={opt.status === 'ready' ? 'success' : 'danger'}
                >
                  {opt.status === 'ready' ? 'Ready' : 'Needs mapping'}
                </Pill>
              </div>

              {/* Interventions */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {opt.isBaseline && opt.interventions.length > 0 ? (
                  <span className="text-xs text-text-light">
                    No changes — compare against current state
                  </span>
                ) : (
                  opt.interventions.map(iv => {
                    const display = formatInterventionDisplay(iv.interventionValue, iv.cap, iv.unit, iv.direction, iv.currentRawValue)
                    return (
                      <span key={iv.factorId} className="inline-flex items-center gap-1 text-xs text-text-body">
                        <InterventionArrow direction={iv.direction} />
                        <span>{iv.factorLabel}</span>
                        <span className="text-text-light">{display}</span>
                      </span>
                    )
                  })
                )}
                {opt.interventions.length === 0 && !opt.isBaseline && (
                  <span className="text-xs text-text-light">No interventions mapped</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OptionPreview
