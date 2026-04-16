/**
 * ScientificEditor — Two-level progressive disclosure for model parameter editing.
 *
 * Level 1 (default): User-friendly controls (value input, quick-select buttons, confirm).
 * Level 2 (toggle): Raw scientific parameters (mean, std, exists_probability).
 *
 * Variants: factor | edge | contested
 *
 * Validation: errors show after blur, clear on focus (DS v5 §8.3).
 * Touch targets: minimum 44px on interactive elements.
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'
import type { ValidationMetadata } from '@/canvas/domain/validation'
import { classifyUnit } from '@/canvas/utils/labelUtils'

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
  rawValue: number | null
  cap: number | null
  unit: string | null
  extractionType?: string
  onSave: (rawValue: number) => void
  onCancel: () => void
}

export interface EdgeStrengthEditorProps {
  kind: 'edge'
  mean: number
  std: number
  existsProbability: number
  onSave: (values: { mean: number; std: number; existsProbability: number }) => void
  onCancel: () => void
}

export interface ContestedEdgeEditorProps {
  kind: 'contested'
  validation: ValidationMetadata
  onSave: (values: { mean: number; std: number; existsProbability: number }) => void
  onCancel: () => void
}

export type ScientificEditorProps = FactorValueEditorProps | EdgeStrengthEditorProps | ContestedEdgeEditorProps

// ── Validation ──────────────────────────────────────────────────────────────

interface ValidationError {
  field: string
  message: string
}

function validateEdgeParams(mean: number, std: number, ep: number): ValidationError[] {
  const errors: ValidationError[] = []
  if (mean < -1 || mean > 1) errors.push({ field: 'mean', message: 'Must be between -1 and 1' })
  if (std < 0.05 || std > 0.35) errors.push({ field: 'std', message: 'Must be between 0.05 and 0.35' })
  // std > |mean| only invalid when mean is non-zero — zero mean with non-zero std
  // represents genuine uncertainty about a null effect
  if (std > Math.abs(mean) && mean !== 0) errors.push({ field: 'std', message: 'Must not exceed |mean|' })
  if (ep < 0 || ep > 1) errors.push({ field: 'existsProbability', message: 'Must be between 0 and 1' })
  return errors
}

// ── Number input with validation (errors show on blur, clear on focus) ──────

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
  const [touched, setTouched] = useState(false)

  // DS v5 §8.3: show errors on blur (after touched), clear on focus
  const showError = error && touched && !focused

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
        onBlur={() => { setFocused(false); setTouched(true) }}
        min={min}
        max={max}
        step={step}
        readOnly={readOnly}
        className={`
          w-full px-2 py-1 ${typography.panelMeta} rounded bg-panel text-text-body
          border ${showError ? 'border-danger' : 'border-panel-border'}
          ${readOnly ? 'bg-panel-hover cursor-default' : ''}
          focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info
        `}
      />
      {showError && (
        <p className={`${typography.panelMeta} text-danger`}>{error}</p>
      )}
    </div>
  )
}

// ── Read-only pass display (for contested edges) ────────────────────────────

function PassDisplay({ label, pass }: {
  label: string
  pass: { strength_mean: number; strength_std: number; exists_probability: number }
}) {
  return (
    <div className="space-y-1">
      <p className={`${typography.panelMeta} text-text-header font-semibold`}>{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className={`${typography.panelMeta} text-text-light`}>mean</span>
          <p className={`${typography.panelMeta} text-text-body`}>{pass.strength_mean.toFixed(3)}</p>
        </div>
        <div>
          <span className={`${typography.panelMeta} text-text-light`}>std</span>
          <p className={`${typography.panelMeta} text-text-body`}>{pass.strength_std.toFixed(3)}</p>
          <p className={`${typography.panelMeta} text-text-light`}>{confidenceBandLabel(pass.strength_std)}</p>
        </div>
        <div>
          <span className={`${typography.panelMeta} text-text-light`}>exists</span>
          <p className={`${typography.panelMeta} text-text-body`}>{pass.exists_probability.toFixed(3)}</p>
          <p className={`${typography.panelMeta} text-text-light`}>{existsBandLabel(pass.exists_probability)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Shared Level 2 toggle ───────────────────────────────────────────────────

function ScienceToggle({ showScience, onToggle }: { showScience: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1 min-h-[44px] px-1 rounded ${typography.panelMeta} text-info hover:bg-panel-hover cursor-pointer`}
    >
      <ChevronRight
        size={12}
        className={`transition-transform duration-150 ${showScience ? 'rotate-90' : ''}`}
      />
      {showScience ? 'Hide scientific parameters' : 'Show scientific parameters'}
    </button>
  )
}

// ── Save/Cancel buttons ─────────────────────────────────────────────────────

function SaveCancelButtons({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className={`min-h-[44px] px-3 ${typography.panelMeta} bg-primary text-text-on-color rounded hover:bg-panel-hover disabled:opacity-50`}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={`min-h-[44px] px-3 rounded ${typography.panelMeta} text-text-light hover:text-text-body hover:bg-panel-hover`}
      >
        Cancel
      </button>
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
          className={`flex-1 px-2 min-h-[44px] ${typography.panelBody} border border-panel-border rounded bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
        />
        {unit && classifyUnit(unit).kind !== 'placeholder' && (
          <span className={`${typography.panelMeta} text-text-light shrink-0`}>{unit}</span>
        )}
      </div>
      <SaveCancelButtons
        onSave={handleSave}
        onCancel={onCancel}
        disabled={value.trim() === '' || isNaN(parseFloat(value))}
      />

      <ScienceToggle showScience={showScience} onToggle={() => setShowScience(!showScience)} />

      {showScience && (
        <div className="rounded border border-panel-border bg-panel p-2 space-y-2">
          <NumericField label="raw_value" value={numValue} onChange={(v) => setValue(String(v))} />
          {normalisedValue != null && (
            <NumericField label="normalised" value={normalisedValue} readOnly />
          )}
          {cap != null && <NumericField label="cap" value={cap} readOnly />}
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
  const [dirty, setDirty] = useState(false)

  const errors = useMemo(() => validateEdgeParams(mean, std, ep), [mean, std, ep])
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {}
    errors.forEach(e => { map[e.field] = e.message })
    return map
  }, [errors])

  const direction = mean >= 0 ? 'positive' : 'negative'

  const handleBandSelect = useCallback((band: typeof STRENGTH_BANDS[number]) => {
    setSelectedBand(band.label)
    setDirty(true)
    const sign = mean >= 0 ? 1 : -1
    setMean(sign * band.mid)
    setStd(Math.max(0.05, Math.min(0.20, band.mid * 0.15)))
  }, [mean])

  const handleSave = useCallback(() => {
    if (errors.length === 0) {
      onSave({ mean, std, existsProbability: ep })
    }
  }, [mean, std, ep, errors, onSave])

  // Track Level 2 changes as dirty
  const handleMeanChange = useCallback((v: number) => { setMean(v); setDirty(true) }, [])
  const handleStdChange = useCallback((v: number) => { setStd(v); setDirty(true) }, [])
  const handleEpChange = useCallback((v: number) => { setEp(v); setDirty(true) }, [])

  // Show Save/Cancel when any value has changed (band selected OR Level 2 edited)
  const showSaveButtons = dirty || selectedBand != null

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
              min-h-[44px] px-3 rounded ${typography.panelMeta}
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

      {showSaveButtons && (
        <SaveCancelButtons onSave={handleSave} onCancel={onCancel} disabled={errors.length > 0} />
      )}

      <ScienceToggle showScience={showScience} onToggle={() => setShowScience(!showScience)} />

      {showScience && (
        <div className="rounded border border-panel-border bg-panel p-2 space-y-2">
          <NumericField label="strength.mean" value={mean} onChange={handleMeanChange} min={-1} max={1} step={0.05} error={errorMap.mean} />
          <NumericField label="strength.std" value={std} onChange={handleStdChange} min={0.05} max={0.35} step={0.01} error={errorMap.std} bandLabel={confidenceBandLabel(std)} />
          <NumericField label="exists_probability" value={ep} onChange={handleEpChange} min={0} max={1} step={0.05} error={errorMap.existsProbability} bandLabel={existsBandLabel(ep)} />
          <div className="flex items-center justify-between">
            <span className={`${typography.panelMeta} text-text-light`}>effect_direction</span>
            <span className={`${typography.panelMeta} text-text-body`}>{direction}</span>
          </div>

          {/* Save from Level 2 without needing band selection */}
          {!showSaveButtons && (
            <SaveCancelButtons onSave={handleSave} onCancel={onCancel} disabled={errors.length > 0} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Contested edge editor ───────────────────────────────────────────────────

function ContestedEdgeEditor({ validation, onSave, onCancel }: Omit<ContestedEdgeEditorProps, 'kind'>) {
  const [showScience, setShowScience] = useState(false)
  const [mean, setMean] = useState(validation.pass1.strength_mean)
  const [std, setStd] = useState(validation.pass1.strength_std)
  const [ep, setEp] = useState(validation.pass1.exists_probability)
  const [dirty, setDirty] = useState(false)

  const errors = useMemo(() => validateEdgeParams(mean, std, ep), [mean, std, ep])
  const errorMap = useMemo(() => {
    const map: Record<string, string> = {}
    errors.forEach(e => { map[e.field] = e.message })
    return map
  }, [errors])

  const direction = mean >= 0 ? 'positive' : 'negative'

  const handleSave = useCallback(() => {
    if (errors.length === 0) onSave({ mean, std, existsProbability: ep })
  }, [mean, std, ep, errors, onSave])

  const handleMeanChange = useCallback((v: number) => { setMean(v); setDirty(true) }, [])
  const handleStdChange = useCallback((v: number) => { setStd(v); setDirty(true) }, [])
  const handleEpChange = useCallback((v: number) => { setEp(v); setDirty(true) }, [])

  return (
    <div className="space-y-2">
      {/* Level 1: Accept pass 1 or pass 2 */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMean(validation.pass1.strength_mean)
            setStd(validation.pass1.strength_std)
            setEp(validation.pass1.exists_probability)
            setDirty(true)
          }}
          className={`min-h-[44px] px-3 rounded ${typography.panelMeta} bg-panel border border-panel-border text-text-body hover:bg-panel-hover cursor-pointer`}
        >
          Keep original
        </button>
        <button
          type="button"
          onClick={() => {
            setMean(validation.pass2.strength_mean)
            setStd(validation.pass2.strength_std)
            setEp(validation.pass2.exists_probability)
            setDirty(true)
          }}
          className={`min-h-[44px] px-3 rounded ${typography.panelMeta} bg-panel border border-panel-border text-text-body hover:bg-panel-hover cursor-pointer`}
        >
          Use review
        </button>
      </div>

      {/* Pass 2 reasoning */}
      {validation.pass2.reasoning && (
        <p className={`${typography.panelMeta} text-text-light`}>
          Review basis: {validation.pass2.reasoning}
        </p>
      )}

      {dirty && (
        <SaveCancelButtons onSave={handleSave} onCancel={onCancel} disabled={errors.length > 0} />
      )}

      <ScienceToggle showScience={showScience} onToggle={() => setShowScience(!showScience)} />

      {showScience && (
        <div className="rounded border border-panel-border bg-panel p-2 space-y-3">
          {/* Pass 1 and Pass 2 comparison */}
          <PassDisplay label="Pass 1 (original)" pass={validation.pass1} />
          <PassDisplay label="Pass 2 (review)" pass={validation.pass2} />

          {/* Read-only metadata */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-panel-border">
            <div>
              <span className={`${typography.panelMeta} text-text-light`}>basis</span>
              <p className={`${typography.panelMeta} text-text-body`}>{validation.pass2.basis}</p>
            </div>
            <div>
              <span className={`${typography.panelMeta} text-text-light`}>max_divergence</span>
              <p className={`${typography.panelMeta} text-text-body`}>{validation.max_divergence.toFixed(3)}</p>
            </div>
            {validation.evoi_impact != null && (
              <div>
                <span className={`${typography.panelMeta} text-text-light`}>evoi_impact</span>
                <p className={`${typography.panelMeta} text-text-body`}>{validation.evoi_impact.toFixed(1)}pp</p>
              </div>
            )}
          </div>

          {/* Editable values */}
          <div className="pt-1 border-t border-panel-border space-y-2">
            <p className={`${typography.panelMeta} text-text-header font-semibold`}>Your value</p>
            <NumericField label="strength.mean" value={mean} onChange={handleMeanChange} min={-1} max={1} step={0.05} error={errorMap.mean} />
            <NumericField label="strength.std" value={std} onChange={handleStdChange} min={0.05} max={0.35} step={0.01} error={errorMap.std} bandLabel={confidenceBandLabel(std)} />
            <NumericField label="exists_probability" value={ep} onChange={handleEpChange} min={0} max={1} step={0.05} error={errorMap.existsProbability} bandLabel={existsBandLabel(ep)} />
            <div className="flex items-center justify-between">
              <span className={`${typography.panelMeta} text-text-light`}>effect_direction</span>
              <span className={`${typography.panelMeta} text-text-body`}>{direction}</span>
            </div>
          </div>

          {!dirty && (
            <SaveCancelButtons onSave={handleSave} onCancel={onCancel} disabled={errors.length > 0} />
          )}
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
  if (props.kind === 'contested') {
    return <ContestedEdgeEditor
      validation={props.validation}
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
