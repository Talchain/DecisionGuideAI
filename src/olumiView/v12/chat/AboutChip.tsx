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
import { endRing, pointRing } from '../../ring'

export const ABOUT_CHIP_MAX = 3

export type AboutCard = { id: string; title: string }

/** The cards a reply points at, each once, named by the View's card heading, in core's order (`at` first); none the canvas lacks. */
export function aboutCardsOf(view: View | null, next: NonNullable<ViewTurn['answer']>['next']): AboutCard[] {
  const cards = view?.model?.cards ?? []
  const ids = [...new Set([...(next.at === null ? [] : [next.at]), ...next.about])]
  return ids.flatMap((id) => { const c = cards.find((x) => x.id === id); return c === undefined || c.heading === '' ? [] : [{ id, title: c.heading }] }).slice(0, ABOUT_CHIP_MAX)
}

export const aboutWords = (title: string): string => `About ${title} on the canvas`

/** The chip's count words (17 Nov, the calm panel: one icon with "2 cards"): how many cards the reply points at; the numeral is drawn beside the icon, the words are its label. Fixed chrome; the cards' own titles are the hover (core's headings). */
export const aboutCountWords = (n: number): string => `${n} ${n === 1 ? 'card' : 'cards'}`

/** v10 review item 6: ONE chip in the reply's icon row, not a wrapped chip per card. Hover or focus rings the cards (the same ring the next step
 *  lights); a press focuses the first and selects it on the canvas. The titles are on the hover, one per line. */
export function AboutChips({ cards }: { cards: readonly AboutCard[] }): JSX.Element | null {
  if (cards.length === 0) return null
  const ids = cards.map((c) => c.id)
  return (
    <div className="flex" data-testid="view-about-chips">
      <button type="button" onClick={() => focusNodeById(ids[0]!)} onMouseEnter={() => pointRing(ids)} onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) endRing() }} onFocus={() => pointRing(ids)} onBlur={() => endRing()}
        title={cards.map((c) => aboutWords(c.title)).join('\n')} data-testid="view-about-chip" data-card={ids[0]} data-cards={ids.join(' ')}
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-info hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <Crosshair className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} aria-hidden="true" /><span aria-hidden="true">{cards.length}</span><span className="sr-only">{aboutCountWords(cards.length)}</span>
      </button>
    </div>
  )
}
