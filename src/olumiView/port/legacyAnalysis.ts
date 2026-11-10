/**
 * Stream A3's local map from olumi.view/3 to what the previous product's Analysis components read (UI recovery, DL 10 Nov 2026). ONE small
 * file: it folds into the shared adapter `coreViewToLegacy` (the Reasoning session's) once its types are posted in the ledger; it is never
 * a second mapping layer. Nothing here words, rounds, ranks or sorts: every string is core's, a number only sizes a mark, and the order is
 * the View's own.
 */
import type { ServedGoalCell } from '../../components/results/OptionCards'
import type { OptionResult } from '../../components/results/types'
import type { ViewCard, ViewModel } from '../client'
import { optionCards } from '../layout'
import { driverRowOf, headlineRowOf, leadAimOf } from './pick'

/** Core sends no outcome percentiles the previous cards may format: the card's expert range bar stays off. */
const NO_OUTCOME = { mean: null, p10: null, p50: null, p90: null } as const

/** The row an option's headline is about: core's own pick (`headlineRowOf`), else its row for the aim core's lead speaks of, else its first chance. */
function headRowOf(card: ViewCard, lead: string | null) {
  return card.rows[headlineRowOf(card)] ?? card.rows.find((r) => lead !== null && (r.aim_id ?? null) === lead) ?? card.rows[driverRowOf(card)] ?? null
}

export interface LegacyOptions {
  /** One per compared option, in core's card order. No win share, rank, leader or outcome figure: core sends none. */
  options: OptionResult[]
  /** The option's headline for the card's goal row: core's words verbatim, and the aim they are about. */
  goalCellOf: (id: string) => ServedGoalCell | null
}

/**
 * The previous `OptionCards` props from the View. Each option's headline is its chance of meeting the aim (DL #87): core's words are the
 * readout (`cards[].headline.text`, else its row's `value`), and the chance as a number only sets the bar's length. A headline that is
 * not a chance (fixed by the figures, or nothing to say yet) is said in core's words with no bar, through the cards' no-bar cell.
 */
export function legacyOptionsOf(model: ViewModel): LegacyOptions {
  const lead = leadAimOf(model)
  const cells = new Map<string, ServedGoalCell>()
  const options = optionCards(model).map((card): OptionResult => {
    const row = headRowOf(card, lead)
    const chance = row?.kind === 'chance' && !row.fixed && typeof row.chance === 'number' && Number.isFinite(row.chance) ? row.chance : null
    const words = card.headline?.text ?? (row === null ? '' : row.kind === 'none' ? row.text : row.value)
    cells.set(card.id, { kind: chance === null ? 'range' : 'figure', display: words, face: row === null || row.kind === 'none' || row.aim === '' ? null : row.aim })
    return { id: card.id, label: card.heading, expected: null, outcome: NO_OUTCOME, p10: null, p50: null, p90: null, isRecommended: false, goalProbability: chance }
  })
  return { options, goalCellOf: (id) => cells.get(id) ?? null }
}
