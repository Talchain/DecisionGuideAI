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
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react'
import { Pill } from './primitives'
import Tooltip from '../../../components/Tooltip'
import type { OptionPreviewData } from './hooks/usePreAnalysisData'
import { typography } from '@/styles/typography'
import { classifyUnit } from '../../utils/labelUtils'
import { qualitativeLabel } from '../../utils/formatValueWithUnit'
import { DiscussWithAiButton } from './DiscussWithAiButton'

/**
 * Visible header text for the option quality card. Exported so other surfaces
 * (notably the PreAnalysisPanel dynamic headline) can reference the same copy
 * without hard-coding a parallel literal that would drift if this ever changes.
 */
export const OPTION_PREVIEW_TITLE = 'Your options'

/**
 * Treat the unit as "no display unit" when it falls into the placeholder
 * bucket from labelUtils.classifyUnit. Placeholder units (scale, index, score,
 * normalised, norm, unit, units) carry no real-world scale and add nothing
 * but noise to "0 → 0.5 scale". Suppressing them everywhere keeps the
 * intervention display consistent with the triage card detail logic in
 * usePreAnalysisData.formatObservedStateDetail.
 */
function isPlaceholderUnit(unit: string | null | undefined): boolean {
  if (unit == null) return true
  const kind = classifyUnit(unit).kind
  return kind === 'none' || kind === 'placeholder'
}

/** Option square shape — purple, rounded-[2px], per DS v5 §10.1 */
function OptionSquare() {
  return (
    <span
      className="inline-block flex-shrink-0 w-4 h-4 rounded-[2px] bg-option"
      aria-hidden="true"
    />
  )
}

interface OptionPreviewProps {
  options: OptionPreviewData[]
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onSendMessage?: (text: string) => void
  /** When true, shows a structural similarity coaching line below the option list */
  hasSameLeversCheck?: boolean
  /**
   * When true, each option's intervention list is collapsed by default with a
   * per-option chevron toggle. Used by the v2 pre-analysis panel to keep the
   * option quality card compact. Default is false (interventions always visible)
   * to preserve existing consumer behaviour and tests.
   */
  collapseInterventionsByDefault?: boolean
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
 * Returns null when currentRawValue is absent (estimated value with no grounding).
 *
 * Placeholder units (scale, index, score, …) are treated like no-unit so the
 * before-value reads "very low" or "0.5", not "0.5 scale". The "before"
 * qualitative path uses the same boundaries as formatInterventionDisplay so
 * "before → after" stays consistent for qualitative factors.
 */
function formatBeforeValue(
  currentRawValue: number | null,
  cap: number | null,
  unit: string | null,
): string | null {
  if (currentRawValue == null) return null
  const placeholder = isPlaceholderUnit(unit)
  // Qualitative: placeholder unit AND no meaningful cap — show level label via shared utility
  if (placeholder && (cap == null || cap === 1)) {
    return qualitativeLabel(currentRawValue)
  }
  const isDiscrete = cap != null && Number.isInteger(cap) && Number.isInteger(currentRawValue)
  const display = isDiscrete ? Math.round(currentRawValue) : +currentRawValue.toFixed(1)
  if (placeholder) return `${display}`
  if (unit === '%') return `${display}%`
  if (unit) {
    const { kind, canonical } = classifyUnit(unit)
    if (kind === 'symbol') return `${canonical}${display.toLocaleString('en-GB')}`
    if (kind === 'iso') return `${canonical} ${display.toLocaleString('en-GB')}`
  }
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

  // Placeholder units (scale, index, score, …) are treated like no-unit so the
  // intervention reads "to 0.5" not "to 0.5 scale". This is the cross-surface
  // contract from labelUtils.classifyUnit and matches formatObservedStateDetail
  // in usePreAnalysisData.
  const placeholder = isPlaceholderUnit(unit)

  // Qualitative detection: placeholder unit AND no meaningful cap (cap=1 is just
  // the normalised ceiling). Renders qualitative band labels.
  const isQualitative = placeholder && (cap == null || cap === 1)

  // --- Determine raw value ---
  let rawValue: number

  if (isQualitative) {
    if (normalisedValue >= 0 && normalisedValue <= 1) {
      return `to ${qualitativeLabel(normalisedValue)}`
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

  // Placeholder unit → drop the suffix; the scale "scale" / "index" / "score"
  // would add no meaning to a denormalised number.
  if (placeholder) return `to ${approx}${display}`
  if (unit === '%') return `to ${approx}${display}%`
  if (unit) {
    const { kind, canonical } = classifyUnit(unit)
    if (kind === 'symbol') return `to ${approx}${canonical}${display.toLocaleString('en-GB')}`
    if (kind === 'iso') return `to ${approx}${canonical} ${display.toLocaleString('en-GB')}`
    return `to ${approx}${display} ${pluraliseUnit(unit, display)}`
  }
  return `to ${approx}${display}`
}

function InterventionArrow({ direction }: { direction: 'up' | 'down' | 'same' }) {
  if (direction === 'up') return <ArrowUp className="w-3 h-3 text-success" />
  if (direction === 'down') return <ArrowDown className="w-3 h-3 text-danger" />
  return <Minus className="w-3 h-3 text-text-light" />
}

/**
 * SameLeversCoaching — shared narrow-framing coaching rendered whenever the
 * same_levers quality signal fires. Rendered both in the collapsed and the
 * expanded OptionPreview states so the copy is data-driven, not state-driven
 * (Brief 4 hotfix Task 6).
 */
function SameLeversCoaching({
  onSendMessage,
}: {
  onSendMessage?: (text: string) => void
}) {
  return (
    <p className={`${typography.panelMeta} text-text-light`} data-testid="option-quality-narrow-framing">
      Your options all work through similar factors. Consider a structurally different approach.
      {onSendMessage && (
        <>
          {' '}
          <button
            type="button"
            onClick={() => onSendMessage('My options seem similar. Can you suggest a structurally different approach?')}
            className="text-info hover:underline cursor-pointer"
          >
            Explore alternatives
          </button>
        </>
      )}
    </p>
  )
}

/**
 * Per-option intervention rows.
 *
 * Default (collapsedByDefault=false): the intervention list is always visible.
 * v2 panel (collapsedByDefault=true): the list is hidden behind a per-option
 * disclosure toggle so the option quality card stays compact.
 */
function OptionInterventions({
  option: opt,
  onFocusNode,
  collapsedByDefault = false,
}: {
  option: OptionPreviewData
  onFocusNode?: (id: string) => void
  collapsedByDefault?: boolean
}) {
  const [isOpen, setIsOpen] = useState(!collapsedByDefault)

  // Baseline = "No changes"
  if (opt.isBaseline) {
    return (
      <p className={`${typography.panelBody} text-text-light mt-1`}>No changes</p>
    )
  }

  // Non-baseline with empty interventions — return null
  if (opt.interventions.length === 0) {
    return null
  }

  const list = (
    <div className="mt-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {opt.interventions.map(iv => {
          // The intervention TARGET is always derived from interventionValue
          // via the local formatter. We do NOT use iv.currentDisplayValue
          // here — that field is the formatted *current* value (the "before"
          // side of the arrow), not the target. Mixing them up would silently
          // misstate where each option moves the factor to.
          const display = formatInterventionDisplay(iv.interventionValue, iv.cap, iv.unit, iv.direction, iv.currentRawValue)
          // Prefer the CEE-provided current value display string when
          // present (future CEE-1 schema). Otherwise fall back to the local
          // before-value formatter that mirrors formatInterventionDisplay's
          // unit/qualitative rules.
          const before = iv.currentDisplayValue && iv.currentDisplayValue.trim().length > 0
            ? iv.currentDisplayValue
            : formatBeforeValue(iv.currentRawValue, iv.cap, iv.unit)
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
    </div>
  )

  if (!collapsedByDefault) return list

  // Per-option disclosure: chevron + count, click to toggle
  const count = opt.interventions.length
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`inline-flex items-center gap-1 ${typography.panelMeta} text-info hover:underline cursor-pointer`}
        aria-expanded={isOpen}
        data-testid={`option-interventions-toggle-${opt.id}`}
      >
        {isOpen
          ? <ChevronDown className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
        {isOpen ? 'Hide changes' : `Show ${count} change${count === 1 ? '' : 's'}`}
      </button>
      {isOpen && list}
    </div>
  )
}

/**
 * Derive the ordered list of factor labels shared by ALL non-baseline options.
 * Returns [] when fewer than 2 non-baseline options exist or no overlap found.
 */
function sharedFactorLabels(options: OptionPreviewData[]): string[] {
  const nonBaseline = options.filter(o => !o.isBaseline)
  if (nonBaseline.length < 2) return []
  const [first, ...rest] = nonBaseline
  const intersection = new Set(first.interventions.map(i => i.factorId))
  for (const opt of rest) {
    const ids = new Set(opt.interventions.map(i => i.factorId))
    for (const id of intersection) {
      if (!ids.has(id)) intersection.delete(id)
    }
  }
  if (intersection.size === 0) return []
  return first.interventions
    .filter(i => intersection.has(i.factorId))
    .map(i => i.factorLabel)
}

export function OptionPreview({
  options,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSendMessage,
  hasSameLeversCheck = false,
  collapseInterventionsByDefault = false,
}: OptionPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (options.length === 0) return null

  // Suppress "Ready" pills when all options share the same status
  const allSameStatus = options.length > 0 && options.every(o => o.status === options[0].status)

  // P1-2: option quality card gets a generic "discuss options" sparkle. Passes
  // a synthetic label so buildAiDiscussPrompt produces a sensible prompt for
  // the option set as a whole.
  const firstOptionLabel = options[0]?.label ?? 'your options'

  return (
    <div className="relative rounded-lg border border-panel-border" data-testid="option-preview">
      {/* Header — option square shape, no decorative icon */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
        data-testid="option-preview-toggle"
      >
        <div className="flex items-center gap-2">
          <OptionSquare />
          <span className={`${typography.panelHeader} text-text-header`}>{OPTION_PREVIEW_TITLE}</span>
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

      {/* UI-BUG-3: option names + coaching line are visible in collapsed
          state so users always see what they're comparing. Only the
          per-option intervention details collapse. */}
      {!isExpanded && (
        <div className="px-3 pb-2 space-y-0.5">
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5" data-testid="option-preview-collapsed-names">
            {options.map(opt => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFocusNode?.(opt.id)
                  }}
                  className={`${typography.panelBody} text-text-body hover:underline cursor-pointer`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
          {hasSameLeversCheck && (() => {
            const shared = sharedFactorLabels(options)
            return (
              <>
                {shared.length > 0 && (
                  <p
                    className={`${typography.panelMeta} text-text-light`}
                    data-testid="option-preview-overlap-factors"
                  >
                    {`All options route through ${new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(shared)}.`}
                  </p>
                )}
                {/* Brief 4 hotfix Task 6: normalised to full sentence + link
                    in both collapsed and expanded states so coaching is
                    data-driven, not state-driven. */}
                <SameLeversCoaching onSendMessage={onSendMessage} />
              </>
            )
          })()}
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-0">
          {options.map((opt, idx) => (
            <div
              key={opt.id}
              className={`py-2 rounded hover:bg-option-light transition-colors ${idx > 0 ? 'border-t border-panel-border' : ''}`}
              onMouseEnter={() => onHoverEnter?.('node', opt.id)}
              onMouseLeave={() => onHoverLeave?.()}
            >
              {/* Option label + status badge (suppressed when all same) */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFocusNode?.(opt.id)}
                  className={`${typography.panelHeader} text-text-header hover:underline cursor-pointer text-left`}
                >
                  {opt.label}
                </button>
                {!allSameStatus && (
                  opt.status === 'ready' ? (
                    <Pill size="small" variant="success">Ready</Pill>
                  ) : (
                    <Pill size="small" variant="danger">Needs mapping</Pill>
                  )
                )}
              </div>

              {/* Interventions — collapsed per option when v2 panel passes the flag */}
              <OptionInterventions
                option={opt}
                onFocusNode={onFocusNode}
                collapsedByDefault={collapseInterventionsByDefault}
              />
            </div>
          ))}

          {/* Structural similarity coaching line — uses the same shared
              SameLeversCoaching component as the collapsed state so copy
              stays identical across expansion. */}
          {hasSameLeversCheck && (
            <div className="mt-2">
              <SameLeversCoaching onSendMessage={onSendMessage} />
            </div>
          )}

          {/* Ideation CTA */}
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage("What other options should I consider for this decision?")}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-2`}
            >
              Explore more options
            </button>
          )}
        </div>
      )}

      {/* P1-2: Discuss-with-AI sparkle, bottom-right of the option quality card */}
      <div className="absolute bottom-1 right-1">
        <DiscussWithAiButton element={{ kind: 'option', label: firstOptionLabel }} />
      </div>
    </div>
  )
}

export default OptionPreview
