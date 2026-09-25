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
 * follows. This splits the reply at that exact marker so the questions render
 * VERBATIM behind a disclosure: nothing is reworded, dropped or re-ordered, and
 * the science stays the producer's.
 *
 * ⚠ FAILS OPEN. The marker is the producer's string, not a contract field. If
 * it changes, or appears anywhere but as the reply's last segment, this returns
 * `null` and the reply renders exactly as it does today.
 */

/** The producer's marker, byte for byte (write-outcome.ts `openQuestionsLine`). */
export const SERVER_OPEN_QUESTIONS_MARKER = 'Questions this model does not answer yet:'

/** The toggle's label: the producer's own heading, so nothing is renamed. */
export const OPEN_QUESTIONS_LABEL = 'Questions this model does not answer yet'

export interface ServerOpenQuestionsSplit {
  /** Everything before the marker — the reply the user reads at rest. */
  readonly lead: string
  /** Everything after the marker, verbatim — the questions, on demand. */
  readonly questions: string
}

export function splitServerOpenQuestions(text: string): ServerOpenQuestionsSplit | null {
  const at = text.indexOf(SERVER_OPEN_QUESTIONS_MARKER)
  // Exactly once. (A leading marker fails the whitespace check below.)
  if (at === -1 || text.indexOf(SERVER_OPEN_QUESTIONS_MARKER, at + 1) !== -1) return null
  // The producer appends it with a single leading space onto the status line.
  if (!/\s$/.test(text.slice(0, at))) return null
  const lead = text.slice(0, at).trimEnd()
  const questions = text.slice(at + SERVER_OPEN_QUESTIONS_MARKER.length).trim()
  if (lead.length === 0 || questions.length === 0) return null
  return { lead, questions }
}
