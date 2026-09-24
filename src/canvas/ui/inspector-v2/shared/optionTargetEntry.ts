/**
 * ⭐⭐ WHAT AN OPTION-TARGET INPUT SHOWS, AND HOW WHAT IS TYPED INTO IT BECOMES
 * THE MODEL VALUE — one owner, so the row cannot seed in one frame and read in
 * another.
 *
 * ── THE DEFECT (served UI `a4434670`, 24 Sep 2026, CDP starter) ─────────────
 * The option card read "Annual platform cost £60k". The inspector's field for
 * the same target read **0.5** — the MODEL scale — and parsed with
 * `parseFloat`. A reader typing the figure the card showed them, `80000`, was
 * refused ("cannot be recorded on this model", or, per the witness, nothing
 * visible at all), and `£80,000` or `80k` fared no better. The field and the
 * card disagreed about which number the row IS, which is Paul's "0.295 model
 * value" beside "59 GBP/month" in a different place.
 *
 * ── THE FRAME ───────────────────────────────────────────────────────────────
 * A row takes amounts in the factor's OWN unit when, and only when, the
 * conversion is unambiguous:
 *   · the unit is a real one (`classifyUnit` symbol / iso / percent / other —
 *     never none, a placeholder, or a suppressed factor-type descriptor);
 *   · the factor declares a usable `cap` (> 1, the same `scaleBase > 1` the
 *     card's own formatter requires before it prints a unit);
 *   · and where the factor also records a raw anchor, that anchor agrees with
 *     the cap. The card denormalises through the ANCHOR
 *     (`denormaliseInterventionValue`); the one raw→model rule
 *     (`normaliseRawFactorValue`) divides by the CAP — CEE's own scale for this
 *     carrier. When the two disagree a typed £ amount has two meanings, and the
 *     card would print back a figure the reader did not type. That is data the
 *     wire does not reconcile, so the row stays on the model scale there rather
 *     than choosing a meaning.
 * Every other row keeps the model scale it has always had.
 *
 * ── THE PARSER ──────────────────────────────────────────────────────────────
 * `parseSuccessTarget`, the estate's existing amount parser, and the one the
 * pre-analysis drill-in already commits factor values through: `80000`,
 * `80,000`, `£80,000`, `80k`, `£80k`, `15%`. Nothing new is invented; it fails
 * CLOSED on ambiguity, and every refusal here carries a sentence the row
 * renders — the input never silently reverts or silently does nothing.
 */

import { classifyUnit, denormaliseInterventionValue, isSuppressedUnit, toFiniteNumber } from '../../../utils/labelUtils'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'
import { formatNumber, formatValueWithUnit } from '../../../utils/formatValueWithUnit'
import { parseSuccessTarget } from '../../../components/pre-analysis-v3/hero/parseSuccessTarget'

/** The factor's recorded anchor, as `OptionPanel` already carries it. */
export interface OptionTargetAnchor {
  /** `observedState.value` — normalised. */
  observedValue?: number
  /** `observedState.raw_value` — the same quantity in the factor's unit. */
  observedRawValue?: number
}

export type OptionTargetEntryFrame =
  | { kind: 'model_scale' }
  | {
      kind: 'user_units'
      /** `classifyUnit`'s canonical spelling. */
      unit: string
      unitKind: 'symbol' | 'iso' | 'percent' | 'other'
      cap: number
    }

const MODEL_SCALE: OptionTargetEntryFrame = { kind: 'model_scale' }

/**
 * Relative tolerance for "the anchor agrees with the cap". CEE mints `value` as
 * `raw / cap` in floating point, so a consistent factor agrees to ~1e-16; 1e-9
 * keeps the card's printed figure identical to the typed one for any amount
 * the two-decimal display can show, and nothing looser is claimed.
 */
const ANCHOR_AGREES_WITH_CAP = 1e-9

export function resolveOptionTargetEntryFrame({
  unit,
  cap,
  observedValue,
  observedRawValue,
}: { unit?: string; cap?: number } & OptionTargetAnchor): OptionTargetEntryFrame {
  if (!unit || isSuppressedUnit(unit)) return MODEL_SCALE
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'none' || kind === 'placeholder') return MODEL_SCALE
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 1) return MODEL_SCALE
  const raw = toFiniteNumber(observedRawValue)
  if (raw != null && raw > 0 && typeof observedValue === 'number' && Number.isFinite(observedValue) && observedValue > 0) {
    if (Math.abs(raw / observedValue - cap) > cap * ANCHOR_AGREES_WITH_CAP) return MODEL_SCALE
  }
  return { kind: 'user_units', unit: canonical, unitKind: kind, cap }
}

/**
 * The text the input shows for a model-scale `value`.
 *
 * ⚠ MODEL SCALE KEEPS `String(value)`, UNROUNDED, exactly as before: the buffer
 * is committed on blur, so rounding it would write a rounded value
 * (`InlineNumberEditor`'s own rule). A user-unit row shows the card's figure —
 * the same denormaliser the card uses — without the unit, which sits beside the
 * field so the reader types a number and nothing else is required of them.
 */
export function optionTargetEntrySeed(
  value: number,
  frame: OptionTargetEntryFrame,
  anchor: OptionTargetAnchor,
): string {
  if (frame.kind === 'model_scale') return String(value)
  return formatNumber(userUnitMagnitude(value, frame, anchor))
}

/** The same quantity, in the row's unit, as the reader reads it (`£80,000`). */
export function describeOptionTargetValue(
  value: number,
  frame: OptionTargetEntryFrame,
  anchor: OptionTargetAnchor,
): string {
  if (frame.kind === 'model_scale') return `${formatNumber(value)} (model value)`
  return formatValueWithUnit(userUnitMagnitude(value, frame, anchor), frame.unit)
}

/** What sits beside the input: the unit, on the side the card prints it. */
export function optionTargetEntryAdornment(
  frame: OptionTargetEntryFrame,
): { prefix?: string; suffix?: string } {
  if (frame.kind === 'model_scale') return {}
  if (frame.unitKind === 'symbol') return { prefix: frame.unit }
  if (frame.unitKind === 'iso') return { prefix: frame.unit }
  return { suffix: frame.unit }
}

function userUnitMagnitude(
  value: number,
  frame: Extract<OptionTargetEntryFrame, { kind: 'user_units' }>,
  anchor: OptionTargetAnchor,
): number {
  return denormaliseInterventionValue(value, frame.cap, anchor.observedValue, anchor.observedRawValue)
}

/**
 * Every sentence a refused entry can show — named, so a spec binds the string
 * the reader reads.
 *
 * ⭐ THE SAME SHAPE AS A REFUSAL FROM THE MODEL: `Not saved · <specific
 * reason>`, printed directly under the field with the typed text left in it
 * (Experience Design, #63 5806266691, S2). To the reader an entry the field
 * could not read and an entry CEE declined are the same event — their value
 * was not saved — so they read alike; only the reason differs.
 */
export const OPTION_TARGET_ENTRY_REFUSAL = {
  unreadable: (example: string) =>
    `Not saved · not a number this row can read. Enter an amount such as ${example}.`,
  unreadableModelScale: 'Not saved · not a number this row can read. Enter a value between 0 and 1.',
  outOfRange: (lowest: string, highest: string) =>
    `Not saved · must be between ${lowest} and ${highest} for this factor.`,
  outOfRangeModelScale: 'Not saved · must be between 0 and 1 on the model scale.',
  unitConflict: (unit: string) =>
    `Not saved · this row is in ${unit}. Enter the amount without another unit.`,
  unitOnModelScale: 'Not saved · this row is on the model scale. Enter a plain number between 0 and 1.',
} as const

export type OptionTargetEntryAdmission =
  | { ok: true; value: number }
  | { ok: false; reason: string }

const CURRENCY_SYMBOL_TYPED = /^[£$€]$/

/**
 * Parse a typed entry and return the MODEL-SCALE value to send, or the reason
 * it cannot be sent. Never throws, never clamps, never guesses.
 *
 * @param example — the value the row is showing, used only to phrase the
 *   "such as …" example in the unreadable sentence. It is the reader's own
 *   record, so the example invents nothing.
 */
export function admitOptionTargetEntry(
  text: string,
  frame: OptionTargetEntryFrame,
  anchor: OptionTargetAnchor,
  example: number,
): OptionTargetEntryAdmission {
  let typed = text.trim()
  // A reader may type the unit the field already names ("5 months"). The
  // parser reads a number followed by a time word as a TIMEFRAME, never a
  // target, so the row's own unit word is removed first — only that word,
  // only at the end.
  if (frame.kind === 'user_units' && frame.unitKind === 'other') {
    const tail = frame.unit.toLowerCase()
    if (typed.toLowerCase().endsWith(tail)) typed = typed.slice(0, typed.length - tail.length).trim()
  }
  const parsed = parseSuccessTarget(typed)
  if (parsed === null) {
    return {
      ok: false,
      reason:
        frame.kind === 'user_units'
          ? OPTION_TARGET_ENTRY_REFUSAL.unreadable(describeOptionTargetValue(example, frame, anchor))
          : OPTION_TARGET_ENTRY_REFUSAL.unreadableModelScale,
    }
  }

  if (frame.kind === 'model_scale') {
    // A unit on a model-scale row has no conversion to apply: refuse rather
    // than read `60%` as 60 or as 0.6 on the reader's behalf.
    if (parsed.unit !== null) return { ok: false, reason: OPTION_TARGET_ENTRY_REFUSAL.unitOnModelScale }
    if (parsed.value < 0 || parsed.value > 1) {
      return { ok: false, reason: OPTION_TARGET_ENTRY_REFUSAL.outOfRangeModelScale }
    }
    return { ok: true, value: parsed.value }
  }

  // A marker that CONTRADICTS the row's declared unit is refused, not ignored:
  // a different currency symbol on a symbol row, `%` on a non-percent row, a
  // currency symbol on a percent row. An ISO or free-text unit ("GBP/month")
  // cannot be compared with a symbol without a table this module does not own,
  // so a symbol typed there is read as the row's own unit — the drill-in's rule.
  if (parsed.unit !== null) {
    const typedIsCurrency = CURRENCY_SYMBOL_TYPED.test(parsed.unit)
    const conflicts =
      (parsed.unit === '%' && frame.unitKind !== 'percent') ||
      (typedIsCurrency && frame.unitKind === 'percent') ||
      (typedIsCurrency && frame.unitKind === 'symbol' && parsed.unit !== frame.unit)
    if (conflicts) return { ok: false, reason: OPTION_TARGET_ENTRY_REFUSAL.unitConflict(frame.unit) }
  }

  // ⭐ THE ONE raw→model RULE, never re-typed here (`observedStateHelpers`).
  const modelValue = normaliseRawFactorValue(parsed.value, frame.cap)
  if (!Number.isFinite(modelValue) || modelValue < 0 || modelValue > 1) {
    return {
      ok: false,
      reason: OPTION_TARGET_ENTRY_REFUSAL.outOfRange(
        formatValueWithUnit(0, frame.unit),
        formatValueWithUnit(frame.cap, frame.unit),
      ),
    }
  }
  return { ok: true, value: modelValue }
}
