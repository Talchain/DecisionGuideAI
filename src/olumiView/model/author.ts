/**
 * WHO STATED A CARD'S FIGURE, WHEN CORE SAYS SO. CORE'S FIELD (served since core 6192ad6b; in the View's generated types):
 * `cards[].author: { by: 'person' | 'brief' | 'olumi' | 'mixed', text, title } | null`. Olumi's own are marked ◆, ◐ on
 * `cards[].olumi`): a person's or the brief's figure carries none, and `model.key` has no entry for them, so the tab draws this icon for them.
 *
 * Read defensively: a shape other than core's reads as absent (an authorship the page cannot read is drawn as nothing, never guessed). The words are core's; the page picks only the icon.
 */
import type { ViewCard } from '../client'

export type CardAuthor = { by: 'person' | 'brief'; text: string; title: string }

export function authorOf(card: ViewCard): CardAuthor | null {
  const a = (card as unknown as { author?: unknown }).author
  if (typeof a !== 'object' || a === null) return null
  const { by, text, title } = a as Record<string, unknown>
  // Olumi's own (and partly Olumi's) stay core's ◆/◐ on `cards[].olumi`, drawn once.
  if ((by !== 'person' && by !== 'brief') || typeof text !== 'string' || text === '' || typeof title !== 'string') return null
  return { by, text, title }
}

/** Every kind core says (person, brief, olumi, mixed), for the row's detail, which names whose a card is in core's words whatever the
 *  kind; the row itself draws Olumi's as core's ◆/◐ (`authorOf` above). Any other shape reads as absent. */
export type CardAuthorAny = { by: 'person' | 'brief' | 'olumi' | 'mixed'; text: string; title: string }
export function authorAnyOf(card: ViewCard): CardAuthorAny | null {
  const a = (card as unknown as { author?: unknown }).author
  if (typeof a !== 'object' || a === null) return null
  const { by, text, title } = a as Record<string, unknown>
  if ((by !== 'person' && by !== 'brief' && by !== 'olumi' && by !== 'mixed') || typeof text !== 'string' || text === '' || typeof title !== 'string') return null
  return { by, text, title }
}
