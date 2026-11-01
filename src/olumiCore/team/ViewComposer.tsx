import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { myOpenView } from './model'
import { PrivacyNote } from './PrivacyNote'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import type { TeamScenario } from './types'

/**
 * Your own view of the question, formed before you see anyone else's. Lifted from the participant packet's answer field
 * ("I would rather not answer this" is its skip), narrowed to the dock. Words go to core exactly as typed. Once given, a view is
 * shown back to its owner and cannot be edited: a person's confirmed words are never changed under them.
 */
export function ViewComposer({ sid, scenario, onWrote }: { sid: string; scenario: Pick<TeamScenario, 'views' | 'reveal'>; onWrote: () => Promise<void> }): JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const held = myOpenView(scenario)

  const run = async (write: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await write(); setText(''); await onWrote() } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }

  if (held) {
    return (
      <section data-testid="team-view-held" aria-label="Your view" className="grid gap-2">
        <h3 className={H}>Your view</h3>
        <div className={CARD}>
          <p className={`${META} flex items-center gap-1.5 text-text-header`}><Lock aria-hidden="true" className="h-3 w-3 flex-none" />{held.skip ? 'You chose not to answer' : 'Held, private to you'}</p>
          {!held.skip && <p className={`${BODY} whitespace-pre-wrap`} data-testid="team-view-held-text">{held.text}</p>}
        </div>
        <PrivacyNote />
      </section>
    )
  }

  return (
    <section data-testid="team-view-composer" aria-label="Your view" className="grid gap-2">
      <h3 className={H}>Your view</h3>
      <div className={CARD}>
        <label htmlFor="team-view-text" className={LABEL}>What do you think, in your own words?</label>
        <textarea
          id="team-view-text" data-testid="team-view-text" className={`${FIELD} min-h-[88px]`} value={text} disabled={busy}
          onChange={(e) => { setText(e.target.value); if (error) setError(null) }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" data-testid="team-view-give" disabled={busy || text.trim() === ''} onClick={() => void run(() => teamApi.giveView(sid, text))}>Hold my view</Button>
          <button
            type="button" data-testid="team-view-skip" disabled={busy}
            className={`${META} cursor-pointer underline underline-offset-2 hover:text-text-body disabled:opacity-50`}
            onClick={() => void run(() => teamApi.skipView(sid))}
          >I would rather not answer this</button>
        </div>
        {error && <p role="alert" data-testid="team-view-error" className={ERR}>{error}</p>}
      </div>
      <PrivacyNote />
    </section>
  )
}
