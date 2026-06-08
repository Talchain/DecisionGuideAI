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
 *    - Surface: factor node body text (FactorNode.tsx, OptionNode formatChipValue contextual path),
 *      inspector-v2 factor panels, and the debug bundle's renderFactorDisplayState
 *      (via the shared factorDisplayText entry point — same priority for all)
 *    - Input:   { label, value, raw_value, unit, factor_type, cap, category, display_value }
 *    - Output:  null | "£40,000" | "75%" | "No tech lead in place" | display_value verbatim
 *    - Fallback: returns null when no meaningful text can be produced.
 *    - Priority (V5 stale-value-protection fix, May 2026):
 *        1. Pattern 1 (raw_value + meaningful unit) — outranks display_value
 *        2. display_value                          — outranks raw/heuristic
 *        3. raw_value without unit (numeric fallback)
 *        4. value-only binary heuristic
 *      A fresh raw_value + meaningful unit (£26,000) beats a stale display_value
 *      ('£20,000'), but display_value still beats unitless raw and the binary heuristic
 *      so CEE-authored contextual text ('No acquisition pursued') survives.
 *    - Notes: Binary contextual text only fires when factor_type === 'binary'.
 *      Suppresses fractional 0<v<1 with meaningless unit.
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
  // Concise sentence-case form (node label minus the "Capacity/Level/Added"
  // suffix) — fits every caller's 20–22 char budget. Not authored copy.
  [/^developer headcount (capacity|level|added)$/i, 'Developer headcount'],
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
 * Contract note: a COMPACT_LABEL_LOOKUP hit returns its canonical replacement
 * VERBATIM and is NOT bounded by `maxLength` — these forms are hand-authored to
 * be brief (e.g. "MRR", "Developer headcount") and truncating them would corrupt
 * them. `maxLength` therefore caps ONLY the fallback suffix-strip + truncate
 * path. Keep every lookup value short (current max ≈ 19 chars); all real callers
 * pass 20–22. See compactFactorLabel('Developer headcount capacity', 15) in the
 * spec, which locks this verbatim-lookup behaviour.
 *
 * @param label - Raw factor label (already cleaned of scale metadata)
 * @param maxLength - Cap for the FALLBACK truncate path only (default 15);
 *                    lookup-table hits are returned verbatim regardless.
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
 * Format a raw win probability (0–1) for display as a percentage string.
 *
 * Explicit thresholds avoid ambiguity around values like 0.005 that sit on
 * JS Math.round boundaries. Non-zero probabilities below 1% surface as
 * "< 1%" so baseline options with very low but non-zero win share do not
 * appear as a misleading "0%".
 */
export function formatWinProbability(rawProb: number): string {
  if (!Number.isFinite(rawProb)) return '—'
  if (rawProb <= 0) return '0%'
  if (rawProb < 0.01) return '< 1%'
  if (rawProb >= 0.995) return '100%'
  return `${Math.round(rawProb * 100)}%`
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
 * Single source of truth — Polish 4 follow-up + review follow-up. The
 * model-tab utility module previously had its own GENERIC_UNITS,
 * CURRENCY_SYMBOLS, and ISO_CURRENCY_CODES sets. formatFactorDisplayValue
 * had its own hardcoded ['£', '$', '€', '¥'] list. They all now route
 * through classifyUnit (below) so the canvas, the model-tab, and the
 * factor body display can't drift on which units are meaningless and
 * which are currencies.
 *
 * The CURRENCY_SYMBOLS / ISO_CURRENCY_CODES split is load-bearing:
 *   - Symbol → prefix with NO space ("£49,000", "$500")
 *   - ISO code → prefix WITH space ("CHF 49,000", "USD 500")
 * Every formatter in this file plus src/utils/formatFactorDisplayValue.ts
 * and src/canvas/components/model-tab/utils.ts honours this rule.
 *
 * classifyUnit also normalises case + whitespace so 'chf', ' CHF ',
 * 'USD', 'r$' all resolve to their canonical ISO form.
 *
 * Known remaining scatter (documented exception, NOT consolidated):
 *   - src/canvas/ui/inspector-v2/panels/{FactorControllable,FactorObservable}Panel.tsx
 *     and shared/InterventionRow.tsx: hardcoded ['£', '$', '€']. A narrower
 *     UX-intentional set for inline inspector-input prefix treatment. The
 *     inspector renders the unit as a SEPARATE span (not a fused prefix
 *     glyph) for ISO codes so the user can edit the number cleanly next to
 *     a trailing label. InspectorRouter.spec.tsx explicitly asserts this
 *     behaviour (CHF renders as a trailing span, not an inline prefix).
 *     This is a structural UX choice, not a tech-debt scatter — leave it.
 */
// Brief 5.7 close-out follow-up: the unit-classification primitives moved to
// `@/utils/unitClassifier` (a neutral, non-canvas location) so shared
// components can consume them without depending on the canvas layer. The
// re-exports below preserve every existing canvas import path so canvas
// consumers do not change.
export {
  GENERIC_PLACEHOLDER_UNITS,
  CURRENCY_SYMBOLS,
  ISO_CURRENCY_CODES,
  COUNT_UNITS,
  classifyUnit,
  isCountUnit,
} from '@/utils/unitClassifier'
export type { UnitClass } from '@/utils/unitClassifier'

import { GENERIC_PLACEHOLDER_UNITS, classifyUnit } from '@/utils/unitClassifier'

function isGenericPlaceholderUnit(unit: string | null | undefined): boolean {
  if (unit == null) return false
  return GENERIC_PLACEHOLDER_UNITS.has(unit.toLowerCase().trim())
}

/**
 * Epsilon used when deciding if an intervention value is "the same as" the
 * observed baseline for placeholder-unit factors (scale, index, score, …).
 * Values within ±epsilon of baseline are treated as "does not change".
 */
export const PLACEHOLDER_DIRECTION_EPSILON = 0.1

/**
 * Direction-only phrasing for placeholder-unit factors, where the raw number
 * ("0.33 scale") carries no meaning for a user. Returns null if the baseline
 * is unknown — callers should render nothing in that case.
 */
export function placeholderDirectionLabel(
  interventionValue: number,
  baseline: number | null | undefined,
  compactLabel: string,
): string | null {
  if (baseline == null) return null
  if (interventionValue > baseline + PLACEHOLDER_DIRECTION_EPSILON) return `Increases ${compactLabel}`
  if (interventionValue < baseline - PLACEHOLDER_DIRECTION_EPSILON) return `Decreases ${compactLabel}`
  return `Does not change ${compactLabel}`
}

/**
 * Qualitative tier labels returned by formatInterventionValue for unitless
 * quality factors. These are just as meaningless as placeholder-unit values
 * in differentiator/highlight text, so callers fall through to directional
 * phrasing when this returns true.
 */
export function isTierLabel(text: string): boolean {
  return /^(Very high|Very low|High|Low|Medium|Moderate)$/i.test(text)
}

/**
 * Returns true if the given unit string represents ANY kind of currency
 * (single-char symbol or multi-char ISO code / label).
 *
 * Helper preserved for backwards compatibility. New code should call
 * classifyUnit(unit).kind directly to distinguish symbol-vs-ISO formatting.
 */
export function isCurrencyUnit(unit: string): boolean {
  if (!unit) return false
  const kind = classifyUnit(unit).kind
  return kind === 'symbol' || kind === 'iso'
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
 * @deprecated Use `formatFactorDisplayValue` (src/utils/formatFactorDisplayValue.ts)
 * or the `factorDisplayText` helper. This function predates the CEE `display_value`
 * field and does not short-circuit on it; consumers are being migrated.
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
    typeof rRaw === 'string' ? rRaw : (unwrapInterventionValue(rRaw).value ?? undefined)
  const value: number | undefined = unwrapInterventionValue(rValue).value ?? undefined
  const { cap, factor_type } = observedState
  const unit = sanitiseUnit(observedState.unit)

  // 1. raw_value present — preferred path
  if (raw_value !== undefined && raw_value !== null && String(raw_value).trim() !== '') {
    const rawStr = String(raw_value).trim()
    if (!unit) return rawStr
    const numericRaw = Number(rawStr)
    // Polish 4 review follow-up: classifyUnit normalises case / whitespace
    // so 'chf', ' CHF ', 'USD' all resolve to their canonical ISO form.
    const { kind, canonical } = classifyUnit(unit)
    if (kind === 'symbol') {
      if (!isNaN(numericRaw) && rawStr !== '') {
        return formatInterventionValue(numericRaw, canonical, factor_type)
      }
      return `${canonical}${rawStr}`
    }
    if (kind === 'iso') {
      if (!isNaN(numericRaw) && rawStr !== '') {
        return formatInterventionValue(numericRaw, canonical, factor_type)
      }
      return `${canonical} ${rawStr}`
    }
    if (kind === 'percent') {
      return `${rawStr}%`
    }
    return `${rawStr} ${canonical || unit}`
  }

  if (value === undefined) return null

  // 2. Denormalise via cap when available
  if (cap != null && cap > 1) {
    const denormed = denormaliseInterventionValue(value, cap)
    if (unit) {
      const { kind, canonical } = classifyUnit(unit)
      if (kind === 'symbol') {
        return `${canonical}${Math.round(denormed).toLocaleString('en-GB')}`
      }
      if (kind === 'iso') {
        return `${canonical} ${Math.round(denormed).toLocaleString('en-GB')}`
      }
      if (kind === 'percent') {
        const pct = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
        return `${pct}%`
      }
      return `${Math.round(denormed)} ${canonical || unit}`
    }
  }

  // 3. Qualitative fallback (no unit) or percentage of unit-bearing but cap-less value
  if (!unit) return qualitativeTierLabel(value)
  // Unit present but no cap — format as percentage of unit scale (e.g. 0.85 = "85%")
  if (unit === '%') return `${Math.round(value * 100)}%`
  return null
}

/**
 * Unwrap an intervention record into its numeric value AND its optional
 * CEE-authored `display_value` string. Returns both so rendering paths can
 * show CEE's human-readable label verbatim (F.6 passthrough) while
 * computation paths use the numeric value.
 *
 * Handles:
 * - Legacy scalar form (plain number) → `{ value: n, displayValue: null }`
 * - V3 object form `{ value, display_value?, source?, ... }` produced by
 *   `normaliseOptionFromCEE` (see `src/types/options.ts`)
 * - Observed-state metadata fields (obs.value, obs.raw_value, obs.cap, etc.)
 *   which share the same `number | {value}` shape
 *
 * Returns `value: null` when:
 * - input is null / undefined
 * - input is a number that is NaN or Infinity
 * - input is an object whose `.value` is not a finite number (covers
 *   missing field, null, undefined, string, NaN, Infinity)
 * - input is any other type (string, boolean, array, etc.)
 *
 * Returns `displayValue: null` when:
 * - no `display_value` property is present
 * - `display_value` is not a string
 * - `display_value` trims to an empty string
 * Otherwise returns the trimmed string. `displayValue` may be non-null even
 * when `value` is null — renderers tolerant of null numerics (e.g. FactorNode
 * comparison rows) can still show the CEE string; computation sites drop the
 * entry on `value == null`.
 *
 * Strictly typed: this helper does NOT coerce strings, null, or undefined
 * into numbers via `Number(...)`. A previous version did, which produced
 * the surprise that `{ value: null }` returned 0 (because `Number(null) === 0`)
 * — that rendered "Intervention: £0" for unset interventions and short-
 * circuited the legacy fallback chain in OptionsSection.extractInterventionNumeric.
 *
 * Sites that need to render string interventions verbatim (the qualitative
 * `{value: "low"}` shape, distinct from CEE's display_value) must check the
 * raw value separately via `extractStringIntervention` (see
 * FactorControllablePanel for an example).
 *
 * Centralises the unwrap logic so every UI display path converges on one
 * source of truth. The earlier shadow helper `extractInterventionDisplay`
 * was folded into this function (feat/refactor commits, 2026-04-15).
 */
export interface UnwrappedIntervention {
  /** Finite numeric value, or null if none can be extracted. */
  value: number | null
  /** CEE-authored human-readable label (trimmed), or null when absent. */
  displayValue: string | null
}

export function unwrapInterventionValue(raw: unknown): UnwrappedIntervention {
  // Scalar form (legacy).
  if (typeof raw === 'number') {
    return { value: Number.isFinite(raw) ? raw : null, displayValue: null }
  }
  // Object form ({ value, display_value?, ... }) — CEE V3 shape, but also
  // used for observed_state metadata fields (obs.value, obs.raw_value, etc.)
  // which may arrive as scalar or wrapped.
  if (raw != null && typeof raw === 'object') {
    // Strict numeric check on `.value` — no Number(...) coercion, since
    // `Number(null) === 0` and `Number('foo') === NaN` cause subtle bugs.
    let value: number | null = null
    if ('value' in raw) {
      const v = (raw as { value: unknown }).value
      if (typeof v === 'number' && Number.isFinite(v)) value = v
    }
    let displayValue: string | null = null
    if ('display_value' in raw) {
      const dv = (raw as { display_value: unknown }).display_value
      if (typeof dv === 'string') {
        const trimmed = dv.trim()
        if (trimmed.length > 0) displayValue = trimmed
      }
    }
    return { value, displayValue }
  }
  return { value: null, displayValue: null }
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
  // F.6 passthrough for CEE-authored display_value is implemented at the
  // caller boundary, not here. `unwrapInterventionValue` returns both the
  // numeric value and displayValue; rendering surfaces (FactorNode hover +
  // comparison, OptionNode chips + differentiator + Detailed inline,
  // OptionPanel, FactorControllablePanel, OptionsSection model-tab) render
  // displayValue verbatim when present and only fall through to this
  // function when it is absent. Do NOT re-introduce display_value handling
  // here — the pattern intentionally keeps this function pure numeric
  // formatting so callers stay in control of precedence.
  //
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
  // Polish 4 review follow-up: route every unit classification through
  // classifyUnit so case / whitespace drift can't create inconsistent
  // rendering ('chf' → "1200 chf" before; "CHF 1,200" now).
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'percent') {
    const display = Math.abs(value) <= 1 ? Math.round(value * 100) : Math.round(value)
    return `${display}%`
  }
  if (kind === 'symbol') {
    // J2: single-char glyph → prefix with no space ("£49,000").
    const rounded = hasScaleBase ? Math.round(v) : v
    return `${canonical}${rounded.toLocaleString('en-GB')}`
  }
  if (kind === 'iso') {
    // ISO code → prefix with space ("CHF 49,000"). Canonical form is the
    // uppercased label for 3-letter codes, or the raw 'kr'/'R$' label.
    const rounded = hasScaleBase ? Math.round(v) : v
    return `${canonical} ${rounded.toLocaleString('en-GB')}`
  }
  if (kind === 'other') {
    // J1: Round to integer when cap was applied; otherwise preserve existing precision
    const display = hasScaleBase ? Math.round(v) : v
    return `${display} ${canonical}`
  }
  if (kind === 'placeholder') {
    // Scale / index / score / … with a raw anchor: the suppression path
    // (top of function) already caught the no-raw case. Here we have raw
    // data, so preserve the legacy "0.5 scale" suffix rendering for
    // backwards compatibility with callers that pass both.
    const display = hasScaleBase ? Math.round(v) : v
    return `${display} ${canonical}`
  }
  // kind === 'none' → no unit. Fall through to the qualitative tier path
  // below so value-only callers still render a meaningful label.
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
function formatRawSmartNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-GB')
  if (Math.abs(n) < 1) return n.toFixed(2).replace(/\.?0+$/, '')
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatRawValueWithUnit(value: number, unit?: string | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not set'
  // Polish 4 review follow-up: route through classifyUnit so case /
  // whitespace / generic-placeholder / ISO handling is identical to the
  // normalised-value formatters above.
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'none') return formatRawSmartNumber(value)
  if (kind === 'placeholder') return formatRawSmartNumber(value)
  if (kind === 'symbol') return `${canonical}${formatRawSmartNumber(value)}`
  if (kind === 'iso') return `${canonical} ${formatRawSmartNumber(value)}`
  if (kind === 'percent') return `${formatRawSmartNumber(value)}%`
  // kind === 'other'
  return `${formatRawSmartNumber(value)} ${canonical}`
}
