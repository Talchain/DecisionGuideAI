/**
 * A threshold figure in its unit — ONE rule for both threshold sites on the Reasoning tab (the
 * Challenge row's tipping sentence and the glance's "Could change if").
 *
 * Served 28 Sep 2026 (UI `ac2def0f`, Paul's £-goal journey): "Pro plan price would have to rise from
 * 58.8 GBP per month to 59 GBP per month". The model's unit is `GBP per month`; the reader's is
 * "£58.80 / month", which is how the factor card already prints the same node.
 *
 * ⚠ IT ONLY MOVES A CURRENCY TO ITS GLYPH, the estate's own `compactUnitParts` /
 * `ISO_CURRENCY_GLYPHS` (the factor card's reader). No conversion, no rescaling, no new unit: a
 * figure whose unit is not a currency keeps `applyUnitPlacement` exactly as before.
 */
import { applyUnitPlacement, classifyUnit, compactUnitParts, ISO_CURRENCY_GLYPHS } from '../../../utils/unitClassifier'

const GLYPH_LEAD = /^-?[£$€]/

/** Money is never "£58.8": a non-whole amount shows its pence. */
function money(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-GB')
    : value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatThresholdFigure(figure: string, value: number, unit: string): string {
  if (unit.trim() === '') return figure
  const parts = compactUnitParts(money(value), unit)
  if (parts !== null && GLYPH_LEAD.test(parts.figure)) {
    return parts.unit ? `${parts.figure} ${parts.unit}` : parts.figure
  }
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'iso' && value >= 0) {
    const glyph = ISO_CURRENCY_GLYPHS[canonical.toUpperCase()]
    if (glyph !== undefined) return `${glyph}${money(value)}`
  }
  if (kind === 'symbol' && GLYPH_LEAD.test(canonical) && value >= 0) return `${canonical}${money(value)}`
  return applyUnitPlacement(figure, unit)
}
