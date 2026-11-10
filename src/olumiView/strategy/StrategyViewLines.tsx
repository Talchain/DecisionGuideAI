/**
 * Strategy lane, slice 1: one person's qualitative views on the model, inside their block in the reveal dock (RevealDock.tsx `Person`, after
 * their figures, by agreement with the V11 build, 7 Nov): per card, core's pill ("Observed, two rollouts") and the card's name, then their
 * words for it when they are not the view's words already shown above. Every word is core's or the person's. Null when they gave none.
 * Opened on a card (a chip), their line on THIS card comes first and their lines on other cards are one step away ("2 more from Priya";
 * design owner's witness, 8 Nov).
 * P1 (the approved Reveal comp, 10 Nov): opened on a card, their pill for THIS card sits beside their name (`StrategyHerePill`, mounted in
 * RevealDock's name row) and its line drops the card's name, which the panel's heading already says; their words for it show only when they
 * differ from the view's words above.
 */
import { useState } from 'react'
import { BODY, META } from '../../olumiCore/team/ui'
import type { View } from '../client'
import { viewLinesOf } from './strategy'

/** Their pill for the card the panel is opened on, for the name row; null when they said nothing on that card. */
export function StrategyHerePill({ view, v, card }: { view: View; v: { id: number }; card: string | null }): JSX.Element | null {
  if (card === null) return null
  const l = viewLinesOf(view, v.id).find((x) => x.about.id === card)
  if (l === undefined) return null
  return <span className={`${META} rounded-full border border-panel-border px-2 py-0.5 font-normal text-text-body`} data-testid={`strategy-pill-${l.view}-${l.about.id}`}>{l.pill}</span>
}

export function StrategyViewLines({ view, v, card = null }: { view: View; v: { id: number; text: string; by: string }; card?: string | null }): JSX.Element | null {
  const [more, setMore] = useState(false)
  const lines = viewLinesOf(view, v.id)
  if (lines.length === 0) return null
  const here = card === null ? lines : lines.filter((l) => l.about.id === card)
  const rest = card === null ? [] : lines.filter((l) => l.about.id !== card)
  const shown = more ? [...here, ...rest] : here
  // The line on the opened card says only what the name row does not: its pill is there, its card is the heading.
  const onCard = (id: string) => card !== null && id === card
  return (
    <div className="grid gap-1.5">
    <ul className="m-0 grid list-none gap-1.5 p-0" data-testid={`strategy-view-lines-${v.id}`}>
      {shown.map((l) => (
        onCard(l.about.id) && l.text === v.text ? null : <li key={`${l.view}:${l.about.id}`} className="grid gap-0.5" data-strategy-about={l.about.id}>
          {onCard(l.about.id) ? null : <p className={`${META} flex flex-wrap items-center gap-2`}>
            <span className="rounded-full border border-panel-border px-2 py-0.5 text-text-body" data-testid={`strategy-pill-${l.view}-${l.about.id}`}>{l.pill}</span>
            {l.about.label === null ? null : <span className="text-text-header">{l.about.label}</span>}
          </p>}
          {l.text === v.text ? null : <p className={`${BODY} whitespace-pre-wrap break-words`}>{l.text}</p>}
        </li>
      ))}
    </ul>
    {rest.length === 0 ? null : (
      <button type="button" aria-expanded={more} data-testid={`strategy-view-more-${v.id}`} onClick={() => setMore((m) => !m)}
        className={`${META} inline-flex min-h-6 cursor-pointer items-center justify-self-start text-text-body underline underline-offset-2 hover:text-text-header`}>
        {more ? `Only this card from ${v.by}` : `${rest.length} more from ${v.by}`}
      </button>
    )}
    </div>
  )
}
