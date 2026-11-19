/**
 * B2, the UI half: Olumi's reading of the round, at the top of "Where you differ" (contract: olumiCore/team/roundRead.ts).
 *
 * Drawn in core's words only, by field: core's provisional line and lead; per crux, core's words for its kind, each person's own words as
 * core resolved them (verbatim, under their name), each comparison core embedded (its name, core's `status_text` for what it does, and each
 * option's chance with each person's figure), and core's settle line. Nothing here says which option leads but core's `status_text`.
 *
 * With no reading served, after two people's views are revealed: one ask (core A8's counted route), and the reading appears in place.
 * The crux's question is carried but not drawn in this slice: the round's one question stays core's `collab.next` with its Answer, so the
 * panel never shows two competing prompts; the crux's own actions wait on core's typed crux target (Codex B2 ruling, item 5).
 */
import { useState } from 'react'
import type { View } from '../../client'
import { OkIcon } from '../../look/icons'
import { ASK, AVATAR, BODY, ERR, LABEL, META } from '../../../olumiCore/team/ui'
import type { DifferenceHeadings } from '../../../olumiCore/team/differences'
import { TeamApiError } from '../../../olumiCore/team/api'
import { runWrite } from '../../../olumiCore/team/writes'
import { askRoundRead, roundReadOf } from '../../../olumiCore/team/roundRead'
import { ChanceBars } from './DiffChart'
import { twoPeopleRevealed } from './differGroups'

/** Chrome words for asking (never about the scenario). */
export const ROUND_WORDS = {
  ask: 'Ask Olumi to read this round',
  reading: 'Olumi is reading the round…',
  none: 'Olumi has no reading of this round yet.',
  failed: 'That did not go through. Nothing was saved.',
} as const

/** The ask: one press sends core's counted route once (a second press while it is on its way waits for the first), then the View is read
 *  again, so core's reading appears in place. Offered only after two people's views are revealed to this viewer and while no reading is served. */
function AskRound({ sid, onWrote }: { sid: string; onWrote: () => Promise<boolean> }): JSX.Element {
  const [state, setState] = useState<'idle' | 'reading' | 'none' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const ask = async () => {
    setState('reading'); setError(null)
    try { await runWrite(`${sid}:round-read`, { op: false }, {}, () => askRoundRead(sid)); await onWrote(); setState('none') } catch (e) {
      setState('failed'); setError(e instanceof TeamApiError ? e.message : ROUND_WORDS.failed)
    }
  }
  return (
    <div className="grid justify-items-start gap-1" data-testid="round-read-ask-block">
      <button type="button" className={ASK} data-testid="round-read-ask" disabled={state === 'reading'} onClick={() => void ask()}>
        <OkIcon id="olumi-mark" size={14} decorative />{ROUND_WORDS.ask}
      </button>
      {/* Said only once the ask has ended: core answered, the View was read again, and still no reading is served for this round. */}
      <p role="status" className={META} data-testid="round-read-said">{state === 'reading' ? ROUND_WORDS.reading : state === 'none' ? ROUND_WORDS.none : ''}</p>
      {error !== null && <p role="alert" className={ERR} data-testid="round-read-error">{error}</p>}
    </div>
  )
}

const initial = (name: string) => (Array.from(name)[0] ?? '').toUpperCase()

export function RoundRead({ sid, view, headings, onWrote }: { sid: string; view: View; /** Core's headings from the differences read, for the chances; null draws no chances. */ headings: DifferenceHeadings | null; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const read = roundReadOf(view)
  if (read === null) return view.gated || !twoPeopleRevealed(view) ? null : <AskRound key={sid} sid={sid} onWrote={onWrote} />
  return (
    <section className="grid gap-3" data-testid="round-read" data-round-snapshot={read.snapshot} data-round-version={read.at_version} aria-label={read.provisional_text}>
      <p className={`${META} flex items-start gap-1.5`} data-testid="round-read-provisional">
        <span className="mt-0.5 flex-none"><OkIcon id="olumi-mark" size={14} decorative /></span><span className="min-w-0 break-words">{read.provisional_text}</span>
      </p>
      <p className={`${BODY} break-words font-medium text-text-header`} data-testid="round-read-lead">{read.lead}</p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {read.cruxes.map((c) => (
          <li key={c.id} className="grid gap-2" data-round-crux={c.id} data-crux-kind={c.kind}>
            <p className={LABEL} data-round-kind="">{c.kind_text}</p>
            {c.quotes.length > 0 && (
              <ul className="m-0 grid list-none gap-1 p-0">
                {c.quotes.map((q) => (
                  <li key={q.id} className={`${BODY} flex items-start gap-1.5 break-words`} data-round-quote={q.id} data-quote-holder={q.holder_id} data-quote-view={q.view_id}>
                    <span aria-hidden="true" className={AVATAR}>{initial(q.holder)}</span>
                    <span><span className="text-text-header">{q.holder}</span>: “{q.text}”</span>
                  </li>
                ))}
              </ul>
            )}
            {c.comparisons.map((d) => {
              const at = `round-${c.id}-${d.record}${d.goal ? `-${d.goal}` : ''}`
              return (
                <div key={`${d.record}|${d.goal}`} className="grid gap-1.5" data-round-comparison={`${d.record}|${d.goal}`} data-difference-status={d.status}>
                  <p className={`${BODY} break-words font-medium text-text-header`}>{d.label}{d.goal_label ? <span className="font-normal text-text-light"> · {d.goal_label}</span> : null}</p>
                  <p className={`${BODY} break-words`} data-round-status="">{d.status_text}</p>
                  {headings !== null && <ChanceBars d={d} heading={headings.options} modelHeading={headings.model} at={at} />}
                </div>
              )
            })}
            {c.settle_text !== null && <p className={`${BODY} break-words`} data-round-settle="">{c.settle_text}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
