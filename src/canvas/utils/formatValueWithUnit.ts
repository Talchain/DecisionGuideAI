/**
 * formatValueWithUnit — shared raw-value formatting utility.
 *
 * Single source of truth for displaying a raw numeric value with its unit
 * across triage cards, expertise rows, and option preview current-state display.
 *
 * Rules (unified spec §2.4):
 * - Currency symbol (£, $, €) prefix without space: £5,000
 * - ISO currency code (GBP, USD, CHF) prefix with space: GBP 5,000
 * - Percentage suffix: 4.5% not % 4.5. ⚠ SUFFIX ONLY — NO ×100, AND THAT IS
 *   CORRECT, NOT A GAP. See "THE PERCENT ARM DOES NOT SCALE" below.
 * - Time/generic units suffix with a space: 3 months, 500 users
 * - Numbers ≥ 1000 get thousand separators (en-GB locale)
 * - Placeholder units (scale/score/index/norm/normalised/unit/units) + 0–1
 *   value → qualitative label. Outside that range, the unit is suppressed
 *   and the bare number is rendered — placeholder units carry no real-world
 *   scale, so "0 score" / "50 index" are misleading.
 * - Proportion units (`ratio` — see `PROPORTION_UNITS`) render the stored
 *   magnitude and the producer's own word, UNINTERPRETED: `0.4 ratio`. Their
 *   magnitude is bounded to four SIGNIFICANT digits rather than four FRACTION
 *   digits. Same honesty budget, an instrument that cannot annihilate a small
 *   value — see "A PROPORTION UNIT'S FIGURE" below. NO ×100 AND NO QUALITATIVE
 *   WORD: both are refused, and the reasons are recorded at `PROPORTION_UNITS`.
 *
 * ⭐⭐ A PROPORTION UNIT'S FIGURE IS PRESERVED, NOT ROUNDED INTO A DIFFERENT
 * NUMBER — AND TWO HARMS WERE SHARING ONE PARAMETER.
 *
 * `BOUNDED_FMT` below is `maximumFractionDigits: 4`, introduced against a
 * measured over-claim: causal-edge means arriving at seventeen significant
 * figures (`0.24782608695652172`). That harm is real and four figures is the
 * right budget for it. But `maximumFractionDigits` caps DECIMAL PLACES, so it
 * answers that harm with an instrument that DESTROYS MAGNITUDE at the small end:
 *
 *     0.00001  → "0"        0.000004 → "0"        0.00004999 → "0"
 *
 * i.e. `0 ratio` for a value that is not zero. Of the two failures that is the
 * worse one — an over-claimed figure is still the value, whereas `0` is a
 * different number, and a proportion unit's values live precisely where the
 * fraction-digit bound bites. `maximumSignificantDigits: 4` states the SAME
 * four-figure budget against significant figures: it bounds the over-claim
 * identically (`0.24782608695652172` → `0.2478`) and cannot annihilate
 * (`0.00001` → `0.00001`). Two questions under one name — trap 21.
 *
 * ⚠ SCOPED TO PROPORTION UNITS, AND THE SCOPE IS THE POINT. The same latent
 * annihilation exists for every other class below 5e-5 (`0.00001 months` →
 * `0 months`; `0.00001 £` → `£0`). That is a real defect and it is NOT fixed
 * here: widening the instrument would move every unit class across ~20 surfaces,
 * which is a separate reviewable change. Both are pinned as UNCHANGED in
 * `__tests__/formatValueWithUnitProportionUnit.spec.ts` so this boundary is
 * provable rather than asserted.
 *
 * ⚠ MEASURED BLAST RADIUS: byte-identical on every value on the founder's board
 * (0.4 / 0.55 / 0.65 / 0.85) and on every other pinned value. Only the
 * annihilating cases move.
 *
 * ⭐⭐ THE PERCENT ARM DOES NOT SCALE, AND THE CONTRACT IS COHERENT — DERIVED
 * 19 SEP 2026 AFTER A SIBLING LANE READ IT AS A DEFECT.
 *
 * `formatValueWithUnit(0.62, '%')` returns `'0.62%'`, not `'62%'`. That was
 * reported as a missing ×100 against the claim that this file's docblock promises
 * one. IT DOES NOT. Measured at the bytes:
 *
 *   - The sentence *"Percent is the one exception: a 0–1 ratio converts to
 *     percentage points (×100) with no cap at all"* appears ZERO times in this
 *     file. It lives at `canvas/nodes/shared/factorPriorRange.ts:298`, describing
 *     THAT function, and is quoted at `utils/unitClassifier.ts:66` as a
 *     description of four OTHER branches. It was attributed here by mistake.
 *   - This file's percent rule is and always was a SUFFIX rule ("4.5% not % 4.5").
 *   - And the input frame is declared immediately below: ALREADY-DENORMALISED
 *     (raw) values only. A raw percent value is already in percentage points, so
 *     scaling it would be the defect.
 *
 * ⭐ ALL THREE PRODUCTION CALLERS HONOUR THAT FRAME, which is why the arm is right:
 *   `conversation/AddOptionPanel.tsx:203`        passes `factor.currentRaw`
 *   `pre-analysis/…/resolveEditorRawValue.ts`   passes `item.cap` (raw, same unit)
 *   `conversation/optimisticFactorEdit.ts:512`  gates `basis !== 'raw_value'` out
 *
 * ⛔ SO DO NOT ADD A ×100 HERE. It would divide nothing and multiply all three of
 * those callers' values by 100 on screen. A caller holding a NORMALISED 0–1
 * quantity must not use this helper at all — that is a caller-frame error, and a
 * sibling lane was right to decline adoption at ~27 percent-suffixed node sites
 * for exactly that reason, even though the finding named this file. The frame
 * declaration is restated up here because reading it fifty lines below the rules
 * is how the misread happened.
 *
 * The residual REAL finding, recorded and NOT fixed here: the ×100 rule has four
 * implementations (`formatFactorDisplayValue:373/469`, `formatInterventionValue`,
 * `formatObservedValueWithUnit`, `factorPriorRange:342`) and no owner. Choosing
 * one is above this lane's scope; this helper is not a candidate, because its
 * contract is raw values.
 *
 * This utility handles ALREADY-DENORMALISED (raw) values only. For intervention
 * values that require cap-based denormalisation, see OptionPreview.tsx
 * formatInterventionDisplay which has its own discrete/cap logic.
 */

import { classifyUnit } from './labelUtils'
import { isProportionUnit } from '@/utils/unitClassifier'

/**
 * The honesty budget for a proportion magnitude, in SIGNIFICANT digits. Four, to
 * match `BOUNDED_FMT`'s four fraction digits — the same claim about how precisely
 * a figure is known, stated with an instrument that cannot round a non-zero value
 * to zero. See the module docblock.
 */
export const PROPORTION_SIGNIFICANT_DIGITS = 4

/** Qualitative label for 0–1 scale values (exclusive upper boundary). */
export function qualitativeLabel(v: number): string {
  if (v < 0.2) return 'very low'
  if (v < 0.4) return 'low'
  if (v < 0.6) return 'moderate'
  if (v < 0.8) return 'high'
  return 'very high'
}

/** Locale-aware number formatter with thousand separators for values ≥ 1000. */
const NUMBER_FMT = new Intl.NumberFormat('en-GB')

/**
 * Values below 1000 — every strength, probability, ratio and rescaled
 * coefficient — bounded to four decimal places.
 *
 * ⚠ THIS BRANCH WAS `String(n)`, AND THE GUARD WAS INVERTED RELATIVE TO RISK:
 * large values (typically a user's own round figure) were formatted, small ones
 * went out at full float width. Measured on a 104-edge corpus from five dated
 * append-only staging captures, **30 of 104 shipped causal-edge means carry more
 * than four decimal places** — e.g. `0.24782608695652172`. They are minted by a
 * rescale (CEE `repair/graph-enforcement.ts:257-263`, a raw float division) and
 * nothing rounds them after: UI ingest clamps but does not round
 * (`applyDraftResult.ts:98`), so all seventeen significant figures reached the
 * screen. Seventeen figures assert a precisely-known quantity for an estimate
 * that is not stable even in its ORDERING between two independent passes
 * (Spearman rho 0.325 global, 0.077 on one brief).
 *
 * FOUR is the measurement's own threshold, so this removes exactly the class
 * measured as wrong and nothing else — and it is deliberately GENEROUS, because
 * this helper renders user-scale figures as often as model-derived ones and a
 * tighter bound would round away precision the user actually supplied.
 *
 * The `>= 1000` branch is untouched: en-GB defaults to three fraction digits
 * there, so widening it would ADD a digit — the wrong direction — and no
 * measurement implicates it.
 *
 * SCOPE — ⚠ CORRECTED, AND THE CORRECTION IS THE POINT. An earlier version of
 * this note said "this changes how precisely a number is CLAIMED, never which
 * number is shown". That is true of a caller rendering ONE value and FALSE of a
 * caller rendering a CONTRAST between two: for those, a display bound coarser
 * than the caller's own difference threshold changes whether two numbers are
 * shown as one. `describeRebaseDivergence` is such a caller — its detector
 * proves a difference at a relative `1e-9` while this bound is `1e-4`, five
 * orders of magnitude apart — and bounding here silently collapsed its sentence
 * into "on top of 0.1235, not the 0.1235 shown on your canvas".
 *
 * So the bound is a DISPLAY POLICY for the value-rendering path, and the
 * `significantDigits` override below is how a contrast caller states the
 * resolution it actually requires. See `optimisticFactorEdit.ts`
 * `describeRebaseDivergence` for the one caller that needs it and why.
 */
const BOUNDED_FMT = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 })

/**
 * `maximumSignificantDigits` formatters, memoised — a contrast caller walks a
 * short ladder of these and would otherwise rebuild `Intl` objects per rung.
 * Clamped to Intl's own accepted range (1–21).
 */
const SIGNIFICANT_FMT = new Map<number, Intl.NumberFormat>()
function significantFmt(digits: number): Intl.NumberFormat {
  const clamped = Math.min(Math.max(Math.trunc(digits), 1), 21)
  let fmt = SIGNIFICANT_FMT.get(clamped)
  if (fmt === undefined) {
    fmt = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: clamped })
    SIGNIFICANT_FMT.set(clamped, fmt)
  }
  return fmt
}

/**
 * Seventeen significant decimal digits uniquely determine an IEEE-754 double,
 * so two DISTINCT finite doubles are guaranteed to render differently at this
 * precision. That is what lets a contrast renderer terminate by proof rather
 * than by hope.
 */
export const DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS = 17

/**
 * Render one number for display.
 *
 * @param n
 * @param significantDigits - OPTIONAL, and it is not a style knob. Supplying it
 *   says "I am rendering this number as part of a CONTRAST and I require this
 *   much resolution", and it overrides BOTH house bounds — the four-fraction
 *   -digit bound below 1000 and en-GB's three-fraction-digit default at and
 *   above it. Callers rendering a single value must not pass it; the house
 *   bound is the honest one for them.
 */
export function formatNumber(n: number, significantDigits?: number): string {
  if (significantDigits !== undefined) return significantFmt(significantDigits).format(n)
  if (Math.abs(n) >= 1000) return NUMBER_FMT.format(n)
  return BOUNDED_FMT.format(n)
}

/**
 * Format a raw value with its unit for panel display.
 *
 * @param rawValue - The denormalised real-world value (not a 0–1 normalised value,
 *                   unless the factor genuinely lives on a 0–1 scale).
 * @param unit     - Optional unit string (e.g. "£", "%", "months", "GBP", "scale").
 * @param significantDigits - OPTIONAL contrast override; see `formatNumber`. It
 *   also suppresses the qualitative branch, because a caller that has stated a
 *   required numeric resolution is asking for a NUMBER — handing it back the
 *   word "moderate" would defeat the request silently, which is the same class
 *   of failure the override exists to close.
 */
export function formatValueWithUnit(
  rawValue: number,
  unit: string | undefined | null,
  significantDigits?: number,
): string {
  const { kind, canonical } = classifyUnit(unit ?? null)
  const num = (n: number) => formatNumber(n, significantDigits)

  if (
    significantDigits === undefined
    && (kind === 'none' || kind === 'placeholder')
    && rawValue >= 0 && rawValue <= 1
  ) {
    return qualitativeLabel(rawValue)
  }
  if (kind === 'none' || kind === 'placeholder') return num(rawValue)
  if (kind === 'symbol') return `${canonical}${num(rawValue)}`
  if (kind === 'iso') return `${canonical} ${num(rawValue)}`
  if (kind === 'percent') return `${num(rawValue)}%`

  /**
   * A proportion unit classifies as `other` — it IS a real unit word, and it
   * keeps it. What changes is only the magnitude instrument: four significant
   * digits instead of four fraction digits, so a small stored value is not
   * rendered as zero. An explicit `significantDigits` outranks the default, which
   * is what keeps `describeRebaseDivergence`'s precision ladder able to terminate
   * by proof at `DOUBLE_ROUND_TRIP_SIGNIFICANT_DIGITS`.
   *
   * ⛔ NO ×100 HERE, DELIBERATELY. The producer names these values
   * `normalised_value`; converting one to a percentage would assert a share of a
   * whole nothing on the wire identifies. See `PROPORTION_UNITS`.
   */
  if (isProportionUnit(unit)) {
    return `${formatNumber(rawValue, significantDigits ?? PROPORTION_SIGNIFICANT_DIGITS)} ${canonical}`
  }

  // kind === 'other' — generic unit (months, users, etc.)
  return `${num(rawValue)} ${canonical}`
}
