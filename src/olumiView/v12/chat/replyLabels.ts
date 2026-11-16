/**
 * A first draft's reply holds two lines core writes itself: the label over the first answer and the heading over Olumi's check against the
 * model. Core sends both words on the turn (`answer.first_answer: { label, heading | null }`, olumi-core view/session.ts withMove), so the
 * reply panel draws exactly those whole paragraphs apart from the prose: the label as a quiet caption, the heading as a block heading. The UI
 * holds no copy of either; a reply without `first_answer` has no such lines, whatever its words.
 * Additive on olumi.view/3 and not yet in the generated types, so it is read here, defensively.
 */
export type FirstAnswerLines = { label: string; heading: string | null }
export type ReplyLine = 'label' | 'heading' | null

/** Core's two lines for this reply, or null where the turn carries none (any reply but a first draft's, or an older core). */
export const firstAnswerOf = (answer: unknown): FirstAnswerLines | null => {
  const fa = (answer as { first_answer?: unknown } | null)?.first_answer as { label?: unknown; heading?: unknown } | undefined
  if (fa == null || typeof fa.label !== 'string' || fa.label === '') return null
  return { label: fa.label, heading: typeof fa.heading === 'string' && fa.heading !== '' ? fa.heading : null }
}

/** Which of core's lines a whole paragraph is, by core's own words for this reply; null for every paragraph when core sent none. */
export const replyLineOf = (paragraph: string, lines: FirstAnswerLines | null): ReplyLine =>
  lines === null ? null : paragraph.trim() === lines.label ? 'label' : lines.heading !== null && paragraph.trim() === lines.heading ? 'heading' : null
