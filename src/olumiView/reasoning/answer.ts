/**
 * Answer in place: the UI half of the question → answer → examination contract (DL, ~/olumi-work/claude-checks/overnight-20261117/
 * dl-takeover/question-answer/CONTRACT.md, core 339b32860). It reads ONLY what that contract names, and draws today's tab when core sends none:
 * - `model.questions[]`: Olumi's questions typed by identity, `{id, text, about, role, unit}` (AS BUILT, core 1285c463), beside the
 *   `coaching_questions` texts;
 * - `POST /api/scenarios/:id/answer {question_id, text, op}` (§3): a message turn bound to that question; core's 409 `question_unknown` /
 *   `question_stale` come back with core's own sentence, which is shown as it is;
 * - `view.reasoning.examined[]` (AS BUILT): `{id, question_id, question, about, supplied {by, by_id, text, at}, bound, finding {row, text},
 *   mentioned, limits, proposal_id, olumi}`. `mentioned` are records the reply mentions (Codex ROOT 01:00Z): never drawn as what the
 *   finding rests on, nor as evidence; absent is [] or null and draws nothing.
 * Nothing here ranks, examines or words anything: the examination is core's; the page draws its fields.
 */
import type { ViewModel } from '../client'
import { call } from '../../olumiCore/team/api'

/** `at`: the question's place in core's `model.questions` (its View path), kept even where an unreadable entry before it is skipped. */
export type Question = { id: string; text: string; about: string | null; role: 'value' | 'due' | 'measure' | null; unit: 'day' | 'week' | 'month' | 'year' | null; at: number }
export type Examination = {
  id: string; question_id: string; question: string; about: string | null
  supplied: { by: string; by_id: string | null; text: string; at: string }
  bound: string | null; finding: { row: number; text: string } | null; mentioned: string[]; limits: string | null; proposal_id: number | null
}
const isStr = (x: unknown): x is string => typeof x === 'string'
const strOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string'

/** Core's typed questions, in core's order; an older core (no `model.questions`) gives none, and the tab draws its text rows as before. */
export function questionsOf(model: ViewModel): Question[] {
  const raw = (model as unknown as { questions?: unknown }).questions
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q, at): Question[] => {
    if (q === null || typeof q !== 'object') return []
    const o = q as Record<string, unknown>
    if (!isStr(o.id) || o.id === '' || !isStr(o.text) || o.text === '' || !strOrNull(o.about ?? null)) return []
    const role = o.role === 'value' || o.role === 'due' || o.role === 'measure' ? o.role : null
    const unit = o.unit === 'day' || o.unit === 'week' || o.unit === 'month' || o.unit === 'year' ? o.unit : null
    return [{ id: o.id, text: o.text, about: (o.about as string | null | undefined) ?? null, role, unit, at }]
  })
}

/** Core's examinations (`view.reasoning.examined`, AS BUILT), in core's order; none on an older core. An item missing its identity is not drawn. */
export function examinedOf(view: unknown): Examination[] {
  const raw = (view as { reasoning?: { examined?: unknown } } | null)?.reasoning?.examined
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x): Examination[] => {
    if (x === null || typeof x !== 'object') return []
    const o = x as Record<string, unknown>, s = o.supplied as Record<string, unknown> | null | undefined
    if (!isStr(o.id) || !isStr(o.question_id) || !isStr(o.question) || s == null || !isStr(s.text)) return []
    const f = o.finding as Record<string, unknown> | null | undefined
    return [{
      id: o.id, question_id: o.question_id, question: o.question, about: isStr(o.about) ? o.about : null,
      supplied: { by: isStr(s.by) ? s.by : '', by_id: isStr(s.by_id) ? s.by_id : null, text: s.text, at: isStr(s.at) ? s.at : '' },
      bound: isStr(o.bound) ? o.bound : null,
      finding: f != null && isStr(f.text) && f.text !== '' ? { row: typeof f.row === 'number' ? f.row : 0, text: f.text } : null,
      mentioned: Array.isArray(o.mentioned) ? o.mentioned.filter(isStr) : [],
      limits: isStr(o.limits) && o.limits !== '' ? o.limits : null,
      proposal_id: typeof o.proposal_id === 'number' ? o.proposal_id : null,
    }]
  })
}

/** The answer route (contract §3): one message turn bound to the question. Core answers it in the conversation and in `examined`. */
export const answerQuestion = (sid: string, question_id: string, text: string, op: string) =>
  call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/answer`, { question_id, text, op })

