import { useState } from 'react'
import { Lock, Users } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { myOpenView, myRevealedView, viewPhaseOf } from './model'
import { PrivacyNote } from './PrivacyNote'
import { NOT_SAVED, settleUncertain, UNKNOWN_SAVED } from './settle'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import type { TeamScenario } from './types'

/**
 * Your own view of the question, formed before you see anyone else's. Lifted from the participant packet's answer field
 * ("I would rather not answer this" is its skip), narrowed to the dock. Words go to core exactly as typed. Once given, a view is
 * shown back to its owner and cannot be edited: a person's confirmed words are never changed under them.
 *
 * Three states: the composer (you have no view this round: you never gave one, or you gave one before someone joined and core counts a
 * fresh one for this round); your view held, private to you; and, once the team has revealed, "Views revealed together" with what you gave.
 * The text you type is kept while the tab is away.
 */
export function ViewComposer({ sid, scenario, onWrote }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<boolean> }): JSX.Element {
  const [text, setText, dropText] = useDraft(`${sid}:view`, '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A write whose outcome could not be read back: no second send is offered until Olumi has said what it holds.
  const [unverified, setUnverified] = useState(false)
  const phase = viewPhaseOf(scenario)
  const open = myOpenView(scenario)

  /** I am no longer to give a view this round: the write is in. */
  const landed = (s: TeamScenario) => viewPhaseOf(s) !== 'compose'
  const check = async () => {
    setBusy(true)
    const r = await settleUncertain(onWrote, landed)
    setBusy(false)
    if (r === 'saved') { dropText(); setUnverified(false); setError(null) }
    else if (r === 'not_saved') { setUnverified(false); setError(NOT_SAVED) } else { setUnverified(true); setError(UNKNOWN_SAVED) }
  }
  const run = async (write: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await write(); dropText(); await onWrote(); setBusy(false) } catch (e) {
      setBusy(false)
      if (e instanceof TeamApiError && e.uncertain) { await check(); return }
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    }
  }

  if (phase === 'revealed') {
    const mine = myRevealedView(scenario)
    return (
      <section data-testid="team-view-revealed" aria-label="Your view" className="grid gap-2">
        <h3 className={H}>Your view</h3>
        <div className={CARD}>
          <p className={`${META} flex items-center gap-1.5 text-text-header`}><Users aria-hidden="true" className="h-3 w-3 flex-none" />Views revealed together</p>
          {mine?.skip ? <p className={BODY} data-testid="team-view-revealed-skip">You chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="team-view-revealed-text">{mine?.text}</p>}
        </div>
        <PrivacyNote phase="after" />
      </section>
    )
  }

  if (phase === 'held' && open) {
    return (
      <section data-testid="team-view-held" aria-label="Your view" className="grid gap-2">
        <h3 className={H}>Your view</h3>
        <div className={CARD}>
          <p className={`${META} flex items-center gap-1.5 text-text-header`}><Lock aria-hidden="true" className="h-3 w-3 flex-none" />{open.skip ? 'You chose not to answer' : 'Held, private to you'}</p>
          {!open.skip && <p className={`${BODY} whitespace-pre-wrap`} data-testid="team-view-held-text">{open.text}</p>}
        </div>
        <PrivacyNote phase="before" />
      </section>
    )
  }

  return (
    <section data-testid="team-view-composer" aria-label="Your view" className="grid gap-2">
      <h3 className={H}>Your view</h3>
      <div className={CARD}>
        {open && (
          <p className={META} data-testid="team-view-earlier">
            You gave a view before someone joined. Olumi still needs one from you for this round. Your earlier view stays private to you.
          </p>
        )}
        <label htmlFor="team-view-text" className={LABEL}>What do you think, in your own words?</label>
        <textarea
          id="team-view-text" data-testid="team-view-text" className={`${FIELD} min-h-[88px]`} value={text} disabled={busy || unverified}
          onChange={(e) => { setText(e.target.value); if (error) setError(null) }}
        />
        <div className="flex flex-wrap items-center gap-3">
          {unverified ? (
            <Button size="sm" data-testid="team-view-check" disabled={busy} onClick={() => void check()}>Check whether it was saved</Button>
          ) : (
            <>
              <Button size="sm" data-testid="team-view-give" disabled={busy || text.trim() === ''} onClick={() => void run(() => teamApi.giveView(sid, text))}>Hold my view</Button>
              <button
                type="button" data-testid="team-view-skip" disabled={busy}
                className={`${META} cursor-pointer underline underline-offset-2 hover:text-text-body disabled:opacity-50`}
                onClick={() => void run(() => teamApi.skipView(sid))}
              >I would rather not answer this</button>
            </>
          )}
        </div>
        {error && <p role="alert" data-testid="team-view-error" className={ERR}>{error}</p>}
      </div>
      <PrivacyNote phase="before" />
    </section>
  )
}
