/**
 * The confidence language (Design System v5 §confidence) as the thinking tools' one status code: solid success for a
 * figure the user stated or accepted, dashed info for one not yet checked, dotted factor for a figure not set yet.
 * Every mark, swatch and pill in the tools reads it from here, so the three states look the same wherever they appear.
 */
import type { AssumptionColumn, AssumptionItem } from './assumptionMapModel'

export const FIGURE_MARK: Readonly<Record<AssumptionColumn, string>> = Object.freeze({
  yours: 'bg-success border border-success',
  unchecked: 'bg-info-light/50 border-[1.5px] border-dashed border-info',
  missing: 'bg-panel border-[3px] border-dotted border-factor',
})

/** The pill words: a count reads before each. The column titles stay the full words (`ASSUMPTION_MAP_COPY.columns`). */
export const FIGURE_SHORT: Readonly<Record<AssumptionColumn, string>> = Object.freeze({
  yours: 'yours',
  unchecked: 'not yet checked',
  missing: 'no figure yet',
})

/** The strip reads like the model's progress: what is yours first, then what is not checked, then what is not set. */
export const FIGURE_ORDER: readonly AssumptionColumn[] = ['yours', 'unchecked', 'missing']

/** One figure's identity across the tool, the store and the canvas selection. */
export function figureKey(item: Pick<AssumptionItem, 'target'>): string {
  return `${item.target.kind}:${item.target.id}`
}
