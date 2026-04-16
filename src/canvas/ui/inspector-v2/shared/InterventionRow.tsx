/**
 * InterventionRow — Factor link + baseline → editable input + Δ%
 * Used in OptionPanel §6.2: "What this option changes"
 */

import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { typography } from '../../../../styles/typography'

interface InterventionRowProps {
  factorId: string
  factorLabel: string
  /** Baseline value in raw units */
  baseline?: number
  /** Current intervention value */
  currentValue: number
  /** CEE-authored display_value for the intervention — rendered verbatim when
   * present, replacing the "Currently: X → editable" numeric formatter. */
  displayValue?: string
  unit?: string
  onChange: (newValue: number) => void
  onNavigate?: () => void
  disabled?: boolean
  techMode?: boolean
  /** Normalised model value (0-1) for tech display */
  normalisedValue?: number
}

export function InterventionRow({
  factorLabel,
  baseline,
  currentValue,
  displayValue,
  unit = '',
  onChange,
  onNavigate,
  disabled = false,
  techMode = false,
  normalisedValue,
}: InterventionRowProps) {
  const [draft, setDraft] = useState(String(currentValue))
  const inputRef = useRef<HTMLInputElement>(null)

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(draft)
    if (!isNaN(parsed) && parsed !== currentValue) {
      onChange(parsed)
    } else {
      setDraft(String(currentValue))
    }
  }, [draft, currentValue, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(String(currentValue))
      inputRef.current?.blur()
    }
  }, [currentValue])

  // Change delta
  const delta = baseline != null && baseline !== 0
    ? ((currentValue - baseline) / Math.abs(baseline)) * 100
    : null
  const deltaSign = delta != null ? (delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '') : ''
  const deltaColor = delta != null ? (delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-light') : ''

  const formatValue = (v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') {
      return `${unit}${v.toLocaleString()}`
    }
    return unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString()
  }

  // F.6 passthrough: when CEE provides display_value, it IS the canonical
  // default-mode user-facing text. Raw numeric baseline/delta/editable input
  // only surface in tech mode to preserve editability for operators. This
  // also satisfies the Brief 4 constraint "InterventionRow reading
  // intervention.value directly when intervention.display_value is present".
  const hasDisplayValue = !!displayValue
  const showNumericSurface = !hasDisplayValue || techMode

  return (
    <div className="bg-panel border border-panel-border rounded-lg p-2.5 mb-1.5">
      {/* Factor label + change indicator (delta hidden when displayValue is primary) */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <NodeShapeIndicator nodeKind="factor" size={14} />
          <button
            type="button"
            onClick={onNavigate}
            className={`${typography.panelBody} font-medium text-text-body hover:text-info transition-colors truncate ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
            disabled={!onNavigate}
          >
            {factorLabel}
          </button>
        </div>
        {delta != null && showNumericSurface && (
          <span className={`${typography.panelMeta} ${deltaColor}`}>
            {deltaSign} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>

      {/* CEE-authored display_value — canonical default-mode text when present */}
      {hasDisplayValue && (
        <div className={`${typography.panelBody} text-text-body mt-1 ${techMode ? 'italic text-text-light' : ''}`}>
          {displayValue}
        </div>
      )}

      {/* Baseline → editable input (default mode when no displayValue, or always in techMode) */}
      {showNumericSurface && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            <div className={`${typography.panelMeta} text-text-light`}>
              Currently: {baseline != null ? formatValue(baseline) : 'N/A'}
            </div>
          </div>
          <ArrowRight size={10} className="text-text-light flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={`${typography.panelHeader} text-xs w-[110px] px-2 py-1 border rounded-lg text-center bg-panel ${
              disabled ? 'border-panel-border text-text-light' : 'border-info'
            }`}
          />
        </div>
      )}

      {/* Tech mode: normalised value */}
      {techMode && normalisedValue != null && (
        <div className={`${typography.panelMeta} text-text-light mt-1`}>
          System: model value: {normalisedValue.toFixed(2)}
        </div>
      )}
    </div>
  )
}
