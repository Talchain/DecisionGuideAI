/**
 * Q1 readers (DL GO, 28 Oct 2026): A LINK IN WORDS, SAID IN WORDS.
 *
 * CEE puts `link_words` on a link no figure sizes: an influence link (direction up, down, unknown, conditional or
 * disputed; confidence likely, unsure or unknown; a basis or null) and an unsized risk's link (direction up, down or
 * unknown; no confidence and no basis recorded). The wire keeps `exists_probability: 1` and `direction_settled: false`
 * beside it, and neither is anybody's statement, so every reader that finds these words says them instead of a
 * percentage or "Its range runs both ways". Read from the saved graph (`savedModelProgram.programLinkWords`), never
 * inferred. Numerical links carry none and are unchanged.
 *
 * The direction words are the reading card's verbs (CEE `postimage.ts` INFLUENCE_WORDS: raises, lowers, in a direction
 * not known yet, depending on conditions, in a disputed direction), so the canvas and the card say one thing.
 */

export const LINK_WORD_DIRECTIONS = ['up', 'down', 'unknown', 'conditional', 'disputed'] as const
export const LINK_WORD_CONFIDENCES = ['likely', 'unsure', 'unknown'] as const
export type LinkWordDirection = (typeof LINK_WORD_DIRECTIONS)[number]
export type LinkWordConfidence = (typeof LINK_WORD_CONFIDENCES)[number]

export interface LinkWords {
  direction: LinkWordDirection
  /** Null: the record holds no confidence (an unsized risk's link). Never said as "not known". */
  confidence: LinkWordConfidence | null
  basis: string | null
}

/** The wire's `link_words`, exactly as the contract shapes it; anything else is not read (today's reading stands). */
export function readLinkWords(value: unknown): LinkWords | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const { direction, confidence, basis } = value as Record<string, unknown>
  if (!(LINK_WORD_DIRECTIONS as readonly unknown[]).includes(direction)) return null
  if (confidence !== null && !(LINK_WORD_CONFIDENCES as readonly unknown[]).includes(confidence)) return null
  if (basis !== null && typeof basis !== 'string') return null
  const said = typeof basis === 'string' && basis.trim() !== '' ? basis.trim() : null
  return { direction: direction as LinkWordDirection, confidence: confidence as LinkWordConfidence | null, basis: said }
}

/** The stated direction, as the hover's Direction row says it. */
export const LINK_DIRECTION_WORDS: Readonly<Record<LinkWordDirection, string>> = {
  up: 'Raises it',
  down: 'Lowers it',
  unknown: 'Not known yet',
  conditional: 'Depends on conditions',
  disputed: 'Disputed',
}

/** The stated confidence, as the connection rows and the inspector say it (DL G3: "not known", plain words). */
export const LINK_CONFIDENCE_WORDS: Readonly<Record<LinkWordConfidence, string>> = {
  likely: 'likely',
  unsure: 'unsure',
  unknown: 'not known',
}

/** The Strength row and the link's label: a link in words has no size. */
export const LINK_IN_WORDS_NOT_SIZED = 'In words, not sized'

/** The "?" glyph's accessible name for a link in words ("Effect direction: depends on conditions"). */
export function linkDirectionAriaLabel(direction: LinkWordDirection): string {
  return `Effect direction: ${LINK_DIRECTION_WORDS[direction].toLowerCase()}`
}

/** The hover's basis line. */
export function linkBasisSentence(basis: string): string {
  return `Basis: ${basis}`
}

/** The confidence word, or null when the record holds none. */
export function linkConfidenceWord(words: LinkWords): string | null {
  return words.confidence === null ? null : LINK_CONFIDENCE_WORDS[words.confidence]
}

/**
 * Where a surface would print a link's existence figure (the inspector's existence row, its technical detail, the Model
 * tab's Advanced tier): the stated confidence in words. A record with none (an unsized risk) says so, never "not known".
 */
export function linkExistenceSentence(words: LinkWords): string {
  const word = linkConfidenceWord(words)
  return word === null ? 'Not stated. No figure is set.' : `In words: ${word}. No figure is set.`
}

/** A goal or limit card whose outcome is not calculable: one muted line, in CEE's own words. */
export function withheldReasonLine(reason: string): string {
  return `Not calculated yet: ${reason}`
}
