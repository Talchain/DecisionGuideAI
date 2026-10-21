/**
 * The comparison's headline in goal-chance terms (Paul, 20 Oct 2026; DL rulings 6, 20 and 21 Oct): the fixed ruled words for
 * CEE's highest-form claim (`claim`, bound to the licence's `leader_option_id`), with the named option's own chance on each
 * side of the pair in the chance gate's words. Any other form has no UI sentence (DL 12 Oct: a label beside a chance is
 * CEE's words or none). It never says "still" or "changed", never computes a difference, and never says best, winner or
 * recommend. `null` = no ruled claim, and the caller keeps its existing headline.
 */
import type { PairChanceFigures, PairChanceRow } from '../runView/runView'

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
  }
}
