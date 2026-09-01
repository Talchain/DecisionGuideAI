/**
 * `resolveFactorPriorRange` — the "Range: a to b" line an EXTERNAL factor
 * carries when nobody has stated a point value for it.
 *
 * ⭐ WHY THIS IS A MODULE AND NOT A `useMemo` IN `FactorNode`.
 *
 * It was a `useMemo` in `FactorNode`, and that is precisely why the canvas went
 * blank when a user zoomed out. Below the legibility floor a node renders ONE
 * reduced line, resolved by `lodMetricLine.ts` — which could not see this
 * derivation, because it lived inside the component that renders the full card.
 * So on a pre-analysis model, where a factor's only figure IS its prior range,
 * the reduced line asked for a stated value and an influence score, found
 * neither, and rendered nothing. Measured on deployed `f3b1ca87`: three of the
 * three range-bearing factors on the Headcount starter went blank at 0.49 zoom
 * while their cards plainly read "Range: 0.3 to 0.9" one zoom step above.
 *
 * ⛔ THE RULE THIS PRESERVES: the reduced line READS THE OWNER, it never
 * recomputes. A second copy of this arithmetic living in `lodMetricLine.ts`
 * would be the estate's dominant defect (CLAUDE.md trap 12) in its worst
 * location — the two renderings are two pixels apart on the zoom ladder, and
 * the body the low-zoom line would disagree with is HIDDEN, so nothing on
 * screen could ever show the disagreement.
 *
 * Behaviour is byte-for-byte what `FactorNode` shipped; only the location
 * changed. The dedupe arm still takes the caller's own `valueDisplay`, because
 * the two callers legitimately resolve that string by different entry points
 * (the card via `formatFactorDisplayValue`, the reduced line via
 * `factorDisplayText`) and neither may be assumed for the other.
 */
import { isUnquantifiedPrior } from '../../domain/nodes'
import { classifyUnit, formatRawValueWithUnit, isSuppressedUnit } from '../../utils/labelUtils'

/**
 * Parse a display string that is a BARE numeric range ("0.2 to 0.8",
 * "20 – 80", "20,000-80,000"). Anything else — prose, currency-formatted
 * ranges ("£20,000 to £80,000"), unit-suffixed values — returns null.
 * Used only for the prior-range dedupe below.
 */
function parseBareNumericRange(text: string): readonly [number, number] | null {
  const m = text.trim().match(/^(-?[\d,]*\.?\d+)\s*(?:to|[–—-])\s*(-?[\d,]*\.?\d+)$/i)
  if (!m) return null
  const a = Number(m[1].replace(/,/g, ''))
  const b = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return [a, b]
}

/** Relative-epsilon numeric equality for the dedupe check (never string-fuzzy). */
function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/**
 * True when `text` is a bare numeric range that duplicates the prior's
 * range_min/max — matched NUMERICALLY (lane C3), in either normalised form
 * ("0.2 to 0.8") or cap-denormalised form ("20 to 80" with cap 100).
 */
function bareNumericRangeMatchesPrior(
  text: string,
  rangeMin: number,
  rangeMax: number,
  cap: number | null | undefined,
): boolean {
  const parsed = parseBareNumericRange(text)
  if (!parsed) return false
  const [a, b] = parsed
  if (nearlyEqual(a, rangeMin) && nearlyEqual(b, rangeMax)) return true
  if (cap != null && cap > 1 && nearlyEqual(a, rangeMin * cap) && nearlyEqual(b, rangeMax * cap)) {
    return true
  }
  return false
}

/** Normalised (0–1) range end for unitless display: ≤2 dp, trailing zeros trimmed. */
function formatNormalisedRangeEnd(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
}

export interface FactorPriorRangeInputs {
  /** The node's `data`, read and never rewritten. */
  data: Record<string, unknown> | undefined
  /** `data.category` — only `'external'` factors carry a displayable prior. */
  nodeCategory: string | undefined
  /** The node's observed state, for the unit and the cap. */
  observedState: { unit?: string | null; cap?: number | null } | undefined
  /**
   * The value string the CALLER would otherwise render for this factor, for
   * the repetition dedupe. Pass `null` when the caller renders no value.
   */
  valueDisplay: string | null
}

/**
 * Prior range for external factors (only the range values, no "Variable"
 * prefix). Lane C3: prior.range_min/max are NORMALISED 0–1 values. Only a
 * real-world unit (currency, %, months, …) justifies cap-denormalising and
 * suffixing a unit; generic placeholder units ("scale", "index", …) must
 * never render as if measured — "0.5 scale" looks measured but isn't (see
 * GENERIC_PLACEHOLDER_UNITS doctrine in labelUtils). Classification goes
 * through the shared classifyUnit, and real-unit formatting through the
 * shared formatRawValueWithUnit, so this path can no longer drift from the
 * other formatters (it previously had a local fmt() with its own hardcoded
 * ['£','$','€','¥'] list that leaked "Range: 20 scale to 80 scale").
 */
export function resolveFactorPriorRange({
  data,
  nodeCategory,
  observedState,
  valueDisplay,
}: FactorPriorRangeInputs): string | null {
  const prior = data?.prior as { range_min?: number; range_max?: number } | undefined
  const rangeMin = prior?.range_min
  const rangeMax = prior?.range_max
  // ⭐⭐ AN IGNORANCE PRIOR IS NOT A RANGE TO PRINT.
  //
  // ⚠ THIS ARM IS REACHABLE, AND A FIRST READING SAID IT WAS NOT. Two writers
  // of the flagged prior (`normalisation.ts`, `deterministic-sweep.ts`) are on
  // the CONTROLLABLE arm, so this site was once deferred as unreachable. There
  // is a THIRD writer: `unified-pipeline/stages/repair/unreachable-factors.ts`
  // sets `node.category = "external"` (:446) and then writes
  // `buildUnquantifiedPrior()` (:750) — SAME node, SAME loop iteration, no
  // intervening scope (verified at CEE `8a4564e5`). So an EXTERNAL factor does
  // carry the flag, and CEE's own comment there names this surface:
  // *"instead of printing a bare `Range: 0 to 1`"*.
  //
  // ⚠ AND THE HARM IS WORSE THAN AN UNFIXED SIBLING. `Range: 0 to 1` is
  // PRE-EXISTING here; what the honest-unknown sentence adds is a
  // CONTRADICTION BESIDE IT — the node saying "No estimate yet" and
  // "Range: 0 to 1" at once, the second being exactly the claim the first was
  // written to replace. Suppressing the range is what stops the pair
  // co-rendering, and that pairing is pinned in the spec.
  //
  // Suppressing the LINE is not hiding the STATE: the honest sentence and the
  // evidence-gap badge both render on this node and say what is true.
  if (isUnquantifiedPrior(prior)) return null
  // Both endpoints must be finite numbers: `!range_min` truthiness would
  // drop the line for range_min === 0 (a perfectly good lower bound), and
  // Infinity/NaN must never render ("Range: Infinity to …").
  if (
    nodeCategory !== 'external' ||
    typeof rangeMin !== 'number' || !Number.isFinite(rangeMin) ||
    typeof rangeMax !== 'number' || !Number.isFinite(rangeMax)
  ) return null
  const cap = observedState?.cap
  // Internal factor_type descriptors ('binary', 'normalised', …) must never
  // display as units — treat as unitless (same guard as the card's value row).
  const rawUnit = observedState?.unit
  const unit = rawUnit && !isSuppressedUnit(rawUnit) ? rawUnit : null
  const { kind } = classifyUnit(unit)
  // Only a cap > 1 can turn the normalised 0–1 prior back into real-world
  // magnitude. Percent is the one exception: a 0–1 ratio converts to
  // percentage points (×100) with no cap at all.
  const canCalibrate = cap != null && cap > 1

  if (kind === 'none' || kind === 'placeholder' || (kind !== 'percent' && !canCalibrate)) {
    // No real-world calibration: cap-denormalising would fake a measurement,
    // so render the normalised range unitless — UNLESS the node body already
    // shows this same range via the CEE-authored display_value (numeric
    // dedupe against both normalised and cap-denormalised forms). The
    // display_value line wins because it is CEE-authored copy; the Range
    // line adds nothing when it repeats the same numbers.
    // A real unit WITHOUT a usable cap lands here too: prefixing a
    // normalised 0–1 endpoint with "£" fakes calibration exactly like a
    // placeholder unit would (and Math.round would grind it to "£0 to £1").
    if (valueDisplay != null && bareNumericRangeMatchesPrior(valueDisplay, rangeMin, rangeMax, cap)) {
      return null
    }
    return `Range: ${formatNormalisedRangeEnd(rangeMin)} to ${formatNormalisedRangeEnd(rangeMax)}`
  }

  // Real unit with calibration (or percent): the Range line adds calibrated
  // information (e.g. "£20,000 to £80,000"). Denormalise via cap, then
  // format through the shared classifyUnit-based raw formatter (symbol
  // prefix "£20,000", ISO prefix "USD 20,000", "%" / "months" suffix).
  const fmt = (v: number) => {
    let denormed = canCalibrate ? v * cap : v
    // Percent with no usable cap: the 0–1 prior is a ratio — scale to
    // percentage points (0.2 → 20%, 1 → 100%), mirroring
    // formatFactorDisplayValue's percent rule. Keyed on CAP PRESENCE, not
    // value magnitude: a cap-denormalised value is already in percentage
    // points and must never be re-scaled (cap 100, range_min 0.005
    // denormalises to 0.5, meaning 0.5% — not 50%).
    if (kind === 'percent' && !canCalibrate) denormed *= 100
    // Integer rounding is only honest at magnitude ≥ 1; sub-1 calibrated
    // values (0.5 percentage points) keep two decimal places.
    const rounded = Math.abs(denormed) >= 1 ? Math.round(denormed) : Math.round(denormed * 100) / 100
    return formatRawValueWithUnit(rounded, unit)
  }
  const rendered = `${fmt(rangeMin)} to ${fmt(rangeMax)}`
  // Dedupe: a CEE-authored display_value that is EXACTLY the calibrated
  // range text (e.g. "£20,000 to £80,000") makes the Range line pure
  // repetition. Exact-string equality only — both sides must have come
  // through the same formatter to collide, so this is numerically faithful
  // and can never fuzzy-match prose or differently-scaled values. A bare
  // numeric display_value ("20000 to 80000") deliberately does NOT dedupe
  // here: the calibrated Range line still adds the unit information.
  if (valueDisplay != null && valueDisplay.trim() === rendered) return null
  return `Range: ${rendered}`
}
