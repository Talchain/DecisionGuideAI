/**
 * What is worth examining in the thinking, as ONE list (Reasoning, 18 Nov 2026). It claims no priority: core computes none yet (engine ask 2,
 * ENGINE-ASKS-REASONING.md), so nothing leads and nothing is called "first". Every word is core's; only the ORDER OF KINDS is the tab's:
 *   1. a card core marks `challenged` (a disagreement or a challenge is the most consequential thing to look at): its action shows the card;
 *   2. core's `sharpen` prompts (science-grounded: shared mechanism, option breadth, risk count) whose move core offers as a method
 *      (`session.methods`, by the move's id, else by `MOVE_METHOD`: core names the move `widen_options` but offers it as `else_do`);
 *   3. core's `coaching_questions`, each filling the message box with that question (nothing sent);
 *   4. core's remaining widening asks (`askOption` / `askRisk`), each filling the box with core's draft.
 * Order as built: challenges, then questions and asks (specific to this model), then sharpen prompts (count-based shape advice, whose method
 * press is kept), offered ones before the rest. A challenged card that is a recorded disagreement (`collab.dissent`) is said under Towards
 * commitment instead, once.
 */
import type { ViewCard, ViewModel } from '../client'
import { challengedCards } from '../layout'
import { questionsOf, type Question } from './answer'

export type Sharpen = NonNullable<ViewModel['sharpen']>[number]
export type MethodWord = { id: string; text: string }
/** Core's sharpen moves whose method core offers under another id (engine gap 6: no move-to-method map on the wire; Codex 01:56Z item 3). */
export const MOVE_METHOD: Readonly<Record<string, string>> = { widen_options: 'else_do' }
type Widen = { k: 'askOption' | 'askRisk'; label: string; draft: string }

export type Examine =
  | { kind: 'challenge'; key: string; card: ViewCard }
  | { kind: 'method'; key: string; i: number; s: Sharpen; method: { at: number; m: MethodWord } | null }
  /** `typed`: core's typed question (answer in place, CONTRACT §2), when core sends `model.questions`; null for a text-only question. */
  | { kind: 'question'; key: string; i: number; q: string; typed: Question | null }
  | { kind: 'widen'; key: string; w: Widen }

/** Whether an item carries a press of its own (a challenge always does: the card). */
export const actionable = (e: Examine): boolean => e.kind !== 'method' || e.method !== null

export function widenOf(words: Record<string, unknown> | null): Widen[] {
  return (['askOption', 'askRisk'] as const).flatMap((k) => {
    const label = words?.[k], draft = words?.[`${k}Draft`]
    return typeof label === 'string' && label !== '' && typeof draft === 'string' && draft !== '' ? [{ k, label, draft }] : []
  })
}

export function examineOf(model: ViewModel, methods: readonly MethodWord[] | null, words: Record<string, unknown> | null, saidElsewhere: ReadonlySet<string> = new Set()): Examine[] {
  const challenges: Examine[] = challengedCards(model).filter((card) => !saidElsewhere.has(card.id)).map((card) => ({ kind: 'challenge', key: `c:${card.id}`, card }))
  const sharpen: Examine[] = (model.sharpen ?? []).flatMap((s, i) => {
    if (s.lead === '' && s.emphasis === '') return []
    const find = (id: string | undefined) => (id === undefined ? -1 : (methods ?? []).findIndex((x) => x.id === id))
    const direct = s.move === null ? -1 : find(s.move)
    const at = direct >= 0 || s.move === null ? direct : find(MOVE_METHOD[s.move])
    const method = at < 0 || methods === null ? null : { at, m: methods[at]! }
    return [{ kind: 'method', key: `s:${s.id}`, i, s, method } satisfies Examine]
  })
  // Core's typed questions when it sends them (each answerable in place by its id); else its coaching texts, as before.
  const typed = questionsOf(model)
  const questions: Examine[] = typed.length > 0
    ? typed.map((t, i) => ({ kind: 'question', key: `q:${t.id}`, i, q: t.text, typed: t } satisfies Examine))
    : (model.coaching_questions ?? []).flatMap((q, i) => (q === '' ? [] : [{ kind: 'question', key: `q:${i}`, i, q, typed: null } satisfies Examine]))
  const rest: Examine[] = widenOf(words).map((w) => ({ kind: 'widen', key: `w:${w.k}`, w }))
  return [...challenges, ...questions, ...rest, ...sharpen.filter(actionable), ...sharpen.filter((e) => !actionable(e))]
}
