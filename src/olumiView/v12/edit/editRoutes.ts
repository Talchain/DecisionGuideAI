/**
 * V12 MANUAL EDITING: THE CORE ROUTES THE LANE HAD NO CALLER FOR (MANUAL-EDITING-MAP 16 Nov, headline 3), plus Undo and Redo.
 * Each is core's own route on this origin, no adapter, in `call`'s words for every refusal (src/olumiCore/team/api.ts). The existing
 * callers (`writes.rename`, `writes.addFigure`, `writes.edit`, `writes.removeLink`) stay in ../../client.ts and are reused as they are.
 *
 *   POST …/size             { base, record, typed, op }              a link's strength (the View's `links[].size.edit`)
 *   POST …/size             { base, record, chance?, change?, op }   a risk's chance and/or size (a risk card's `figure.edit`)
 *   POST …/strategy/items   { base, kind, text, concerns?, op }      a choice (an option), risk, claim, assumption or question
 *   POST …/undo             { base, undoes, op }                     core's undo of the person's own last saved edit (the delivery lead's contract,
 *                                                                    z1-undo-scope.md §4). `base` is the View's `model.edit_base`, `undoes` the version row id
 *                                                                    `model.undo.version` names, `op` a fresh idempotency key (the same on a re-send).
 *
 * ⚠ `…/undo` is being added to core tonight: it does not exist at core 1a88be48. One level only; there is no redo route in this slice.
 */
import { call } from '../../../olumiCore/team/api'
import type { View } from '../../client'

const at = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}`

export type Saved = { version: number; n: number; receipt: string }
/** What core answers a strategy item: a saved version, a question held on a figure's range (NOTHING saved), or a stance (not the model). */
export type ItemAnswer = Saved & { record: string } | { record: string; held: 'range' } | { stance: number }
export type ItemKind = 'choice' | 'risk' | 'claim' | 'assumption' | 'question'
export type RiskGiven = { readonly chance?: string; readonly change?: string }
export type UndoBody = { readonly base: number; readonly undoes: number; readonly op: string }

export const laneWrites = {
  /** A link's strength, as the person typed it: core reads it as it reads a figure, or refuses in the line's own `ask`. */
  sizeLink: (sid: string, base: number, record: string, typed: string, op: string) =>
    call<Saved>('POST', `${at(sid)}/size`, { base, record, typed, op }),
  /** A risk's chance and/or size, as typed: only the fields the person filled are sent. */
  sizeRisk: (sid: string, base: number, record: string, given: RiskGiven, op: string) =>
    call<Saved>('POST', `${at(sid)}/size`, { base, record, ...(given.chance === undefined ? {} : { chance: given.chance }), ...(given.change === undefined ? {} : { change: given.change }), op }),
  /** One item as the person's own edit. A `risk` needs a figure in `concerns` (core refuses it otherwise, in its own words). */
  addItem: (sid: string, base: number, item: { readonly kind: ItemKind; readonly text: string; readonly concerns?: readonly string[] }, op: string) =>
    call<ItemAnswer>('POST', `${at(sid)}/strategy/items`, { base, kind: item.kind, text: item.text, ...(item.concerns === undefined || item.concerns.length === 0 ? {} : { concerns: item.concerns }), op }),
  undo: (sid: string, body: UndoBody) => call<Saved>('POST', `${at(sid)}/undo`, body),
}

/** An answer that saved a version (a strategy question held on a range, or a stance, saved none). */
export const savedVersion = (a: unknown): a is Saved => a !== null && typeof a === 'object' && typeof (a as { n?: unknown }).n === 'number'

// ── What the View offers to undo (`model.undo`, additive; absent on a core before it) ─────────────────────────────────────
/** core's `model.undo`: `label` and `why_not` are core's words, drawn as given. `version` is the version row id to name as `undoes`. */
export type ViewUndo = { readonly available: boolean; readonly version: number | null; readonly n: number | null; readonly label: string | null; readonly why_not: string | null }
const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
/** `model.undo` as core serves it, read defensively: null when the View carries none (a core before it) or a shape that is not the contract's. */
export function viewUndoOf(view: View | null): ViewUndo | null {
  const u = (view?.model as { undo?: unknown } | null | undefined)?.undo as Record<string, unknown> | null | undefined
  if (u === null || u === undefined || typeof u !== 'object' || typeof u['available'] !== 'boolean') return null
  return { available: u['available'], version: num(u['version']), n: num(u['n']), label: str(u['label']), why_not: str(u['why_not']) }
}
