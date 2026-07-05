/**
 * interventionDisplay — the SINGLE formatter for option-intervention change
 * statements (graph coaching audit §8 P0-4).
 *
 * Every surface that renders "what an option does to a factor" must derive
 * its statement from here so the same input can never produce contradictory
 * claims (the live bug: "→ 60%" / "Does not change Team Seniority" / "↑ 20%"
 * for the same 0.5→0.6 intervention).
 *
 * Consumers:
 *  - OptionNode delta pills (structuredDeltas)
 *  - OptionNode hover popover + "What this option changes:" lists
 *  - FactorNode on-canvas "→ value" annotation during option hover
 *  - computeAllDifferentiators directional fallback
 *
 * Rules:
 *  - "No change" fires ONLY on exact equality of the raw stored values
 *    (epsilon 1e-9 — never a display-rounding epsilon like 0.1).
 *  - Values render in DISPLAY UNITS via the existing option-card formatting
 *    chain (formatFactorDisplayValue → formatInterventionValue → % fallback).
 *    No new unit logic is introduced here.
 *  - CEE-authored display_value renders verbatim (F.6 passthrough) and is
 *    never rewritten — the count-unit singularisation below applies only to
 *    UI-formatted numeric text.
 */

// UI-SEM-064: shared intervention-change formatter (no-change epsilon,
// count-unit singularisation, tier→percentage rendering). Display only.
import { formatPercent } from '../../utils/formatPercent'
import {
  formatInterventionValue,
  denormaliseInterventionValue,
  inferInterventionScaleBase,
  isSuppressedUnit,
  isCountUnit,
  isTierLabel,
} from './labelUtils'
import { formatFactorDisplayValue } from '../../utils/formatFactorDisplayValue'

/**
 * Maximum tolerated difference between baseline and target for a "no change"
 * claim. Exact-equality semantics: this exists only to absorb float noise
 * from serialisation, never to round away real interventions.
 */
export const INTERVENTION_NO_CHANGE_EPSILON = 1e-9

/** Factor/value context needed to format one side of an intervention. */
export interface InterventionValueInput {
  /** Cleaned factor label (used by contextual binary formatting only). */
  label: string
  /** Normalised (0–1 or raw) intervention value. */
  value: number
  /** CEE-authored display_value for THIS value — rendered verbatim when present. */
  displayValue?: string
  unit?: string
  factorType?: string
  cap?: number
  observedValue?: number
  observedRawValue?: string | number
}

export interface InterventionChangeInput {
  /** Baseline (pre-intervention) normalised value; null/undefined when unknown. */
  baselineValue?: number | null
  /** Target (intervention) normalised value; null when only a displayValue exists. */
  targetValue: number | null
  /** Compact/cleaned factor label used in sentence forms. */
  label: string
  unit?: string | null
  factorType?: string | null
  cap?: number | null
  observedValue?: number | null
  observedRawValue?: string | number | null
  /** CEE display_value for the TARGET intervention — verbatim wins. */
  targetDisplayValue?: string | null
}

export interface InterventionChange {
  /** False ONLY when baseline and target are both known and exactly equal. */
  changed: boolean
  /** Direction of change; null when unchanged or baseline unknown. */
  arrow: 'up' | 'down' | null
  /**
   * Canonical one-line statement:
   *  - unchanged            → "Does not change {label}"
   *  - changed, formattable → "{label} → {targetText}"
   *  - changed, no text     → "Increases {label}" / "Decreases {label}"
   *  - baseline unknown, no text → "Changes {label}"
   */
  text: string
  /** Formatted target in display units ('' when unformattable). */
  targetText: string
  /** Formatted baseline in display units ('' when unknown/unformattable). */
  baselineText: string
}

/**
 * Singularise count-like units for a value of exactly 1: "1 engineers" →
 * "1 engineer". Applies ONLY to UI-formatted text for units in COUNT_UNITS —
 * CEE display_value strings are never touched.
 */
function singulariseCountUnitText(text: string, unit: string | null | undefined): string {
  if (!text || !unit || !isCountUnit(unit)) return text
  const match = /^1\s+(.+)$/.exec(text.trim())
  if (!match) return text
  const suffix = match[1]
  if (suffix.toLowerCase() === unit.trim().toLowerCase() && /s$/i.test(suffix)) {
    return `1 ${suffix.slice(0, -1)}`
  }
  return text
}

/**
 * Format a single intervention value in display units.
 *
 * This is the former OptionNode.formatChipValue, promoted to the shared
 * module so every surface uses one chain:
 *   1. CEE display_value verbatim
 *   2. formatFactorDisplayValue contextual (raw_value + unit, binary text, …)
 *   3. formatInterventionValue numeric fallback
 *   4. tier labels / raw normalised decimals → percentage
 * plus count-unit singularisation on UI-formatted output.
 */
export function formatInterventionTargetText(chip: InterventionValueInput): string {
  // CEE-provided display_value wins over any UI-side formatting (verbatim).
  if (chip.displayValue) return chip.displayValue
  // Denormalise the 0–1 intervention value when a real-world scale exists.
  // Coherence fix (audit §8 P0-4): the option-card chip previously used the
  // crude `value × cap` while the on-canvas annotation used the T3-trusted
  // denormaliseInterventionValue (raw_value-anchored proportional mapping) —
  // the two surfaces could show different numbers for the same intervention.
  // Both now use the trusted path; it degrades to `value × cap` when no
  // raw anchor exists, so anchor-less behaviour is unchanged.
  const effectiveUnit = chip.unit && !isSuppressedUnit(chip.unit) ? chip.unit : null
  const scaleBase = inferInterventionScaleBase(chip.cap ?? null, chip.observedValue, chip.observedRawValue)
  let rawValue: number | string | null = null
  if (effectiveUnit && scaleBase != null && scaleBase > 1) {
    const raw = denormaliseInterventionValue(chip.value, chip.cap ?? null, chip.observedValue, chip.observedRawValue)
    // Clean float-precision artefacts: count/headcount units render as whole
    // numbers; other units keep ≤2 decimals. Display-only.
    rawValue = isCountUnit(effectiveUnit) ? Math.round(raw) : Math.round(raw * 100) / 100
  }
  const contextual = formatFactorDisplayValue({
    label: chip.label,
    value: chip.value,
    raw_value: rawValue,
    unit: effectiveUnit,
    factor_type: chip.factorType ?? null,
    cap: chip.cap ?? null,
  })
  if (contextual) return singulariseCountUnitText(contextual, effectiveUnit)
  // Fallback: prefer numeric formatting over qualitative tier labels and raw normalised values
  const fallback = formatInterventionValue(chip.value, chip.unit, chip.factorType, chip.cap, chip.observedValue, chip.observedRawValue)
  // Tier labels → percentage (tier words are meaningless as change targets)
  if (isTierLabel(fallback)) {
    return formatPercent(chip.value, { fromDecimal: true })
  }
  // Raw normalised number (no unit, value in [0,1] like "0.15") → percentage
  if (!effectiveUnit && chip.value >= 0 && chip.value <= 1 && /^0\.\d+$/.test(fallback)) {
    return formatPercent(chip.value, { fromDecimal: true })
  }
  return singulariseCountUnitText(fallback, effectiveUnit)
}

/** True ONLY when both values are known and exactly equal (float-noise epsilon). */
export function isInterventionNoChange(
  baselineValue: number | null | undefined,
  targetValue: number | null | undefined,
): boolean {
  if (baselineValue == null || targetValue == null) return false
  return Math.abs(targetValue - baselineValue) <= INTERVENTION_NO_CHANGE_EPSILON
}

/**
 * Direction-only sentence for a factor change. Replaces the old
 * placeholderDirectionLabel(±0.1 epsilon) semantics: any real difference is
 * a change — "Does not change" requires exact equality.
 */
export function describeInterventionDirection(
  baselineValue: number | null | undefined,
  targetValue: number,
  label: string,
): string {
  if (baselineValue == null) return `Changes ${label}`
  if (isInterventionNoChange(baselineValue, targetValue)) return `Does not change ${label}`
  return targetValue > baselineValue ? `Increases ${label}` : `Decreases ${label}`
}

/**
 * The single intervention-change formatter. All option-intervention
 * renderings derive {changed, arrow, text} (and the shared value texts)
 * from this function.
 */
export function formatInterventionChange(input: InterventionChangeInput): InterventionChange {
  const { baselineValue, targetValue, label } = input

  const valueContext = {
    label,
    unit: input.unit ?? undefined,
    factorType: input.factorType ?? undefined,
    cap: input.cap ?? undefined,
    observedValue: input.observedValue ?? undefined,
    observedRawValue: input.observedRawValue ?? undefined,
  }

  // "No change" ONLY on exact equality of known values. Unknown baseline can
  // never claim "no change" (and claims no direction either). Checked FIRST:
  // no-change chips are discarded by every consumer, so formatting both
  // sides through the full denormalise/singularise chain would be pure
  // throwaway work on hot hover/render paths.
  const unchanged = isInterventionNoChange(baselineValue, targetValue)
  const changed = !unchanged

  const targetText = changed && (targetValue != null || input.targetDisplayValue)
    ? formatInterventionTargetText({
        ...valueContext,
        value: targetValue ?? 0,
        displayValue: input.targetDisplayValue ?? undefined,
      })
    : ''
  const baselineText = changed && baselineValue != null
    ? formatInterventionTargetText({ ...valueContext, value: baselineValue })
    : ''
  const arrow: 'up' | 'down' | null =
    changed && baselineValue != null && targetValue != null
      ? (targetValue > baselineValue ? 'up' : 'down')
      : null

  let text: string
  if (!changed) {
    text = `Does not change ${label}`
  } else if (targetText) {
    text = `${label} → ${targetText}`
  } else if (targetValue != null) {
    text = describeInterventionDirection(baselineValue, targetValue, label)
  } else {
    text = `Changes ${label}`
  }

  return { changed, arrow, text, targetText, baselineText }
}
