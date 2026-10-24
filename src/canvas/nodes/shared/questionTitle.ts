import { displayLabelText } from '../../domain/elementLabel'

/**
 * The card's title is the question itself. CEE labels the node "Decision: <question>" (`path-b/living-model/mapper.ts`),
 * and saved models keep that label, but Olumi is a reasoning partner: the word "Decision" is only for the person's own
 * act of choosing (CLAUDE.md §3 vocabulary, Paul 22 Oct). The saved label is unchanged, and CEE keeps minting it (the
 * label is part of the persisted identity hash, core-route on #3657), so this is the fix, not a stopgap.
 * Shared by the question card and every surface that names it (the hover card), so no channel keeps the prefix.
 */
export function questionTitle(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined
  const title = displayLabelText(label)
  return title !== label.trim() ? title : undefined
}
