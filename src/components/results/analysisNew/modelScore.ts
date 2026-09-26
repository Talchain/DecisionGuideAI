/**
 * ⛔ A NORMALISED OUTCOME IS A MODEL SCORE: NO `%`, NO `+`.
 *
 * AI Quality (#70 5841808930, 26 Sep 2026): on a run whose outcomes are
 * normalised (`isNormalised`), `outcome.p10/p50/p90` are origin-form model
 * scores — not a percent of anything, and not a change from today. The shared
 * `formatThreshold(…, true)` (RangeVisualization, also the Analysis tab's)
 * reframes them as "+13%", which reads as "a 13% rise". On Paul's MRR run
 * "Keep current price: +9%" would read as keeping the price grows MRR by 9%.
 *
 * This tab prints such a value the way its comparison axis already does
 * (`OptionsComparison` `formatAxisTick`): three significant figures, no sign,
 * no symbol. A value with a real unit still goes through `formatThreshold`.
 */
export function formatModelScore(value: number): string {
  return value.toLocaleString(undefined, { maximumSignificantDigits: 3 })
}

export const MODEL_SCORE_COPY = {
  /** A score inside a sentence names what it is, so a bare "0.136" is never read as a unit. */
  readout: (value: number): string => `${formatModelScore(value)} (a model score, no unit)`,
} as const
