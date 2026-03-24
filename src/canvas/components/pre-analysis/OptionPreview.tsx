/**
 * OptionPreview — Collapsible section showing what each option does.
 *
 * Highest-value pre-analysis check: "Did the AI understand my options?"
 * Shows direction arrows by comparing intervention values to current observed_state.
 *
 * Data source: ceeAnalysisReady.options[] via usePreAnalysisData().optionPreviews
 *
 * Intervention target values are read-only from CEE. Inline editing deferred
 * until intervention mutation pathway is established.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react'
import { Pill } from './primitives'
import Tooltip from '../../../components/Tooltip'
import type { OptionPreviewData } from './hooks/usePreAnalysisData'
import { typography } from '@/styles/typography'

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
 * Format the current (before) raw value for display alongside the intervention target.
 * Uses the same formatting rules as formatInterventionDisplay.
 * Returns null when currentRawValue is absent (AI estimate with no grounding).
 */
function formatBeforeValue(
  currentRawValue: number | null,
  cap: number | null,
  unit: string | null,
): string | null {
  if (currentRawValue == null) return null
  // Qualitative: no unit and no meaningful cap — mirror formatInterventionDisplay qualitative path
  if (!unit && (cap == null || cap === 1)) {
    const v = currentRawValue
    const level = v < 0.2 ? 'very low' : v < 0.4 ? 'low' : v < 0.6 ? 'moderate' : v < 0.8 ? 'high' : 'very high'
    return level
  }
  const isDiscrete = cap != null && Number.isInteger(cap) && Number.isInteger(currentRawValue)
  const display = isDiscrete ? Math.round(currentRawValue) : +currentRawValue.toFixed(1)
  if (unit === '$' || unit === '£') return `${unit}${display.toLocaleString()}`
  if (unit === '%') return `${display}%`
  if (unit) return `${display} ${pluraliseUnit(unit, display)}`
  return `${display}`
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

  // Qualitative detection: no meaningful unit AND (no cap, or cap=1 which is just normalised ceiling)
  // Empty string unit is treated the same as absent — CEE sometimes sends unit: ""
  const isQualitative = !unit && (cap == null || cap === 1)

  // --- Determine raw value ---
  let rawValue: number

  if (isQualitative) {
    if (normalisedValue >= 0 && normalisedValue <= 1) {
      const level = normalisedValue < 0.2 ? 'very low'
        : normalisedValue < 0.4 ? 'low'
        : normalisedValue < 0.6 ? 'moderate'
        : normalisedValue < 0.8 ? 'high'
        : 'very high'
      return `to ${level}`
    } else {
      // Out-of-range value with no cap/unit — display numeric as-is
      rawValue = normalisedValue
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

/** Per-option collapsible intervention rows — collapsed by default */
function OptionInterventions({ option: opt, onFocusNode }: { option: OptionPreviewData; onFocusNode?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  // Baseline with interventions = "no changes"
  if (opt.isBaseline && opt.interventions.length > 0) {
    return (
      <div className={`${typography.panelMeta} text-text-light mt-1`}>
        No changes — compare against current state
      </div>
    )
  }

  // No interventions at all
  if (opt.interventions.length === 0) {
    return opt.isBaseline ? null : (
      <div className={`${typography.panelMeta} text-text-light mt-1`}>No factor changes</div>
    )
  }

  return (
    <div className="mt-1">
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
        >
          Show interventions
        </button>
      )}
      {expanded && (
        <>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {opt.interventions.map(iv => {
              const display = formatInterventionDisplay(iv.interventionValue, iv.cap, iv.unit, iv.direction, iv.currentRawValue)
              const before = formatBeforeValue(iv.currentRawValue, iv.cap, iv.unit)
              return (
                <span key={iv.factorId} className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-body`}>
                  <InterventionArrow direction={iv.direction} />
                  <button
                    type="button"
                    onClick={() => onFocusNode?.(iv.factorId)}
                    className="hover:underline cursor-pointer"
                  >
                    {iv.factorLabel}
                  </button>
                  {before != null && display !== 'unchanged'
                    ? <span className="text-text-light">{before} → {display.replace(/^to /, '')}</span>
                    : <span className="text-text-light">{display}</span>
                  }
                </span>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1`}
          >
            Hide
          </button>
        </>
      )}
    </div>
  )
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
          <span className={`${typography.panelHeader} text-text-body`}>Your options</span>
          <Tooltip delay={300} content="The strategies you're choosing between. Each changes different factors by different amounts. Click any value to adjust.">
            <Info size={14} className="text-text-light" />
          </Tooltip>
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
              className={`py-2 rounded hover:bg-option-light transition-colors ${idx > 0 ? 'border-t border-panel-border' : ''}`}
              onMouseEnter={() => onHoverEnter?.('node', opt.id)}
              onMouseLeave={() => onHoverLeave?.()}
            >
              {/* Option label + status badge */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFocusNode?.(opt.id)}
                  className={`${typography.panelHeader} text-text-header hover:underline cursor-pointer text-left`}
                >
                  {opt.label}
                </button>
                {opt.status === 'ready' ? (
                  <span className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-body bg-transparent border border-success/30 rounded-full px-2 py-0.5`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" aria-hidden="true" />
                    Ready
                  </span>
                ) : (
                  <Pill size="small" variant="danger">Needs mapping</Pill>
                )}
              </div>

              {/* Interventions — collapsed by default */}
              <OptionInterventions
                option={opt}
                onFocusNode={onFocusNode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OptionPreview
