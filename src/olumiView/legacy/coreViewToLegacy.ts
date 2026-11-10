/**
 * The one adapter from core's View (olumi.view/3) to what the previous product's panels draw (DL brief A4, 10 Nov).
 *
 * The previous panels read CEE's Run through composing resolvers (`optionChanceCellFromResults`, RunView's licence). Core has already
 * worked out every word, so this module does not imitate CEE's report: it fills each section's DRAWN shape (the props its pure
 * component takes) with core's strings verbatim, each with its View path in `at`. It formats, rounds, sorts and words nothing.
 * A section core cannot feed is absent here and listed in `LEGACY_GAPS`, never filled with an invented value.
 *
 * Sections, in the previous Reasoning tab's order as they are added: `matrix` (Options side by side).
 */
import type { DecisionMatrixRows, MatrixCell, MatrixRow } from '../../components/results/analysisNew/sections/DecisionMatrix'
import type { View, ViewCard, ViewModel } from '../client'
import { optionCards } from '../layout'
import { aimGroupsOf, type AimGroup } from '../port/pick'

export type LegacyReasoning = {
  /** Options side by side: each compared option's chance per aim, core's card order, the lead aim first. */
  matrix: DecisionMatrixRows | null
}

export function coreViewToLegacy(view: View): LegacyReasoning {
  const model = view.model
  return { matrix: model == null ? null : matrixOf(model, view.version ?? null) }
}

/** One cell: the option's row for this aim. A chance or limit row draws its value with core's sentence as the Why; a refusal draws its own words. */
function cellOf(group: AimGroup, card: ViewCard): MatrixCell {
  const hit = group.rows.find((r) => r.card === card)
  if (hit === undefined) return { text: null, why: null }
  const { row, i } = hit, at = `${card.id}.rows.${i}`
  return row.kind === 'none'
    ? { text: row.text, why: row.title, at: `${at}.text` }
    : { text: row.value, why: row.title, at: `${at}.value` }
}

export function matrixOf(model: ViewModel, version: View['version'] | null): DecisionMatrixRows | null {
  const cards = optionCards(model)
  if (cards.length === 0) return null
  const groups = aimGroupsOf(model)
  const lead = groups[0]
  const rows: MatrixRow[] = cards.map((card) => {
    // The modelled outcome is the lead aim's: core's own range sentence, its explanation on hover.
    const hit = lead?.rows.find((r) => r.card === card)
    const outcome = hit !== undefined && hit.row.kind === 'chance' ? hit.row.outcome ?? null : null
    const outcomeAt = outcome === null ? undefined : `${card.id}.rows.${hit!.i}.outcome.text`
    return {
      id: card.id, label: card.heading, labelAt: `${card.id}.heading`,
      cells: groups.map((g) => cellOf(g, card)),
      outcome: null, centreReadout: outcome?.text ?? null, outcomeTitle: outcome?.title, outcomeAt,
    }
  })
  const shared = model.run?.shared_blockers ?? []
  return {
    // The version's own label (core's word for which saved model these come from); the previous "From the Run at …" sentence is not composed here.
    stamp: version == null ? null : { text: version.label, at: 'version.label', computedAt: version.at },
    columns: groups.map((g) => ({ id: g.aimId, label: g.aim?.text ?? null, at: g.aim?.at })),
    rows,
    withheld: shared.map((b, i) => ({ text: b.text, at: `run.shared_blockers.${i}.text` })),
  }
}

/**
 * What the previous matrix drew that core's View does not carry today (for the engine stream, A5). Each is left out, never invented.
 */
export const LEGACY_GAPS = {
  matrix: [
    "Olumi's reading of the goal, with its correct control (the previous GoalReadingLine opens the canvas inspector); core sends run.readings, which this section does not draw yet.",
  ],
} as const
