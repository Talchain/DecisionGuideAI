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
  // `display_value` may arrive at either top level (CEE wire shape, see
  // golden-path-staging-2026-04-05.json) or inside observedState. Prefer
  // top-level (canonical CEE emission) and fall back to observedState for
  // legacy/in-flight shapes.
  const displayValue =
    (data.display_value as string | null | undefined) ??
    (observedState?.display_value as string | null | undefined) ??
    null
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
  if (display_value != null && display_value !== '') {
    return display_value
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
