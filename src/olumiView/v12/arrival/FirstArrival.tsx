import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, Eye, FileText, Lock } from 'lucide-react'
import type { View } from '../../client'
import { ownViewPending } from '../../../olumiCore/ownViewFirst'
import { BODY, CARD, H, LABEL } from '../../../olumiCore/team/ui'
import { nonEmpty } from '../../tipping'

/**
 * A colleague's first arrival (17 Nov): the one card a member reads above the private-view box while core still holds them, that is, until
 * they have given or skipped their own view (the View's `gated`, read through the one existing rule, `ownViewPending`). It says why their
 * view comes first, offers the brief the scenario started from (their teammate's words, verbatim, behind a closed disclosure), and says
 * what is private and what the reveal does. Then the existing controls take over, directly below.
 *
 * It reads three fields of the reader's own View and nothing else (`gated`, `brief`, `team_words.views.private`), so nothing core holds
 * back from them (a teammate's view, a reply, a kept idea, evidence) can be drawn here. It fetches nothing, stores nothing, moves no focus
 * and scrolls nothing. The privacy line is core's own sentence, drawn as given: this file promises nothing about privacy itself.
 */
export const ARRIVAL_WORDS = {
  heading: 'Your view comes first',
  why: 'Say what you think before you read the others’, so the team hears what only you know.',
  brief: 'The brief this scenario started from',
  reveal: 'Once everyone has given or skipped a view, any of you can reveal them all together.',
} as const

const ICON = 'mt-[3px] h-3.5 w-3.5 flex-none text-text-body'
const ROW = `${BODY} flex items-start gap-1.5`

export function FirstArrival({ view }: { view: View }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const briefId = useId()
  if (!ownViewPending(view)) return null
  const brief = typeof view.brief === 'string' ? view.brief : ''
  const privacy = view.team_words?.views?.private
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <section data-testid="first-arrival" aria-label={ARRIVAL_WORDS.heading} className={CARD}>
      <h3 className={H}>{ARRIVAL_WORDS.heading}</h3>
      <p className={BODY}>{ARRIVAL_WORDS.why}</p>
      {brief.trim() !== '' && (
        <div className="grid gap-1">
          <button type="button" data-testid="first-arrival-brief-toggle" aria-expanded={open} aria-controls={briefId} onClick={() => setOpen((o) => !o)}
            className={`${LABEL} flex min-h-[24px] w-full items-center gap-1.5 text-left`}>
            <FileText strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
            <span className="min-w-0 flex-1">{ARRIVAL_WORDS.brief}</span>
            <Chevron strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
          </button>
          {open && <p id={briefId} data-testid="first-arrival-brief" className={`${BODY} whitespace-pre-wrap break-words`}>{brief}</p>}
        </div>
      )}
      {nonEmpty(privacy) && (
        <p className={ROW} data-testid="first-arrival-private"><Lock strokeWidth={1.75} aria-hidden="true" className={ICON} /><span>{privacy}</span></p>
      )}
      <p className={ROW} data-testid="first-arrival-reveal"><Eye strokeWidth={1.75} aria-hidden="true" className={ICON} /><span>{ARRIVAL_WORDS.reveal}</span></p>
    </section>
  )
}
