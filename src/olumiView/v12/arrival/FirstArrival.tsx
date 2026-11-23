import { useId, useState } from 'react'
import { OkIcon } from '../../look/icons'
import { FoldChevron } from '../../look/FoldChevron'
import type { View } from '../../client'
import { ownViewPending } from '../../../olumiCore/ownViewFirst'
import { BODY, CARD, H, LABEL } from '../../../olumiCore/team/ui'
import { nonEmpty } from '../../tipping'
import { Hover } from '../../look/Hover'

/**
 * A colleague's first arrival (17 Nov): the one card a member reads above the private-view box while core still holds them, that is, until
 * they have given or skipped their own view (the View's `gated`, read through the one existing rule, `ownViewPending`). It says why their
 * view comes first, offers the brief the scenario started from (their teammate's words, verbatim, behind a closed disclosure), and says
 * what is private and what the reveal does, the last two as hover words on the lock and the line (v10 review item 9). Then the existing controls take over, directly below.
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

const ROW = `${BODY} flex items-start gap-1.5`

export function FirstArrival({ view }: { view: View }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const briefId = useId()
  if (!ownViewPending(view)) return null
  const brief = typeof view.brief === 'string' ? view.brief : ''
  const privacy = view.team_words?.views?.private
  return (
    <section data-testid="first-arrival" aria-label={ARRIVAL_WORDS.heading} className={CARD}>
      <h3 className={H}>{ARRIVAL_WORDS.heading}</h3>
      {/* v10 review item 9: headline plus one line. The lock is core's privacy sentence and the line itself carries the reveal sentence, both as hover words. */}
      <Hover as="p" className={ROW} data-testid="first-arrival-why" words={ARRIVAL_WORDS.reveal}>
        <Hover data-testid="first-arrival-private" words={nonEmpty(privacy) ? privacy : undefined} className="inline-flex flex-none">
          <OkIcon id="view-only" size={14} decorative className="mt-[3px]" />
        </Hover>
        <span>{ARRIVAL_WORDS.why}</span>
      </Hover>
      {brief.trim() !== '' && (
        <div className="grid gap-1">
          <button type="button" data-testid="first-arrival-brief-toggle" aria-expanded={open} aria-controls={briefId} onClick={() => setOpen((o) => !o)}
            className={`${LABEL} flex min-h-[24px] w-full items-center gap-1.5 text-left`}>
            <OkIcon id="brief" size={14} decorative />
            <span className="min-w-0 flex-1">{ARRIVAL_WORDS.brief}</span>
            <FoldChevron open={open} />
          </button>
          {open && <p id={briefId} data-testid="first-arrival-brief" className={`${BODY} whitespace-pre-wrap break-words`}>{brief}</p>}
        </div>
      )}
    </section>
  )
}
