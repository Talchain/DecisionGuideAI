/**
 * V12 "My whole view, in words": the optional `frame` a member can add to a private view (core scope z2 §3, additive on
 * `POST /api/scenarios/:sid/views`): the question as they see it, their aim or measure, up to 5 options and up to 5 links, each in their own
 * words. Core stores it on the same private row and reveals it with the view; core also owns every refusal and every heading.
 *
 * This module only (1) reads `frame` / `frame_words` off a View's `collab.mine[]` / `collab.shared[]` exactly as core gives them (an older core
 * sends neither, and nothing is drawn), (2) builds the request, and (3) applies the caps core states so a person is not sent away for a count
 * they could not see. The caps are core's numbers; core still refuses what it refuses and its words are drawn as they come.
 */
import { call } from '../../../olumiCore/team/api'

/** The caps core states (`frame_words.limits`, API v1.41); these numbers are only the fallback for a View that carries none. */
export interface FrameLimits { readonly question: number; readonly aim: number; readonly option: number; readonly options: number; readonly link_words: number; readonly links: number }
export const FRAME_LIMITS: FrameLimits = { question: 300, aim: 300, option: 120, options: 5, link_words: 200, links: 5 }

export interface FrameLink { readonly from_label: string; readonly to_label: string; readonly words: string }
export interface ViewFrame { readonly question?: string | null; readonly aim?: string | null; readonly options?: readonly string[]; readonly links?: readonly FrameLink[] }
/** Core's headings for the frame's parts (`frame_words`), by part; any it does not send fall back to chrome labels below. */
export type FrameWords = Readonly<Partial<Record<'question' | 'aim' | 'options' | 'links' | 'heading' | 'not_expressed' | 'note', string>>>

/** Core's `collab.frame_words` (v1.41): sent only when the viewer is not alone, and only by a core that reads a frame. A View without it
 *  does not take a frame, so none is offered (a frame sent to such a core would be dropped without a word). */
export function frameSupport(view: { collab?: unknown }): { words: FrameWords; limits: FrameLimits } | null {
  const w = (view.collab as { frame_words?: unknown } | null | undefined)?.frame_words
  if (w === null || w === undefined || typeof w !== 'object') return null
  const l = (w as { limits?: unknown }).limits as Record<string, unknown> | null | undefined
  if (l === null || l === undefined || typeof l !== 'object') return null
  const n = (k: keyof FrameLimits): number => (typeof l[k] === 'number' && (l[k] as number) > 0 ? (l[k] as number) : FRAME_LIMITS[k])
  return { words: frameWordsOf({ frame_words: w }), limits: { question: n('question'), aim: n('aim'), option: n('option'), options: n('options'), link_words: n('link_words'), links: n('links') } }
}

const isStr = (x: unknown): x is string => typeof x === 'string'

/** The frame core sent with this view, or null when it sent none or one of another shape (never half-drawn). */
export function frameOf(v: unknown): ViewFrame | null {
  const f = (v as { frame?: unknown } | null)?.frame
  if (f === null || f === undefined || typeof f !== 'object') return null
  const o = f as Record<string, unknown>
  if (o['question'] != null && !isStr(o['question'])) return null
  if (o['aim'] != null && !isStr(o['aim'])) return null
  if (o['options'] != null && !(Array.isArray(o['options']) && o['options'].every(isStr))) return null
  if (o['links'] != null && !(Array.isArray(o['links']) && o['links'].every((l) => l !== null && typeof l === 'object' && isStr((l as FrameLink).from_label) && isStr((l as FrameLink).to_label) && isStr((l as FrameLink).words)))) return null
  return f as ViewFrame
}
export const frameIsEmpty = (f: ViewFrame | null): boolean =>
  f === null || ((f.question ?? '') === '' && (f.aim ?? '') === '' && (f.options ?? []).length === 0 && (f.links ?? []).length === 0)

/** Core's `frame_words` for this view: only string values are kept. */
export function frameWordsOf(v: unknown): FrameWords {
  const w = (v as { frame_words?: unknown } | null)?.frame_words
  if (w === null || w === undefined || typeof w !== 'object') return {}
  const out: Record<string, string> = {}
  for (const k of ['question', 'aim', 'options', 'links', 'heading', 'not_expressed', 'note'] as const) { const s = (w as Record<string, unknown>)[k]; if (isStr(s) && s !== '') out[k] = s }
  return out
}

/** Chrome labels for the entry's fields, used only where core sent no heading. They name the form's boxes, never the scenario. */
export const FRAME_LABELS = { question: 'The question as you see it', aim: 'What you are aiming for', options: 'Options', links: 'Links' } as const

export interface FrameDraft { question: string; aim: string; options: string[]; links: Array<{ from_label: string; to_label: string; words: string }> }
export const EMPTY_FRAME: FrameDraft = { question: '', aim: '', options: [], links: [] }

/** The request's `frame`: trimmed, empty parts left out (silence is "not expressed": nothing is written for it), caps applied; null if nothing is said. */
export function frameBody(d: FrameDraft, lim: FrameLimits = FRAME_LIMITS): ViewFrame | null {
  const t = (s: string, n: number) => s.trim().slice(0, n)
  const question = t(d.question, lim.question), aim = t(d.aim, lim.aim)
  const options = d.options.map((o) => t(o, lim.option)).filter((o) => o !== '').slice(0, lim.options)
  const links = d.links.map((l) => ({ from_label: l.from_label.trim(), to_label: l.to_label.trim(), words: t(l.words, lim.link_words) }))
    .filter((l) => l.from_label !== '' && l.to_label !== '' && l.words !== '').slice(0, lim.links)
  const f: ViewFrame = { ...(question ? { question } : {}), ...(aim ? { aim } : {}), ...(options.length ? { options } : {}), ...(links.length ? { links } : {}) }
  return frameIsEmpty(f) ? null : f
}

/** `POST …/views` with the additive frame: needs the current version (core refuses a stale one in its own words). The op makes a retry safe. */
export const giveFrameView = (sid: string, text: string, version: number, frame: ViewFrame, op: string | null) =>
  call<{ contribution: number }>('POST', `/api/scenarios/${encodeURIComponent(sid)}/views`, { text, version, frame, ...(op == null ? {} : { op }) })
