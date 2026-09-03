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
 *
 * ⚠ THE SCALE GUARD ABOVE IS NOT THE SAME GUARD AS "IS IT A NUMBER", and this
 * file spent its whole life conflating them. Read the two-questions memo at
 * `computeSuccessState` before touching either predicate: `isSet` answers
 * EXISTENCE and is deliberately non-numeric; `rawValue` answers THE NUMBER and
 * is deliberately strict. Both delegate to `canvas/domain/goalTarget.ts`, which
 * the canvas goal card's own resolver already goes through.
 */

import type { Node } from '@xyflow/react'
import { classifyUnit } from '../../../utils/labelUtils'
import { isStatedTargetValue, statedTargetNumber } from '../../../domain/goalTarget'
import type { Attribution } from '../types'

export interface SuccessState {
  /**
   * EXISTENCE — true when a display-scale success target has been STATED.
   *
   * ⚠ NOT "we have a number for it". A goal stating `'200k'`, `'£11M'` or
   * `'11%'` has a target and no number; `rawValue` is `null` there and `isSet`
   * is `true`. Conflating the two is what made this selector and the canvas
   * goal card give opposite answers about the same goal. Non-finite numbers
   * (`NaN`, `±Infinity`) are refused: nobody states them.
   */
  isSet: boolean
  /**
   * Formatted display text (e.g. "20%", "£150,000"), null when unset.
   *
   * ⚠ `displayText !== null` ⟺ `isSet` on every return site, and
   * `DecisionOverviewCard` derives its own `successIsSet` from exactly that.
   * A stated target with no number renders VERBATIM rather than empty.
   */
  displayText: string | null
  /**
   * THE NUMBER — a numeric prefill for the inline editor, and the only field
   * safe for arithmetic.
   *
   * ⚠ `null` means "no NUMBER", NEVER "no target" — ask `isSet` for that. It
   * is strict on purpose: no coerced `0` for a blank, no `16` for `'0x10'`.
   */
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
 * `goal_threshold_unit`). `classifyUnit` NOW RECOGNISES IT — the word forms
 * were folded into its existing `kind: 'percent'` branch in U2 (see
 * `PERCENT_UNIT_SPELLINGS` in src/utils/unitClassifier.ts).
 *
 * HISTORY, because the reasoning was wrong the first time and the record should
 * say so: C2 added a LOCAL `normaliseUnitForDisplay` here rather than widening
 * `classifyUnit`, on the grounds that the classifier was "a primitive with many
 * other consumers and its own tests". That made this the FIFTH live recogniser
 * of the same word, and the six had already drifted apart — the graph-patch
 * receipt's copy never learned `'percentage'` at all. Having many consumers and
 * its own tests is the argument for widening the primitive ONCE, guarded, not
 * for cloning it. All six copies are retired; the parity is pinned by
 * src/utils/__tests__/percentWordSingleSource.spec.ts.
 */
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

  /**
   * ⭐⭐ EXISTENCE IS DECIDED NON-NUMERICALLY; THE NUMBER STAYS STRICT. This
   * selector was asking ONE question — `typeof … === 'number'` — to answer TWO,
   * and the canvas goal card was answering the other one, so the two surfaces
   * disagreed **about whether the goal has a target at all**.
   *
   * ⚠ WITNESSED AS A PREDICATE DIVERGENCE, NOT A STYLE DIFFERENCE. `GoalNode`
   * (`nodes/GoalNode.tsx:114-117`) counts a target as present with
   * `thresholdRaw != null && String(thresholdRaw).trim() !== ''`, and
   * `SuccessTargetLine` goes through `resolveGoalTarget`, which admits
   * `string | number` with a blank guard at both legs. This selector admitted
   * NUMBERS ONLY. One goal node carrying `goal_threshold_raw: '11'` therefore
   * produced, on one screen:
   *
   *     canvas card   Target: 11
   *     hero field    (empty) · "success needs setting"
   *
   * Same fact, two predicates, opposite answers. The same divergence exists on
   * leg 1 for a user-stated `success_threshold: '20%'`.
   *
   * ⚠⚠ AND THE FIX IS NOT TO ALIGN TWO DEFAULTS — trap 21 forbids that, and it
   * would be the wrong move here even so. The two things this selector returns
   * answer different questions and now use different predicates:
   *
   *   `isSet`               EXISTENCE — has anyone STATED a target?  Broad.
   *                         True of `'200k'`, `'£11M'`, `'11%'`, `'≥ £1,000'` —
   *                         real targets no `number | null` can hold.
   *   `rawValue`            THE NUMBER — what may a numeric consumer use? Strict.
   *                         `null` means "no NUMBER", never "no target".
   *
   * Both come from `domain/goalTarget.ts`, the shared owner, so a future
   * divergence has to go through one function. Read its two-questions memo
   * before widening or tightening either.
   *
   * ⚠ NON-FINITE NUMBERS ARE NOT TARGETS, and that is a DELIBERATE narrowing.
   * `typeof NaN === 'number'`, so a bare `NaN` used to reach `formatWithUnit`
   * and render the literal **"NaN"** in the hero field. It is refused at both
   * predicates now. The canvas card still renders it (`String(NaN)` is not
   * blank) — that file belongs to another lane tonight and is pinned as a
   * KNOWN-DIVERGENT shape on the cross-surface spec rather than silently left
   * out of it. It is not reachable over the wire: JSON cannot encode `NaN`.
   *
   * ⚠ THE `displayText !== null ⟺ isSet` COUPLING IS LOAD-BEARING and pinned by
   * `DecisionOverviewCard.primitiveSelectors.spec.tsx` — that card derives
   * `successIsSet` from `displayText !== null` and nothing else. A stated
   * target with no number therefore renders VERBATIM (the same fallback
   * `SuccessTargetLine` uses), never an empty string.
   */

  // 1. User-set measure: the user's own target, on the scale they typed it.
  const userStatedTarget = data.threshold_source === 'user' ? data.success_threshold : undefined
  if (isStatedTargetValue(userStatedTarget)) {
    const numeric = statedTargetNumber(userStatedTarget)
    return {
      isSet: true,
      displayText:
        numeric !== null ? formatWithUnit(numeric, unit) : String(userStatedTarget).trim(),
      rawValue: numeric,
      unit,
      attribution: currentUser ?? { kind: 'person', displayName: 'You' },
      scaleAmbiguous: false,
    }
  }

  // 2. CEE-derived measure with a display-scale anchor.
  const rawCandidate = isStatedTargetValue(data.goal_threshold_raw)
    ? data.goal_threshold_raw
    : isStatedTargetValue(analysisReady?.goal_threshold_raw)
      ? analysisReady?.goal_threshold_raw
      : undefined
  if (rawCandidate !== undefined) {
    const numeric = statedTargetNumber(rawCandidate)
    // Attribution honesty (lane 35 fix 2): a display anchor whose value the
    // user stated in their brief (explicit-provenance stored constraint) is
    // the USER's target; only derived/defaulted values are Olumi's.
    //
    // ⚠ FAIL-CLOSED ON A TARGET WITH NO NUMBER. `matchesExplicitConstraint`
    // compares numbers; a stated `'200k'` cannot be matched against one, so it
    // keeps the Olumi attribution rather than borrowing the user's voice —
    // which is what that helper's own header demands of every unmatched case.
    const userStated = numeric !== null && matchesExplicitConstraint(numeric, goalConstraints)
    return {
      isSet: true,
      displayText: numeric !== null ? formatWithUnit(numeric, unit) : String(rawCandidate).trim(),
      rawValue: numeric,
      unit,
      attribution: userStated
        ? (currentUser ?? { kind: 'person', displayName: 'You' })
        : { kind: 'olumi' },
      scaleAmbiguous: false,
    }
  }

  // 3. Normalised-only threshold: present on the wire but not displayable —
  //    degrade to unset (value-scale guard) and surface the ambiguity flag.
  //
  // ⚠ FINITE, not `typeof === 'number'`. A `NaN` here is not a normalised
  // threshold we cannot express — it is nothing at all, and flagging it
  // `scaleAmbiguous` would tell the user a value exists that never did.
  const normalisedOnly =
    Number.isFinite(data.goal_threshold) ||
    Number.isFinite(data.success_threshold) ||
    Number.isFinite(analysisReady?.goal_threshold)
  return { ...unset, scaleAmbiguous: normalisedOnly }
}
