/**
 * Answer in place: the UI half of the question → answer → examination contract (DL, ~/olumi-work/claude-checks/overnight-20261117/
 * dl-takeover/question-answer/CONTRACT.md, core 339b32860). It reads ONLY what that contract names, and draws today's tab when core sends none:
 * - `model.questions[]`: Olumi's questions typed by identity, `{id, text, target, role, unit}` (§2, §6), beside the `coaching_questions` texts;
 * - `POST /api/scenarios/:id/answer {question_id, text, op}` (§3): a message turn bound to that question; core's 409 `question_unknown` /
 *   `question_stale` come back with core's own sentence, which is shown as it is;
 * The examination (`view.reasoning.examined`, §6) is NOT drawn yet: it waits for the contract's AS BUILT field names (DL 01:0xZ; Codex
 *   ROOT 01:00Z: the records it names are mentioned/related records, never what a finding rests on or evidence).
 * Nothing here ranks, examines or words anything: the examination is core's; the page draws its fields.
 */
import type { ViewModel } from '../client'
import { call } from '../../olumiCore/team/api'

/** `at`: the question's place in core's `model.questions` (its View path), kept even where an unreadable entry before it is skipped. */
export type Question = { id: string; text: string; target: string | null; role: 'value' | 'due' | null; unit: 'day' | 'week' | 'month' | 'year' | null; at: number }
const isStr = (x: unknown): x is string => typeof x === 'string'
const strOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string'

/** Core's typed questions, in core's order; an older core (no `model.questions`) gives none, and the tab draws its text rows as before. */
export function questionsOf(model: ViewModel): Question[] {
  const raw = (model as unknown as { questions?: unknown }).questions
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q, at): Question[] => {
    if (q === null || typeof q !== 'object') return []
    const o = q as Record<string, unknown>
    if (!isStr(o.id) || o.id === '' || !isStr(o.text) || o.text === '' || !strOrNull(o.target ?? null)) return []
    const role = o.role === 'value' || o.role === 'due' ? o.role : null
    const unit = o.unit === 'day' || o.unit === 'week' || o.unit === 'month' || o.unit === 'year' ? o.unit : null
    return [{ id: o.id, text: o.text, target: (o.target as string | null | undefined) ?? null, role, unit, at }]
  })
}

/** The answer route (contract §3): one message turn bound to the question. Core answers it in the conversation and in `examined`. */
export const answerQuestion = (sid: string, question_id: string, text: string, op: string) =>
  call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/answer`, { question_id, text, op })

