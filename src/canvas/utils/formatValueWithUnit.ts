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
 * - A magnitude the four-fraction-digit bound would render as `0` (anything
 *   non-zero below 5e-5) falls back to two SIGNIFICANT digits instead, so no
 *   real value is ever reported as nothing. A true zero stays `0`. See
 *   `formatNumber`.
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
 * ⚠⚠ THE PROPORTION-ONLY SCOPE ABOVE IS SUPERSEDED — R9 CLOSED IT. The paragraph
 * that stood here said the same annihilation for every OTHER class below 5e-5
 * (`0.00001 months` → `0 months`; `0.00001 £` → `£0`) was "a real defect and it
 * is NOT fixed here … a separate reviewable change", and pinned both as UNCHANGED
 * so the boundary would be provable. That separate change has now been made, in
 * `formatNumber` itself, and those two pins were MOVED deliberately — see
 * `formatNumber`'s own docblock for the rule and
 * `__tests__/formatNumber.smallMagnitudeRescue.spec.ts` for the enumerated blast
 * radius. This note is kept rather than deleted because the sentence it replaces
 * described behaviour that is no longer the code's, and a stale scope claim in the
 * paragraph every reader starts from is exactly the hand-maintained mirror this
 * estate keeps paying for.
 *
 * ⚠ THE TWO INSTRUMENTS ARE STILL DIFFERENT, AND THAT IS DELIBERATE. A proportion
 * unit takes FOUR significant digits UNCONDITIONALLY (#1747, because a proportion
 * value lives where the fraction bound bites). Every other class keeps the
 * four-fraction-digit house bound and falls back to TWO significant digits ONLY
 * where that bound erased the magnitude (#1742's reviewed pattern). Same harm,
 * two budgets, because the value populations differ — not an inconsistency to
 * reconcile.
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
 * The resolution a rescued magnitude is rendered at, in SIGNIFICANT digits, when
 * the house bound has erased it entirely. TWO, deliberately: enough to make the
 * magnitude and its sign visible, few enough not to imply precision this class of
 * value does not have. Adopted unchanged from the reviewed fix at #1742's three
 * call sites, so the centre and the edges cannot give two answers to one
 * question.
 */
export const ERASED_MAGNITUDE_SIGNIFICANT_DIGITS = 2

/**
 * Render one number for display.
 *
 * ⭐⭐ THE HOUSE BOUND MAY NOT REPORT A REAL MAGNITUDE AS NOTHING — R9, the
 * durable version of a fix previously made twice at the edges.
 *
 * `BOUNDED_FMT` is `maximumFractionDigits: 4`, which is right for the over-claim
 * it was adopted to close (a 17-figure raw double reaching the founder) and WRONG
 * below 5e-5, where it renders a real non-zero magnitude as `0` — and `-0.00001`
 * as `-0`, which is worse, because the SIGN survives while the MAGNITUDE does
 * not: the reader is given the direction of a quantity that is simultaneously
 * reported as nothing.
 *
 * ── HISTORY, BECAUSE IT DECIDES THE SHAPE OF THIS FIX ───────────────────────
 * #1742 fixed three `ui/inspector-v2` callers and recorded that "the durable fix
 * is for `formatNumber` itself to stop erasing small magnitudes, which would fix
 * every consumer in the estate at once; that file has a different owner". #1747
 * then fixed it for PROPORTION units here, and scoped itself explicitly: the
 * remaining classes "NOT fixed here … a separate reviewable change", with
 * `0.00001 months → "0 months"` pinned UNCHANGED so the boundary was provable.
 * This is that change, and it moves those pins deliberately.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Keep the house bound; fall back to significant digits ONLY when the house bound
 * has erased a non-zero magnitude. `Number(housed) === 0` is the test for
 * "erased", and it also covers `'-0'` (`-0 === 0` is true in JS).
 *
 * ⚠ A STORED `-0` IS LEFT ALONE, in both arms. `-0 !== 0` is FALSE, so the second
 * conjunct excludes it — correctly: `-0` is the value the model holds, not an
 * erased magnitude.
 *
 * ⚠ THE `>= 1000` BRANCH IS EXCLUDED STRUCTURALLY, not by luck. The rescue lives
 * inside the sub-1000 arm, so a grouped value can never reach it. That matters
 * because two significant digits would round `22,500.5` to `22,000` — rounding a
 * PRODUCER value to solve a DISPLAY problem, which is banned. (It is doubly
 * excluded: `Number('22,500.5')` is `NaN` and `NaN === 0` is false, which is the
 * argument the three merged call sites rely on. Placing the branch inside the
 * sub-1000 arm makes it independent of locale grouping as well.)
 *
 * ⚠ NON-FINITE INPUT PASSES THROUGH. `BOUNDED_FMT.format(NaN)` is `'NaN'`, which
 * parses back to `NaN`, and `NaN === 0` is false — so no rescue is attempted on a
 * value that has no magnitude to preserve.
 *
 * ⚠ KNOWN, REPORTED BOUND: two-significant-digit DECIMAL notation grows with the
 * exponent (1e-8 → 10 characters, 1e-17 → 19, 1e-30 → 32, 5e-324 → 326).
 * Realistic producer values sit in the first band. This is inherited unchanged
 * from the pattern already merged at #1742's three call sites; widening it into an
 * exponential arm would be a new display grammar and a second answer to one
 * question, so it is pinned in the spec as a known width set and reported rather
 * than fixed here.
 *
 * ⚠ AND WHAT THIS DOES NOT FIX, MEASURED: just ABOVE the threshold the house
 * bound OVER-claims by up to 66% (`0.00006 → "0.0001"`). That is a property of
 * `maximumFractionDigits: 4` itself, is untouched here, and is pinned UNCHANGED.
 *
 * @param n
 * @param significantDigits - OPTIONAL, and it is not a style knob. Supplying it
 *   says "I am rendering this number as part of a CONTRAST and I require this
 *   much resolution", and it overrides BOTH house bounds — the four-fraction
 *   -digit bound below 1000 and en-GB's three-fraction-digit default at and
 *   above it — AND the rescue below, because a caller that has stated its own
 *   resolution has already answered this question. Callers rendering a single
 *   value must not pass it; the house bound, rescued, is the honest one for them.
 *   This is what keeps #1747's proportion arm (which passes an explicit four) and
 *   `describeRebaseDivergence`'s precision ladder byte-identical.
 */
export function formatNumber(n: number, significantDigits?: number): string {
  if (significantDigits !== undefined) return significantFmt(significantDigits).format(n)
  if (Math.abs(n) >= 1000) return NUMBER_FMT.format(n)
  const housed = BOUNDED_FMT.format(n)
  if (Number(housed) === 0 && n !== 0) {
    return significantFmt(ERASED_MAGNITUDE_SIGNIFICANT_DIGITS).format(n)
  }
  return housed
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
