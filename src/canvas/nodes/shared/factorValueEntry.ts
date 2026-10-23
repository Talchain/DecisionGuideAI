/**
 * The card's value field for a factor whose figure is typed in its OWN unit (vision spec §2d, 23 Oct 2026).
 *
 * Two rules, both read from rules the estate already owns:
 *   1. THE FIELD SHOWS THE MAGNITUDE THE CARD SHOWS. A percent factor stored as a 0–1 ratio (`raw_value: 0.25`,
 *      `unit: '%'`) reads "25%" at rest (`formatFactorDisplayValue`'s percent rule: 0 < raw < 1 → × 100). Its field
 *      opens at 25, and a typed figure goes back to the writer on the stored scale (÷ 100). Every other factor opens at
 *      its stored figure, which is what its card prints.
 *   2. A TYPED UNIT MARKER IS ADMITTED ONLY WHEN IT IS THE FACTOR'S OWN (`typedMarkerDenotesRowUnit`, the inspector's
 *      option-target rule): "£6.80" on a "£ per customer" factor is £6.80; "$6.80" is refused with the inspector's own
 *      sentence, and nothing is sent. Never re-read as the factor's unit.
 *
 * The figure it admits is in the FIELD's scale (so committing the opened figure unchanged is a no-op); `toWrite` turns
 * it into the number `useModelEditAuthority.proposeFactorValue` reads, in the factor's unit. The writer is unchanged.
 */
import { classifyUnit } from '../../utils/labelUtils'
import { parseSuccessTarget } from '../../components/pre-analysis-v3/hero/parseSuccessTarget'
import { OPTION_TARGET_ENTRY_REFUSAL, typedMarkerDenotesRowUnit } from '../../ui/inspector-v2/shared/optionTargetEntry'
import type { NodeValueEntryAdmission } from './NodeValueEditor'

export interface FactorValueEntry {
  /** The figure the field opens with, in the field's scale. */
  fieldValue: number
  /** The field's opening text. */
  seedText: string
  admit: (draft: string) => NodeValueEntryAdmission
  /** A field-scale figure → the figure the writer reads, in the factor's unit. */
  toWrite: (fieldFigure: number) => number
  /** A stored figure in the factor's unit → the field's scale (for the editor's settled read-back). */
  toField: (stored: number) => number
}

/** × 100 without the binary tail (0.07 × 100 = 7.000000000000001). */
const percentPoints = (ratio: number): number => Number((ratio * 100).toPrecision(12))

/**
 * The entry for a factor whose field reads its own unit, or null where there is none to name (no unit, a placeholder
 * unit): those fields keep the plain number field.
 *
 * @param stored the figure the field would otherwise open with (`resolveValueInputSeed(...).seed`), in the unit.
 */
export function factorValueEntry(unit: string | null | undefined, stored: number): FactorValueEntry | null {
  const { kind, canonical } = classifyUnit(unit ?? undefined)
  if (kind === 'none' || kind === 'placeholder') return null
  const rowUnit = canonical || String(unit)
  const ratio = kind === 'percent' && stored > 0 && stored < 1
  const toField = (v: number) => (ratio ? percentPoints(v) : v)
  const toWrite = (v: number) => (ratio ? v / 100 : v)
  const fieldValue = toField(stored)
  const frame = { kind: 'user_units' as const, unit: rowUnit, unitKind: kind, cap: 0 }
  return {
    fieldValue,
    seedText: String(fieldValue),
    toWrite,
    toField,
    admit: (draft) => {
      let typed = draft.trim()
      // The factor's own unit words, typed after the figure ("6.80 £ per customer"), are the field's own.
      if (kind === 'other' && typed.toLowerCase().endsWith(rowUnit.toLowerCase())) typed = typed.slice(0, typed.length - rowUnit.length).trim()
      const parsed = parseSuccessTarget(typed)
      if (parsed === null) return { ok: false, reason: OPTION_TARGET_ENTRY_REFUSAL.unreadableWithoutValue(rowUnit) }
      if (parsed.unit !== null && !typedMarkerDenotesRowUnit(parsed.unit, frame)) {
        return { ok: false, reason: OPTION_TARGET_ENTRY_REFUSAL.unitConflict(rowUnit) }
      }
      return { ok: true, value: parsed.value }
    },
  }
}
