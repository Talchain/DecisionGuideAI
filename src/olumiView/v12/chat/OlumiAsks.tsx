/**
 * "Olumi's question" card (17 Nov, calm panel mock v2, Paul): ONE of Olumi's questions at a time, the rest behind it (progress dashes and "1 of N"),
 * an answer field, the person's green "Use this", Skip as a neutral icon, and a row of neutral ask-for-more icons (the registry's method icons).
 * The card is Olumi's (a panel with an --info border); every word of it is viewPanelBody. At rest it is ONE row (Olumi's mark, the question, a
 * chevron); pressing opens the answer box, the dashes, Skip and the ask-for-more icons (18 Nov audit chat-2, chat-3: nothing open over the thread).
 *
 * The questions are core's, in core's words, as `chatQuestionsOf` draws them (model.trial_questions first, then model.coaching_questions, three
 * at most). Core serves no answer type, so a question that names a figure with its editor (`id` and `edit`) is answered in that figure's own
 * editor (`body`, ViewChat's QuestionLine: its own write), and every other question takes plain words. "Use this" sends the person's words,
 * and only those, through the conversation's own send path (`onAnswer`: the same `say` a typed message uses; core's question is never sent as
 * the person's); the ask-for-more icons put a method's lead-in in the message box (as the composer's own method icons), and send nothing. The
 * questions not shown stay in the page, hidden, in core's words.
 *
 * A draft belongs to ONE question of ONE scenario: it is kept under the scenario, the question's key and the question's exact words, so a
 * question core rewrites, or another scenario's question at the same place, never shows words typed for a different question (Codex, 17 Nov).
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { OkIcon, OkIconButton } from '../../look/icons'
import { V10_METHODS } from '../../../presentation/V10MethodChips'
import { HIT_44 } from '../../../styles/hitArea'

export interface AskedQuestion { readonly key: string; readonly view: string; readonly text: string; readonly id: string | null; readonly edit: object | null }

export const USE_THIS = 'Use this'
/** Chrome words only: the box's prompt and the chevron's names. The question itself is core's. */
export const ANSWER_PLACEHOLDER = 'Your answer'
export const OPEN_ANSWER = 'Answer this question'
export const CLOSE_ANSWER = 'Close the answer box'
/** The green act: Olumi's green with an ink label (Paul, 17 Nov: no black buttons). Drawn only once there are words, so it is never seen disabled. */
const USE_CLASS = `${typography.viewPanelHeading} inline-flex min-h-[32px] items-center rounded-full border border-success bg-success px-3 text-text-header hover:border-success-hover hover:bg-success-hover active:bg-success-active focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`
const METHOD_ICON = { assumption: 'method-challenge', opposite: 'method-opposite', disconfirming: 'method-disprove', outside: 'method-outside' } as const

/** The identity of one question's draft: the scenario, the question's key and its exact words. */
export const draftKeyOf = (scope: string, q: Pick<AskedQuestion, 'key' | 'text'>): string => JSON.stringify([scope, q.key, q.text])

export function OlumiAsks({ questions, scope, body, held, onAnswer, onMethod }: {
  questions: readonly AskedQuestion[]
  /** The scenario these questions belong to (the View's id): part of every draft's identity. */
  scope: string
  /** A question's own words, or its figure's editor where core gives one (ViewChat's QuestionLine). */
  body: (q: AskedQuestion) => ReactNode
  /** Nothing is sent while a write holds the conversation. */
  held: boolean
  /** The person's words for this question, through the conversation's own send; true once sent. */
  onAnswer: (q: AskedQuestion, answer: string) => Promise<boolean>
  /** One of the four challenges pressed (ViewChat's `pressChallenge`: typed on the selected card, or waiting for one). */
  onMethod: (key: (typeof V10_METHODS)[number]['key']) => void
}): JSX.Element | null {
  const [at, setAt] = useState(0)
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const n = questions.length
  if (n === 0) return null
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
          className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info">
          {open ? <ChevronUp aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" /> : <ChevronDown aria-hidden="true" strokeWidth={1.75} className="h-4 w-4" />}
        </button>
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
            {i >= n - 1 ? null : <OkIconButton id="skip-question" testid="view-question-skip" size={14} className="h-6 w-6 rounded-md hover:bg-panel-hover" onClick={() => setAt(i + 1)} />}
            <span role="group" aria-label="Ways to ask for more" className="ml-auto flex items-center gap-0.5" data-testid="view-question-more">
              {V10_METHODS.map(({ key, label }) => (
                <OkIconButton key={key} id={METHOD_ICON[key]} words={label} testid={`view-question-method-${key}`} size={14} className="h-6 w-6 rounded-md hover:bg-panel-hover" disabled={held} onClick={() => onMethod(key)} />
              ))}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
