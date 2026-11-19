/**
 * "Olumi's question" card (17 Nov, calm panel mock v2, Paul): ONE of Olumi's questions at a time, the rest behind it (progress dashes and "1 of N"),
 * an answer field, the person's green "Use this" and Skip as a neutral icon. The four method icons are the composer's alone, never repeated here (Paul, 19 Nov).
 * The card is Olumi's (a panel with an --info border); every word of it is viewPanelBody. At rest it is ONE row (Olumi's mark, the question, a
 * chevron); pressing opens the answer box, the dashes, Skip (18 Nov audit chat-2, chat-3: nothing open over the thread).
 *
 * The questions are core's, in core's words, as `chatQuestionsOf` draws them (model.trial_questions first, then model.coaching_questions, three
 * at most). Core serves no answer type, so a question that names a figure with its editor (`id` and `edit`) is answered in that figure's own
 * editor (`body`, ViewChat's QuestionLine: its own write), and every other question takes plain words. "Use this" sends the person's words,
 * and only those, through the conversation's own send path (`onAnswer`: the same `say` a typed message uses; core's question is never sent as
 * the person's); nothing else is sent. The
 * questions not shown stay in the page, hidden, in core's words.
 *
 * A draft belongs to ONE question of ONE scenario: it is kept under the scenario, the question's key and the question's exact words, so a
 * question core rewrites, or another scenario's question at the same place, never shows words typed for a different question (Codex, 17 Nov).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { controls } from '../../../styles/controls'
import { OkIcon, OkIconButton } from '../../look/icons'
import { FoldChevron } from '../../look/FoldChevron'
import { HIT_44 } from '../../../styles/hitArea'
import { useLaneInspector } from '../edit/inspectorStore'

/** `answers`: core's typed question id (question-answer CONTRACT §2) when core sent this question typed: the answer is bound to it by identity. */
export interface AskedQuestion { readonly key: string; readonly view: string; readonly text: string; readonly id: string | null; readonly edit: object | null; readonly answers?: string | null }

export const USE_THIS = 'Use this'
/** Chrome words only: the box's prompt and the chevron's names. The question itself is core's. */
export const ANSWER_PLACEHOLDER = 'Your answer'
export const OPEN_ANSWER = 'Answer this question'
export const CLOSE_ANSWER = 'Close the answer box'
/** The green act: Olumi's green with an ink label (Paul, 17 Nov: no black buttons). Drawn only once there are words, so it is never seen disabled. */
const USE_CLASS = `${typography.viewPanelHeading} inline-flex min-h-[32px] items-center rounded-full px-3 ${controls.act}`

/** The identity of one question's draft: the scenario, the question's key and its exact words. */
export const draftKeyOf = (scope: string, q: Pick<AskedQuestion, 'key' | 'text'>): string => JSON.stringify([scope, q.key, q.text])

/** Question sets the person removed (Paul, 19 Nov: "not just collapse, but remove"), by scenario and the questions' own keys: the card stays
 *  gone for those questions on this page and comes back only when Olumi asks something new. Nothing is written to core. */
const removed = new Set<string>()
export const REMOVE_QUESTIONS = 'Remove these questions'

export function OlumiAsks({ questions, scope, body, held, onAnswer }: {
  questions: readonly AskedQuestion[]
  /** The scenario these questions belong to (the View's id): part of every draft's identity. */
  scope: string
  /** A question's own words, or its figure's editor where core gives one (ViewChat's QuestionLine). */
  body: (q: AskedQuestion) => ReactNode
  /** Nothing is sent while a write holds the conversation. */
  held: boolean
  /** The person's words for this question, through the conversation's own send; true once sent. */
  onAnswer: (q: AskedQuestion, answer: string) => Promise<boolean>
}): JSX.Element | null {
  const [at, setAt] = useState(0)
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  // One surface at a time (Paul, 19 Nov): a card's pop-over opening folds this answer box. What was typed stays in `drafts`, and the question stays as one row.
  const popover = useLaneInspector((s) => (s.current?.kind === 'details' ? s.current.n : null))
  useEffect(() => { if (popover !== null) setOpen(false) }, [popover])
  const [, bump] = useState(0)
  const n = questions.length
  const setKey = `${scope}\u0000${questions.map((x) => x.key).join('\u0001')}`
  if (n === 0 || removed.has(setKey)) return null
  const i = Math.min(at, n - 1), q = questions[i]!
  const head = n === 1 ? 'Olumi’s question' : 'Olumi’s questions'
  const own = q.id !== null && q.edit !== null
  const mine = draftKeyOf(scope, q)
  const typed = drafts[mine] ?? ''
  const testid = (k: number) => (k === 0 ? 'view-model-question-text' : `view-model-question-text-${k}`)
  const use = async () => {
    if (sending || held || typed.trim() === '') return
    setSending(true)
    try {
      if (await onAnswer(q, typed)) { setDrafts((d) => ({ ...d, [mine]: '' })); setAt(Math.min(i + 1, n - 1)) }
    } finally { setSending(false) }
  }
  return (
    <section className={`${typography.viewPanelBody} space-y-2 rounded-md border border-info/30 bg-panel p-2`} data-testid="view-model-question" aria-label={head} data-asked={i + 1} data-asked-of={n} data-open={open ? '' : undefined}>
      <p className="sr-only">{head}</p>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none"><OkIcon id="olumi-mark" size={14} decorative /></span>
        <div className="min-w-0 flex-1 space-y-1">
          {questions.map((x, k) => (
            <div key={x.key} hidden={k !== i} data-testid={testid(k)} data-view={x.view} data-question-id={x.id ?? undefined}>{body(x)}</div>
          ))}
        </div>
        <button type="button" aria-expanded={open} aria-controls="view-question-open" aria-label={open ? CLOSE_ANSWER : OPEN_ANSWER} title={open ? CLOSE_ANSWER : OPEN_ANSWER} data-testid="view-question-toggle" onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info">
          <FoldChevron open={open} />
        </button>
        <OkIconButton id="cancel-close" tone="ghost" testid="view-question-remove" words={REMOVE_QUESTIONS}
          onClick={() => { removed.add(setKey); bump((x) => x + 1) }} />
      </div>
      {!open ? null : (
        <div id="view-question-open" className="space-y-2" data-testid="view-question-open">
          {n === 1 ? null : (
            <div className="flex items-center gap-2">
              <span role="group" aria-label="Progress" className="flex items-center gap-1" data-testid="view-question-dashes">
                {questions.map((x, k) => (
                  <button key={x.key} type="button" onClick={() => setAt(k)} aria-label={`Question ${k + 1} of ${n}`} aria-current={k === i ? 'step' : undefined} data-testid={`view-question-dash-${k}`}
                    className={`${HIT_44} inline-block h-1 w-4 rounded-full ${k === i ? 'bg-info' : 'bg-info/30'}`} />
                ))}
              </span>
              <span className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-question-count">{i + 1} of {n}</span>
            </div>
          )}
          {own ? null : (
            <textarea rows={2} value={typed} disabled={held || sending} aria-label={q.text} placeholder={ANSWER_PLACEHOLDER} data-testid="view-question-answer"
              onChange={(e) => { const v = e.target.value; setDrafts((d) => ({ ...d, [mine]: v })) }}
              className={`${typography.viewPanelBody} block w-full resize-none rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body outline-none focus:border-text-light`} />
          )}
          <div className="flex flex-wrap items-center gap-1">
            {own || typed.trim() === '' ? null : <button type="button" disabled={held || sending} onClick={() => void use()} className={USE_CLASS} data-testid="view-question-use">{USE_THIS}</button>}
            {i >= n - 1 ? null : <OkIconButton id="skip-question" testid="view-question-skip" className="h-7 w-7 rounded-md hover:bg-panel-hover" onClick={() => setAt(i + 1)} />}
          </div>
        </div>
      )}
    </section>
  )
}
