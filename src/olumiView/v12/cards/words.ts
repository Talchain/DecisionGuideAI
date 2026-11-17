/**
 * Which of core's words a V12 card face draws where. Core's words only, picked by field or by core's own line shape; nothing here writes,
 * formats or rounds a word.
 */
import type { ViewCard, ViewModel } from '../../client'

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
 * R6 (Paul, 16 Nov): an option with no chance says what is missing in ONE quiet line, core's own words: its next step (`headline.add`) where it
 * sends one, else its headline's text. Core's long reason (`why`, else the `title` every option shares) and the next step are the card's hover,
 * never a "?", a "Why not" or an empty track at rest. Unknown is never drawn as zero; no sentence is cut.
 */
export function noChanceLineOf(h: Headline): { line: string; hover: string } {
  const hover = [withheldField(h) === 'text' ? null : withheldWords(h), h.add].filter((x) => x != null && x !== '').join('\n')
  return { line: h.add != null && h.add !== '' ? h.add : h.text, hover: hover !== '' ? hover : h.title !== '' ? h.title : h.text }
}

/**
 * The reason every option shares, said ONCE on the aim card (DL, 17 Nov): where every option waits (`run.all_withheld`), the options that head aim
 * `aimId` with no chance, core's shared headline (`headline.shared`) and no step of their own (`headline.add`) say nothing each; the aim card says
 * their headline. Null unless every such option's words agree, so one line never speaks for options that differ. Read by field, never by words.
 */
export function sharedNoChanceOf(model: ViewModel | null, aimId: string | null | undefined): Headline | null {
  if (model === null || aimId == null || model.run?.all_withheld !== true || !model.cards.some((c) => c.id === aimId)) return null
  const heads = model.cards.flatMap((c) => (c.family === 'option' && c.headline != null && c.headline.aim_id === aimId ? [c.headline] : []))
  const shared = heads.filter((h) => h.state === 'none' && h.shared === true && (h.add ?? '') === '')
  return shared.length > 0 && shared.length === heads.length && shared.every((h) => h.text === shared[0]!.text) ? shared[0]! : null
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

/**
 * Core's gap words once: a line of clauses joined by " · " ("not sized yet · Not sized yet.") says the same clause twice where core's two strings agree.
 * Display only: a clause is dropped when it equals the one before it ignoring case and a closing full stop; no word is changed or reordered. The whole
 * string stays the hover.
 */
export function onceWords(words: string): string {
  const same = (a: string, b: string): boolean => a.replace(/\.$/, '').trim().toLowerCase() === b.replace(/\.$/, '').trim().toLowerCase()
  const parts = words.split(' · ')
  return parts.filter((p, i) => i === 0 || !same(p, parts[i - 1]!)).join(' · ')
}
