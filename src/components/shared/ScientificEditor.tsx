/**
 * ScientificEditor — Two-level progressive disclosure for model parameter editing.
 *
 * Level 1 (default): User-friendly controls (value input, quick-select buttons, confirm).
 * Level 2 (toggle): Raw scientific parameters (mean, std, exists_probability).
 *
 * Used in both pre-analysis and post-analysis triage panels for inline
 * factor value and edge strength editing.
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'

// ── Strength band helpers ───────────────────────────────────────────────────

export const STRENGTH_BANDS = [
  { label: 'Weakly', min: 0.10, max: 0.25, mid: 0.175 },
  { label: 'Moderately', min: 0.30, max: 0.50, mid: 0.40 },
  { label: 'Strongly', min: 0.60, max: 0.85, mid: 0.725 },
] as const

function confidenceBandLabel(std: number): string {
  if (std <= 0.10) return 'High confidence'
  if (std <= 0.20) return 'Moderate confidence'
  return 'Low confidence'
}

function existsBandLabel(ep: number): string {
  if (ep >= 0.90) return 'Near-certain'
  if (ep >= 0.70) return 'Likely'
  if (ep >= 0.50) return 'Uncertain'
  return 'Speculative'
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorValueEditorProps {
  kind: 'factor'
  /** Current raw value */
  rawValue: number | null
  /** Normalisation cap */
  cap: number | null
  /** Display unit */
  unit: string | null
  /** Source badge (read-only in Level 2) */
  extractionType?: string
  /** Save handler */
  onSave: (rawValue: number) => void
  onCancel: () => void
}

export interface EdgeStrengthEditorProps {
  kind: 'edge'
  /** Current mean [-1, +1] */
  mean: number
  /** Current std [0.05, 0.35] */
  std: number
  /** Current exists probability [0, 1] */
  existsProbability: number
  /** Save handler */
  onSave: (values: { mean: number; std: number; existsProbability: number }) => void
  onCancel: () => void
}

export type ScientificEditorProps = FactorValueEditorProps | EdgeStrengthEditorProps

// ── Validation ──────────────────────────────────────────────────────────────

interface ValidationError {
  field: string
  message: string
}

function validateEdgeParams(mean: number, std: number, ep: number): ValidationError[] {
  const errors: ValidationError[] = []
  if (mean < -1 || mean > 1) errors.push({ field: 'mean', message: 'Must be between -1 and 1' })
  if (std < 0.05 || std > 0.35) errors.push({ field: 'std', message: 'Must be between 0.05 and 0.35' })
  if (std > Math.abs(mean) && mean !== 0) errors.push({ field: 'std', message: 'Must not exceed |mean|' })
  if (ep < 0 || ep > 1) errors.push({ field: 'existsProbability', message: 'Must be between 0 and 1' })
  return errors
}

// ── Number input with validation ────────────────────────────────────────────

function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  error,
  readOnly,
  bandLabel,
}: {
  label: string
  value: number
  onChange?: (v: number) => void
  min?: number
  max?: number
  step?: number
  error?: string
  readOnly?: boolean
  bandLabel?: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <label className={`${typography.panelMeta} text-text-light`}>{label}</label>
        {bandLabel && (
          <span className={`${typography.panelMeta} text-text-light`}>{bandLabel}</span>
        )}
      </div>
      <input
        type="number"
        value={readOnly ? value.toFixed(3) : value}
        onChange={onChange ? (e) => onChange(parseFloat(e.target.value) || 0) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        min={min}
        max={max}
        step={step}
        readOnly={readOnly}
        className={`
          w-full px-2 py-1 ${typography.panelMeta} rounded bg-panel text-text-body
          border ${error && !focused ? 'border-danger' : 'border-panel-border'}
          ${readOnly ? 'bg-panel-hover cursor-default' : ''}
          focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info
        `}
      />
      {error && !focused && (
        <p className={`${typography.panelMeta} text-danger`}>{error}</p>
      )}
    </div>
  )
}

// ── Factor value editor ─────────────────────────────────────────────────────

function FactorValueEditor({ rawValue, cap, unit, extractionType, onSave, onCancel }: Omit<FactorValueEditorProps, 'kind'>) {
  const [value, setValue] = useState<string>(rawValue != null ? String(rawValue) : '')
  const [showScience, setShowScience] = useState(false)

  const numValue = parseFloat(value) || 0
  const normalisedValue = cap && cap > 0 ? Math.min(1, numValue / cap) : null

  const handleSave = useCallback(() => {
    const parsed = parseFloat(value)
    if (!isNaN(parsed)) onSave(parsed)
  }, [value, onSave])

  return (
    <div className="space-y-2">
      {/* Level 1: simple value input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value"
          className={`flex-1 px-2 py-1.5 ${typography.panelBody} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        {unit && <span className={`${typography.panelMeta} text-text-light shrink-0`}>{unit}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={value.trim() === '' || isNaN(parseFloat(value))}
          className={`px-2.5 py-1 ${typography.panelMeta} bg-primary text-text-on-color rounded hover:opacity-90 disabled:opacity-50`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`px-2.5 py-1 rounded ${typography.panelMeta} text-text-light hover:text-text-body hover:bg-panel-hover`}
        >
          Cancel
        </button>
      </div>

      {/* Level 2 toggle */}
      <button
        type="button"
        onClick={() => setShowScience(!showScience)}
        className={`flex items-center gap-1 ${typography.panelMeta} text-info hover:underline cursor-pointer`}
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-150 ${showScience ? 'rotate-90' : ''}`}
        />
        {showScience ? 'Hide scientific parameters' : 'Show scientific parameters'}
      </button>

      {/* Level 2: scientific parameters */}
      {showScience && (
        <div className="rounded border border-panel-border bg-panel p-2 space-y-2">
          <NumericField label="raw_value" value={numValue} onChange={(v) => setValue(String(v))} />
          {normalisedValue != null && (
            <NumericField label="normalised" value={normalisedValue} readOnly />
          )}
          {cap != null && (
            <NumericField label="cap" value={cap} readOnly />
          )}
          {unit && (
            <div className="flex items-center justify-between">
              <span className={`${typography.panelMeta} text-text-light`}>unit</span>
              <span className={`${typography.panelMeta} text-text-body`}>{unit}</span>
            </div>
          )}
          {extractionType && (
            <div className="flex items-center justify-between">
              <span className={`${typography.panelMeta} text-text-light`}>source</span>
              <span className={`px-1.5 py-0.5 rounded-full border border-panel-border ${typography.panelMeta} text-text-body`}>
                {extractionType}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Edge strength editor ────────────────────────────────────────────────────

function EdgeStrengthEditor({ mean: initMean, std: initStd, existsProbability: initEp, onSave, onCancel }: Omit<EdgeStrengthEditorProps, 'kind'>) {
  const [selectedBand, setSelectedBand] = useState<string | null>(null)
  const [showScience, setShowScience] = useState(false)
  const [mean, setMean] = useState(initMean)
  const [std, setStd] = useState(initStd)
  const [ep, setEp] = useState(initEp)

  const errors = useMemo(() => validateEdgeParams(mean, std, ep), [mean, std, ep])
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {}
    errors.forEach(e => { map[e.field] = e.message })
    return map
  }, [errors])

  const direction = mean >= 0 ? 'positive' : 'negative'

  const handleBandSelect = useCallback((band: typeof STRENGTH_BANDS[number]) => {
    setSelectedBand(band.label)
    const sign = mean >= 0 ? 1 : -1
    setMean(sign * band.mid)
    // Default std for band selection: 15% of the midpoint
    setStd(Math.max(0.05, Math.min(0.20, band.mid * 0.15)))
  }, [mean])

  const handleSave = useCallback(() => {
    if (errors.length === 0) {
      onSave({ mean, std, existsProbability: ep })
    }
  }, [mean, std, ep, errors, onSave])

  return (
    <div className="space-y-2">
      {/* Level 1: quick-select buttons */}
      <div className="flex items-center gap-1.5">
        {STRENGTH_BANDS.map((band) => (
          <button
            key={band.label}
            type="button"
            onClick={() => handleBandSelect(band)}
            className={`
              px-2.5 py-1.5 rounded ${typography.panelMeta}
              ${selectedBand === band.label
                ? 'bg-primary text-text-on-color'
                : 'bg-panel border border-panel-border text-text-body hover:bg-panel-hover'}
              cursor-pointer transition-colors
            `}
          >
            {band.label}
          </button>
        ))}
      </div>

      {/* Save/Cancel */}
      {selectedBand && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={errors.length > 0}
            className={`px-2.5 py-1 ${typography.panelMeta} bg-primary text-text-on-color rounded hover:opacity-90 disabled:opacity-50`}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`px-2.5 py-1 rounded ${typography.panelMeta} text-text-light hover:text-text-body hover:bg-panel-hover`}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Level 2 toggle */}
      <button
        type="button"
        onClick={() => setShowScience(!showScience)}
        className={`flex items-center gap-1 ${typography.panelMeta} text-info hover:underline cursor-pointer`}
      >
        <ChevronRight
          size={12}
          className={`transition-transform duration-150 ${showScience ? 'rotate-90' : ''}`}
        />
        {showScience ? 'Hide scientific parameters' : 'Show scientific parameters'}
      </button>

      {/* Level 2: scientific parameters */}
      {showScience && (
        <div className="rounded border border-panel-border bg-panel p-2 space-y-2">
          <NumericField
            label="strength.mean"
            value={mean}
            onChange={setMean}
            min={-1}
            max={1}
            step={0.05}
            error={errorMap.mean}
          />
          <NumericField
            label="strength.std"
            value={std}
            onChange={setStd}
            min={0.05}
            max={0.35}
            step={0.01}
            error={errorMap.std}
            bandLabel={confidenceBandLabel(std)}
          />
          <NumericField
            label="exists_probability"
            value={ep}
            onChange={setEp}
            min={0}
            max={1}
            step={0.05}
            error={errorMap.existsProbability}
            bandLabel={existsBandLabel(ep)}
          />
          <div className="flex items-center justify-between">
            <span className={`${typography.panelMeta} text-text-light`}>effect_direction</span>
            <span className={`${typography.panelMeta} text-text-body`}>{direction}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function ScientificEditor(props: ScientificEditorProps) {
  if (props.kind === 'factor') {
    return <FactorValueEditor
      rawValue={props.rawValue}
      cap={props.cap}
      unit={props.unit}
      extractionType={props.extractionType}
      onSave={props.onSave}
      onCancel={props.onCancel}
    />
  }
  return <EdgeStrengthEditor
    mean={props.mean}
    std={props.std}
    existsProbability={props.existsProbability}
    onSave={props.onSave}
    onCancel={props.onCancel}
  />
}

export default ScientificEditor
