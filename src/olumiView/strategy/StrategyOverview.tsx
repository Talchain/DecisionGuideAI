/**
 * Strategy lane, slice 1: the strategy overview as a read-only projection of core's `strategy.overview` (the question, the aim, the routes
 * in play, claims with the crux first, assumptions, open questions, risks, the views given, evidence, commitments). Each line is a stored
 * word with core's state pill and its holders' initials; a section with nothing shows core's own sentence for that. Under the aim, core's definitional gate in
 * words. First in the Team tab's panel list (TeamTab.tsx, by agreement with the V11 build, 7 Nov), folded until opened; null without the key.
 */
import { controls } from '../../styles/controls'
import { HIT_44_TALL } from '../../styles/hitArea'
import { useId, useState } from 'react'
import { FoldChevron } from '../look/FoldChevron'
import { Hover } from '../look/Hover'
import { AVATAR, BODY, CARD, META } from '../../olumiCore/team/ui'
import type { View } from '../client'
import { strategyOf } from './strategy'

const initial = (by: string) => by.slice(0, 1).toUpperCase()

export function StrategyOverviewSection({ view }: { view: View | null }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const body = useId()
  const s = strategyOf(view)
  if (s === null) return null
  return (
    <section className={CARD} data-testid="strategy-overview" aria-label={s.overview.heading}>
      <button type="button" aria-expanded={open} aria-controls={open ? body : undefined} data-testid="strategy-overview-toggle" onClick={() => setOpen((o) => !o)} className={`${controls.chipText} ${HIT_44_TALL} flex w-full cursor-pointer items-center gap-1.5 text-left`}>
        <FoldChevron open={open} />
        {s.overview.heading}
      </button>
      {!open ? null : (
        <div id={body} className="grid gap-3" data-testid="strategy-overview-body">
          {s.overview.sections.map((sec) => (
            <section key={sec.id} className="grid gap-1" data-testid={`strategy-overview-${sec.id}`} aria-label={sec.heading}>
              <h3 className={`${META} m-0 font-medium text-text-header`}>{sec.heading}</h3>
              {sec.lines.length === 0 ? <p className={META}>{sec.empty}</p> : (
                <ul className="m-0 grid list-none gap-1 p-0">
                  {sec.lines.map((l) => (
                    <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2" data-strategy-line={l.id}>
                      <p className={`${BODY} flex flex-wrap items-baseline gap-x-2`}>
                        <span>{l.text}</span>
                        {l.pill === null ? null : <span className={`${META} rounded-full border border-panel-border px-2 py-0.5`} data-strategy-pill="">{l.pill}</span>}
                      </p>
                      <span className="inline-flex flex-none" aria-label={l.people.map((p) => p.name).join(', ')}>
                        {l.people.slice(0, 3).map((p, i) => <Hover key={p.id} as="span" words={p.name} role="img" aria-label={p.name} className={`${AVATAR} ${i > 0 ? '-ml-1.5' : ''}`}>{initial(p.name)}</Hover>)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {sec.id === 'aim' ? <p className={META} data-testid="strategy-gate">{s.gate.text}</p> : null}
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
