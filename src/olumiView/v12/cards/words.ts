/**
 * Which of core's words a V12 card face draws where. Core's words only, picked by field or by core's own line shape; nothing here writes,
 * formats or rounds a word.
 */
import type { ViewCard } from '../../client'

type Headline = NonNullable<ViewCard['headline']>

/** The field of core's that says why a chance is withheld (`headline.state` none): `why`, else `title`, else `text`; null for a chance or a
 *  fixed result. Picked by field, never by comparing words. */
export function withheldField(h: Headline): 'why' | 'title' | 'text' | null {
  if (h.state !== 'none') return null
  return (h.why ?? '') !== '' ? 'why' : h.title !== '' ? 'title' : 'text'
}
/** Core's words for a withheld chance: that field's words (withheldField); null for a chance or a fixed result. */
export function withheldWords(h: Headline): string | null {
  const f = withheldField(h)
  return f === null ? null : f === 'why' ? h.why! : h[f]
}

/**
 * Core makes a chance line in one place (core src/view/run-lines.ts chanceFace): `${bare} chance`, then its clauses, each after ", ". The
 * words up to the first clause are the number's own; the rest is the qualifier, drawn as its own line. A line not in that shape is whole.
 */
export function chanceParts(text: string): { head: string; qualifier: string | null } {
  const cut = text.indexOf(', ')
  return cut > 0 && text.slice(0, cut).endsWith(' chance') ? { head: text.slice(0, cut), qualifier: text.slice(cut + 2) } : { head: text, qualifier: null }
}

/** The chance row for the headline's own aim, where the option has a chance. Bound by the aim's id. */
export function headlineChanceRow(card: ViewCard): Extract<ViewCard['rows'][number], { kind: 'chance' }> | null {
  const h = card.headline
  if (card.family !== 'option' || h == null || h.state !== 'chance') return null
  for (const r of card.rows) if (r.kind === 'chance' && r.aim_id === h.aim_id) return r
  return null
}

/** Core's words for a figure that has no value yet ("not sized yet · …", "not given yet · …"): its `figure.title`; null where the card has a
 *  value, no figure, or core sends no words for the gap. */
export function unsizedWords(card: ViewCard): string | null {
  const f = card.figure
  return f != null && f.text === '' && f.title !== '' ? f.title : null
}
