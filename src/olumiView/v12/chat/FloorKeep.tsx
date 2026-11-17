/**
 * Keep an idea from a floor reply (words-start CONTRACT 2, 17 Nov): Olumi's answer in words, on a scenario with no model, can be kept like any
 * reply's. Core `POST /api/scenarios/:s/kept { floor: <floor[].job>, text }` (in place of `turn`); core resolves Olumi as the author and this
 * person as the keeper, and the same person's repeat press writes nothing. The kept idea comes back in the View's `kept` list with `turn` equal
 * to that job, so "Kept" is read with the same `isKept` as a reply's.
 *
 * The SAME Keep as a reply's (v12/KeepIdea.tsx: its words, hover, "Kept" line and look) and the same choice of words (`ideaTextOf`: whole
 * sentences of Olumi's own reply, never cut, never reworded). Shown only on a reply to a message that ended done (the caller's rule: never
 * the first draft's job, never the job the View's `turn` still reports as answering, failed or lost) and never on the host's own sentences;
 * core refuses anything else in its own words, which are said here.
 */
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { call, TeamApiError } from '../../../olumiCore/team/api'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import type { ViewTurn } from '../../client'
import { ideaTextOf, isKept, PAST_VERSION } from '../ideas'
import { KEEP_IDEA, KEEP_IDEA_HOVER, KEPT_IDEA } from '../KeepIdea'

/**
 * The host's own fixed sentences that core refuses to keep (words-start CONTRACT 2): its status line beside a reply to a message sent while the
 * first model was built (olumi-core app/ai-runtime/kept.ts MID_WORDS, appended to `floor[].text` as its last paragraph), and its fixed sentences
 * inside a reply (run/direct-claims.ts EMPTY, NOTHING_TO_ACCEPT and the "I left out…" notes GONE, STALE, UNHELD). The View carries no typed field
 * for them, so they are matched whole, verbatim, as core writes them.
 */
export const HOST_SENTENCES: readonly string[] = [
  'The model Olumi is building will take this into account.',
  'Olumi applied this to the proposed model before showing it. The change is Olumi\'s: accept, change or reject it there.',
  'Olumi checked this against the proposed model and changed nothing in it.',
  'This is not in the proposed model yet. Send it again and Olumi will apply it.',
  'I could not finish my reply this time.',
  'There is no proposal waiting for your approval, so there is nothing to accept and no result changes.',
  'I left out one point I could not check against your model.',
  'One figure I had worked out no longer holds once the changes in this turn are in, so I have left it out.',
  'I had a reason for a missing result that no longer applies to the model as it now stands, so I have left it out.',
]
const holdsHost = (paragraph: string): boolean => HOST_SENTENCES.some((s) => paragraph.includes(s))
/** The words a floor reply offers to keep: as for a reply's answer (ideaTextOf), from Olumi's own paragraphs before the first that holds a host
 *  sentence. A failed reply (only the host's sentence) or a status line alone offers nothing. */
export const floorIdeaOf = (text: string): string | null => {
  const paragraphs = text.split(/\n\s*\n/), own: string[] = []
  for (const p of paragraphs) { if (holdsHost(p)) break; own.push(p) }
  return own.join('').trim() === '' ? null : ideaTextOf({ answer: [{ text: own.join('\n\n') }] } as unknown as NonNullable<ViewTurn['answer']>)
}

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
