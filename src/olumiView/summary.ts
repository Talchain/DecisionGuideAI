/**
 * The Summary on olumi-core (core API v1.16, `GET /api/scenarios/:s/summary`, `olumi.summary/1`): one saved version's reasoning artefact,
 * built by core from the View's facts and the stored words, with no AI call. Core also serves it as a document (`blocks`), which the page
 * draws verbatim, and as two exports from the same blocks: Markdown (`format=md`, a download) and a print-ready page (`format=html`, which
 * the browser prints to PDF). Nothing here words, orders or formats anything: the three say the same words because core wrote them once.
 */
import { call, TeamApiError } from '../olumiCore/team/api'
import { NOT_FOR_THIS_PAGE, useMe } from '../olumiCore/me'

export const SUMMARY_SCHEMA = 'olumi.summary/1'
/** Core answered in a shape this page was not built for: said, never drawn as if it were this one. */
export const SUMMARY_SHAPE_CHANGED = 'Olumi has been updated since this page loaded. Reload the page to see the Summary.'
/** A core that answers a version's Summary with another version: said, never drawn as that version. */
export const SUMMARY_VERSION_NOT_SERVED = 'Olumi cannot show the Summary of that version yet.'

export type SummaryMark = { readonly glyph: string; readonly title: string }
/** One piece of a block's words: `strong` drawn bold, `href` a link, `mark` the glyph after it with its hover. */
export type SummaryPart = { readonly text: string; readonly strong: boolean; readonly href: string | null; readonly mark: SummaryMark | null }
export type SummaryBlock = { readonly tag: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'meta'; readonly parts: readonly SummaryPart[] }
/** The fields this page reads; the rest of `olumi.summary/1` (the facts by record id) is core's, for other readers. */
export type Summary = {
  readonly schema: typeof SUMMARY_SCHEMA
  readonly scenario: string
  readonly title: string
  readonly version: { readonly id: number; readonly n: number; readonly at: string; readonly by: string } | null
  readonly headings: Readonly<Record<string, string>>
  readonly blocks: readonly SummaryBlock[]
}

export type SummaryFormat = 'json' | 'md' | 'html'
/** `at`: one saved version's Summary (as `view?at=n`); null: the latest saved version. */
export function summaryPath(sid: string, at: number | null = null, format: SummaryFormat = 'json'): string {
  const q = new URLSearchParams()
  if (at !== null) q.set('at', String(at))
  if (format !== 'json') q.set('format', format)
  const s = q.toString()
  return `/api/scenarios/${encodeURIComponent(sid)}/summary${s === '' ? '' : `?${s}`}`
}

/**
 * The read is bound to the person the page was opened for (`person`, taken when the read is asked for: `me.ts`). A Summary carries no reader
 * (it is the same for every member), so once it is answered core is asked whose private link this browser holds now, and a read answered
 * after another link was opened here is dropped in the person's words (NOT_FOR_THIS_PAGE), never drawn (Codex, integrated review 7 Nov).
 * While the page cannot say who it is for (no person read yet), the read stands, as `isForThisPage` lets a View stand.
 */
export async function readSummary(sid: string, at: number | null = null, person: string | null = useMe.getState().me?.id ?? null): Promise<Summary> {
  const s = await call<{ schema?: unknown; version?: { n?: unknown } | null; blocks?: unknown }>('GET', summaryPath(sid, at))
  if (s === null || typeof s !== 'object' || s.schema !== SUMMARY_SCHEMA || !Array.isArray(s.blocks)) throw new TeamApiError(0, SUMMARY_SHAPE_CHANGED)
  if (at !== null && s.version?.n !== at) throw new TeamApiError(0, SUMMARY_VERSION_NOT_SERVED)
  if (person !== null) {
    const now = await call<{ me?: { id?: unknown } | null }>('GET', '/api/me')
    if ((typeof now?.me?.id === 'string' ? now.me.id : null) !== person) throw new TeamApiError(409, NOT_FOR_THIS_PAGE)
  }
  return s as Summary
}

/** Consecutive list items drawn as one list, every other block on its own: grouping for layout, the blocks' order and words unchanged. */
export function summaryGroups(blocks: readonly SummaryBlock[]): { readonly first: number; readonly blocks: readonly SummaryBlock[]; readonly list: boolean }[] {
  const out: { first: number; blocks: SummaryBlock[]; list: boolean }[] = []
  blocks.forEach((b, i) => {
    const last = out[out.length - 1]
    if (b.tag === 'li' && last !== undefined && last.list) last.blocks.push(b)
    else out.push({ first: i, blocks: [b], list: b.tag === 'li' })
  })
  return out
}
