import { useState } from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { newOp, teamApi, TeamApiError } from './api'
import { recordChoices, wordsOfRecord } from './model'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'
import type { TeamEvidenceRow, TeamScenario } from './types'

type Stance = TeamEvidenceRow['stance']
const STANCES: ReadonlyArray<{ value: Stance; words: string }> = [
  { value: 'supports', words: 'Supports it' },
  { value: 'challenges', words: 'Challenges it' },
  { value: 'unclear', words: 'Not clear yet' },
]
const NONE = '__none__'

/** A source is a link only when it is an http(s) address with no spaces (core's own rule); anything else is shown as plain text. */
export function linkOf(source: string | null): string | null {
  if (source === null) return null
  return /^https?:\/\/\S+$/.test(source) && !/^https?:\/\/[^/\s@]*@/.test(source) ? source : null
}

/** The question the person asks Olumi about a piece of evidence: its words, quoted exactly (design plan 7b, v10 board 18). */
export const askAboutEvidence = (e: Pick<TeamEvidenceRow, 'text'>): string => `What does this change? ${e.text}`

/**
 * EVIDENCE (design plan steps 7, 7a and 7b). The participant packet's attach form, narrowed to the dock and allowed at any time: it is
 * shared with the team the moment it is added (never private), and it is a record of what people brought, not a change to the model.
 * The person says which record it bears on (not "nothing in particular" by default) and has no default stance.
 * Olumi's coach does not read evidence yet (olumi-core API v1.7): to put it to Olumi the person asks in the chat, quoting it.
 */
export function EvidencePanel({ sid, scenario, onWrote, onAskOlumi }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<void>; onAskOlumi?: (q: string) => void }): JSX.Element {
  const choices = recordChoices(scenario)
  const approved = scenario.version !== null
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [bears, setBears] = useState<string>('')
  const [stance, setStance] = useState<Stance | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One op per attempt, so a retry after a lost answer never adds a second row.
  const [op, setOp] = useState(newOp)

  // Before a model is approved only "nothing in the model yet" is accepted by core.
  const effectiveBears = approved ? bears : NONE
  const ready = text.trim() !== '' && effectiveBears !== '' && stance !== null

  const add = async () => {
    if (!ready || stance === null) return
    setBusy(true); setError(null)
    try {
      await teamApi.addEvidence(sid, { text, source: source.trim() === '' ? null : source, concerns: effectiveBears === NONE ? [] : [effectiveBears], stance }, op)
      setText(''); setSource(''); setBears(''); setStance(null); setOp(newOp()); setOpen(false)
      await onWrote()
    } catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.') } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-evidence" aria-label="Evidence" className="grid gap-2">
      <h3 className={H}>Evidence</h3>
      {scenario.evidence.length === 0 && <p className={META} data-testid="team-evidence-empty">Nothing brought yet. Evidence you add is shared with the team straight away.</p>}
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-evidence-list">
        {scenario.evidence.map((e) => {
          const link = linkOf(e.source)
          const about = e.concerns.map((id) => wordsOfRecord(scenario, id) ?? 'a part of the model that has since changed')
          return (
            <li key={e.id} data-testid={`team-evidence-${e.id}`} data-stance={e.stance} className={CARD}>
              <p className={`${META} text-text-header`}>{e.by} · {STANCES.find((s) => s.value === e.stance)?.words.toLowerCase()}</p>
              <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid={`team-evidence-text-${e.id}`}>{e.text}</p>
              <p className={META}>{about.length > 0 ? `Bears on: ${about.join('; ')}` : 'Nothing in the model yet'}</p>
              {e.source !== null && (
                <p className={`${META} break-all`} data-testid={`team-evidence-source-${e.id}`}>
                  Source: {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2">{e.source}</a> : e.source}
                </p>
              )}
              {onAskOlumi && (
                <div>
                  <button type="button" data-testid={`team-evidence-ask-${e.id}`} onClick={() => onAskOlumi(askAboutEvidence(e))} className={`${META} inline-flex cursor-pointer items-center gap-1 underline underline-offset-2 hover:text-text-body`}>
                    <MessageSquareQuote aria-hidden="true" className="h-3 w-3" />Ask Olumi what this changes
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!open ? (
        <div><Button size="sm" variant="secondary" data-testid="team-evidence-open" onClick={() => setOpen(true)}>Add evidence</Button></div>
      ) : (
        <div className={CARD} data-testid="team-evidence-form">
          <label htmlFor="team-evidence-text" className={LABEL}>What is the evidence?</label>
          <textarea id="team-evidence-text" data-testid="team-evidence-body" className={`${FIELD} min-h-[72px]`} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); if (error) setError(null) }} />
          <label htmlFor="team-evidence-source" className={LABEL}>Where it comes from (optional)</label>
          <input id="team-evidence-source" data-testid="team-evidence-source" className={FIELD} value={source} disabled={busy} autoComplete="off" spellCheck={false} onChange={(e) => setSource(e.target.value)} placeholder="A link, or a plain note of where" />
          <label htmlFor="team-evidence-bears" className={LABEL}>What it bears on</label>
          <select id="team-evidence-bears" data-testid="team-evidence-bears" className={FIELD} value={effectiveBears} disabled={busy || !approved} onChange={(e) => setBears(e.target.value)}>
            <option value="" disabled>Choose…</option>
            <option value={NONE}>Nothing in the model yet</option>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.familyWords}: {c.words}</option>)}
          </select>
          {!approved && <p className={META} data-testid="team-evidence-unapproved">There is no confirmed model yet, so evidence is kept now and can be tied to a card once the model is confirmed.</p>}
          <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid="team-evidence-stance">
            <legend className={LABEL}>It…</legend>
            {STANCES.map((s) => (
              <label key={s.value} className={`${BODY} flex min-h-[28px] cursor-pointer items-center gap-2`}>
                <input type="radio" name="team-evidence-stance" value={s.value} checked={stance === s.value} disabled={busy} onChange={() => setStance(s.value)} />
                {s.words}
              </label>
            ))}
          </fieldset>
          <p className={META}>Shared with the team as soon as you add it. It does not change the model.</p>
          {error && <p role="alert" data-testid="team-evidence-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-evidence-add" disabled={!ready || busy} onClick={() => void add()}>Add evidence</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </section>
  )
}
