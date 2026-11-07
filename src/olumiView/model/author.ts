/**
 * WHO STATED A CARD, IN CORE'S WORDS: olumi.view/3 `cards[].author { by: 'person' | 'brief' | 'olumi' | 'mixed', text, title } | null`
 * (core `src/view/author.ts`, the one producer of authorship words; served on core wip/summary a62f0899, 7 Nov, not yet in candidate).
 * A person's card ("The team’s figure", "Priya’s figure", "Stated by the team") and, once core records the split, the brief's carry an
 * icon whose name is core's `text` and whose hover is `text` then `title` (the quote and party), both verbatim. Olumi's (◆) and partly
 * Olumi's (◐) stay core's own mark on `cards[].olumi`, whose hover is the same `title`, so they are drawn once. null is the model's
 * structure, which no one authored: nothing is drawn.
 *
 * Read defensively: DGAI's vendored View type does not hold the field until its schema is re-vendored, a View built before core served it
 * omits it, and any other shape reads as absent (an authorship the page cannot read is drawn as nothing, never guessed).
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
