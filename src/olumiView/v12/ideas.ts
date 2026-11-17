/**
 * "Keep as an idea" (V12, proposal 005 v2, Create): an Olumi method reply kept as an `idea` item on the scenario's strategy, still Olumi's.
 * One write to core `POST /api/scenarios/:sid/strategy/items { kind: 'idea', text, base, from_turn, op }` (API.md v1.42). `from_turn` is the reply's turn id (`chat[].id`); core then records the
 * item's origin as Olumi's, the reply as its source and the person as the keeper: three separate things, none written here. A refusal is core's own
 * words (TeamApiError.message). The same press after a dropped connection reuses its op, so core keeps it once.
 */
import { call, newOp } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import type { View, ViewTurn } from '../client'
import { sessionOf } from '../layout'
import { floorOf } from '../early'

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
export const PAST_VERSION = 'You are looking at an earlier version. Go back to the current one to keep this.'
/**
 * With no saved model to keep against (the first proposal still pending, or none), the idea is retained on the scenario instead, never in the
 * model and never approving anything: core `POST /api/scenarios/:sid/kept { turn, text }` (Codex root, 16 Nov 12:23:29Z). Core resolves Olumi
 * as the author and this person as the keeper, and the same person's repeat press writes nothing, so no op is sent.
 */
export async function keepIdea({ sid, turn, text, base, op, floor = false }: { sid: string; turn: number; text: string; base?: number | null; op?: string; /** `turn` is a floor reply's job (words-start CONTRACT 4): always retained on the scenario, `{ floor, text }`. */ floor?: boolean }): Promise<unknown> {
  if (base === undefined && useViewStore.getState().at !== null) throw new Error(PAST_VERSION)
  if (floor) return call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/kept`, { floor: turn, text })
  const b = base === undefined ? ideaBaseOf(useViewStore.getState().view) : base
  if (b === null) return call<unknown>('POST', `/api/scenarios/${encodeURIComponent(sid)}/kept`, { turn, text })
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

type Parts = NonNullable<ViewTurn['answer']>['answer']

/**
 * The approaches core's reply separates itself: its own list lines ("- ", the same lines the reply draws as bullets), only where there are two
 * or more of them, so one line is never offered as "an approach" of a reply that holds a single one. Each is its words verbatim (marker dropped),
 * and only a line that is plain words (no cite inside it) and fits core's limit can be kept: core accepts only text that is in the reply. Prose
 * is never split here. Returns the keepable ones, in the reply's order; none when the reply does not separate them.
 */
export const approachOf = (pieces: ReadonlyArray<{ text: string } | { cite: string }>): string | null => {
  if (pieces.some((p) => 'cite' in p)) return null
  const words = pieces.map((p) => ('text' in p ? p.text : '')).join('').replace(/^\s*- /, '').replace(/\s+/g, ' ').trim()
  return words === '' || [...words].length > IDEA_MAX ? null : words
}
export function approachesOf(parts: Parts): string[] {
  const lines: Array<Array<{ text: string } | { cite: string }>> = [[]]
  for (const p of parts) {
    if ('cite' in p) { lines[lines.length - 1]!.push(p); continue }
    p.text.split('\n').forEach((s, k) => { if (k > 0) lines.push([]); if (s !== '') lines[lines.length - 1]!.push({ text: s }) })
  }
  const items = lines.filter((l) => { const f = l[0]; return f !== undefined && 'text' in f && /^\s*- /.test(f.text) })
  if (items.length < 2) return []
  return items.flatMap((l) => { const w = approachOf(l); return w === null ? [] : [w] })
}

/**
 * Words-start CONTRACT 4 (Codex root 04:41:16Z): the entry core offers for one drawn line of a floor reply (`floor[].prose`: each line of Olumi's
 * prose, its list or number marker dropped, whitespace squashed). The drawn line is the entry itself, or the entry after one short token with no
 * letter in it (whatever marker core dropped: "-", "•", "1.", "2)"), so no marker list is kept here. Null when the line is not one of core's entries.
 */
export function floorEntryOf(entries: readonly string[], line: string): string | null {
  const w = line.replace(/\s+/g, ' ').trim()
  return entries.find((e) => w === e || (w.endsWith(` ${e}`) && /^[^\p{L}\s]{1,4}$/u.test(w.slice(0, w.length - e.length - 1)))) ?? null
}

/** An idea the scenario holds (View `strategy.items[kind='idea']`: Olumi's idea, the reply it came from, the person who kept it). */
export type KeptIdea = { id: string; text: string; olumis: boolean; sourceTurn: string | null; keptBy: { id: string; name: string } | null; /** Kept from a floor reply (View `kept[].from: "floor"`, words-start CONTRACT 5): `sourceTurn` is that reply's `floor[].job`, not a `chat[].id`. */ fromFloor?: true }

/**
 * The ideas kept on the scenario, read by shape (the vendored View types predate them): first the model's own idea items (core's order, none set
 * aside), then the ideas retained before any model was approved (View `kept[]`, oldest first), each once: a retained idea that is also a model
 * item (same words, same reply) is drawn as the model item.
 */
export function keptIdeasOf(view: View | null): KeptIdea[] {
  const items = strategyIdeasOf(view)
  const kept = (view as { kept?: unknown } | null)?.kept
  if (!Array.isArray(kept)) return items
  const retained = kept.flatMap((r: Record<string, unknown> | null): KeptIdea[] => {
    if (r === null || typeof r !== 'object' || typeof r['id'] !== 'number' || typeof r['text'] !== 'string' || typeof r['turn'] !== 'number') return []
    const k = r['kept_by'] as { id?: unknown; name?: unknown } | null | undefined
    const keptBy = k != null && typeof k.id === 'string' && typeof k.name === 'string' ? { id: k.id, name: k.name } : null
    return [{ id: `kept:${r['id']}`, text: r['text'], olumis: r['by'] === 'olumi', sourceTurn: String(r['turn']), keptBy, ...(r['from'] === 'floor' ? { fromFloor: true as const } : {}) }]
  })
  const seen = new Set(items.map((i) => `${i.sourceTurn}\u0000${i.text}`))
  return [...items, ...retained.filter((i) => { const key = `${i.sourceTurn}\u0000${i.text}`; if (seen.has(key)) return false; seen.add(key); return true })]
}
function strategyIdeasOf(view: View | null): KeptIdea[] {
  const items = (view as { strategy?: { items?: unknown } } | null)?.strategy?.items
  if (!Array.isArray(items)) return []
  return items.flatMap((i: Record<string, unknown> | null): KeptIdea[] => {
    if (i === null || typeof i !== 'object' || i['kind'] !== 'idea' || typeof i['id'] !== 'string' || typeof i['text'] !== 'string' || i['status'] === 'set_aside') return []
    const k = i['kept_by'] as { id?: unknown; name?: unknown } | null | undefined
    const keptBy = k != null && typeof k.id === 'string' && typeof k.name === 'string' ? { id: k.id, name: k.name } : null
    const t = i['source_turn']
    return [{ id: i['id'], text: i['text'], olumis: i['by_id'] === 'olumi', sourceTurn: typeof t === 'string' || typeof t === 'number' ? String(t) : null, keptBy }]
  })
}

/** Is this text, from this reply, already kept? (Matched by the reply it came from when core says which, else by its words.) */
export const isKept = (view: View | null, turn: number, text: string): boolean =>
  keptIdeasOf(view).some((i) => i.text === text && (i.sourceTurn === null || i.sourceTurn === String(turn)))

/** The core menu question a kept idea came from: the said words of the reply's turn, when they are one of core's own questions. */
export function ideaMethodOf(view: View, idea: KeptIdea): string | null {
  const said = ideaSourceSaidOf(view, idea)
  return said === null ? null : sessionOf(view)?.methods.find((m) => m.text === said)?.text ?? null
}
/** What the person said that the kept idea's reply answered, read where core says the idea came from (CONTRACT 5): the visible floor reply by its
 *  job when `from` is "floor", else the chat reply by its id; null when that reply is not in this person's View (or its words were erased). */
export function ideaSourceSaidOf(view: View, idea: KeptIdea): string | null {
  if (idea.sourceTurn === null) return null
  if (idea.fromFloor === true) return floorOf(view).find((f) => String(f.job) === idea.sourceTurn)?.said ?? null
  return view.chat.find((c) => String(c.id) === idea.sourceTurn)?.said ?? null
}

/**
 * Whether Keep is offered on Olumi's reply (Codex 008e #3): any reply with an answer, whatever the person typed. The View carries no marker for
 * "coached" or "host-only"; core keeps only what it can read in a reply and refuses the rest in its own words (shown as today), so the page
 * does not guess narrower than core: a guess that hid a Keep core supports would fail silently, one too wide fails with core's sentence.
 */
export const isCoachedReply = (t: ViewTurn): boolean => t.answer !== null

/** The questions the person can send about a kept idea: they carry its exact words, and go to the composer for the person to edit (never sent). */
export const developQuestionOf = (idea: Pick<KeptIdea, 'text'>): string => `How could I develop this idea? “${idea.text}”`
export const challengeQuestionOf = (idea: Pick<KeptIdea, 'text'>): string => `What would challenge this idea? “${idea.text}”`
