/**
 * The figures Stress-test draws when a result exists but no figure drives it: the ones Core names (result bases, run rests, Check's needs) or
 * links into a calculation or aim by a typed role. Typed sources only; no text comparison.
 */
import type { View, ViewCard, ViewModel } from '../../client'
import { checkNeedsOf } from '../../check/items'
import { cardOf } from '../../port/pick'
import { cardKindOf } from '../cards/kind'
import { linkRole } from '../contract'
import { cardOfRecord } from '../lenses/layers'

/** Figures Core names in result bases or needs, or links into a calculation or aim. */
export function resultFigureCardsOf(model: ViewModel, view: View): ViewCard[] {
  // Every card Check lists as a need (what blocks or waits, a figure to give, Olumi's worth-checking) is named, by id.
  const named = new Set(checkNeedsOf(model).flatMap((item) => item.cards))
  const addRecord = (id: string) => {
    const card = cardOfRecord(model, id)
    if (card !== undefined) named.add(card.id)
  }
  for (const card of model.cards) {
    for (const row of card.rows) {
      if (row.kind !== 'chance' || row.rests_on == null) continue
      const { estimates, approx, what_ifs } = row.rests_on
      for (const id of [...estimates, ...approx, ...what_ifs]) addRecord(id)
    }
  }
  for (const rest of model.run?.rests ?? []) {
    for (const figure of rest.figures ?? []) addRecord(figure.id)
  }
  const inputs = new Set<string>()
  for (const link of model.links) {
    const role = linkRole(link)
    if (role === 'input' || role === 'size' || role === 'measures' || role === 'target') {
      inputs.add(link.from)
    } else if (role === 'effect') {
      const target = cardOf(model, link.to)
      if (target !== null && cardKindOf(target, model, view).shape === 'calculated') inputs.add(link.from)
    }
  }
  return model.cards.filter((card) =>
    (named.has(card.id) || (card.family === 'quantity' && inputs.has(card.id))) &&
    cardKindOf(card, model, view).shape !== 'calculated')
}
