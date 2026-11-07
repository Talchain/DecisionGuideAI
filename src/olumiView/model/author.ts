/**
 * WHO STATED A CARD'S FIGURE, WHEN CORE SAYS SO. PENDING CORE FIELD (requested of the DL, 7 Nov ~15:2xZ):
 * `cards[].author: { by: 'person' | 'brief' | 'olumi' | 'mixed', text, title } | null`. Today core serves only Olumi's marks (◆, ◐ on
 * `cards[].olumi`): a person's or the brief's figure carries none (core `src/view/view.ts:229`, where `markOf` is '' for 'theirs'), and
 * `model.key` has no entry for them, so until the field lands this reads null and the tab draws Olumi's mark alone, as core does.
 *
 * Read defensively: the View's generated type does not hold the field yet, and a shape other than the one asked for reads as absent (an
 * authorship the page cannot read is drawn as nothing, never guessed). The words are core's; the page picks only the icon.
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
