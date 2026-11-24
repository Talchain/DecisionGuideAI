/**
 * "Olumi's question" card (17 Nov, calm panel mock v2, Paul; W3 24 Nov: the full list). At rest it is ONE row (Olumi's mark, the chosen question,
 * a chevron), with "N left to check" above it when there are several (18 Nov audit chat-2, chat-3: nothing open over the thread). Opened, it lists
 * EVERY question core serves, numbered, in core's order; a number chooses its question for the one answer box, the person's green "Use this" and
 * Skip as a neutral icon. Nothing is counted as answered: core serves no answer receipt here, and a question core has its answer for is simply no
 * longer served, so N is what is left. The four method icons are the composer's alone, never repeated here (Paul, 19 Nov).
 * The card is Olumi's (a panel with an --info border); every word of it is viewPanelBody.
 *
 * The questions are core's, in core's words, as `chatQuestionsAllOf` draws them (model.trial_questions first, then core's check-first-ordered
 * model.questions, else model.coaching_questions). Core serves no answer type, so a question that names a figure with its editor (`id` and `edit`) is answered in that figure's own
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
import { HoverButton } from '../../look/Hover'
import { HIT_44 } from '../../../styles/hitArea'
import { useLaneInspector } from '../edit/inspectorStore'
import { useViewStore } from '../../store'

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

/** Question sets the person removed (Paul, 19 Nov: "not just collapse, but remove"): the card stays gone on this page, for this viewer, for
 *  exactly these questions in these words (draftKeyOf: scenario, key and text; Codex 11:15:52Z), and comes back for a new or reworded question.
 *  Page and session only: nothing is written to core or to storage. */
const removed = new Set<string>()
export const REMOVE_QUESTIONS = 'Remove these questions'
/** Tests only: forget every removal (the set lives for the page). */
export const resetRemovedQuestions = (): void => removed.clear()

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
  const viewer = useViewStore((st) => st.view?.you_id ?? null)
  const n = questions.length
  const setKey = JSON.stringify([viewer, ...questions.map((x) => draftKeyOf(scope, x))])
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
    <section className={`${typography.viewPanelBody} space-y-3 rounded-md border border-info/30 bg-panel p-3`} data-testid="view-model-question" aria-label={head} data-asked={i + 1} data-asked-of={n} data-open={open ? '' : undefined}>
      <p className="sr-only">{head}</p>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-none"><OkIcon id="olumi-mark" size={14} decorative /></span>
        <div className="min-w-0 flex-1 space-y-1">
          {n === 1 ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-question-count">{n} left to check</p>}
          {/* At rest the chosen question alone; open, every question core serves, numbered, in core's order (W3, 24 Nov). */}
          <ol className="space-y-1" data-testid="view-question-list">
            {questions.map((x, k) => (
              <li key={x.key} hidden={!open && k !== i} className="flex items-start gap-2" aria-current={open && n > 1 && k === i ? 'step' : undefined}>
                {!open || n === 1 ? null : (
                  <button type="button" onClick={() => setAt(k)} aria-label={`Question ${k + 1} of ${n}`} data-testid={`view-question-pick-${k}`}
                    className={`${typography.viewPanelMeta} ${HIT_44} mt-0.5 w-4 flex-none text-left ${k === i ? 'font-semibold text-text-header' : 'text-text-light'}`}>{k + 1}</button>
                )}
                <div className="min-w-0 flex-1" data-testid={testid(k)} data-view={x.view} data-question-id={x.id ?? undefined}>{body(x)}</div>
              </li>
            ))}
          </ol>
        </div>
        <HoverButton words={open ? CLOSE_ANSWER : OPEN_ANSWER} type="button" aria-expanded={open} aria-controls="view-question-open" aria-label={open ? CLOSE_ANSWER : OPEN_ANSWER} data-testid="view-question-toggle" onClick={() => setOpen((o) => !o)}
          className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
          <FoldChevron open={open} />
        </HoverButton>
        <OkIconButton id="cancel-close" tone="ghost" testid="view-question-remove" words={REMOVE_QUESTIONS}
          onClick={() => { removed.add(setKey); bump((x) => x + 1) }} />
      </div>
      {!open ? null : (
        <div id="view-question-open" className="space-y-3" data-testid="view-question-open">
          {own ? null : (
            <textarea rows={2} value={typed} disabled={held || sending} aria-label={q.text} placeholder={ANSWER_PLACEHOLDER} data-testid="view-question-answer"
              onChange={(e) => { const v = e.target.value; setDrafts((d) => ({ ...d, [mine]: v })) }}
              className={`${typography.viewPanelBody} block w-full resize-none rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body outline-none focus:border-text-light`} />
          )}
          <div className="flex flex-wrap items-center gap-1">
            {own || typed.trim() === '' ? null : <button type="button" disabled={held || sending} onClick={() => void use()} className={USE_CLASS} data-testid="view-question-use">{USE_THIS}</button>}
            {i >= n - 1 ? null : <OkIconButton id="skip-question" tone="ghost" testid="view-question-skip" onClick={() => setAt(i + 1)} />}
          </div>
        </div>
      )}
    </section>
  )
}
