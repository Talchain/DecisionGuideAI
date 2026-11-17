/**
 * Reply text, read as plain words with two light marks (V12 refinement spec §1): `**x**` is weight 500 with no asterisks, and a bare
 * http(s) address is a link in Olumi's blue. Nothing else is interpreted; every other character is drawn as it came, in order.
 * A link opens in a new tab and carries rel="noopener noreferrer". A bold span is never searched for links.
 */
import type { ReactNode } from 'react'

/** A line core opens with two to six hashes and a space is a lead-in (the reply contract keeps core's markers, 17 Nov): the hashes are layout,
 *  not words. One hash, or seven, is words, drawn as typed. The one rule for every reply surface: Blocks (stored replies, drawn as its own
 *  block) and, through this function, EarlyAnswer (the first answer while the model builds, and the model-less floor). */
export const LEAD_IN = /^#{2,6} /
/** A list line's mark, "- ": layout, not words. */
export const ITEM_MARK = /^\s*- /

const MARKS = /(\*\*[^*\n]+\*\*)|(https?:\/\/[^\s<>]+)/g
/** Sentence punctuation that follows an address but is not part of it. */
const TRAIL = /[.,;:!?)\]'"’”]+$/

export function richText(s: string): ReactNode[] {
  // A lead-in line reads as a quiet heading run (weight 500, the heading ink), its hashes dropped.
  if (LEAD_IN.test(s)) return [<strong key="lead-in" className="font-medium text-text-header" data-reply-lead-in="">{inline(s.replace(LEAD_IN, ''))}</strong>]
  return inline(s)
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  let at = 0, k = 0
  for (const m of s.matchAll(MARKS)) {
    const i = m.index ?? 0
    if (i > at) out.push(s.slice(at, i))
    if (m[1] !== undefined) {
      out.push(<strong key={k++} className="font-medium">{m[1].slice(2, -2)}</strong>)
      at = i + m[0].length
    } else {
      const url = m[2]!.replace(TRAIL, '')
      if (url === 'http://' || url === 'https://') { out.push(m[0]); at = i + m[0].length; continue }
      out.push(<a key={k++} href={url} target="_blank" rel="noopener noreferrer" className="break-words text-info hover:underline">{url}</a>)
      at = i + url.length
    }
  }
  if (at < s.length) out.push(s.slice(at))
  return out
}
