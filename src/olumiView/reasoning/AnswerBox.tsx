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
import { answerQuestion, type Question } from './answer'
import { TYPE } from '../port/type'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'

export const ANSWER_WORDS = {
  placeholder: 'Your answer',
  send: 'Answer',
  sending: 'Sending',
  failed: 'Olumi could not take the answer just now. Your words are kept: try again.',
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
