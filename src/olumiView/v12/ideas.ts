/**
 * "Keep as an idea" (V12, proposal 005 v2, Create): an Olumi method reply kept as an `idea` item on the scenario's strategy, still Olumi's.
 * One write to core `POST /api/scenarios/:sid/strategy/items { kind: 'idea', text, base, from_turn, op }` (API.md v1.42). `from_turn` is the reply's turn id (`chat[].id`); core then records the
 * item's origin as Olumi's, the reply as its source and the person as the keeper: three separate things, none written here. A refusal is core's own
 * words (TeamApiError.message). The same press after a dropped connection reuses its op, so core keeps it once.
 */
import { call, newOp } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import type { View, ViewTurn } from '../client'

/** Core keeps an item to this many characters (app/strategy/kinds.ts TEXT_MAX). */
export const IDEA_MAX = 400

export type IdeaBody = { kind: 'idea'; text: string; base: number; from_turn: number; op: string }

const ops = new Map<string, string>()
const keyOf = (sid: string, turn: number, text: string) => `${sid}\u0000${turn}\u0000${text}`

/** The model version an item is saved against (`edit_base`); null while a proposal is held or there is no model, when core takes no edit. */
export const ideaBaseOf = (view: View | null): number | null => view?.model?.edit_base ?? null

/**
 * Keep Olumi's idea. `base` is read from the View on screen unless given. Resolves with core's answer; rejects with TeamApiError carrying core's
 * words (a 4xx), or with `Error(NO_BASE)` before any call when there is no version to save against.
 */
export const NO_BASE = 'There is no saved model to keep this against yet. Approve the proposal first, then keep it.'
export const PAST_VERSION = 'You are looking at an earlier version. Go back to the current one to keep this.'
export async function keepIdea({ sid, turn, text, base, op }: { sid: string; turn: number; text: string; base?: number | null; op?: string }): Promise<unknown> {
  if (base === undefined && useViewStore.getState().at !== null) throw new Error(PAST_VERSION)
  const b = base === undefined ? ideaBaseOf(useViewStore.getState().view) : base
  if (b === null) throw new Error(NO_BASE)
  const k = keyOf(sid, turn, text)
  const use = op ?? ops.get(k) ?? newOp()
  ops.set(k, use)
  const body: IdeaBody = { kind: 'idea', text, base: b, from_turn: turn, op: use }
  const done = await call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/strategy/items`, body)
  ops.delete(k)
  return done
}

/**
 * The words kept: Olumi's own, verbatim, from the reply's answer (its first paragraph, then further paragraphs while they fit, never cut
 * mid-sentence). A first paragraph over core's limit is taken sentence by sentence; null when not even its first sentence fits (nothing is kept
 * that Olumi did not say, and nothing is shortened by rewording).
 */
export function ideaTextOf(answer: NonNullable<ViewTurn['answer']>): string | null {
  const whole = answer.answer.flatMap((p) => ('text' in p ? [p.text] : [])).join('')
  const paragraphs = whole.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter((p) => p !== '')
  if (paragraphs.length === 0) return null
  let out = ''
  for (const p of paragraphs) {
    const next = out === '' ? p : `${out} ${p}`
    if ([...next].length > IDEA_MAX) break
    out = next
  }
  if (out !== '') return out
  const sentences = paragraphs[0]!.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? []
  for (const s of sentences) {
    const next = out === '' ? s.trim() : `${out} ${s.trim()}`
    if ([...next].length > IDEA_MAX) break
    out = next
  }
  return out === '' ? null : out
}
