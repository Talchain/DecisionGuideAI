/**
 * computeSuccessState — the hero success-measure field model.
 *
 * Value-scale guard (approved correction, cee-plot-flip value-scale boundary):
 * the displayed value and unit come from raw display-scale fields only —
 * the user's own success_threshold (threshold_source 'user') or the CEE
 * goal_threshold_raw + unit. A normalised-only goal_threshold is never
 * displayed and never counts as "set": the user cannot see or meaningfully
 * confirm a number on a scale they were never shown. Occurrences of that
 * degradation are listed in the build report.
 */

import type { Node } from '@xyflow/react'
import { classifyUnit } from '../../../utils/labelUtils'
import type { Attribution } from '../types'

export interface SuccessState {
  /** True when an honest display-scale success measure exists. */
  isSet: boolean
  /** Formatted display text (e.g. "20%", "£150,000"), null when unset. */
  displayText: string | null
  /** Numeric prefill for the inline editor. */
  rawValue: number | null
  unit: string | null
  attribution: Attribution | null
  /**
   * True when a normalised-only threshold exists but cannot be displayed —
   * the value-scale degradation case (reported, not rendered).
   */
  scaleAmbiguous: boolean
}

function formatWithUnit(value: number, unit: string | null): string {
  const formatted = Math.abs(value) >= 1000 ? value.toLocaleString('en-GB') : String(value)
  if (!unit) return formatted
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'symbol') return `${canonical}${formatted}`
  if (kind === 'iso') return `${canonical} ${formatted}`
  if (kind === 'percent') return `${formatted}%`
  if (kind === 'placeholder') return formatted
  return `${formatted} ${canonical || unit}`
}

export function computeSuccessState(
  goalNode: Node | null,
  analysisReady: Record<string, unknown> | null,
  currentUser: Attribution | null,
): SuccessState {
  const unset: SuccessState = {
    isSet: false,
    displayText: null,
    rawValue: null,
    unit: null,
    attribution: null,
    scaleAmbiguous: false,
  }
  if (!goalNode) return unset

  const data = goalNode.data as Record<string, unknown>
  const unit =
    (typeof data.goal_threshold_unit === 'string' && data.goal_threshold_unit) ||
    (typeof analysisReady?.goal_threshold_unit === 'string' &&
      (analysisReady.goal_threshold_unit as string)) ||
    null

  // 1. User-set measure: the user's own number, on the scale they typed it.
  if (data.threshold_source === 'user' && typeof data.success_threshold === 'number') {
    return {
      isSet: true,
      displayText: formatWithUnit(data.success_threshold, unit),
      rawValue: data.success_threshold,
      unit,
      attribution: currentUser ?? { kind: 'person', displayName: 'You' },
      scaleAmbiguous: false,
    }
  }

  // 2. CEE-derived measure with a display-scale anchor.
  const rawCandidate =
    (typeof data.goal_threshold_raw === 'number' ? data.goal_threshold_raw : undefined) ??
    (typeof analysisReady?.goal_threshold_raw === 'number'
      ? (analysisReady.goal_threshold_raw as number)
      : undefined)
  if (rawCandidate != null) {
    return {
      isSet: true,
      displayText: formatWithUnit(rawCandidate, unit),
      rawValue: rawCandidate,
      unit,
      attribution: { kind: 'olumi' },
      scaleAmbiguous: false,
    }
  }

  // 3. Normalised-only threshold: present on the wire but not displayable —
  //    degrade to unset (value-scale guard) and surface the ambiguity flag.
  const normalisedOnly =
    typeof data.goal_threshold === 'number' ||
    typeof data.success_threshold === 'number' ||
    typeof analysisReady?.goal_threshold === 'number'
  return { ...unset, scaleAmbiguous: normalisedOnly }
}
