/**
 * Core's link chips (`collab.link_marks`, API v1.30): which mark a line draws and what its hover says. Ported from noA's LinkMarks
 * (347604a7, 65d43a31) onto V11's chip (LinkMarkChip.tsx), whose look stays V11's:
 * - one chip per link: core's first mark for a link (a mark without words, or without its link, is never drawn), on the first line that
 *   holds that link;
 * - one link is the same record and the same part, whether core says no part as null or '';
 * - the hover is core's strings, each whole, in this order: each holder's stance (`title`), what the model cannot calculate (`status_text`),
 *   Olumi's reading where core gives one, and the chip's one closing question (`question`). Nothing is composed here.
 */
import type { View } from './client'

export type LinkMark = NonNullable<View['collab']['link_marks']>[number]
type LinkRef = { readonly record: string; readonly part: string | null }

const said = (x: unknown): x is string => typeof x === 'string' && x !== ''
export const sameLink = (a: LinkRef | null | undefined, b: LinkRef): boolean => a != null && a.record === b.record && (a.part || null) === (b.part || null)
const drawable = (m: LinkMark | null | undefined): m is LinkMark => m != null && said(m.text) && m.link != null && said(m.link.record) && Array.isArray(m.stances)

/** Core's first drawable mark for this link (on its line, or off it), or null. */
export function markFor(view: View | null, link: LinkRef | null | undefined, line: boolean): LinkMark | null {
  if (view === null || link == null) return null
  return view.collab.link_marks?.find((m) => drawable(m) && m.line === line && sameLink(link, m.link)) ?? null
}

/** The mark line `i` draws: core's line mark for the link it holds, only on the first line that holds that link (`i` null: any line). */
export function lineMarkAt(view: View | null, i: number | null, holds: LinkRef | null | undefined): LinkMark | null {
  const m = markFor(view, holds, true)
  if (m === null || i === null) return m
  const first = (view?.model?.links ?? []).findIndex((l) => sameLink(l.holds, m.link))
  return first === -1 || first === i ? m : null
}

/** The chip's hover: core's strings, each whole, one per line. */
export function markHover(m: LinkMark): string {
  const x = m as LinkMark & { status_text?: unknown; question?: unknown; reading?: { text?: unknown; note?: unknown } | null }
  const parts: string[] = []
  if (said(x.title)) parts.push(x.title)
  if (said(x.status_text)) parts.push(x.status_text)
  if (x.reading != null && said(x.reading.text)) { parts.push(x.reading.text); if (said(x.reading.note)) parts.push(x.reading.note) }
  if (said(x.question)) parts.push(x.question)
  return parts.join('\n')
}
