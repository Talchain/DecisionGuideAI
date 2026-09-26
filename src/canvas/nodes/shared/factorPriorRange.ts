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
 * The extraction was byte-for-byte what `FactorNode` shipped. ⚠ TWO behaviour
 * changes have landed since: the dedupe arm now also declines when the
 * caller's value line CONTRADICTS the scale the normalised range would print on
 * (see `displayedValueIsOffTheNormalisedScale`, and the journey witness quoted
 * there); and a USER-OWNED value restates the range as replaced rather than
 * live (see `userValueReplacesPrior`). The dedupe arm still takes the caller's own
 * `valueDisplay`, because
 * the two callers legitimately resolve that string by different entry points
 * (the card via `formatFactorDisplayValue`, the reduced line via
 * `factorDisplayText`) and neither may be assumed for the other.
 */
import { isUnquantifiedPrior, priorEndpointsAreNormalised } from '../../domain/nodes'
import { classifyValueProvenance } from '../../domain/valueProvenance'
import { getObservedState } from '../../utils/observedStateHelpers'
import { classifyUnit, formatRawValueWithUnit, isSuppressedUnit } from '../../utils/labelUtils'

/**
 * ⭐⭐ A VALUE THE USER STATED REPLACES THE RANGE — so the range is not live.
 *
 * Derived at the bytes, not assumed (22 Sep 2026; lane notes
 * `output/canvas-review-20260922/lanes/external-factors.md`, PLoT re-read at
 * `staging` 5039cca4):
 *
 *   · An external factor carrying a drafted `prior` can receive a point value
 *     today (the Model tab editor admits every factor, bounded only by the
 *     prior's support). CEE stamps `observed_state.source = 'user_override'`
 *     and leaves `prior` on the node untouched.
 *   · PLoT `buildParameterUncertaintiesV3` SKIPS the prior pass for any factor
 *     whose `observed_state.value !== undefined` — its own words: "a stated
 *     value always wins, whatever the category" — and sends a Normal around the
 *     value instead. ISL never reads `node.prior`.
 *
 * So a card reading the user's value AND `Range: 0.3 to 0.8` was presenting a
 * range the analysis no longer uses. The range is still TRUE as a record (it is
 * what the node carries, and "caveat, never hide" governs this surface), so it
 * is restated, not removed: the line says the value replaces it. ⚠ It does not
 * say who authored the range — the inspector's quick-set writes `prior` too, so
 * "drafted" would be an attribution the node cannot support.
 *
 * ⚠ THE PREDICATE IS THE ESTATE'S ONE AUTHORITY FOR "WHO PUT THIS NUMBER HERE",
 * never a literal list: `classifyValueProvenance(source).userOwned` — the same
 * test `ModelOutline.unsetBucketOf` applies for "yours". A hand-listed
 * `'user' || 'user_confirmed' || 'user_override'` is exactly how
 * `formatFactorDisplayValue` once missed a member.
 *
 * ⚠ SCOPED TO A USER-OWNED VALUE, DELIBERATELY NARROWER THAN PLOT'S SKIP.
 * PLoT's skip is source-agnostic, so a MODEL-authored value beside a prior
 * has the same dormant range. It is not claimed here: "Your value" would be
 * false attribution on it, and the right sentence for that state is a separate
 * decision. Reported, not decided.
 *
 * ⚠ A MIRROR OF ONE PLOT GATE, NAMED AS SUCH. `FactorExternalPanel`'s role-note
 * docblock records why that panel had declined to mirror PLoT's precedence
 * (trap 12). The mirror is accepted here because the alternative is a false
 * claim on screen today, and it is confined to this one function so that the
 * day PLoT changes the precedence there is one place to change.
 */
export function userValueReplacesPrior(data: unknown): boolean {
  const obs = getObservedState(data)
  const value = obs.value
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  const source = typeof obs.source === 'string' ? obs.source : null
  return classifyValueProvenance(source)?.userOwned === true
}

/**
 * The card's sentence. Follows the range it replaces, in the SAME grammar the
 * live `Range:` line would have used, so the numbers read identically before
 * and after the edit.
 */
export const USER_VALUE_REPLACES_RANGE = 'Your value replaces the range'

/**
 * The inspector's sentence, where the range is drawn beside it (bar, inputs),
 * so it names "this range" rather than repeating the numbers.
 */
export const USER_VALUE_REPLACES_THIS_RANGE = 'Your value replaces this range in the analysis.'

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

/**
 * Every numeric token in a display string. Comma-thousands are one token
 * ("40,000"), a decimal point does not split ("0.28").
 */
const NUMERIC_TOKEN = /-?\d[\d,]*(?:\.\d+)?/g

/**
 * The magnitude of a display string that shows EXACTLY ONE number — the
 * observed point, however it is dressed ("18 month", "£40,000", "CHF 500",
 * "26,000", "0.5"). Returns null for everything else, and the exclusions are
 * the guard, not an oversight:
 *   · no number at all ("Moderate", "No dedicated supplier") — nothing to
 *     compare scales with;
 *   · two or more numbers ("3 to 5", "0.2 to 0.8") — that describes a prior,
 *     not an observed point, and judging it would need a vocabulary over
 *     natural language.
 * Deliberately narrow: everything it declines to parse keeps today's
 * behaviour byte-for-byte.
 */
function parseSingleDisplayedMagnitude(text: string): number | null {
  const tokens = text.match(NUMERIC_TOKEN)
  if (tokens == null || tokens.length !== 1) return null
  const n = Number(tokens[0].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** The ceiling of the normalised scale. It is a property of the SCALE, and it
 *  is never derived from the data — see the correction in the header below. */
const NORMALISED_SCALE_CEILING = 1

/**
 * ⭐⭐ THE VALUE LINE IS NOT ON THE SCALE THIS RANGE WOULD PRINT ON.
 *
 * Journey-witnessed on the deployed product, one card, together and unflagged:
 *
 *     Sales Payback Period        18 month
 *     Range: 0.08 to 0.28
 *
 * A value SIXTY TIMES outside its own displayed range — and the editor then
 * rejects `0.2` as "a proportion rather than a value in month", so the node's
 * displayed range is a set of values its own editor refuses.
 *
 * ⭐ THE REFUSAL TO CALIBRATE ABOVE IS CORRECT AND STAYS. `month` is a real
 * unit, a capless deterministic draft cannot be denormalised, and inventing a
 * cap would fake a measurement. The defect is that having declined to put the
 * range on the shown scale, this path printed the range anyway.
 *
 * ⛔ SO THIS DECLINES, IT NEVER COMPUTES. It answers only "can I POSITIVELY
 * establish that the value on screen is NOT on the normalised scale this range
 * would print on?" — never "does this range look right?".
 *
 * ⛔⛔ AND IT IS A MEMBERSHIP TEST, NOT A COMPARISON WITH THE DATA. THIS IS THE
 * CORRECTION, and it is the whole point of the function.
 *
 * The first version derived its bound from the endpoints —
 * `Math.max(1, |rangeMin|, |rangeMax|)` — reasoning that a prior which exceeds
 * the contract should be "judged against what is actually on screen". Deriving
 * it is what broke it. Once the endpoints are themselves on a real scale,
 * `magnitude > bound` stops asking *"is this value on a different scale?"* and
 * starts asking *"is this value above the range?"* — which is an ordinary, and
 * highly decision-relevant, thing for an observation to be.
 *
 * ⭐ THE ASYMMETRY WAS THE PROOF. Driven through the real entry point against
 * a witnessed out-of-scale prior (`fac_price {range_min: 10, range_max: 30}`):
 *
 *     £31  (one ABOVE the range)  ->  the range line was REMOVED
 *     £9   (BELOW the same range) ->  the range line was KEPT
 *
 * Nothing about SCALE is asymmetric. A predicate that answers differently for a
 * value below its range and a value above it is not testing scale, whatever its
 * name says. It removed information exactly when the observation had exceeded
 * expectation, which is the case a reader most needs to see. (CLAUDE.md trap
 * 13d: the invariant had inherited the asymmetry of the failure mode in hand,
 * because the witnessed value happened to sit far above its range.)
 *
 * ⭐ SO THE GATE COMES FIRST, AND IT IS THE SIBLING SURFACE'S OWN PREDICATE.
 * The unitless line this function guards prints a claim on the 0–1 scale ONLY
 * when both endpoints sit inside 0–1. `priorEndpointsAreNormalised` answers
 * that, and `NodeInspector.describePrior` — which renders the same prior and
 * whose ruling on out-of-scale endpoints is "caveat, never hide" — now reads
 * the same function rather than its own copy. Two surfaces, one answer.
 *
 * With the gate in place the bound is the SCALE's ceiling, fixed at 1 and never
 * touched by the data, so "above the bound" means "not a member of 0–1" and
 * nothing else.
 *
 * ⚠ KNOWN LIMIT, stated rather than hidden: a real-scale value that happens to
 * sit at or below 1 ("0.5 month", "£0.5k") is indistinguishable from a
 * normalised one here, so it is not contradicted and the range still renders.
 * That fails in the safe direction — it keeps information rather than removing
 * it — and the cap is what would settle it, which is upstream and out of scope.
 *
 * ⚠ A WIDER PREDICATE WAS CONSIDERED AND DECLINED, so nobody re-proposes it as
 * an obvious improvement. Inside this arm a REAL unit always means
 * `canCalibrate === false`, so one could suppress on the unit alone — "a real
 * unit beside a unitless normalised range is a scale mismatch by construction",
 * which is direction-free and would also close the known limit above. It is
 * declined because it cannot see its own counterexample: a prior authored on a
 * REAL scale whose endpoints happen to land inside 0–1 (a defect rate of 0.08
 * to 0.28 per unit) is byte-identical to a normalised one, and suppressing it
 * would REMOVE a true line. Trading a false line that is kept for a true line
 * that is hidden is the wrong direction, and it is the same "a range is not
 * self-describing" principle `isUnquantifiedPrior` is built on.
 */
function displayedValueIsOffTheNormalisedScale(
  text: string,
  rangeMin: number,
  rangeMax: number,
): boolean {
  // ⛔ THE GATE. If the endpoints are not inside 0–1 then this line is not
  // printing a normalised claim, there is no normalised scale to be off, and
  // no comparison with the displayed value can establish a contradiction.
  if (!priorEndpointsAreNormalised(rangeMin, rangeMax)) return false
  const shown = parseSingleDisplayedMagnitude(text)
  if (shown == null) return false
  const magnitude = Math.abs(shown)
  return (
    magnitude > NORMALISED_SCALE_CEILING
    && !nearlyEqual(magnitude, NORMALISED_SCALE_CEILING)
  )
}

/**
 * The one suppression decision for the uncalibrated range line, with its two
 * arms named: the value line already SHOWS this range (dedupe, lane C3), or the
 * value line CONTRADICTS the scale this range would print on (the witness
 * above). Extended rather than duplicated on purpose — two suppression
 * mechanisms a caller must remember to consult in the right order is this
 * estate's dominant defect, and both arms answer one question at one call site:
 * is there anything true left for this line to say?
 */
function normalisedRangeHasNothingTrueToSayBeside(
  text: string,
  rangeMin: number,
  rangeMax: number,
  cap: number | null | undefined,
): boolean {
  return (
    bareNumericRangeMatchesPrior(text, rangeMin, rangeMax, cap)
    || displayedValueIsOffTheNormalisedScale(text, rangeMin, rangeMax)
  )
}

/**
 * ⭐⭐ ONE FORMATTER PER FILE — AND THIS FILE WAS RENDERING TWO GRAMMARS.
 *
 * This was a local `Number.isInteger(v) ? String(v) : v.toFixed(2)…` — a fifth
 * copy of the house number rule, sitting a hundred lines above the calibrated
 * branch that already calls the shared `formatRawValueWithUnit`. Measured on
 * the same function, same card, before this change:
 *
 *     calibrated arm      "Range: £20,000 to £80,000"   ← shared formatter
 *     uncalibrated arm    "Range: 20000 to 80000"       ← this local one
 *
 * and the second arm is reachable with an ordinary currency factor that has no
 * usable cap (the branch comment below says so). A reader met the same figure
 * in two grammars depending on a cap they cannot see. That is the defect this
 * adoption closes, and it is the directory's last hand-rolled formatter.
 *
 * ⚠ THE UNIT IS `null` ON PURPOSE, AND IT IS NOT A SHORTCUT. This arm has
 * already decided the value CANNOT be shown as measured — a placeholder unit,
 * or a real unit with no cap to calibrate against. `formatRawValueWithUnit`'s
 * 'none' arm IS the bare-number rule, so passing the unit through here would
 * re-attach the very suffix the branch exists to withhold.
 *
 * ⛔ AND IT IS NOT `canvas/utils/formatValueWithUnit`, THE FORMATTER NAMED AS
 * CANONICAL. That one turns any 0-1 magnitude into a qualitative word, so a
 * prior of 0.2 to 0.8 would render "Range: low to very high" — a range whose
 * ends are words cannot be read as a range, and the numbers are the only thing
 * this line has to say. Its rule is right for a single observed value and wrong
 * for an interval endpoint; the two answer different questions.
 *
 * Behaviour is unchanged across [0,1], the contract domain: integers print
 * bare, sub-1 values keep two decimal places with trailing zeros trimmed. It
 * differs only at magnitude >= 1000, where it gains the en-GB thousand
 * separator the calibrated arm already emits — which is the fix.
 */
function formatNormalisedRangeEnd(v: number): string {
  return formatRawValueWithUnit(v, null)
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
function resolvePriorRangeBody(
  {
    data,
    nodeCategory,
    observedState,
    valueDisplay,
  }: FactorPriorRangeInputs,
  /**
   * Whether CEE's authored `display_value` may stand in for the range on the
   * valueless-caller arm. False once a user-owned value exists: CEE rewrites
   * `display_value` FROM THE POINT on a value edit (`set-factor-value.ts:696`),
   * so the authored string is then the user's number, not the range.
   */
  preferAuthoredCopy: boolean,
): PriorRangeBody | null {
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
    // ⛔ AND IT IS SUPPRESSED, NEVER SUBSTITUTED. Silence is the honest
    // outcome here and a replacement sentence would be a new claim: a range IS
    // recorded, so "no range recorded" would be false, and what is actually
    // missing is the cap that would put it on the shown scale — which is
    // upstream, not this surface's to state. Nor does silence leave a gap: this
    // arm is only reachable when `valueDisplay` is non-null, so the card keeps
    // its figure, and the reduced low-zoom line passes `valueDisplay: null` and
    // is therefore untouched (the blank-box regression this module exists to
    // prevent cannot recur through here).
    if (
      valueDisplay != null
      && normalisedRangeHasNothingTrueToSayBeside(valueDisplay, rangeMin, rangeMax, cap)
    ) {
      return null
    }
    /**
     * ⭐⭐⭐ CEE'S OWN STRING WINS HERE TOO — and until now it could not.
     *
     * The dedupe immediately above already states the rule: *"The
     * `display_value` line wins because it is CEE-authored copy."* But it is
     * gated on `valueDisplay != null`, which is the value the CALLER renders —
     * and a factor with NO observed value renders none. So the one card that
     * most needs a legible range was the one card the rule could not reach.
     *
     * Measured on Paul's run, bundle `ebc6e31a`, served `1f77130d`, factor
     * `ab78e513` *Monthly Churn Rate*: `observed_state: null`,
     * `display_value: "0% to 13%"`, prior 0 → 0.13. The card rendered
     * **`Range: 0 to 0.13`** while CEE's own sentence sat unused in the payload.
     *
     * ⚠ A PREFERENCE, NOT A NEW CLAIM. Nothing is computed, converted or
     * invented: the producer's string is rendered verbatim under the caption
     * this line already carries. Where CEE authored nothing the normalised
     * fallback below is untouched, so the missing unit stays an upstream gap
     * rather than becoming a sentence this surface makes up.
     *
     * ⚠ AND ONLY ON THE VALUELESS ARM. With a `valueDisplay` the existing
     * dedupe owns the decision; reaching into that branch would give a card
     * that already shows its value a second copy of it under a Range caption.
     */
    if (valueDisplay == null && preferAuthoredCopy) {
      const authored = (data as { display_value?: unknown } | undefined)?.display_value
      if (typeof authored === 'string' && authored.trim().length > 0) {
        // Strip a caption the producer may already have included, so the two
        // cannot stack into "Range: Range: …".
        const body = authored.trim().replace(/^Range:\s*/i, '')
        // The producer's prose: no endpoints are parsed out of it, so no band.
        if (body.length > 0) {
          const pair = parseBareNumericRange(body)
          return { text: body, ends: null, bareModelScale: pair !== null && priorEndpointsAreNormalised(pair[0], pair[1]) }
        }
      }
    }
    const low = formatNormalisedRangeEnd(rangeMin)
    const high = formatNormalisedRangeEnd(rangeMax)
    return { text: `${low} to ${high}`, ends: [low, high], bareModelScale: priorEndpointsAreNormalised(rangeMin, rangeMax) }
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
  const low = fmt(rangeMin)
  const high = fmt(rangeMax)
  const rendered = `${low} to ${high}`
  // Dedupe: a CEE-authored display_value that is EXACTLY the calibrated
  // range text (e.g. "£20,000 to £80,000") makes the Range line pure
  // repetition. Exact-string equality only — both sides must have come
  // through the same formatter to collide, so this is numerically faithful
  // and can never fuzzy-match prose or differently-scaled values. A bare
  // numeric display_value ("20000 to 80000") deliberately does NOT dedupe
  // here: the calibrated Range line still adds the unit information.
  if (valueDisplay != null && valueDisplay.trim() === rendered) return null
  return { text: rendered, ends: [low, high], bareModelScale: false }
}

/**
 * The range body and, when the body was COMPOSED here from the prior's two
 * numbers, those two endpoints exactly as the text prints them. `ends` is
 * `null` for the producer's authored string (prose is never parsed).
 */
interface PriorRangeBody {
  text: string
  ends: readonly [string, string] | null
  /**
   * The text states the range ONLY on the model's internal 0–1 scale: bare
   * numbers, both inside 0–1, with no real-world unit behind them — composed
   * here from a normalised prior, or the producer's own string when it is
   * exactly such a pair ("0.3 to 0.8"). Contract v3.1 `checks.factor`: "no bare
   * internal model scale" on the CARD (`resolveFactorPriorRangeOnCard`).
   */
  bareModelScale: boolean
}

/**
 * The one line a factor card (and its reduced low-zoom line) says about the
 * factor's prior range, or `null` when there is nothing true to say.
 *
 * `Range: a to b` while the range is live. Once a USER-OWNED value exists
 * (`userValueReplacesPrior`), the same numbers are restated as replaced —
 * `Your value replaces the range a to b` — because the analysis no longer
 * samples them. Every suppression decision above (ignorance prior, dedupe,
 * off-scale) is taken FIRST and is unchanged: a range that had nothing true to
 * say as a live line has nothing true to say as a replaced one either.
 */
export function resolveFactorPriorRange(inputs: FactorPriorRangeInputs): string | null {
  const replaced = userValueReplacesPrior(inputs.data)
  const body = resolvePriorRangeBody(inputs, !replaced)
  if (body == null) return null
  return replaced ? `${USER_VALUE_REPLACES_RANGE} ${body.text}` : `Range: ${body.text}`
}

/**
 * ⭐ THE TWO ENDS OF THE LIVE RANGE, for the card's working-range band
 * (prototype, Paul 25 Sep: "Working range 25–45%" with a band) — or `null`.
 *
 * The SAME decision as `resolveFactorPriorRange` (every suppression is taken
 * first and is unchanged), and the SAME two strings its text prints, so the
 * band can never state a different range from the line above it. `null`:
 *   · wherever the line itself is `null`;
 *   · once a user-owned value REPLACES the range — visual contract v3: a
 *     displaced prior is "disclosed as superseded, not plotted as active
 *     uncertainty";
 *   · for the producer's authored range string, which is never parsed.
 */
export function resolveFactorPriorRangeEnds(inputs: FactorPriorRangeInputs): readonly [string, string] | null {
  if (userValueReplacesPrior(inputs.data)) return null
  return resolvePriorRangeBody(inputs, true)?.ends ?? null
}

/**
 * ⭐⭐ THE CARD'S RANGE LINE — contract v3.1 `checks.factor`: "Own-unit value …
 * no bare internal model scale" (DESIGN-GAP-v31 #20; ruling: omit, never
 * invent).
 *
 * Measured before (served `eec722ab`): market-entry "Current ARR · Range: 0.27
 * to 0.8 · no source", "Target Market Size · Range: 0.3 to 1"; pricing "Range:
 * 0.3 to 0.8" and "Range: 0.2 to 0.6". Those are the prior's normalised 0–1
 * endpoints (or the producer's own string of exactly those two numbers) — a
 * range with no unit a reader can hold it against.
 *
 * The CARD omits such a line, and its band, and does not substitute anything:
 * there is no qualitative or own-unit form in the data to show instead. A range
 * the data CAN state in the reader's units — calibrated through a cap, a
 * percent, the producer's own words ("0% to 13%"), or endpoints outside 0–1 —
 * prints exactly as `resolveFactorPriorRange` prints it.
 *
 * ⚠ THE OWNER'S OUTPUT IS UNCHANGED, DELIBERATELY. `resolveFactorPriorRange`
 * still returns the line, because the Model tab (`model-tab-v2/adapters.ts`,
 * A17) reads it to say "Range: 0.3 to 0.8, not measured" instead of a bare
 * "Not set" on a factor that DOES record a range — a detail surface explaining
 * the record, one action away. Card and Model tab therefore never state two
 * different ranges: the card states none, the Model tab states the owner's.
 * The card's reduced low-zoom line (`lodMetricLine.ts`) reads THIS function, so
 * a zoomed-out card never says more than the full card.
 */
export function resolveFactorPriorRangeOnCard(inputs: FactorPriorRangeInputs): string | null {
  const replaced = userValueReplacesPrior(inputs.data)
  const body = resolvePriorRangeBody(inputs, !replaced)
  if (body == null || body.bareModelScale) return null
  return replaced ? `${USER_VALUE_REPLACES_RANGE} ${body.text}` : `Range: ${body.text}`
}

/** The band's two ends for the CARD — `null` wherever `resolveFactorPriorRangeOnCard` is. */
export function resolveFactorPriorRangeEndsOnCard(inputs: FactorPriorRangeInputs): readonly [string, string] | null {
  if (userValueReplacesPrior(inputs.data)) return null
  const body = resolvePriorRangeBody(inputs, true)
  return body == null || body.bareModelScale ? null : body.ends
}
