/**
 * Canvas node label utilities
 * Display-only transforms — never mutate underlying data
 *
 * ============================================================================
 * VALUE-FORMATTING SURFACE INVENTORY (Polish 4 follow-up Item C)
 * ============================================================================
 *
 * The codebase has FOUR distinct user-facing value-rendering paths. This block
 * exists to keep them straight — when adding a new caller, decide which one
 * fits and call it directly. Do NOT add a fifth shadow.
 *
 * 1. formatFactorDisplayValue   (src/utils/formatFactorDisplayValue.ts)
 *    - Surface: factor node body text (FactorNode.tsx, OptionNode formatChipValue contextual path)
 *    - Input:   { label, value, raw_value, unit, factor_type, cap, category, display_value }
 *    - Output:  null | "£40,000" | "75%" | "No tech lead in place" | display_value verbatim
 *    - Fallback: returns null when no meaningful text can be produced.
 *    - Notes: CEE display_value takes priority. Binary contextual text only fires
 *      when factor_type === 'binary'. Suppresses fractional 0<v<1 with meaningless unit.
 *
 * 2. formatInterventionValue    (this file, line ~430)
 *    - Surface: factor node hover overlay, OptionNode pill/popover/Detailed list (via formatChipValue),
 *      GraphTextView observed-state row
 *    - Input:   value, unit, factorType, cap, observedValue, observedRawValue, opts?
 *    - Output:  '' | "£40,000" | "75%" | "Very low" (qualitative tier) | "5 engineers"
 *    - Fallback: '' for scale-no-raw (Polish 4 Task 1 — meaningless unit suppression).
 *    - opts.preserveTierLabel: when true, scale-no-raw returns the qualitative tier
 *      label instead of '' (used by GraphTextView so the text view keeps tier info).
 *    - Notes: takes a NORMALISED 0–1 intervention value, denormalises via cap/raw.
 *
 * 3. formatRawValueWithUnit     (this file, ~line 415)
 *    - Surface: model-tab OptionsSection intervention rows + delta chips
 *    - Input:   already-denormalised raw number + optional unit
 *    - Output:  "£49,000" | "USD 49,000" | "9 months" | "49" (generic units stripped)
 *    - Fallback: "Not set" when value is non-finite.
 *    - Notes: NEVER denormalises — caller passes the real-world number as-is.
 *
 * 4. formatFactorValue          (this file, ~line 290) — LEGACY
 *    - Surface: inspector-v2 OptionPanel.tsx (only caller — kept for compat).
 *    - Status: do not extend. New code should use formatFactorDisplayValue.
 *
 * Local shadows that intentionally exist (do NOT consolidate without redesign):
 *   - OptionNode.tsx::formatChipValue — composes formatFactorDisplayValue with
 *     a fallback through formatInterventionValue. Cannot be moved into labelUtils
 *     without dragging factor-display logic in.
 *
 * Removed shadows (Polish 4 follow-up):
 *   - OptionsSection.tsx::formatInterventionValue — replaced with formatRawValueWithUnit.
 *   - NodeInspectorCompact.tsx::formatChipValue — file deleted (orphaned chain
 *     after Phase 2 (S.1) routing change; verified zero importers, e2e asserts
 *     no popover renders). The file used to mention "sets to N" copy for
 *     unit-less interventions but the entire compact-inspector path was
 *     removed from the canvas single-click flow.
 * ============================================================================
 */

/**
 * Strip normalisation scale metadata from factor labels.
 * Patterns like "(0–1 scale)", "(0–1)", "(0/1)" are technical artefacts
 * from the CEE pipeline and should not be shown to users.
 *
 * @param label - Raw factor label
 * @returns Cleaned label with scale metadata removed
 */
export function cleanFactorLabel(label: string): string {
  if (!label) return label

  // Strip any parenthetical starting with "0" followed by –, -, or /
  // Covers: (0–1 scale), (0–1 qualitative scale), (0–1, share of N), (0/1), (0-1), etc.
  return label
    .replace(/\s*\(0[–\-/].*?\)\s*/g, '')
    .trim()
}

/**
 * Lookup table of common verbose factor phrases → compact display forms.
 * Applied before generic suffix stripping when rendering pre-analysis option
 * pills (Graph v1.1 wireframe v4 OptionWinnerPre — pills like "↑ Leadership"
 * rather than "↑ Technical leadership presence"). Order matters: longer phrases
 * first so partial matches don't pre-empt the canonical form.
 *
 * Lookup is case-insensitive and whole-phrase. Add new entries here rather
 * than hardcoding shortenings inside components.
 */
const COMPACT_LABEL_LOOKUP: ReadonlyArray<readonly [RegExp, string]> = [
  [/^technical leadership (presence|in place)$/i, 'leadership'],
  // Polish 4 Task 2: developer headcount variants seen in staging screenshots.
  // "added" is the new variant alongside the original "capacity"/"level".
  [/^developer headcount (capacity|level|added)$/i, 'dev headcount'],
  [/^monthly recurring revenue$/i, 'MRR'],
  [/^advertising spend$/i, 'ad spend'],
  // Polish 4 Task 2: marketing-graph factor labels from staging screenshots.
  [/^campaign execution quality$/i, 'campaign quality'],
  [/^marketing expertise available$/i, 'marketing expertise'],
  [/^founder time burden$/i, 'founder time'],
  [/^founder[\s/]*pm time on marketing$/i, 'founder time'],
  [/^market receptivity to feature$/i, 'market receptivity'],
  [/^customer price sensitivity$/i, 'price sensitivity'],
  [/^technical complexity of roadmap$/i, 'tech complexity'],
]

/** Generic suffix patterns shared with the local OptionNode helper. */
const COMPACT_LABEL_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i

/**
 * Truncate at word boundary, ellipsising the tail. Used for label compaction
 * so we never cut a word in half.
 */
function truncateLabelAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLength * 0.6 ? truncated.substring(0, lastSpace) : truncated).trimEnd() + '…'
}

/**
 * Aggressive label compaction for pre-analysis option pills.
 * Wireframe v4 (OptionWinnerPre) shows pills like "↑ Leadership" / "+1 dev"
 * rather than full factor labels. Order: lookup table → suffix strip → truncate.
 *
 * @param label - Raw factor label (already cleaned of scale metadata)
 * @param maxLength - Truncation cap (default 15 per spec)
 */
export function compactFactorLabel(label: string, maxLength = 15): string {
  if (!label) return label
  const trimmed = label.trim()
  for (const [pattern, replacement] of COMPACT_LABEL_LOOKUP) {
    if (pattern.test(trimmed)) return replacement
  }
  const stripped = trimmed.replace(COMPACT_LABEL_SUFFIXES, '').trim()
  return truncateLabelAtWord(stripped, maxLength)
}

/**
 * Map a sensitivity score (0–1) to a descriptive tier label.
 * Used for the Sensitivity bar on factor nodes (T6).
 *
 * | Score   | Label  |
 * |---------|--------|
 * | ≥ 0.7   | "High" |
 * | 0.4–0.69| "Med"  |
 * | < 0.4   | "Low"  |
 *
 * UI-SEM-015: score-based tier fallback. Remove when PLoT provides tier thresholds.
 */
export function sensitivityTierLabel(score: number): string {
  if (score >= 0.7) return 'High'
  if (score >= 0.4) return 'Med'
  return 'Low'
}

/**
 * Map an evidence score (0–1) to a descriptive tier label.
 * Used for the Evidence bar on factor nodes (T6).
 *
 * | Score   | Label    |
 * |---------|----------|
 * | ≥ 0.7   | "Strong" |
 * | 0.4–0.69| "Fair"   |
 * | < 0.4   | "Weak"   |
 *
 * UI-SEM-015: score-based tier fallback. Remove when PLoT provides tier thresholds.
 */
export function evidenceTierLabel(score: number): string {
  if (score >= 0.7) return 'Strong'
  if (score >= 0.4) return 'Fair'
  return 'Weak'
}

/**
 * Factor types that use qualitative tier labels (no numeric meaning to users).
 * 'binary' is included: a binary factor encodes a yes/no state, and its 0/1
 * values map to 'Not used'/'Very high' via the FactorNode special case and
 * to 'Very low'/'Very high' in intervention chips via qualitativeTierLabel.
 */
export const QUALITATIVE_FACTOR_TYPES = new Set(['quality', 'demand', 'other', 'binary'])

/**
 * Internal CEE factor_type descriptor values that must never appear as display units.
 * If the `unit` field contains one of these values it is a data model error —
 * treat it as "no unit" rather than displaying the descriptor to the user.
 *
 * This is the explicit guard for Brief 1b Task 4 (factor_type leak fix).
 * Both `formatFactorValue` and `formatInterventionValue` pass `unit` through
 * `sanitiseUnit()` (which calls `isSuppressedUnit()`) before any formatting.
 * Any unit string present in this set is silently dropped and the no-unit
 * formatting path is used instead.
 */
const INTERNAL_FACTOR_TYPE_DESCRIPTORS = new Set([
  'binary', 'normalized', 'normalised', 'continuous', 'quality',
  'demand', 'cost', 'time', 'other',
])

/**
 * Map a 0–1 intervention value to a qualitative tier label.
 * Used when a factor has no unit and its type is qualitative.
 *
 * | Value     | Label      |
 * |-----------|------------|
 * | 0–0.20    | "Very low" |
 * | 0.21–0.40 | "Low"      |
 * | 0.41–0.60 | "Medium"   |
 * | 0.61–0.80 | "High"     |
 * | 0.81–1.0  | "Very high"|
 *
 * Note: FactorNode renders 'Not used' for binary value=0 via its own special
 * case before reaching this function. Intervention chips (OptionNode) show
 * 'Very low' for value=0 on qualitative factors.
 */
export function qualitativeTierLabel(value: number): string {
  if (value <= 0.2) return 'Very low'
  if (value <= 0.4) return 'Low'
  if (value <= 0.6) return 'Medium'
  if (value <= 0.8) return 'High'
  return 'Very high'
}

/**
 * "Generic placeholder" units emitted by CEE for normalised factors with no
 * real-world calibration. They contribute no information when rendered as a
 * suffix on a number — "0.5 scale" looks measured but isn't.
 *
 * - The canvas formatters (formatInterventionValue) treat these as a signal
 *   to suppress the entire value when there's no raw_value anchor.
 * - The model-tab raw formatter (formatRawValueWithUnit) drops the unit
 *   suffix and renders the number on its own.
 *
 * Single source of truth — Polish 4 follow-up Item 2 (review). The
 * model-tab utility module previously had its own GENERIC_UNITS set; it now
 * imports GENERIC_PLACEHOLDER_UNITS from this file so the canvas and the
 * model-tab can't drift on which units are meaningless.
 */
export const GENERIC_PLACEHOLDER_UNITS: ReadonlySet<string> = new Set([
  'scale', 'index', 'score', 'normalised', 'normalized', 'norm', 'unit', 'units',
])

function isGenericPlaceholderUnit(unit: string | null | undefined): boolean {
  if (unit == null) return false
  return GENERIC_PLACEHOLDER_UNITS.has(unit.toLowerCase().trim())
}

/** Currency symbols that prefix the number (J2). Used for both char-prefix checks and full-unit-string checks. */
export const CURRENCY_SYMBOLS = new Set([
  '£', '$', '€', '¥', '₹', '₩', '₽', '฿', '₫', '₪', '₴', '₸', '₺', '₼', '₾',
  'CHF', 'kr', 'R$',
])

/**
 * Returns true if the given unit string represents a currency symbol.
 * Checks the full string first (for multi-char symbols like 'CHF', 'kr', 'R$'),
 * then the first character (for single-char symbols like '£', '$', '€').
 */
export function isCurrencyUnit(unit: string): boolean {
  if (!unit) return false
  return CURRENCY_SYMBOLS.has(unit) || CURRENCY_SYMBOLS.has(unit[0])
}

/**
 * Returns true if the unit is an internal factor_type descriptor that must
 * never appear in user-facing display (e.g. "binary", "normalized").
 */
export function isSuppressedUnit(unit: string | undefined): boolean {
  if (!unit) return false
  return INTERNAL_FACTOR_TYPE_DESCRIPTORS.has(unit.toLowerCase().trim())
}

/**
 * Returns the unit string if it is safe for user-facing display, or undefined
 * if it is an internal factor_type descriptor that should never be shown.
 */
function sanitiseUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined
  return isSuppressedUnit(unit) ? undefined : unit
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function inferInterventionScaleBase(
  cap: number | null | undefined,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
): number | null {
  const capScale = cap != null && cap > 1 ? cap : null
  const raw = toFiniteNumber(observedRawValue)
  const normalised = typeof observedValue === 'number' && Number.isFinite(observedValue) && observedValue > 0
    ? observedValue
    : null

  if (raw != null && normalised != null) {
    const inferredScale = raw / normalised
    if (Number.isFinite(inferredScale) && inferredScale > 1) {
      if (capScale == null) return inferredScale
      const drift = Math.abs(inferredScale - capScale) / Math.max(inferredScale, capScale)
      return drift > 0.15 ? inferredScale : capScale
    }
  }

  return capScale
}

/**
 * Denormalise a 0–1 intervention value using the factor's raw scale.
 *
 * T3 fix: When `raw_value` and `observedValue` (baseline normalised) are both
 * available, use proportional mapping through the raw scale:
 *   - Baseline case (value ≈ observedValue): return raw_value directly
 *   - Non-baseline: return raw_value × (value / observedValue)
 * This avoids the `value × cap` rounding error (e.g. 0.69 × 70 = 48.3 instead of 49).
 *
 * Falls back to `value × cap` when raw_value is absent.
 *
 * @param value            - Normalised 0–1 value
 * @param cap              - Factor cap (the ceiling of the original scale)
 * @param observedValue    - Baseline normalised value (factor's current observedState.value)
 * @param observedRawValue - Baseline raw value (factor's observedState.raw_value)
 * @returns Denormalised value
 */
export function denormaliseInterventionValue(
  value: number,
  cap: number | null | undefined,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
): number {
  const scaleBase = inferInterventionScaleBase(cap, observedValue, observedRawValue)
  if (scaleBase == null) return value
  // Guard: if value is an integer > 1 and within the scale, it's likely already denormalised.
  // Values ≤ 1 (including 0 and 1.0) are always treated as normalised — note Number.isInteger(1.0) === true in JS.
  if (Number.isInteger(value) && value > 1 && value <= scaleBase) return value

  // T3 fix: When raw_value and baseline normalised value are both known,
  // use proportional mapping through the raw scale for higher accuracy.
  // Guard: raw must be > 0 — a zero raw_value would collapse all interventions to 0.
  const raw = toFiniteNumber(observedRawValue)
  const baselineNorm = typeof observedValue === 'number' && Number.isFinite(observedValue) && observedValue > 0
    ? observedValue
    : null
  if (raw != null && raw > 0 && baselineNorm != null) {
    // Baseline case: value is (close to) the baseline normalised value → return raw_value
    if (Math.abs(value - baselineNorm) < 1e-6) return raw
    // Non-baseline: proportional mapping through raw scale
    return raw * (value / baselineNorm)
  }

  return value * scaleBase
}

/**
 * Format a factor's observed state value for display on the factor node card.
 *
 * Priority order:
 *  1. `raw_value` + `unit` — user-stated baseline (e.g. "£49/mo", "12 engineers")
 *  2. Denormalisation via `cap` — when raw_value absent but value + cap present
 *  3. Qualitative tier label — last resort when no unit or cap available
 *
 * @param observedState - The factor's observed state object
 * @returns Human-readable value string, or null if no data
 */
export function formatFactorValue(observedState: {
  value?: number
  raw_value?: string | number
  unit?: string
  cap?: number
  factor_type?: string
} | undefined | null): string | null {
  if (!observedState) return null

  // Defensive unwrap: callers cast unknown→number on .value/.raw_value, but
  // legacy / future CEE shapes may wrap them as `{ value: number }` objects.
  // Without this guard, `String({ value: 0.5 })` produces "[object Object]"
  // and the rendered cell shows "£[object Object]". unwrapInterventionValue
  // is generic numeric defense (handles both number and `{ value: number }`)
  // and returns null for everything else (string, undefined, null, boolean).
  //
  // For raw_value we preserve the legacy "string passes through" semantics
  // (the signature intentionally accepts `string | number`); only non-string
  // inputs flow through unwrap.
  const rRaw: unknown = observedState.raw_value
  const rValue: unknown = observedState.value
  const raw_value: string | number | undefined =
    typeof rRaw === 'string' ? rRaw : (unwrapInterventionValue(rRaw) ?? undefined)
  const value: number | undefined = unwrapInterventionValue(rValue) ?? undefined
  const { cap, factor_type } = observedState
  const unit = sanitiseUnit(observedState.unit)

  // 1. raw_value present — preferred path
  if (raw_value !== undefined && raw_value !== null && String(raw_value).trim() !== '') {
    const rawStr = String(raw_value).trim()
    if (!unit) return rawStr
    const numericRaw = Number(rawStr)
    if (isCurrencyUnit(unit)) {
      if (!isNaN(numericRaw) && rawStr !== '') {
        return formatInterventionValue(numericRaw, unit, factor_type)
      }
      return `${unit}${rawStr}`
    }
    // % unit: no space between value and symbol (e.g. "0%" not "0 %")
    if (unit === '%') {
      return `${rawStr}%`
    }
    return `${rawStr} ${unit}`
  }

  if (value === undefined) return null

  // 2. Denormalise via cap when available
  if (cap != null && cap > 1) {
    const denormed = denormaliseInterventionValue(value, cap)
    if (unit) {
      if (isCurrencyUnit(unit)) {
        return `${unit}${Math.round(denormed).toLocaleString('en-GB')}`
      }
      if (unit === '%') {
        const pct = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
        return `${pct}%`
      }
      return `${Math.round(denormed)} ${unit}`
    }
  }

  // 3. Qualitative fallback (no unit) or percentage of unit-bearing but cap-less value
  if (!unit) return qualitativeTierLabel(value)
  // Unit present but no cap — format as percentage of unit scale (e.g. 0.85 = "85%")
  if (unit === '%') return `${Math.round(value * 100)}%`
  return null
}

/**
 * Unwrap an intervention value to a finite number, accepting both legacy
 * scalar form and the V3 object form `{ value, source, ... }` produced by
 * `normaliseOptionFromCEE` (see `src/types/options.ts`).
 *
 * Returns null when:
 * - input is null / undefined
 * - input is a number that is NaN or Infinity
 * - input is an object whose `.value` is not a finite number (covers
 *   missing field, null, undefined, string, NaN, Infinity)
 * - input is any other type (string, boolean, array, etc.)
 *
 * Strictly typed: this helper does NOT coerce strings, null, or undefined
 * into numbers via `Number(...)`. A previous version did, which produced
 * the surprise that `{ value: null }` returned 0 (because `Number(null) === 0`)
 * — that rendered "Intervention: £0" for unset interventions and short-
 * circuited the legacy fallback chain in OptionsSection.extractInterventionNumeric.
 *
 * Sites that need to render string interventions verbatim must check the
 * raw value separately (see FactorControllablePanel for an example) — the
 * brief explicitly says strings should "display directly", but the three
 * numeric display paths (OptionPanel InterventionRow, OptionAdvancedEditor
 * AdvancedField type=number, FactorNode formatInterventionValue) cannot
 * render strings without breaking their arithmetic / editable input
 * contracts. Those sites correctly drop string entries; only the
 * FactorControllablePanel connections badge passes them through.
 *
 * Centralises the unwrap logic so every UI display path converges on one
 * source of truth. Inspector panels previously cast the `interventions`
 * map as `Record<string, number>` and rendered objects directly, producing
 * "[object Object]" / "£NaN" on hover, in connections lists, and in
 * advanced editors. The hover-tooltip path on FactorNode was fixed inline
 * in commits b053c82b / fafe62eb; this helper extracts that pattern so
 * every other display path can share it.
 */
export function unwrapInterventionValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw != null && typeof raw === 'object' && 'value' in raw) {
    // Strict numeric check on `.value` — no Number(...) coercion, since
    // `Number(null) === 0` and `Number('foo') === NaN` cause subtle bugs.
    const v = (raw as { value: unknown }).value
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  return null
}

/**
 * Format an intervention value for display as a human-readable chip.
 * Used in OptionNode intervention chips (T8/J1).
 *
 * When a factor has a cap, the normalised 0–1 value is first denormalised
 * (value × cap), then formatted using the unit. Capped values are rounded
 * to whole numbers.
 *
 * @param value      - Normalised intervention value (0–1 for binary/fraction, or raw)
 * @param unit       - Optional unit hint (e.g. '%', 'fraction', '£', 'engineers')
 * @param factorType - Optional CEE factor_type (e.g. 'quality', 'demand') — triggers tier labels
 * @param cap        - Optional factor cap for denormalisation (J1)
 * @param observedValue    - Factor's observed normalised value (for proportional denormalisation)
 * @param observedRawValue - Factor's observed raw value (real-world anchor)
 * @param opts.preserveTierLabel - When true, generic placeholder units with no
 *   raw anchor return the qualitative tier label (e.g. "Very low") instead of
 *   the empty string. Used by GraphTextView so the text view keeps tier info
 *   while the canvas suppresses meaningless numbers. Default: false.
 * @returns Human-readable string. May be '' to signal "suppress" — callers
 *   that render adjacent decoration (arrows, separators) MUST check for empty.
 */
export function formatInterventionValue(
  value: number,
  unit?: string,
  factorType?: string,
  cap?: number,
  observedValue?: number | null,
  observedRawValue?: string | number | null,
  opts?: { preserveTierLabel?: boolean },
): string {
  // Defensive guard: callers must pass a finite number. Object/NaN/undefined
  // inputs previously produced "[object Object]" and "£NaN" strings on factor
  // nodes (see FactorNode.tsx interventionValue memo). Fail visibly instead.
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  // Sanitise unit — never display internal factor_type descriptor strings as units
  unit = sanitiseUnit(unit)
  // Graph v1.1 polish 4 Task 1 + review + follow-up: any "generic placeholder"
  // unit (scale, index, score, normalised, …) emitted by CEE for normalised
  // factors with no real-world calibration is meaningless without an anchor.
  //
  //   - preserveTierLabel=false (default): return '' so canvas callers can
  //     render arrow-only pills with no trailing number.
  //   - preserveTierLabel=true (GraphTextView): return the qualitative tier
  //     label so the text view still surfaces a coarse "Very low" / "High"
  //     classification.
  if (isGenericPlaceholderUnit(unit) && observedRawValue == null) {
    return opts?.preserveTierLabel ? qualitativeTierLabel(value) : ''
  }
  // J1: Denormalise using cap before any formatting
  const v = denormaliseInterventionValue(value, cap, observedValue, observedRawValue)
  const scaleBase = inferInterventionScaleBase(cap, observedValue, observedRawValue)
  const hasScaleBase = scaleBase != null && scaleBase > 1

  if (unit === 'fraction' || unit === 'proportion') {
    // Fraction/proportion: always treat as 0–1 scale (cap doesn't apply — already a ratio)
    return `${Math.round(value * 100)}%`
  }
  if (unit === '%') {
    const display = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${display}%`
  }
  // J2: Currency symbols prefix the number
  if (unit && isCurrencyUnit(unit)) {
    const rounded = hasScaleBase ? Math.round(v) : v
    return `${unit}${rounded.toLocaleString('en-GB')}`
  }
  if (unit) {
    // J1: Round to integer when cap was applied; otherwise preserve existing precision
    const display = hasScaleBase ? Math.round(v) : v
    return `${display} ${unit}`
  }
  // No unit — check if this is a qualitative factor type (case-insensitive)
  const ft = factorType?.toLowerCase().trim()
  const isQualitative = !ft || QUALITATIVE_FACTOR_TYPES.has(ft)
  if (isQualitative) {
    // Qualitative: use original normalised value for tier labels (0–1 scale)
    return qualitativeTierLabel(value)
  }
  // Continuous without unit, non-qualitative — show as number (max 2 dp)
  return v % 1 === 0 ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Format an already-denormalised raw value with an optional unit.
 *
 * Polish 4 follow-up Item C: this replaces the local `formatInterventionValue`
 * shadow inside OptionsSection.tsx. The model-tab code receives raw numbers
 * straight from the option intervention payload (it doesn't denormalise) and
 * just needs to glue a unit on the end with the right formatting rules.
 *
 * Rules:
 *   - non-finite value           → "Not set" (legacy compat with the local helper)
 *   - generic placeholder unit   → number only, no suffix ("49000" not "49000 scale")
 *   - currency symbol            → prefix ("£49,000")
 *   - ISO currency code          → prefix with space ("USD 49,000")
 *   - %                          → suffix with no space ("49%")
 *   - other unit                 → suffix with space ("9 months")
 *   - no unit                    → bare smart-formatted number
 *
 * Distinct from formatInterventionValue (which takes a NORMALISED 0–1 value
 * and denormalises). The two functions converge on similar output but the
 * input contracts differ — keep them separate so the type signature itself
 * tells you which path to use.
 */
const ISO_CURRENCY_CODES_SET: ReadonlySet<string> = new Set([
  'USD', 'GBP', 'EUR', 'JPY', 'INR', 'KRW', 'RUB', 'TRY', 'UAH', 'NGN', 'VND', 'BTC',
  'CHF', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
  'HUF', 'RON', 'BGN', 'HRK', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'ZAR',
  'EGP', 'AED', 'SAR', 'QAR', 'ILS', 'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'LKR',
])

function formatRawSmartNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-GB')
  if (Math.abs(n) < 1) return n.toFixed(2).replace(/\.?0+$/, '')
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatRawValueWithUnit(value: number, unit?: string | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not set'
  if (!unit) return formatRawSmartNumber(value)
  const trimmed = unit.trim()
  if (!trimmed) return formatRawSmartNumber(value)
  // Generic placeholder unit → drop the suffix entirely.
  if (isGenericPlaceholderUnit(trimmed)) return formatRawSmartNumber(value)
  // Currency symbol prefix.
  if (isCurrencyUnit(trimmed)) return `${trimmed}${formatRawSmartNumber(value)}`
  // ISO currency code prefix with space.
  if (ISO_CURRENCY_CODES_SET.has(trimmed)) return `${trimmed} ${formatRawSmartNumber(value)}`
  // Percent: no space.
  if (trimmed === '%') return `${formatRawSmartNumber(value)}%`
  // Everything else: suffix with space.
  return `${formatRawSmartNumber(value)} ${trimmed}`
}
