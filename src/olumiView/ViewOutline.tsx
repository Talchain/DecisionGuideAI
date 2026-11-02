/**
 * The Model tab's outline on the olumi-core lane (canvas A B7): the View's cards in the View's order, each line its glyph and heading
 * exactly as core wrote them, each at its `data-view` path. No group headings: a card's `family` is an id, and a heading made from it
 * would be DGAI's words. Before a View lands there is no outline, as the canvas has no cards.
 */
import { typography } from '../styles/typography'
import { useViewStore } from './store'

export function ViewOutline() {
  const cards = useViewStore((s) => s.view?.model?.cards ?? null)
  if (cards === null) return null
  return (
    <ol className={`${typography.panelBody} text-text-body space-y-1 px-3.5 py-2.5`} data-testid="view-outline">
      {cards.map((c) => (
        <li key={c.id} className="flex items-baseline gap-1" data-view-card={c.id}>
          <span data-view={`${c.id}.glyph`}>{c.glyph}</span> <span data-view={`${c.id}.heading`}>{c.heading}</span>
        </li>
      ))}
    </ol>
  )
}
