/**
 * ⭐ THE CARD'S TITLE TEXT — the words the producer cut, recovered, and a
 * lower-case first word raised (Paul's staging test, 28 Sep 2026, debug export
 * `olumi-debug-64c5eccc`). DISPLAY ONLY: the node's `label` is never written.
 *
 * SERVED: the Question's label was "Help me decide whether to hire…" and the
 * Goal's "ability to focus on high-value…" — the producer shortened the label
 * STRING itself and kept the full text in the node's `description` ("Help me
 * decide whether to hire a personal assistant or use an AI assistant to save
 * money.", "ability to focus on high-value tasks"). The anchor cards are wide
 * and printed the cut label with room to spare.
 *
 * ── THE RULE, AND WHY IT IS THIS NARROW ────────────────────────────────────
 * The description is used ONLY when it provably is the text the label was cut
 * from: the label ends in "…" or "..." AND the description's first line starts
 * with the label's text before that ellipsis. A description that says anything
 * else is the node's description, not its name, and the label stays. A label
 * that is not cut is never replaced, however the description reads.
 *
 * A recovered title is capped at `RECOVERED_TITLE_MAX_CHARS`, cut at a whole
 * word and marked "…": the reading rung does not clamp a title (BaseNode, v3.1
 * WS1 #2), so a paragraph-long description must not become a paragraph-tall
 * card. 140 characters is the served Question (89) with room for a second
 * clause, and still far more than the producer's ~30-character cut.
 *
 * ── THE FIRST LETTER ───────────────────────────────────────────────────────
 * A title whose first word is all lower-case ("ability …") gets an upper-case
 * first letter. A first word that carries a capital anywhere ("iPhone", "eBay")
 * is a spelling, and is left exactly as written.
 */

const PRODUCER_CUT = /(?:…|\.\.\.)\s*$/

/** The longest recovered title the card will show before cutting it at a word. */
export const RECOVERED_TITLE_MAX_CHARS = 140

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * The label, or — when the producer cut it and the description's first line
 * is the text it was cut from — that first line.
 */
export function recoverProducerCutTitle(label: string, description: string | null | undefined): string {
  if (!PRODUCER_CUT.test(label)) return label
  const stem = collapse(label.replace(PRODUCER_CUT, ''))
  if (stem.length === 0 || typeof description !== 'string') return label
  const firstLine = collapse(description.split(/\r?\n/)[0] ?? '')
  if (firstLine.length <= stem.length || !firstLine.startsWith(stem)) return label
  if (firstLine.length <= RECOVERED_TITLE_MAX_CHARS) return firstLine
  const head = firstLine.slice(0, RECOVERED_TITLE_MAX_CHARS)
  const lastSpace = head.lastIndexOf(' ')
  // Never cut back inside the producer's own stem — it is the part we KNOW.
  const cut = lastSpace > stem.length ? head.slice(0, lastSpace) : head
  return `${cut.replace(/[\s,;:.–—-]+$/, '')}…`
}

/** An all-lower-case first word gets an upper-case first letter; any other text is returned as is. */
export function titleCaseFirstWord(text: string): string {
  const firstWord = text.split(/\s/, 1)[0] ?? ''
  if (!/^\p{Ll}/u.test(firstWord) || /\p{Lu}/u.test(firstWord)) return text
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** The text a node card shows as its title: the cut recovered, then the first word raised. */
export function nodeCardTitle(label: string, description: string | null | undefined): string {
  return titleCaseFirstWord(recoverProducerCutTitle(label, description))
}
