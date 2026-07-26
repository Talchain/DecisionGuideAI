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

/**
 * The wire spells the percent unit as the WORD 'percent' (CEE's
 * `goal_threshold_unit`), but `classifyUnit` recognises only the glyph '%'
 * (see src/utils/unitClassifier.ts — `if (trimmed === '%')`). So 'percent'
 * fell through to `kind: 'other'` and rendered as a trailing suffix:
 * "20 percent" rather than "20%".
 *
 * Surfaced by C2, when the Decision Overview card was routed through this
 * selector: the card's own retired unit mapper DID recognise the word, so the
 * two surfaces disagreed on the same value — the card said "20%" and the
 * pre-analysis hero said "20 percent". Normalising here makes both agree, on
 * the better of the two renderings, without widening `classifyUnit` (a
 * primitive with many other consumers and its own tests).
 */
function normaliseUnitForDisplay(unit: string): string {
  const lower = unit.trim().toLowerCase()
  return lower === 'percent' || lower === 'percentage' ? '%' : unit
}

function formatWithUnit(value: number, unit: string | null): string {
  const formatted = Math.abs(value) >= 1000 ? value.toLocaleString('en-GB') : String(value)
  if (!unit) return formatted
  const { kind, canonical } = classifyUnit(normaliseUnitForDisplay(unit))
  if (kind === 'symbol') return `${canonical}${formatted}`
  if (kind === 'iso') return `${canonical} ${formatted}`
  if (kind === 'percent') return `${formatted}%`
  if (kind === 'placeholder') return formatted
  return `${formatted} ${canonical || unit}`
}

/**
 * Lane 35 fix 2 (claim integrity): does the displayed CEE-derived value match
 * a stored goal constraint the USER stated in their brief?
 *
 * CEE marks goal constraints with provenance 'explicit' when the user's own
 * words carried the number ("keeping churn under 4%" — CEE schemas/assist.ts:
 * explicit | inferred | proxy). A display anchor derived from an explicit
 * constraint is the user's own target — labelling it "Olumi estimate"
 * misattributes it. FAIL-CLOSED matching: the claim "this number is yours"
 * requires an exact value match on an 'explicit'-provenance entry; anything
 * else (inferred/proxy/missing provenance, value mismatch, malformed entry)
 * keeps the Olumi attribution. The constraint objects are stored verbatim
 * from the CEE response root (DraftChat/applyDraftResult), so `provenance`
 * is read defensively — it is not part of the UI's CEEGoalConstraint type.
 */
function matchesExplicitConstraint(
  value: number,
  goalConstraints: readonly unknown[] | null | undefined,
): boolean {
  if (!Array.isArray(goalConstraints)) return false
  return goalConstraints.some((c) => {
    if (c == null || typeof c !== 'object') return false
    const entry = c as Record<string, unknown>
    return entry.provenance === 'explicit' && typeof entry.value === 'number' && entry.value === value
  })
}

export function computeSuccessState(
  goalNode: Node | null,
  analysisReady: Record<string, unknown> | null,
  currentUser: Attribution | null,
  goalConstraints?: readonly unknown[] | null,
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
    // Attribution honesty (lane 35 fix 2): a display anchor whose value the
    // user stated in their brief (explicit-provenance stored constraint) is
    // the USER's target; only derived/defaulted values are Olumi's.
    const userStated = matchesExplicitConstraint(rawCandidate, goalConstraints)
    return {
      isSet: true,
      displayText: formatWithUnit(rawCandidate, unit),
      rawValue: rawCandidate,
      unit,
      attribution: userStated
        ? (currentUser ?? { kind: 'person', displayName: 'You' })
        : { kind: 'olumi' },
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
