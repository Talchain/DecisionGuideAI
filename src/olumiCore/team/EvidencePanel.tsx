import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError, type EvidenceInput } from './api'
import { useDraft } from './drafts'
import { runWrite, useWriteSending } from './writes'
import { BODY, CARD, ERR, FIELD, H, LABEL, META } from './ui'

type Stance = EvidenceInput['stance']
const NONE = '__none__'
interface EvidenceDraft { open: boolean; text: string; source: string; bears: string; stance: Stance | null }
const EMPTY: EvidenceDraft = { open: false, text: '', source: '', bears: '', stance: null }

/**
 * A source is a link only when it is an http(s) address with no spaces (core's own rule) that the browser reads as an address with NO sign-in
 * details in it; anything else is shown as plain text. The link is the parsed address, never the raw string.
 */
export function linkOf(source: string | null): string | null {
  if (source === null || !/^https?:\/\/\S+$/i.test(source)) return null
  try {
    const u = new URL(source)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '' && u.username === '' && u.password === '' ? u.href : null
  } catch { return null }
}

/** What evidence can be pointed at: the approved version's records, by core's own label (`collab.records`); a record no longer in it has none. */
const choicesOf = (view: View) => view.collab.records.filter((r): r is typeof r & { label: string } => r.label !== null)

/**
 * Olumi considers a piece of evidence (API v1.12): a press asks core for one turn in the asker's name; core proposes a change where the
 * evidence warrants one (the change card, in the chat, names the evidence it came from), else replies why not. Shown here, as label: value
 * chrome over core's fields (never a sentence composed from them, DL 4 Nov): who asked, and core's `why` verbatim when it changed nothing.
 */
function Considered({ sid, e, onWrote, W }: { sid: string; e: View['evidence'][number]; onWrote: () => Promise<boolean>; W: View['team_words'] }): JSX.Element {
  const key = `${sid}:consider:${e.id}`
  const sending = useWriteSending(key)
  const [mine, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const c = e.considered
  const ask = async () => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: true }, { evidence: e.id }, (op) => teamApi.considerEvidence(sid, e.id, op!)); await onWrote() } catch (x) {
      setError(x instanceof TeamApiError ? x.message : W.failed)
    } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-1" data-testid={`team-evidence-considered-${e.id}`}>
      {c != null && (
        <p className={META} data-testid={`team-evidence-considered-by-${e.id}`}>
          {W.evidence.consideredBy} <span className="text-text-header">{c.by}</span>
        </p>
      )}
      {c?.why != null && <p className={`${META} whitespace-pre-wrap break-words`} title={c.why.title} data-testid={`team-evidence-why-${e.id}`}>{c.why.text}</p>}
      <div>
        <Button size="sm" variant="secondary" data-testid={`team-evidence-consider-${e.id}`} disabled={mine || sending} onClick={() => void ask()}>{W.evidence.consider}</Button>
      </div>
      {error && <p role="alert" data-testid={`team-evidence-consider-error-${e.id}`} className={ERR}>{error}</p>}
    </div>
  )
}

/**
 * EVIDENCE FOR OR AGAINST (spec §8 step 4). Shared with the team the moment it is added, never private, and a record of what people
 * brought, not a change to the model. The person says what it bears on and how; nothing is preset.
 */
export function EvidencePanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const choices = choicesOf(view)
  // Every word of the panel is core's (N3 `team_words`, `evidence_words`, each piece's own lines).
  const W = view.team_words
  const [d, setD, dropDraft] = useDraft<EvidenceDraft>(`${sid}:evidence`, EMPTY)
  const { open, text, source, bears, stance } = d
  const put = (p: Partial<EvidenceDraft>) => setD((x) => ({ ...x, ...p }))
  const [mine, setBusy] = useState(false)
  const sending = useWriteSending(`${sid}:evidence`)
  const busy = mine || sending
  const [error, setError] = useState<string | null>(null)
  const effectiveBears = choices.length > 0 ? bears : NONE
  const ready = text.trim() !== '' && effectiveBears !== '' && stance !== null

  const add = async () => {
    if (!ready || stance === null) return
    setBusy(true); setError(null)
    const input: EvidenceInput = { text, source: source.trim() === '' ? null : source, concerns: effectiveBears === NONE ? [] : [effectiveBears], stance }
    try {
      await runWrite(`${sid}:evidence`, { op: true }, input, (op) => teamApi.addEvidence(sid, input, op!))
      dropDraft()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : W.failed)
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-evidence" aria-label={view.evidence_words.heading} className="grid gap-2">
      <h3 className={H}>{view.evidence_words.heading}</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-evidence-list">
        {view.evidence.map((e) => {
          const link = e.link !== null ? linkOf(e.link) : null
          return (
            <li key={e.id} data-testid={`team-evidence-${e.id}`} data-stance={e.stance} className={CARD}>
              <p className={`${META} text-text-header`}>{e.stance_text}</p>
              <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid={`team-evidence-text-${e.id}`}>{e.text}</p>
              {e.bears_on_text !== null && <p className={META} data-testid={`team-evidence-about-${e.id}`}>{e.bears_on_text}</p>}
              {e.source !== null && (
                <p className={`${META} break-all`} data-testid={`team-evidence-source-${e.id}`}>
                  {W.evidence.sourcePrefix} {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2">{e.source}</a> : e.source}
                </p>
              )}
              <Considered sid={sid} e={e} onWrote={onWrote} W={W} />
            </li>
          )
        })}
      </ul>

      {!open ? (
        <div><Button size="sm" variant="secondary" data-testid="team-evidence-open" onClick={() => put({ open: true })}>{W.evidence.add}</Button></div>
      ) : (
        <div className={CARD} data-testid="team-evidence-form">
          <label htmlFor="team-evidence-text" className={LABEL}>{W.evidence.text}</label>
          <textarea id="team-evidence-text" data-testid="team-evidence-body" className={`${FIELD} min-h-[72px]`} value={text} disabled={busy} onChange={(e) => { put({ text: e.target.value }); if (error) setError(null) }} />
          <label htmlFor="team-evidence-source" className={LABEL}>{W.evidence.source}</label>
          <input id="team-evidence-source" data-testid="team-evidence-source" className={FIELD} value={source} disabled={busy} autoComplete="off" spellCheck={false} onChange={(e) => put({ source: e.target.value })} placeholder={W.evidence.sourcePlaceholder} />
          <label htmlFor="team-evidence-bears" className={LABEL}>{view.evidence_words.bearsOn}</label>
          <select id="team-evidence-bears" data-testid="team-evidence-bears" className={FIELD} value={effectiveBears} disabled={busy || choices.length === 0} onChange={(e) => put({ bears: e.target.value })}>
            <option value="" disabled>{W.evidence.choose}</option>
            <option value={NONE}>{W.evidence.nothingYet}</option>
            {choices.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <fieldset className="m-0 grid gap-1 border-0 p-0" data-testid="team-evidence-stance">
            <legend className={LABEL}>{W.evidence.stanceLegend}</legend>
            {/* Core's picker (N3 `evidence_words.stances`): each stance it accepts, by id, in its words and order. */}
            {view.evidence_words.stances.map((s) => (
              <label key={s.id} className={`${BODY} flex min-h-[28px] cursor-pointer items-center gap-2`}>
                <input type="radio" name="team-evidence-stance" value={s.id} checked={stance === s.id} disabled={busy} onChange={() => put({ stance: s.id })} />
                {s.text}
              </label>
            ))}
          </fieldset>
          <p className={META}>{W.evidence.sharedNote}</p>
          {error && <p role="alert" data-testid="team-evidence-error" className={ERR}>{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" data-testid="team-evidence-add" disabled={!ready || busy} onClick={() => void add()}>{W.evidence.add}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => put({ open: false })}>{W.evidence.cancel}</Button>
          </div>
        </div>
      )}
    </section>
  )
}
