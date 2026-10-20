/**
 * The comparison's headline in goal-chance terms (Paul, 20 Oct 2026; DL rulings 6 and 20 Oct): what CEE's goal-chance
 * licence says about THIS run (`claim`), with the named option's own chance on each side of the pair, in the chance gate's
 * words. It names an option only where CEE names it; it never says "still" or "changed" (no earlier goal-chance claim is
 * carried), never computes a difference, and never says best, winner or recommend. `null` = CEE makes no goal-chance
 * claim, and the caller keeps its existing headline.
 */
import type { PairChanceFigures, PairChanceRow } from '../runView/runView'

function listOf(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function movedWords(row: PairChanceRow | undefined): string {
  if (row?.earlier && row.now) return `: ${row.earlier.words} on the earlier run, ${row.now.words} on this run`
  if (row?.now) return ` (${row.now.words} on this run)`
  return ''
}

export function goalChanceHeadline(figures: PairChanceFigures, label: (id: string) => string | null): string | null {
  const { claim, rows } = figures
  if (claim === null) return null
  const name = (id: string): string => label(id) ?? 'An option'
  switch (claim.kind) {
    case 'highest':
      return `In this model, ${name(claim.optionId)} is the most likely to meet your goal${movedWords(rows.find(r => r.optionId === claim.optionId))}`
    case 'highest_all_likely_to_miss':
      return `In this model, every option is likely to miss your goal; ${name(claim.optionId)} has the highest chance${movedWords(rows.find(r => r.optionId === claim.optionId))}`
    case 'similar':
      return `In this model, ${listOf(claim.optionIds.map(name))} have similar chances of meeting your goal`
    case 'all_likely_to_miss':
      return 'In this model, every option is likely to miss your goal'
  }
}
