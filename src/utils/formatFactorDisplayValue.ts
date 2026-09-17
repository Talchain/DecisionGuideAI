/**
 * formatFactorDisplayValue — contextual display text for factor values.
 *
 * TEMPORARY: display_value should come from CEE. This heuristic bridges
 * until schema v0.3.0. This utility is the single location for the
 * heuristic so it can be replaced with a one-line passthrough later.
 *
 * Returns null when no meaningful text can be produced (node renders
 * no body text). Never returns generic placeholders.
 *
 * Polish 4 review follow-up: currency detection now goes through
 * classifyUnit from labelUtils so symbols (£, $, €) prefix with no space,
 * ISO codes (CHF, USD, kr, R$) prefix with a space, and case / whitespace
 * drift ('chf', ' CHF ') resolve to the canonical form. Previously this
 * file had a hardcoded `['£', '$', '€', '¥']` list that treated CHF as a
 * trailing suffix ("500 CHF") — inconsistent with the rest of the codebase.
 */

import { classifyUnit, unwrapInterventionValue } from '../canvas/utils/labelUtils'

const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i

function stripSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

function formatNumber(value: number): string {
  return Math.abs(value) >= 1000
    ? value.toLocaleString('en-GB')
    : String(value)
}

/**
 * A display string this guard is willing to JUDGE: a single bare, percent, or
 * currency-prefixed number. Nothing else.
 *
 * Deliberately, provably narrow — everything it does not match keeps today's
 * behaviour byte-for-byte:
 *   · qualitative text ("Moderate", "No acquisition pursued") — no number, so
 *     no contradiction can be established;
 *   · ranges ("0.48 to 1", "3–5 months") — two numbers, describes a prior, not
 *     the observed point;
 *   · magnitude shorthand ("£40k", "$2.1m") — the digits are not the value;
 *   · anything with unit words ("42 days", "6 developers").
 * Judging any of those would need a vocabulary, and a vocabulary over natural
 * language drawn from one author's head is exactly the class of predicate this
 * estate keeps getting wrong.
 */
const SINGLE_NUMERIC_DISPLAY = /^\s*[-+]?[£$€¥₹]?\s*[-+]?\d[\d,]*(?:\.\d+)?\s*%?\s*$/

/** How many decimal places a display string committed to. */
function decimalPlaces(text: string): number {
  const m = /\.(\d+)/.exec(text)
  return m ? m[1].length : 0
}

/**
 * Could `candidate` have been rounded to produce `shown`, at the precision
 * `shown` committed to? "0.42" may legitimately render 0.4234; "20" may not
 * render 40.
 */
function couldRoundTo(candidate: number, shown: number, places: number): boolean {
  if (!Number.isFinite(candidate)) return false
  const tolerance = 0.5 * Math.pow(10, -places)
  return Math.abs(candidate - shown) <= tolerance + Number.EPSILON * 8
}

/**
 * Is this `display_value` CONTRADICTED by the node's own numeric state?
 *
 * ROADMAP 2.1003 / audit finding F3 — "the screen lies". Measured on deployed
 * staging 2026-08-09: a CEE receipt carried `observed_state.value = 40` beside
 * a stale top-level `display_value = "20%"`. This formatter returned "20%"
 * verbatim, so the canvas showed 20% — before AND after reload — while the
 * rerun computed on 40 and flipped the leading option. The brief's words:
 * **contradictory display must be invalidated, not preferred.**
 *
 * FAILS SAFE IN THE DIRECTION THAT MATTERS. It answers "can I POSITIVELY
 * establish a contradiction?" — never "does this look right?". Anything it
 * cannot judge is not contradicted, and renders exactly as it does today.
 *
 * Accepted renderings of the state are `value`, `raw_value`, and the two
 * percent scalings (`value × 100`, `value ÷ 100`), because the estate stores
 * percentages on both 0–1 and 0–100 scales and a display string cannot tell us
 * which one it used.
 *
 * ⚠ KNOWN LIMIT, stated rather than hidden: when `raw_value` is present but
 * itself stale, the display agrees with `raw_value` and this returns false.
 * That is a real, measured CEE-side applier defect (the value applier updates
 * `observed_state.value` and leaves `raw_value` behind) and it is not
 * repairable here — a consumer cannot tell a stale producer field from a
 * deliberate one.
 *
 * Exported so the rule is a concept with its own tests and its own mutants,
 * not an expression buried in a branch.
 */
export function isDisplayValueContradicted(
  displayValue: string | null | undefined,
  state: { value?: number | null; raw_value?: number | string | null },
): boolean {
  if (displayValue == null || displayValue === '') return false
  if (!SINGLE_NUMERIC_DISPLAY.test(displayValue)) return false

  const shown = Number(displayValue.replace(/[£$€¥₹,%\s]/g, ''))
  if (!Number.isFinite(shown)) return false

  const rawNumeric =
    typeof state.raw_value === 'number'
      ? state.raw_value
      : typeof state.raw_value === 'string' && state.raw_value.trim() !== ''
        ? Number(state.raw_value)
        : null

  const candidates: number[] = []
  if (typeof state.value === 'number' && Number.isFinite(state.value)) {
    candidates.push(state.value, state.value * 100, state.value / 100)
  }
  if (rawNumeric != null && Number.isFinite(rawNumeric)) {
    candidates.push(rawNumeric, rawNumeric * 100, rawNumeric / 100)
  }
  // No numeric state at all ⇒ nothing to contradict it with.
  if (candidates.length === 0) return false

  const places = decimalPlaces(displayValue)
  return !candidates.some((c) => couldRoundTo(c, shown, places))
}

export interface FactorDisplayInput {
  label: string
  value?: number | null
  raw_value?: number | string | null
  unit?: string | null
  factor_type?: string | null
  cap?: number | null
  category?: string | null
  /**
   * CEE-provided contextual display text. Returned verbatim when none of the
   * higher-priority branches apply. Priority order (V5 stale-value-protection
   * fix, May 2026):
   *   1. Pattern 1 (raw_value + meaningful unit) — outranks display_value
   *   2. display_value                          — outranks raw/heuristic
   *   3. raw_value without unit (numeric fallback)
   *   4. value-only binary heuristic
   *
   * Only Pattern 1 can outrank display_value: a fresh raw_value paired with a
   * meaningful unit (£, %, count, …) wins so a stale display_value cannot mask
   * a user-edited observed_state. For unitless raw_values, placeholder units
   * (scale/index/…), or null raw_value, display_value still wins.
   */
  display_value?: string | null
}

/**
 * Read a factor's CEE `display_value` from node data, honouring the canonical
 * priority: top-level `display_value` (CEE wire shape, see
 * golden-path-staging-2026-04-05.json) THEN `observedState.display_value`
 * (legacy / in-flight shapes). Single source of truth so every consumer
 * (factorDisplayText below, OptionNode's binary baseline label) shares one
 * priority rule instead of re-implementing it. Returns undefined when neither
 * is a non-empty string.
 */
export function readFactorDisplayValue(
  data: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const observedState = data.observedState as Record<string, unknown> | undefined
  const v = (data.display_value as unknown) ?? observedState?.display_value
  // Empty string → undefined so the helper matches its "non-empty" contract.
  // Behaviour-preserving: every caller already treats '' as falsy, and
  // factorDisplayText's `?? null` makes null/'' identical to the formatter's
  // `display_value != null && display_value !== ''` gate.
  return typeof v === 'string' && v !== '' ? v : undefined
}

/**
 * Render the CEE-canonical factor display text for a node's data.
 *
 * Shared entry point for BOTH graph (FactorNode), inspector-v2 factor panels,
 * AND the debug bundle's renderFactorDisplayState — guarantees they use the
 * identical priority chain (see `FactorDisplayInput.display_value` for the
 * full priority order).
 *
 * Accepts the raw `node.data` shape (with `observedState` and `category`) and
 * returns a string suitable for direct display, or null if no meaningful text
 * can be produced. Callers decide whether to render anything on null.
 */
export function factorDisplayText(
  data: Record<string, unknown> | null | undefined,
  fallbackLabel?: string,
): string | null {
  if (!data || typeof data !== 'object') return null
  const label = (data.label as string | undefined) ?? fallbackLabel ?? ''
  const observedState = (data.observedState as Record<string, unknown> | undefined) ?? undefined
  const category = (data.category as string | undefined) ?? null
  const unit = observedState?.unit as string | null | undefined
  // Defensive unwrap: `value` / `raw_value` can be compound `{ value, unit }`
  // objects from legacy or wrapped shapes. Coercing to string would produce
  // "[object Object]". unwrapInterventionValue handles both plain numbers and
  // wrapped forms and returns null when the input cannot resolve.
  const rawValueUnwrapped = unwrapInterventionValue(observedState?.raw_value).value
  const valueUnwrapped = unwrapInterventionValue(observedState?.value).value
  // raw_value is allowed to be a string (e.g. "£49"), so preserve strings as-is.
  const rawValueForFormatter: number | string | null =
    rawValueUnwrapped ??
    (typeof observedState?.raw_value === 'string' ? (observedState!.raw_value as string) : null)
  // `display_value` may arrive at either top level (CEE wire shape) or inside
  // observedState. Shared priority via readFactorDisplayValue (top-level →
  // observedState); `?? null` preserves this function's prior null contract.
  const displayValue = readFactorDisplayValue(data) ?? null
  return formatFactorDisplayValue({
    label,
    value: valueUnwrapped,
    raw_value: rawValueForFormatter,
    unit: unit ?? null,
    factor_type: (observedState?.factor_type as string | null | undefined) ?? null,
    cap: unwrapInterventionValue(observedState?.cap).value,
    category,
    display_value: displayValue,
  })
}

export function formatFactorDisplayValue(input: FactorDisplayInput): string | null {
  const { label, value, raw_value, unit, factor_type, category, display_value } = input

  // External factors with no data: no body text (dashed border is the signal)
  if (category === 'external' && (value == null && raw_value == null)) {
    return null
  }

  // Priority order (V5 stale-value-protection fix, May 2026):
  //   1. Pattern 1: raw_value + meaningful unit  ← outranks display_value
  //   2. display_value                          ← contextual override
  //   3. raw_value without unit (numeric fallback formatter)
  //   4. Pattern 2: value-only binary heuristic
  //
  // Only Pattern 1 (fresh raw_value + meaningful unit such as £, %, …) is
  // permitted to outrank a CEE-authored display_value. The motivation is
  // stale-value protection: a CEE-authored display_value can lag behind a
  // user edit to observed_state (e.g. user changes raw_value to 26000 but
  // the old display_value "£20,000" is still on the node) — when a fresh
  // real-world raw_value + unit pair is present, that wins.
  //
  // display_value still outranks the unitless-raw fallback below so the
  // golden-fixture case `raw_value: 0, no unit, display_value:
  // "No acquisition pursued"` continues to render the contextual text
  // rather than the bare number "0". Unitless raw_value carries no
  // human-meaningful magnitude on its own — there's nothing "fresh and
  // real-world" about it the way £26,000 is — so display_value is the
  // safer choice when both are present.

  // Pattern 1: raw_value + unit → formatted display
  // Graph v2 fix: when unit is a generic placeholder (scale, index, score, …),
  // raw_value is just the denormalised normalised value (value × cap) — not a
  // real-world measurement. Skip Pattern 1 entirely so Pattern 2 can apply
  // the binary heuristic or return null (suppression).
  const { kind: unitKind, canonical: unitCanonical } = unit
    ? classifyUnit(unit)
    : { kind: null as null, canonical: '' }
  if (raw_value != null && unit && unitKind !== 'placeholder') {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      // Cost factor at zero → contextual
      if (numericRaw === 0 && factor_type?.toLowerCase() === 'cost') {
        return 'No cost allocated'
      }
      // Polish 4 review follow-up: classifyUnit handles symbol/ISO/%/other
      // with case + whitespace normalisation. 'CHF' now renders as the
      // ISO-style prefix "CHF 500" instead of the old suffix "500 CHF".
      if (unitKind === 'symbol') {
        return `${unitCanonical}${formatNumber(numericRaw)}`
      }
      if (unitKind === 'iso') {
        return `${unitCanonical} ${formatNumber(numericRaw)}`
      }
      if (unitKind === 'percent') {
        // 0–1 ratio handling: when raw_value is strictly between 0 and 1 we
        // treat it as a probability/ratio and scale by 100 (0.25 → "25%").
        // raw_value === 0 stays "0%". raw_value >= 1 is treated as already in
        // percentage points (25 → "25%"). Deterministic by design — do NOT
        // revert to a bare Math.round, which produces "0%" for 0.25 and was
        // the source of the V5 value-display bug.
        const scaled = numericRaw > 0 && numericRaw < 1 ? numericRaw * 100 : numericRaw
        return `${Math.round(scaled)}%`
      }
      // 'other' | 'none' (unreachable here — unit is truthy)
      return `${formatNumber(numericRaw)} ${unitCanonical || unit}`
    }
    // raw_value is a non-numeric string with unit
    return `${raw_value} ${unit}`
  }

  // CEE-provided display_value: contextual override when Pattern 1 didn't
  // apply (no raw_value, no unit, or only a placeholder unit). Returned
  // verbatim so CEE-authored contextual text (e.g. "No dedicated tech lead",
  // "No acquisition pursued") surfaces instead of a bare number like "0".
  // Previously sat at the top of the function with absolute priority —
  // moved here so a stale display_value cannot mask a fresh raw_value +
  // meaningful unit (Pattern 1), but still beats the unitless-raw numeric
  // fallback below and the value-only heuristic that follows.
  //
  // ROADMAP 2.1003 — …UNLESS THE NODE'S OWN NUMBERS SAY IT IS WRONG.
  // A denormalised string that contradicts the value the analysis is actually
  // computing on is not a "contextual override", it is a lie about the user's
  // model. Measured live: `display_value = "20%"` beside
  // `observed_state.value = 40`, rendered as 20% on the canvas immediately and
  // after reload while the rerun used 40 and flipped the leading option.
  const displayValueContradicted =
    display_value != null
    && display_value !== ''
    && isDisplayValueContradicted(display_value, { value, raw_value })

  if (display_value != null && display_value !== '' && !displayValueContradicted) {
    return display_value
  }

  // ROADMAP 2.1003 — RECOVERY AFTER INVALIDATION. **Do not delete this without
  // reading the next paragraph: without it, suppressing the lie renders BLANK.**
  //
  // MEASURED: with the exact audit fixture (`value: 40, raw_value: null,
  // unit: '%', display_value: '20%'`) the invalidated string fell through to
  // Pattern 2, whose non-binary branch returns `null` — so the factor node got
  // NO BODY TEXT AT ALL. The user went from a wrong "20%" to nothing. Killing
  // the symptom (the wrong number) while never measuring the outcome (what the
  // user actually sees) is the defect class this lane exists to stop.
  //
  // WHY `raw_value` IS ABSENT IN THAT FIXTURE, and why this is one defect and
  // not two: CEE's value applier updates `observed_state.value` and leaves
  // `raw_value` behind (ROADMAP 2.1033). The numeric branches below need
  // `raw_value`; it isn't there; so there is nothing left to render.
  //
  // ⚠ SCOPED TO WHAT CAN BE RENDERED HONESTLY — and the exclusions are the
  // point, not an oversight:
  //   · percent units — `value` maps deterministically to the shown
  //     percentage, using Pattern 1's own 0–1-vs-0–100 rule (reused, not
  //     re-implemented), so "40" and "0.4" both render "40%";
  //   · no unit at all — the bare committed number is exactly the truth;
  //   · EVERYTHING ELSE (currency, time, counts, ISO codes) returns nothing
  //     here and falls through. For those, `value` is a 0–1 figure normalised
  //     against `cap` and is NOT a real-world magnitude: rendering "£0.3" for
  //     a £30,000 factor would replace one lie with a worse one, and
  //     reconstructing `value × cap` would be inventing a number. Blank is the
  //     honest outcome there, and it is disclosed rather than papered over.
  // Gated on `displayValueContradicted` so it fires ONLY where we just
  // suppressed something — a node that simply never had a `display_value`
  // keeps today's behaviour byte-for-byte.
  if (displayValueContradicted && raw_value == null && value != null) {
    if (unitKind === 'percent') {
      const scaled = value > 0 && value < 1 ? value * 100 : value
      return `${Math.round(scaled)}%`
    }
    if (!unit) {
      return formatNumber(value)
    }
  }

  // raw_value without unit — numeric fallback formatter. Runs AFTER
  // display_value because a unitless raw_value carries no human-meaningful
  // magnitude on its own (no £, %, or count semantics), so CEE-authored
  // contextual text is preferable when present.
  if (raw_value != null && !unit) {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      return formatNumber(numericRaw)
    }
    return String(raw_value)
  }

  // Pattern 2: value only (no raw_value) → binary heuristic.
  // Also applies when raw_value is present but the unit is a generic placeholder
  // (scale, index, …) — the raw_value is just a denormalised normalised value
  // and carries no real-world meaning, so treat it as value-only.
  if (value != null && (raw_value == null || unitKind === 'placeholder')) {
    // Graph v1.1 polish 4 Task 1 + review feedback: when the unit is
    // meaningless ("scale" or undefined), a normalised value tells the user
    // nothing real. The contextual "No X in place" / "X active" text is only
    // honest when the user has explicitly tagged the factor as binary.
    // Otherwise — including the previous "qualitative factor_type" loophole —
    // suppress entirely so the dashed/amber border + StatusPill (or the
    // higher-fidelity Detailed view) carry the meaning.
    const isExplicitlyBinary = factor_type?.toLowerCase().trim() === 'binary'
    const factorTypeUnset = factor_type == null
    // A unit is "meaningless" for display purposes when it's null/empty, or
    // any generic placeholder (scale, index, score, norm, …). Uses unitKind
    // from classifyUnit so ALL placeholder units get the same gating.
    const isMeaningless = unit == null || unit.trim() === '' || unitKind === 'placeholder'
    // Graph v2 fix: when value === 0 and factor_type is not set, CEE likely
    // omitted factor_type for a binary factor (CEE-4 upstream issue). Treat
    // as binary-like zero and produce contextual "No X in place" text.
    // When factor_type IS set to something non-binary (e.g. 'continuous'),
    // suppress — the explicit type indicates this isn't binary.
    if (isMeaningless && !isExplicitlyBinary) {
      if (value === 0 && factorTypeUnset) {
        const stripped = stripSuffixes(label).toLowerCase()
        return `No ${stripped} in place`
      }
      // NOTE: the value === 1 mirror case is deliberately NOT implemented yet.
      // If CEE starts providing binary factors with value=1 and no factor_type,
      // extend this heuristic to produce "[Label] in place" or "[Label] active".
      // Do not add a mismatched pattern (e.g. "No X" for 1) here without
      // considering both branches together.
      return null
    }
    const stripped = stripSuffixes(label).toLowerCase()
    if (value === 0) {
      return `No ${stripped} in place`
    }
    if (value === 1) {
      return `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)} active`
    }
    // Non-binary numeric value (e.g. 0.42) with a real unit but no raw_value:
    // return null (no meaningful display).
    return null
  }

  // Pattern 3: no value at all → no body text
  return null
}
