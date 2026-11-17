/**
 * Keep an idea from a floor reply (words-start CONTRACT 4, revised 17 Nov 03:55Z): Olumi's answer in words, on a scenario with no model, can be kept like any
 * reply's. Core `POST /api/scenarios/:s/kept { floor: <floor[].job>, text }` (in place of `turn`); core resolves Olumi as the author and this
 * person as the keeper, and the same person's repeat press writes nothing. The kept idea comes back in the View's `kept` list with `turn` equal
 * to that job and `from: "floor"` (CONTRACT 5), so "Kept" is read with the same `isKept` as a reply's (ids never collide).
 *
 * The SAME Keep as a reply's (v12/KeepIdea.tsx: its words, hover, "Kept" line and look) and the same choice of words (`ideaTextOf`: whole
 * sentences of Olumi's own reply, never cut, never reworded). Shown only on a floor reply of a scenario core says was started in words (the
 * caller's rule: never the first draft's job, never the job the View's `turn` still reports as answering, failed or lost). Who wrote a sentence
 * is never guessed from its words: core keeps only Olumi's typed prose and refuses anything else in its own words, which are said here.
 */
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { call, TeamApiError } from '../../../olumiCore/team/api'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import type { ViewTurn } from '../../client'
import { ideaTextOf, isKept, PAST_VERSION } from '../ideas'
import { KEEP_IDEA, KEEP_IDEA_HOVER, KEPT_IDEA } from '../KeepIdea'

/** The words a floor reply offers to keep: as for a reply's answer (ideaTextOf: whole sentences of the reply, never cut, never reworded). */
export const floorIdeaOf = (text: string): string | null => ideaTextOf({ answer: [{ text }] } as unknown as NonNullable<ViewTurn['answer']>)

export function FloorKeep({ job, text }: { job: number; text: string }): JSX.Element | null {
  const sid = useViewStore((st) => st.sid)
  const words = floorIdeaOf(text)
  const past = useViewStore((st) => st.at !== null)
  const held = useViewStore((st) => words !== null && isKept(st.view, job, words))
  const [state, setState] = useState<{ s: 'idle' | 'busy' | 'kept' } | { s: 'said'; said: string }>({ s: 'idle' })
  if (sid === null || words === null) return null
  const go = async () => {
    setState({ s: 'busy' })
    try {
      await call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/kept`, { floor: job, text: words })
      setState({ s: 'kept' })
      void useViewStore.getState().refresh()
    } catch (e) {
      setState({ s: 'said', said: e instanceof TeamApiError || e instanceof Error ? e.message : 'That did not go through. Nothing was kept.' })
    }
  }
  if (state.s === 'kept' || held) return <p role="status" className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-floor-keep-kept">{KEPT_IDEA}</p>
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="view-floor-keep">
      <button type="button" disabled={state.s === 'busy' || past} onClick={() => void go()} title={past ? PAST_VERSION : KEEP_IDEA_HOVER} data-testid="view-floor-keep-button"
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:text-text-light disabled:cursor-not-allowed`}>
        <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{KEEP_IDEA}
      </button>
      {state.s === 'said' ? <span role="alert" className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-floor-keep-said">{state.said}</span> : null}
    </div>
  )
}
