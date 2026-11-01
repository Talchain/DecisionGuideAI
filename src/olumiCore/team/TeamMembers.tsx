import { CheckCircle2, Hourglass, Lock } from 'lucide-react'
import { memberStates, type MemberState } from './model'
import { AVATAR, BODY, CARD, H, META } from './ui'
import type { TeamScenario } from './types'

const STATE: Readonly<Record<MemberState, { words: string; Icon: typeof Lock; tone: string }>> = {
  in: { words: 'In', Icon: CheckCircle2, tone: 'text-success' },
  held: { words: 'View held', Icon: Lock, tone: 'text-text-light' },
  waiting: { words: 'Waiting', Icon: Hourglass, tone: 'text-text-light' },
}

/** Who is here, and where each person stands this round: in, holding a private view, or still to give one (design plan, step 1). */
export function TeamMembers({ scenario }: { scenario: Pick<TeamScenario, 'members' | 'waiting' | 'reveal' | 'you'> }): JSX.Element {
  const rows = memberStates(scenario)
  return (
    <section data-testid="team-members" aria-label="Who is here" className="grid gap-2">
      <h3 className={H}>Who is here</h3>
      {rows.length < 2 && <p className={META} data-testid="team-alone">Only you so far. Send a teammate their own private link to bring them in.</p>}
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {rows.map(({ member, state }) => {
          const s = STATE[state]
          return (
            <li key={member.id} data-testid={`team-member-${member.id}`} data-state={state} className={`${CARD} grid-cols-[22px_minmax(0,1fr)_auto] items-center !gap-2.5 !py-1.5 min-h-[40px]`}>
              <span aria-hidden="true" className={AVATAR}>{member.name.slice(0, 1).toUpperCase()}</span>
              <span className={`${BODY} truncate text-text-header`}>{member.name}{member.name === scenario.you ? <span className="text-text-light"> (you)</span> : null}</span>
              <span className={`inline-flex items-center gap-1 ${META}`}>
                <s.Icon aria-hidden="true" className={`h-3 w-3 flex-none ${s.tone}`} />
                <span>{s.words}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
