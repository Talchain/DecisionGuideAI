/**
 * Answer in place: the UI half of the question → answer → examination contract (DL, ~/olumi-work/claude-checks/overnight-20261117/
 * dl-takeover/question-answer/CONTRACT.md, core 339b32860). It reads ONLY what that contract names, and draws today's tab when core sends none:
 * - `model.questions[]`: Olumi's questions typed by identity, `{id, text, target, role, unit}` (§2, §6), beside the `coaching_questions` texts;
 * - `POST /api/scenarios/:id/answer {question_id, text, op}` (§3): a message turn bound to that question; core's 409 `question_unknown` /
 *   `question_stale` come back with core's own sentence, which is shown as it is;
 * - `view.reasoning.examined[]` (§6): what was asked, what the person supplied, the record code bound it to, Olumi's reply as served, what it
 *   rests on, its limits and any held proposal, built by core from immutable rows (so it survives reopening and a teammate sees it).
 * Nothing here ranks, examines or words anything: the examination is core's; the page draws its fields.
 */
import type { View, ViewModel } from '../client'
import { call } from '../../olumiCore/team/api'

export type Question = { id: string; text: string; target: string | null; role: 'value' | 'due' | null; unit: 'day' | 'week' | 'month' | 'year' | null }
export type Examination = {
  id: string; question_id: string; question: string; target: string | null
  supplied: { by: string; text: string; at: string }
  bound: string | null
  finding: { row: number; text: string } | null
  rests_on: string[]
  limits: string | null
  proposal_id: number | null
  olumi: true
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const strOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string'

/** Core's typed questions, in core's order; an older core (no `model.questions`) gives none, and the tab draws its text rows as before. */
export function questionsOf(model: ViewModel): Question[] {
  const raw = (model as unknown as { questions?: unknown }).questions
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q): Question[] => {
    if (q === null || typeof q !== 'object') return []
    const o = q as Record<string, unknown>
    if (!isStr(o.id) || o.id === '' || !isStr(o.text) || o.text === '' || !strOrNull(o.target ?? null)) return []
    const role = o.role === 'value' || o.role === 'due' ? o.role : null
    const unit = o.unit === 'day' || o.unit === 'week' || o.unit === 'month' || o.unit === 'year' ? o.unit : null
    return [{ id: o.id, text: o.text, target: (o.target as string | null | undefined) ?? null, role, unit }]
  })
}

/** Core's examinations (`view.reasoning.examined`), in core's order; none on an older core. An item missing its identity is not drawn. */
export function examinedOf(view: View | null): Examination[] {
  const raw = (view as unknown as { reasoning?: { examined?: unknown } } | null)?.reasoning?.examined
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x): Examination[] => {
    if (x === null || typeof x !== 'object') return []
    const o = x as Record<string, unknown>, s = o.supplied as Record<string, unknown> | null | undefined
    if (!isStr(o.id) || !isStr(o.question_id) || !isStr(o.question) || s == null || !isStr(s.by) || !isStr(s.text)) return []
    const f = o.finding as Record<string, unknown> | null | undefined
    return [{
      id: o.id, question_id: o.question_id, question: o.question, target: isStr(o.target) ? o.target : null,
      supplied: { by: s.by, text: s.text, at: isStr(s.at) ? s.at : '' },
      bound: isStr(o.bound) ? o.bound : null,
      finding: f != null && isStr(f.text) && f.text !== '' ? { row: typeof f.row === 'number' ? f.row : 0, text: f.text } : null,
      rests_on: Array.isArray(o.rests_on) ? o.rests_on.filter(isStr) : [],
      limits: isStr(o.limits) && o.limits !== '' ? o.limits : null,
      proposal_id: typeof o.proposal_id === 'number' ? o.proposal_id : null,
      olumi: true,
    }]
  })
}

/** The answer route (contract §3): one message turn bound to the question. Core answers it in the conversation and in `examined`. */
export const answerQuestion = (sid: string, question_id: string, text: string, op: string) =>
  call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/answer`, { question_id, text, op })
