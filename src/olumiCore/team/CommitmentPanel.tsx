import { useState } from 'react'
import { Lock } from 'lucide-react'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { dissentsOf, modelBandOf, recordWords, wordsOfRecord } from './model'
import { DissentNotConfirmed } from './DissentConfirm'
import { OutcomePanel } from './OutcomePanel'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import type { TeamCommitmentRow, TeamScenario } from './types'

/** The ids of the kept disagreements, as the commitment reads them back: their words in the approved model, else a plain note. */
const keptWords = (s: TeamScenario, id: string): string => wordsOfRecord(s, id) ?? 'a disagreement the model no longer holds'

function Band({ scenario }: { scenario: TeamScenario }): JSX.Element | null {
  const band = modelBandOf(scenario)
  if (band.length === 0) return null
  return (
    <div className="grid gap-1" data-testid="team-commitment-band">
      <p className={`${META} flex items-center gap-1.5 text-text-header`}><OlumiAiIcon aria-hidden="true" className="h-3.5 w-3.5 flex-none" />The model’s range, version {scenario.version?.n} (Olumi’s, from the model as confirmed)</p>
      <ul className="m-0 grid list-none gap-1 p-0">{band.map((f) => <li key={f.id} className={META}>{f.text}</li>)}</ul>
    </div>
  )
}

/**
 * THE COMMITMENT THAT KEEPS DISSENT OPEN (design plan step 9; v10 board 20). The action in the person's own words, an owner chosen from
 * the team, what they expect (written BEFORE the model's range appears: the range is shown only with a saved commitment, so it cannot
 * anchor the expectation), when to reconsider, and which approved disagreements this keeps open. Olumi writes none of these words.
 *
 * Fields core does not store yet (which option, a review date, the holder's own tell) are drawn and cannot be used, and say so.
 */
export function CommitmentPanel({ sid, scenario, onWrote }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<void> }): JSX.Element {
  const approved = scenario.version !== null
  const dissents = dissentsOf(scenario)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('')
  const [owner, setOwner] = useState('')
  const [expect, setExpect] = useState('')
  const [reconsider, setReconsider] = useState('')
  const [keeps, setKeeps] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = [action, expect, reconsider].every((t) => t.trim() !== '') && owner !== ''

  const save = async () => {
    if (!ready) return
    setBusy(true); setError(null)
    try {
      await teamApi.addCommitment(sid, { action, owner, expect, reconsider, keeps })
      setAction(''); setOwner(''); setExpect(''); setReconsider(''); setKeeps([]); setOpen(false)
      await onWrote()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }
  const toggle = (id: string) => setKeeps((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]))

  return (
    <section data-testid="team-commitments" aria-label="Commitment" className="grid gap-2">
      <h3 className={H}>Commitment</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-commitment-list">
        {scenario.commitments.map((c: TeamCommitmentRow) => (
          <li key={c.id} data-testid={`team-commitment-${c.id}`} className={CARD}>
            <dl className="m-0 grid gap-1.5">
              <div><dt className={META}>We will</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words text-text-header`} data-testid={`team-commitment-action-${c.id}`}>{c.action}</dd></div>
              <div><dt className={META}>Owner</dt><dd className={`${BODY} m-0`}>{c.owner}</dd></div>
              <div><dt className={META}>We expect</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`} data-testid={`team-commitment-expect-${c.id}`}>{c.expect}</dd></div>
              <div><dt className={META}>We will reconsider if</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`}>{c.reconsider}</dd></div>
              {c.keeps.length > 0 && (
                <div data-testid={`team-commitment-keeps-${c.id}`}>
                  <dt className={META}>Keeps these disagreements open</dt>
                  <dd className="m-0 grid gap-0.5">{c.keeps.map((id) => <span key={id} className={BODY}>{keptWords(scenario, id)}</span>)}</dd>
                </div>
              )}
            </dl>
            <p className={META}>Recorded by {c.by}</p>
            <Band scenario={scenario} />
            <OutcomePanel sid={sid} scenario={scenario} commitment={c} onWrote={onWrote} />
          </li>
        ))}
      </ul>

      {!approved ? (
        <p className={META} data-testid="team-commitment-unapproved">A commitment is made against a confirmed model. Confirm the model in the chat first.</p>
      ) : !open ? (
        <div><Button size="sm" variant="secondary" data-testid="team-commitment-open" onClick={() => setOpen(true)}>Make a commitment</Button></div>
      ) : (
        <div className={CARD} data-testid="team-commitment-form">
          <p className={META}>Write what you expect first; the model’s range appears after you save.</p>
          <label htmlFor="team-c-action" className={LABEL}>What will you do, in your own words?</label>
          <textarea id="team-c-action" data-testid="team-c-action" className={`${FIELD} min-h-[64px]`} value={action} disabled={busy} onChange={(e) => setAction(e.target.value)} />

          <label htmlFor="team-c-option" className={LABEL}>Which option</label>
          <select id="team-c-option" data-testid="team-c-option" className={FIELD} disabled aria-describedby="team-c-notyet"><option>Not stored by Olumi yet</option></select>

          <label htmlFor="team-c-owner" className={LABEL}>Who owns it</label>
          <select id="team-c-owner" data-testid="team-c-owner" className={FIELD} value={owner} disabled={busy} onChange={(e) => setOwner(e.target.value)}>
            <option value="" disabled>Choose…</option>
            {scenario.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <label htmlFor="team-c-expect" className={LABEL}>What do you expect to happen?</label>
          <textarea id="team-c-expect" data-testid="team-c-expect" className={`${FIELD} min-h-[64px]`} value={expect} disabled={busy} onChange={(e) => setExpect(e.target.value)} />

          <label htmlFor="team-c-reconsider" className={LABEL}>Reconsider if</label>
          <textarea id="team-c-reconsider" data-testid="team-c-reconsider" className={`${FIELD} min-h-[56px]`} value={reconsider} disabled={busy} onChange={(e) => setReconsider(e.target.value)} />

          <label htmlFor="team-c-review" className={LABEL}>Review on</label>
          <input id="team-c-review" data-testid="team-c-review" className={FIELD} disabled placeholder="Not stored by Olumi yet" aria-describedby="team-c-notyet" />
          <p id="team-c-notyet" className={META} data-testid="team-c-notyet">Which option and a review date are drawn here and open when Olumi can store them.</p>

          <fieldset className="m-0 grid gap-1.5 border-0 p-0" data-testid="team-c-keeps">
            <legend className={LABEL}>Keep these disagreements open</legend>
            {dissents.length === 0 && <p className={META}>The confirmed model holds no disagreement to keep.</p>}
            {dissents.map((d) => (
              <label key={d.id} className="flex cursor-pointer items-start gap-2" data-testid={`team-c-keep-${d.id}`}>
                <input type="checkbox" className="mt-1" checked={keeps.includes(d.id)} disabled={busy} onChange={() => toggle(d.id)} />
                <span className="grid gap-0.5"><span className={BODY}>{recordWords(d)}</span><DissentNotConfirmed holder={d.holder ?? null} /></span>
              </label>
            ))}
            {dissents.length > 0 && (
              <div className="grid gap-0.5" data-testid="team-c-tell">
                <label htmlFor="team-c-tell-input" className={`${META} flex items-center gap-1`}><Lock aria-hidden="true" className="h-3 w-3" />What would change their mind, in the holder’s own words</label>
                <textarea id="team-c-tell-input" className={`${FIELD} min-h-[48px]`} disabled placeholder="Only the holder can write this. Not stored by Olumi yet." />
              </div>
            )}
          </fieldset>

          {error && <p role="alert" data-testid="team-commitment-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-commitment-save" disabled={!ready || busy} onClick={() => void save()}>Save commitment</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  )
}
