/**
 * winnerChipCopy — copy for the option card conversation chip.
 *
 * Brief 5.4 Phase 7: replaces hardcoded chip strings at render sites.
 *
 * ⭐ RUN-4 JUDGE, DL RULING (12 Oct; live/runs/2026-10-12T172858Z capacity step 3): the leading option's chip said "Why
 * did the most runs in this model support this?" (and, on a weak run, "What does this rest on in this model?" with the
 * same "most runs" question as its message). That is a leader claim from a win share; ruling A and the guiding principle
 * allow none, and CEE sends no such chip. The leading option's chip is removed and nothing replaces it: the label is
 * `null` and the card draws no chip. The tier-softened arm went with it, so this module no longer reads the confidence
 * tier or stability.
 *
 * Every other card keeps its forward-looking chip, and its label and message stay one question (the label and the text
 * that lands in the user's own transcript once came apart here; `winnerChipCopy.spec.ts` keeps them together).
 */

/**
 * Chip button label for the option card chat trigger, or `null` for the leading option on a turn where a leader is
 * designated (no chip is drawn).
 *
 * ROADMAP 1.223: on a withheld turn (`hasLeadingOption === false`) the leading option is not designated, so it keeps the
 * same forward-looking chip as every other option.
 */
export function winnerChipLabel(
  isWinner: boolean,
  hasLeadingOption?: boolean,
): string | null {
  if (isWinner && hasLeadingOption !== false) return null
  return 'What would make this better supported?'
}

/**
 * Full conversation prompt sent when the chip is clicked: the same question as the label, with the option named.
 */
export function winnerChipPrompt(label: string): string {
  return `What would make "${label}" better supported instead? What changes would be needed?`
}
