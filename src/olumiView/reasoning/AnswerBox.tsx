/**
 * Answer in place (contract §3, `reasoning/answer.ts`): under one of Olumi's typed questions, the person's own answer box and ONE green press.
 * Their words go to core's answer route bound to that question's id (a message turn: core answers it in the conversation, binds a figure by
 * identity where the question names one). A refusal (core's 409, e.g. a question no longer asked on this version) is NOT a success: the
 * words and the op stay, and core's own reason is drawn under the box. The same op is reused for the same words, so a re-press after a
 * dropped connection is saved once.
 */
import { useState } from 'react'
import { newOp, TeamApiError } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import type { View, ViewModel } from '../client'
import { OkIcon } from '../look/icons'
import { pressCard } from './tabRing'
import { answerQuestion, examinedOf, type Examination, type Question } from './answer'
import { TYPE } from '../port/type'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'

export const ANSWER_WORDS = {
  placeholder: 'Your answer',
  send: 'Answer',
  sending: 'Sending',
  failed: 'Olumi could not take the answer just now. Your words are kept: try again.',
  answered: 'Answered',
  supplied: 'Answer given',
  bound: 'Set on',
  proposed: 'Proposed for',
  mentioned: 'Mentioned',
  limits: 'Limits',
} as const

const GREEN = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 ${controls.act} disabled:cursor-not-allowed disabled:opacity-60`

/** Mount it keyed by `q.id` (callers do): the draft, the op and a pending answer belong to one question; another question gets its own box. */
export function AnswerBox({ q }: { q: Question }) {
  const sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const [text, setText] = useState('')
  const [op, setOp] = useState<{ text: string; op: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only the latest version is answered (core refuses a stale question; a past version offers no box at all).
  if (sid === null || at !== null) return null
  const send = async () => {
    const words = text.trim()
    if (words === '' || busy) return
    const key = op !== null && op.text === words ? op : { text: words, op: newOp() }
    setOp(key); setBusy(true); setError(null)
    try {
      await answerQuestion(sid, q.id, words, key.op)
      // Clears only the words that were sent (the box is read-only while sending, so nothing typed meanwhile is lost).
      setText((t) => (t.trim() === words ? '' : t)); setOp(null)
      await useViewStore.getState().refresh()
    } catch (e) {
      setError(e instanceof TeamApiError && e.message !== '' ? e.message : ANSWER_WORDS.failed)
    } finally { setBusy(false) }
  }
  return (
    <form className="mt-1 space-y-1" data-answer-for={q.id} onSubmit={(e) => { e.preventDefault(); void send() }}>
      <div className="flex items-center gap-2">
        <input value={text} readOnly={busy} aria-busy={busy} onChange={(e) => setText(e.target.value)} placeholder={ANSWER_WORDS.placeholder} aria-label={`${ANSWER_WORDS.placeholder}: ${q.text}`}
          className={`${TYPE.body} min-h-8 min-w-0 flex-1 rounded-md border border-panel-border bg-panel px-2 text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`} data-testid="reasoning-answer-input" />
        <button type="submit" className={GREEN} disabled={busy || text.trim() === ''} data-testid="reasoning-answer-send">{busy ? ANSWER_WORDS.sending : ANSWER_WORDS.send}</button>
      </div>
      {error === null ? null : <p role="alert" className={`${TYPE.meta} m-0 text-text-body`} data-testid="reasoning-answer-error">{error}</p>}
    </form>
  )
}

/**
 * One examination, by id (AS BUILT): what was asked, what the person supplied, the card core bound it to (one press), Olumi's reply as served
 * (marked Olumi's) and its limits. `mentioned` is said as what it is, the cards the reply mentions, never what it rests on, and only the ones
 * that are cards on this model; empty, it draws nothing.
 */
function Examined({ x, model, view }: { x: Examination; model: ViewModel; view: View | null }) {
  const card = (id: string | null) => (id === null ? null : model.cards.find((c) => c.id === id) ?? null)
  // Where the answer was bound is an answer HISTORY (Codex ROOT 01:39Z): it is qualified by the source turn core already sends on this View's
  // chat (joined by the proposal's row), with core's own version and status words. It reads as applied ("Set on") only when that turn is the
  // current version, carries no status and is not the pending proposal; otherwise as proposed, with core's words. No source turn: no binding drawn.
  // The turn's words qualify the WHOLE examination (Codex ROOT 01:46Z), so a finding whose bound card is gone is still said as history.
  const row = x.finding?.row ?? x.proposal_id
  const turn = row === null ? undefined : (view?.chat ?? []).find((m) => m.id === row)
  const bound = turn === undefined ? null : card(x.bound)
  const applied = turn !== undefined && !turn.earlier && (turn.status ?? null) === null && view?.proposal?.id !== turn.id
  const mentioned = x.mentioned.flatMap((id) => { const c = card(id); return c === null ? [] : [c] })
  const press = `${TYPE.meta} rounded-sm text-left text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`
  return (
    <li className="space-y-1 px-1 py-1.5" data-examined={x.id} data-examined-question={x.question_id}>
      <p className={`${TYPE.body} m-0 flex items-start gap-2 text-text-header`}><OkIcon id="olumi-mark" size={14} className="mt-0.5" decorative /><span className="min-w-0 flex-1 break-words" data-testid="reasoning-examined-question">{x.question}</span></p>
      {/* The source turn's own version and status (core's words), for the whole examination: the finding and the binding alike, card or no card. */}
      {turn === undefined ? null : <p className={`${TYPE.meta} m-0 pl-6 text-text-light`} data-testid="reasoning-examined-source">{turn.version}{turn.status == null ? '' : ` · ${turn.status}`}</p>}
      <p className={`${TYPE.meta} m-0 break-words pl-6 text-text-body`} data-testid="reasoning-examined-supplied"><span className="text-text-light">{ANSWER_WORDS.supplied}: </span>{x.supplied.by === '' ? null : `${x.supplied.by}: `}{x.supplied.text}</p>
      {bound === null ? null : (
        <p className={`${TYPE.meta} m-0 pl-6`} data-testid="reasoning-examined-binding" data-applied={applied ? 'yes' : 'no'}><span className="text-text-light">{applied ? ANSWER_WORDS.bound : ANSWER_WORDS.proposed}: </span>
          <button type="button" onClick={() => pressCard(bound.id)} className={press} data-testid="reasoning-examined-bound" data-view={`${bound.id}.heading`}>{bound.heading}</button>
</p>
      )}
      {x.finding === null ? null : <p className={`${TYPE.body} m-0 flex items-start gap-2 pl-6 text-text-body`} data-testid="reasoning-examined-finding"><OkIcon id="olumi-mark" size={12} className="mt-1" decorative /><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{x.finding.text}</span></p>}
      {mentioned.length === 0 ? null : (
        <p className={`${TYPE.meta} m-0 flex flex-wrap items-center gap-x-2 pl-6`} data-testid="reasoning-examined-mentioned"><span className="text-text-light">{ANSWER_WORDS.mentioned}:</span>
          {mentioned.map((c) => <button key={c.id} type="button" onClick={() => pressCard(c.id)} className={press} data-mentioned={c.id} data-view={`${c.id}.heading`}>{c.heading}</button>)}</p>
      )}
      {x.limits === null ? null : <p className={`${TYPE.meta} m-0 break-words pl-6 text-text-light`} data-testid="reasoning-examined-limits">{ANSWER_WORDS.limits}: {x.limits}</p>}
    </li>
  )
}

/** What core has examined, in core's order; nothing on an older core or before any answer. */
export function AnsweredList({ view, model }: { view: View | null; model: ViewModel }) {
  const items = examinedOf(view)
  if (items.length === 0) return null
  return (
    <section className="space-y-1" data-testid="reasoning-answered" aria-label={ANSWER_WORDS.answered}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`}>{ANSWER_WORDS.answered}</h3>
      <ul className="m-0 list-none divide-y divide-panel-border p-0">{items.map((x) => <Examined key={x.id} x={x} model={model} view={view} />)}</ul>
    </section>
  )
}
