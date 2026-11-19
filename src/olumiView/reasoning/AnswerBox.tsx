/**
 * Answer in place (contract §3, `reasoning/answer.ts`): under one of Olumi's typed questions, the person's own answer box and ONE green press.
 * Their words go to core's answer route bound to that question's id (a message turn: core answers it in the conversation, binds a figure by
 * identity where the question names one, and lists the examination under "Answered"). A refusal is core's 409 sentence, shown as it is; the
 * words stay in the box. The same op is reused for the same words, so a re-press after a dropped connection is saved once.
 * And what core has examined (`view.reasoning.examined`): what was asked, what the person supplied, the card it was bound to, Olumi's reply
 * as served (marked Olumi's), what it rests on and its limits. Labels are the tab's chrome; every other word is core's or the person's.
 */
import { useState } from 'react'
import type { View, ViewModel } from '../client'
import { newOp, TeamApiError } from '../../olumiCore/team/api'
import { OkIcon } from '../look/icons'
import { useViewStore } from '../store'
import { pressCard } from './tabRing'
import { answerQuestion, examinedOf, type Examination, type Question } from './answer'
import { TYPE } from '../port/type'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'

export const ANSWER_WORDS = {
  placeholder: 'Your answer',
  send: 'Answer',
  sending: 'Sending',
  answered: 'Answered',
  supplied: 'Answer given',
  bound: 'Set on',
  limits: 'Limits',
  failed: 'Olumi could not take the answer just now. Your words are kept: try again.',
} as const

const GREEN = `${typography.viewPanelHeading} inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 ${controls.act} disabled:cursor-not-allowed disabled:opacity-60`

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
      setText(''); setOp(null)
      await useViewStore.getState().refresh()
    } catch (e) {
      setError(e instanceof TeamApiError && e.message !== '' ? e.message : ANSWER_WORDS.failed)
    } finally { setBusy(false) }
  }
  return (
    <form className="mt-1 space-y-1" data-answer-for={q.id} onSubmit={(e) => { e.preventDefault(); void send() }}>
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={ANSWER_WORDS.placeholder} aria-label={`${ANSWER_WORDS.placeholder}: ${q.text}`}
          className={`${TYPE.body} min-h-8 min-w-0 flex-1 rounded-md border border-panel-border bg-panel px-2 text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-info`} data-testid="reasoning-answer-input" />
        <button type="submit" className={GREEN} disabled={busy || text.trim() === ''} data-testid="reasoning-answer-send">{busy ? ANSWER_WORDS.sending : ANSWER_WORDS.send}</button>
      </div>
      {error === null ? null : <p role="alert" className={`${TYPE.meta} m-0 text-text-body`} data-testid="reasoning-answer-error">{error}</p>}
    </form>
  )
}

function Examined({ x, model }: { x: Examination; model: ViewModel }) {
  const bound = x.bound === null ? null : model.cards.find((c) => c.id === x.bound) ?? null
  return (
    <li className="space-y-1 px-1 py-1.5" data-examined={x.id} data-examined-question={x.question_id}>
      <p className={`${TYPE.body} m-0 flex items-start gap-2 text-text-header`}><OkIcon id="olumi-mark" size={14} className="mt-0.5" decorative /><span className="min-w-0 flex-1 break-words" data-testid="reasoning-examined-question">{x.question}</span></p>
      <p className={`${TYPE.meta} m-0 break-words pl-6 text-text-body`} data-testid="reasoning-examined-supplied"><span className="text-text-light">{ANSWER_WORDS.supplied}: </span>{x.supplied.by === '' ? null : `${x.supplied.by}: `}{x.supplied.text}</p>
      {bound === null ? null : (
        <button type="button" onClick={() => pressCard(bound.id)} className={`${TYPE.meta} ml-6 flex items-center gap-1 rounded-sm text-left text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`} data-testid="reasoning-examined-bound">
          <span className="text-text-light">{ANSWER_WORDS.bound}: </span><span data-view={`${bound.id}.heading`}>{bound.heading}</span>
        </button>
      )}
      {x.finding === null ? null : <p className={`${TYPE.body} m-0 flex items-start gap-2 pl-6 text-text-body`} data-testid="reasoning-examined-finding"><OkIcon id="olumi-mark" size={12} className="mt-1" decorative /><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{x.finding.text}</span></p>}
      {x.limits === null ? null : <p className={`${TYPE.meta} m-0 break-words pl-6 text-text-light`} data-testid="reasoning-examined-limits"><span>{ANSWER_WORDS.limits}: </span>{x.limits}</p>}
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
      <ul className="m-0 list-none divide-y divide-panel-border p-0">{items.map((x) => <Examined key={x.id} x={x} model={model} />)}</ul>
    </section>
  )
}
