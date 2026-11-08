/**
 * Strategy lane, slice 1: one person's qualitative views on the model, inside their block in the reveal dock (RevealDock.tsx `Person`, after
 * their figures, by agreement with the V11 build, 7 Nov): per card, core's pill ("Observed, two rollouts") and the card's name, then their
 * words for it when they are not the view's words already shown above. Every word is core's or the person's. Null when they gave none.
 */
import { BODY, META } from '../../olumiCore/team/ui'
import type { View } from '../client'
import { viewLinesOf } from './strategy'

export function StrategyViewLines({ view, v }: { view: View; v: { id: number; text: string } }): JSX.Element | null {
  const lines = viewLinesOf(view, v.id)
  if (lines.length === 0) return null
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0" data-testid={`strategy-view-lines-${v.id}`}>
      {lines.map((l) => (
        <li key={`${l.view}:${l.about.id}`} className="grid gap-0.5" data-strategy-about={l.about.id}>
          <p className={`${META} flex flex-wrap items-center gap-2`}>
            <span className="rounded-full border border-panel-border px-2 py-0.5 text-text-body" data-testid={`strategy-pill-${l.view}-${l.about.id}`}>{l.pill}</span>
            {l.about.label === null ? null : <span className="text-text-header">{l.about.label}</span>}
          </p>
          {l.text === v.text ? null : <p className={`${BODY} whitespace-pre-wrap break-words`}>{l.text}</p>}
        </li>
      ))}
    </ul>
  )
}
