import { useState } from 'react'
import { useDraft } from './drafts'
import { MessageSquareQuote } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { runWrite } from './writes'
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
interface EvidenceDraft { open: boolean; text: string; source: string; bears: string; stance: Stance | null }
const EMPTY: EvidenceDraft = { open: false, text: '', source: '', bears: '', stance: null }

/**
 * A source is a link only when it is an http(s) address with no spaces (core's own rule) that the browser reads as an address with NO sign-in
 * details in it: the address is parsed and judged as the browser reads it (`https:///user:pw@host/` reads as a username and password, whatever
 * its spelling). Anything else is shown as plain text. The link is the parsed address, never the raw string.
 */
export function linkOf(source: string | null): string | null {
  if (source === null || !/^https?:\/\/\S+$/i.test(source)) return null
  try {
    const u = new URL(source)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '' && u.username === '' && u.password === '' ? u.href : null
  } catch { return null }
}

/** What the chat takes in one message (core's 4,000-character cap on a message, less a margin). */
export const MAX_ASK_CHARS = 3900
const ASK_LEAD = 'What does this change? '
const CUT = ' [the evidence goes on; this is the first part]'
/**
 * The question the person asks Olumi about a piece of evidence: its words, quoted exactly (design plan 7b, v10 board 18). Evidence may be as
 * long as 4,000 characters and a message is capped, so a long one is sent as its opening words with the cut said in the message: never
 * a quote that looks whole and is not, and never a message core refuses.
 */
export function askAboutEvidence(e: Pick<TeamEvidenceRow, 'text'>): string {
  const whole = `${ASK_LEAD}${e.text}`
  if (whole.length <= MAX_ASK_CHARS) return whole
  return `${ASK_LEAD}${e.text.slice(0, MAX_ASK_CHARS - ASK_LEAD.length - CUT.length)}${CUT}`
}

/**
 * EVIDENCE (design plan steps 7, 7a and 7b). The participant packet's attach form, narrowed to the dock and allowed at any time: it is
 * shared with the team the moment it is added (never private), and it is a record of what people brought, not a change to the model.
 * The person says which record it bears on (not "nothing in particular" by default) and has no default stance.
 * Olumi's coach does not read evidence yet (olumi-core API v1.7): to put it to Olumi the person asks in the chat, quoting it.
 */
export function EvidencePanel({ sid, scenario, onWrote, onAskOlumi }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<boolean>; onAskOlumi?: (q: string) => void }): JSX.Element {
  const choices = recordChoices(scenario)
  const approved = scenario.version !== null
  // What is typed is kept while the tab is away (`drafts.ts`).
  const [d, setD, dropDraft] = useDraft<EvidenceDraft>(`${sid}:evidence`, EMPTY)
  const { open, text, source, bears, stance } = d
  const setOpen = (v: boolean) => setD((p) => ({ ...p, open: v }))
  const setText = (v: string) => setD((p) => ({ ...p, text: v }))
  const setSource = (v: string) => setD((p) => ({ ...p, source: v }))
  const setBears = (v: string) => setD((p) => ({ ...p, bears: v }))
  const setStance = (v: Stance) => setD((p) => ({ ...p, stance: v }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Before a model is approved only "nothing in the model yet" is accepted by core.
  const effectiveBears = approved ? bears : NONE
  const ready = text.trim() !== '' && effectiveBears !== '' && stance !== null

  const add = async () => {
    if (!ready || stance === null) return
    setBusy(true); setError(null)
    const input = { text, source: source.trim() === '' ? null : source, concerns: effectiveBears === NONE ? [] : [effectiveBears], stance }
    try {
      await runWrite(`${sid}:evidence`, { op: true }, input, (op) => teamApi.addEvidence(sid, input, op!))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-evidence" aria-label="Evidence" className="grid gap-2">
      <h3 className={H}>Evidence</h3>
      {scenario.evidence.length === 0 && <p className={META} data-testid="team-evidence-empty">Nothing brought yet. Evidence you add is shared with the team straight away.</p>}
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-evidence-list">
        {scenario.evidence.map((e) => {
          const link = linkOf(e.source)
          const about = e.concerns.map((id) => wordsOfRecord(scenario, id) ?? 'a part of the model that has since changed')
          // The ids were checked against the version the evidence was added to; a later version may word the same card differently.
          const then = e.version !== null && scenario.version !== null && e.version !== scenario.version.n ? e.version : null
          return (
            <li key={e.id} data-testid={`team-evidence-${e.id}`} data-stance={e.stance} className={CARD}>
              <p className={`${META} text-text-header`}>{e.by} · {STANCES.find((s) => s.value === e.stance)?.words.toLowerCase()}</p>
              <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid={`team-evidence-text-${e.id}`}>{e.text}</p>
              <p className={META}>{about.length > 0 ? `Bears on: ${about.join('; ')}` : 'Nothing in the model yet'}</p>
              {then !== null && about.length > 0 && <p className={META} data-testid={`team-evidence-version-${e.id}`}>Added when the model was version {then}; it is version {scenario.version!.n} now, so these words may have changed.</p>}
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
          {!approved && <p className={META} data-testid="team-evidence-unapproved">There is no confirmed model yet, so this is kept with the question. It cannot be tied to a card afterwards.</p>}
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
