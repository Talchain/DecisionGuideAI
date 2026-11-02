import { useState } from 'react'
import { Lock } from 'lucide-react'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { bandNumber, dissentsOf, modelBandOf, recordWords, wordsOfRecord, type ModelBand } from './model'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked } from './writes'
import { DissentNotConfirmed } from './DissentConfirm'
import { OutcomePanel } from './OutcomePanel'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import type { TeamCommitmentRow, TeamScenario } from './types'

/** The ids of the kept disagreements, as the commitment reads them back: their words in the approved model, else a plain note. */
interface CommitmentDraft { open: boolean; action: string; owner: string; expect: string; reconsider: string; keeps: readonly string[] }
const EMPTY: CommitmentDraft = { open: false, action: '', owner: '', expect: '', reconsider: '', keeps: [] }
const keptWords = (s: TeamScenario, id: string): string => wordsOfRecord(s, id) ?? 'a disagreement the model no longer holds'

/** One range of the model, drawn as a band between its two ends, with one plain line and one quiet "Leaves out" line. No middle is drawn. */
function BandRow({ band }: { band: ModelBand }): JSX.Element {
  const hasNumbers = band.low !== null && band.high !== null
  const unit = band.unit ? ` ${band.unit}` : ''
  // The finding is core's own, as stored. Code adds labels and values only: no sentence of its own, and no comparison of the two ends.
  const line = hasNumbers ? band.words : band.valueWords
  return (
    <li className="grid gap-1" data-testid={`team-commitment-band-${band.id}`}>
      {hasNumbers && (
        <div aria-hidden="true" className="grid gap-0.5">
          <div className="relative mx-1 h-4 rounded-full bg-canvas">
            <span className="absolute inset-y-1 left-[6%] right-[6%] rounded-full bg-info/25" />
            <span className="absolute top-0 h-4 w-0.5 bg-info" style={{ left: '6%' }} />
            <span className="absolute top-0 h-4 w-0.5 bg-info" style={{ right: '6%' }} />
          </div>
          <div className={`${META} flex justify-between tabular-nums`}><span data-testid={`team-commitment-band-low-${band.id}`}>{bandNumber(band.low!)}{unit}</span><span data-testid={`team-commitment-band-high-${band.id}`}>{bandNumber(band.high!)}{unit}</span></div>
        </div>
      )}
      <p className={META} data-testid={`team-commitment-band-line-${band.id}`}>{line}</p>
      {band.leavesOut && <p className={`${META} opacity-80`} data-testid={`team-commitment-band-leaves-${band.id}`}>Leaves out: {band.leavesOut}</p>}
    </li>
  )
}

function Band({ scenario }: { scenario: TeamScenario }): JSX.Element | null {
  const band = modelBandOf(scenario)
  if (band.length === 0) return null
  return (
    <div className="grid gap-1" data-testid="team-commitment-band">
      <p className={`${META} flex items-center gap-1.5 text-text-header`}><OlumiAiIcon aria-hidden="true" className="h-3.5 w-3.5 flex-none" />The model’s range, version {scenario.version?.n} (Olumi’s, from the model as confirmed)</p>
      <ul className="m-0 grid list-none gap-2 p-0">{band.map((b) => <BandRow key={b.id} band={b} />)}</ul>
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
export function CommitmentPanel({ sid, scenario, onWrote }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<boolean> }): JSX.Element {
  const approved = scenario.version !== null
  const dissents = dissentsOf(scenario)
  // What is typed is kept while the tab is away (`drafts.ts`).
  const [d, setD, dropDraft] = useDraft<CommitmentDraft>(`${sid}:commitment`, EMPTY)
  const { open, action, owner, expect, reconsider, keeps } = d
  const setOpen = (v: boolean) => setD((p) => ({ ...p, open: v }))
  const setAction = (v: string) => setD((p) => ({ ...p, action: v }))
  const setOwner = (v: string) => setD((p) => ({ ...p, owner: v }))
  const setExpect = (v: string) => setD((p) => ({ ...p, expect: v }))
  const setReconsider = (v: string) => setD((p) => ({ ...p, reconsider: v }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A commitment has no operation id in core, so a save whose answer was lost may have been saved: it is locked in the store (`writes.ts`), not sent again.
  const locked = useWriteLocked(`${sid}:commitment`)
  const ready = [action, expect, reconsider].every((t) => t.trim() !== '') && owner !== ''

  const save = async () => {
    if (!ready || locked) return
    setBusy(true); setError(null)
    try {
      await runWrite(`${sid}:commitment`, { op: false }, null, () => teamApi.addCommitment(sid, { action, owner, expect, reconsider, keeps }))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }
  const toggle = (id: string) => setD((p) => ({ ...p, keeps: p.keeps.includes(id) ? p.keeps.filter((x) => x !== id) : [...p.keeps, id] }))

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
          <select id="team-c-option" data-testid="team-c-option" className={FIELD} disabled aria-describedby="team-c-notyet"><option value="" /></select>

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
          <input id="team-c-review" data-testid="team-c-review" className={FIELD} disabled aria-describedby="team-c-notyet" />
          <p id="team-c-notyet" className={META} data-testid="team-c-notyet">Option, review date and the holder’s own words come when Olumi can store them.</p>

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
                <textarea id="team-c-tell-input" className={`${FIELD} min-h-[48px]`} disabled aria-describedby="team-c-notyet" placeholder="Only the holder can write this." />
              </div>
            )}
          </fieldset>

          {locked ? <p role="alert" data-testid="team-commitment-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-commitment-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-commitment-save" disabled={!ready || busy || locked} onClick={() => void save()}>Save commitment</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  )
}
