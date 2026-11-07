/**
 * WHERE A ROW'S EDIT LANDS, FROM CORE'S OWN VIEW (no id is invented here):
 * - an aim's target or a limit's bound is its own figure card, which core links to the aim with a line titled `target` or `bound` (core
 *   `src/view/model.ts` measure links; every golden with a target carries one). The aim's row offers that figure's editor, in its words;
 * - a link's strength is a figure too (`links[].effect.figure`, core view.ts): editable where that figure is a card core offers an edit on;
 * - a card's links are the View's lines that start or end at it, each with its place in `links` (its View path).
 * Each answer is null where core offers no edit, so nothing is drawn that core would refuse.
 */
import type { ViewCard, ViewLink, ViewModel } from '../client'

const editable = (model: ViewModel, id: string | null | undefined): ViewCard | null => {
  const c = id == null ? undefined : model.cards.find((k) => k.id === id)
  return c?.figure?.edit == null ? null : c
}

export function targetCardOf(model: ViewModel, card: ViewCard): ViewCard | null {
  if (card.family !== 'goal' && card.family !== 'limit') return null
  const line = model.links.find((l) => l.to === card.id && (l.title === 'target' || l.title === 'bound'))
  return editable(model, line?.from)
}

export const strengthCardOf = (model: ViewModel, link: ViewLink): ViewCard | null => editable(model, link.effect?.figure)

export const linksOf = (model: ViewModel, id: string): { l: ViewLink; i: number }[] =>
  model.links.map((l, i) => ({ l, i })).filter(({ l }) => l.from === id || l.to === id)
