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
import { applyUnitPlacement, formatMoneyFigure } from '../../../utils/unitClassifier'

/** Money through the ONE money-figure rule (`formatMoneyFigure`); any other unit is placed as before. */
export function formatThresholdFigure(figure: string, value: number, unit: string): string {
  if (unit.trim() === '') return figure
  return formatMoneyFigure(value, unit) ?? applyUnitPlacement(figure, unit)
}
