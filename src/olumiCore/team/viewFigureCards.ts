/**
 * D3 (strategy canvas audit, witness 12; the design owner's call): the figure boxes in "Add my view" are core's to name. Core's v3
 * `collab.view_figure_cards` (at most `max_view_figures`, ordered by how much rests on each) lists the approved figures a view's figure may
 * be given for. A box is drawn for exactly those, in core's order. A core that sends no list draws no box: the UI never guesses which
 * figures take one (it drew one for every factor, and core refused unsized ones with a raw id).
 *
 * PL-790 (olumi-core wip/pl-private-figures 71722349): each entry is `{id, label, prompt}` and covers a figure whose card is folded off the
 * canvas too; its box is drawn from those words directly. Only an OLD core's entry (no `prompt`) falls back to the drawn card that offers
 * its own figure edit (`figure.edit.prompt`), as before; one with neither is not drawn.
 */
import type { View } from '../../olumiView/client'

export type ViewFigureCard = { id: string; label: string; prompt: string }

export function viewFigureCardsOf(view: View): ViewFigureCard[] {
  const list = (view.collab as { view_figure_cards?: unknown }).view_figure_cards
  if (!Array.isArray(list)) return []
  const out: ViewFigureCard[] = []
  for (const x of list) {
    const { id, label, prompt } = x as { id?: unknown; label?: unknown; prompt?: unknown }
    if (typeof id !== 'string' || id === '') continue
    if (typeof prompt === 'string' && prompt !== '' && typeof label === 'string' && label !== '') { out.push({ id, label, prompt }); continue }
    const card = view.model?.cards.find((c) => c.id === id)
    if (card?.figure?.edit == null) continue
    out.push({ id, label: typeof label === 'string' && label !== '' ? label : card.heading, prompt: card.figure.edit.prompt })
  }
  return out
}
