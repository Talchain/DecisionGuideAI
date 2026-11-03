/**
 * The Model tab's outline on the olumi-core lane (canvas A B7): the View's cards in the View's order, each line the card's own header as
 * the canvas draws it (glyph, heading, and core's marks: Olumi's ◆ and a proposed change, each with core's hover), every string at its
 * `data-view` path. Olumi's additions stay visibly Olumi's here too (00101). No group headings: a card's `family` is an id, and a
 * heading made from it would be DGAI's words. Before a View lands there is no outline, as the canvas has no cards.
 */
import { Mark } from '../canvas/nodes/ViewCardNode'
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
          <Mark at={`${c.id}.olumi`} mark={c.olumi} />
          <Mark at={`${c.id}.change`} mark={c.change} />
        </li>
      ))}
    </ol>
  )
}
