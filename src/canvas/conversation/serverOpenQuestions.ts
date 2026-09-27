/**
 * The build's OPEN QUESTIONS, as detail on demand (Paul's goal, 25 Sep: "a short
 * conclusion, decisive caveat and one real next action, with useful detail
 * available on demand").
 *
 * CEE's write-outcome line appends the questions a model build parked instead of
 * modelling — `openQuestionsLine` in `olumi-assistants-service`
 * `src/orchestrator-v5/agent-lane/write-outcome.ts` — to the reply, after a
 * fixed, SERVER-AUTHORED marker. On the served construction turn that list is
 * ~110 of ~270 words (served CEE e39f6e0), so it buries the conclusion it
 * follows. This splits the questions out so they render VERBATIM behind a
 * disclosure: nothing is reworded, dropped or re-ordered, and the science stays
 * the producer's.
 *
 * ⛔ THE QUESTIONS ARE NOT THE REST OF THE REPLY (#1987 review 5825639597). The
 * producer can put more after them, and none of it is a question:
 * `contextFactorsLine` ("No option changes X, so I held it as fixed context … —
 * tell me if one of the options should change it", a caveat plus the user's next
 * action), a later write's status line, and `notAdoptedLine`. The questions end
 * at the FIRST sentence that opens like one of those, and everything from there
 * stays in the body. The cut can only come early — a question that happens to
 * open like a status line stays visible — so an error SHOWS more, never hides.
 *
 * ⚠ FAILS OPEN. The marker is the producer's string, not a contract field. If
 * it is absent, repeated, glued to the word before it, or has no question after
 * it, this returns `null` and the reply renders exactly as it does today. The
 * lasting fix is a structured `open_questions` field on the wire (Runtime).
 */

import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

/** The producer's marker, byte for byte (write-outcome.ts `openQuestionsLine`). */
export const SERVER_OPEN_QUESTIONS_MARKER = 'Questions this model does not answer yet:'

/** The toggle's label: the producer's own heading, so nothing is renamed. */
export const OPEN_QUESTIONS_LABEL = 'Questions this model does not answer yet'

/**
 * Where the questions end: a sentence end, then a producer sentence that can
 * follow them (CEE e39f6e0 write-outcome.ts — `contextFactorsLine` :122-126,
 * `statusLine`/`partsLine` :80-177 joined with ' ' at :224-226, and
 * `notAdoptedLine` :240-264 joined after it in agent-v1-turn.ts:1627-1628).
 */
const PRODUCER_SENTENCE =
  String.raw`(?:No option changes |Not included in this proposal: |Saved\b|Not saved\b|Partly saved\b|That change was already saved\b|The model was |This model had already been built\b)`
const AFTER_THE_QUESTIONS = new RegExp(String.raw`[.?!)]\s+(?=${PRODUCER_SENTENCE})`)
const NO_QUESTION_FIRST = new RegExp(String.raw`^\s*${PRODUCER_SENTENCE}`)

export interface ServerOpenQuestionsSplit {
  /** Everything before the marker. */
  readonly lead: string
  /** The questions, verbatim — shown on demand. */
  readonly questions: string
  /** Producer sentences after the questions (e.g. the held-as-context caveat), or ''. */
  readonly after: string
  /** What the user reads at rest: the lead, then `after`. */
  readonly atRest: string
}

export function splitServerOpenQuestions(text: string): ServerOpenQuestionsSplit | null {
  const at = text.indexOf(SERVER_OPEN_QUESTIONS_MARKER)
  // Exactly once. (A leading marker fails the whitespace check below.)
  if (at === -1 || text.indexOf(SERVER_OPEN_QUESTIONS_MARKER, at + 1) !== -1) return null
  // The producer appends it with a single leading space onto the status line.
  if (!/\s$/.test(text.slice(0, at))) return null
  const lead = text.slice(0, at).trimEnd()
  const tail = text.slice(at + SERVER_OPEN_QUESTIONS_MARKER.length)
  // A producer sentence straight after the marker means no question came first.
  if (NO_QUESTION_FIRST.test(tail)) return null
  // The boundary match starts on the question's own closing mark; keep it.
  const end = tail.search(AFTER_THE_QUESTIONS)
  const questions = (end === -1 ? tail : tail.slice(0, end + 1)).trim()
  const after = end === -1 ? '' : tail.slice(end + 1).trim()
  if (lead.length === 0 || questions.length === 0) return null
  return { lead, questions, after, atRest: after ? `${lead} ${after}` : lead }
}

/**
 * ⭐ THE WHOLE LIST, WHEN THE PRODUCER SENDS IT (CEE #2054, `_agent.open_questions`). The reply names at most two and
 * ends "Ask me for the other N."; served, asking gave a 4-bullet synthesis, not the other N (run
 * oq-rest-c3d7873e-f99d0a5, 27 Sep). The typed list is on the same turn, so the disclosure shows it: every item,
 * verbatim, in the producer's order. Anything that is not a non-empty string is dropped, never repaired.
 */
export const OPEN_QUESTION_LIST_MAX = 40

export function readOpenQuestionList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items = raw.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, OPEN_QUESTION_LIST_MAX)
  return items.length > 0 ? items : undefined
}

/** `_agent.open_questions` from the parser's additive sidecar (an undeclared top-level key at the pinned schema). */
export function extractOpenQuestionListSidecar(response: unknown): string[] | undefined {
  const additive = (response as OlumiResponseWithExtensions | null | undefined)?.[ADDITIVE_EXTENSIONS_KEY]
  const agent = (additive as Record<string, unknown> | undefined)?.['_agent']
  if (agent === null || typeof agent !== 'object' || Array.isArray(agent)) return undefined
  return readOpenQuestionList((agent as Record<string, unknown>).open_questions)
}

/**
 * The toggle's label once the whole list is known (DL #70 5851835121): the count first, collapsed by default, so the
 * first message stays short and the list is one press away. No list → the producer's own heading, unchanged.
 */
export function openQuestionsToggleLabel(listLength: number | undefined): string {
  if (!listLength || listLength < 1) return OPEN_QUESTIONS_LABEL
  return `${listLength} ${listLength === 1 ? 'question' : 'questions'} this model does not answer yet`
}
