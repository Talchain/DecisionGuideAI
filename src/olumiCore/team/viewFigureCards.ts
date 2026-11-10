/**
 * D3 (strategy canvas audit, witness 12; the design owner's call): the figure boxes in "Add my view" are core's to name. Core's v3
 * `collab.view_figure_cards` ([{id, label}], at most `max_view_figures`, ordered by how much rests on each; olumi-core wip/d3-view-figures)
 * lists the drawn cards a view's figure may be given for. A box is drawn for exactly those cards, in core's order, each the drawn card that
 * offers its own figure edit (its `figure.edit.prompt` is the box's words). A core that sends no list draws no box: the UI never guesses
 * which cards take a figure (it drew one for every factor, and core refused unsized ones with a raw id).
 */
import type { View } from '../../olumiView/client'

type Card = NonNullable<View['model']>['cards'][number]
export type ViewFigureCard = { card: Card; label: string }

export function viewFigureCardsOf(view: View): ViewFigureCard[] {
  const list = (view.collab as { view_figure_cards?: unknown }).view_figure_cards
  if (!Array.isArray(list)) return []
  const out: ViewFigureCard[] = []
  for (const x of list) {
    const id = (x as { id?: unknown }).id, label = (x as { label?: unknown }).label
    if (typeof id !== 'string') continue
    const card = view.model?.cards.find((c) => c.id === id)
    if (card?.figure?.edit == null) continue
    out.push({ card, label: typeof label === 'string' && label !== '' ? label : card.heading })
  }
  return out
}
