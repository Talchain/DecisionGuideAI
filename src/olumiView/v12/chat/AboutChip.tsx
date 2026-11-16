/**
 * "About <card title> on the canvas" under an Olumi reply (V12 Main): a visible name for the card the reply points at, which until now was only a
 * ring on the canvas. The cards are core's own pointers (`answer.next.at`, else `answer.next.about`), the title is that card's heading in the View,
 * and a press focuses and selects the card on the canvas (the same focus channel the Reasoning tab uses). A pointer to a record the canvas does not
 * draw names nothing, and a reply with no pointer draws no chip. "About" and "on the canvas" are the board's fixed chrome.
 */
import { Crosshair } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import type { View, ViewTurn } from '../../client'

export const ABOUT_CHIP_MAX = 3

export type AboutCard = { id: string; title: string }

/** The cards a reply points at, each once, named by the View's card heading, in core's order (`at` first); none the canvas lacks. */
export function aboutCardsOf(view: View | null, next: NonNullable<ViewTurn['answer']>['next']): AboutCard[] {
  const cards = view?.model?.cards ?? []
  const ids = [...new Set([...(next.at === null ? [] : [next.at]), ...next.about])]
  return ids.flatMap((id) => { const c = cards.find((x) => x.id === id); return c === undefined || c.heading === '' ? [] : [{ id, title: c.heading }] }).slice(0, ABOUT_CHIP_MAX)
}

export const aboutWords = (title: string): string => `About ${title} on the canvas`

export function AboutChips({ cards }: { cards: readonly AboutCard[] }): JSX.Element | null {
  if (cards.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1" data-testid="view-about-chips">
      {cards.map((c) => (
        <button key={c.id} type="button" onClick={() => focusNodeById(c.id)} data-testid="view-about-chip" data-card={c.id}
          className={`${typography.viewPanelMeta} inline-flex min-h-[24px] max-w-full items-center gap-1 rounded-full border border-panel-border bg-panel px-2 text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}>
          <Crosshair className="h-3 w-3 flex-none text-info" aria-hidden="true" /><span className="truncate">{aboutWords(c.title)}</span>
        </button>
      ))}
    </div>
  )
}
