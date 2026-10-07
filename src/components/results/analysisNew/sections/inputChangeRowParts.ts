/**
 * The parts of one input-change row in the Compare tab's row layout (Compare v3 handoff, 4 Oct 2026, §3): the input's
 * name, a short context, and its recorded before → after as values, a strength band position, or the estimate's origin.
 *
 * ⛔ PRESENTATION ONLY. Every part is read from the row `buildRunDeltaView` already built: the producer's values, already
 * formatted; strength band ids and sizing literals by IDENTITY. Nothing is diffed, inferred or converted here, and the
 * row's own sentence (`inputRowText` / `linkRowText`) stays the authority for what the change MEANS: the row layout
 * renders that sentence for assistive technology and draws these parts for the eye.
 */
import type { StrengthBand } from '@talchain/schemas'
import { sizingWords, strengthBandWords } from '../runDeltaLinkWords'
import type { RunDeltaInputRow } from '../runDeltaView'

/** The producer's four strength bands, weakest first. An ORDER of categories, not an interval scale. */
export const STRENGTH_BAND_ORDER: readonly StrengthBand[] = ['slight', 'moderate', 'strong', 'very_strong']

/** Where a band sits in `STRENGTH_BAND_ORDER`, by identity; `null` for anything that is not one of the four. */
export function strengthBandIndex(raw: string | null): number | null {
  if (raw === null) return null
  const i = (STRENGTH_BAND_ORDER as readonly string[]).indexOf(raw)
  return i >= 0 ? i : null
}

/** A sizing literal as a short label ("Olumi's estimate, accepted"), sentence case. The words are `sizingWords`'. */
export function sizingLabel(raw: string | null): string | null {
  const words = sizingWords(raw)
  return words === null ? null : words.charAt(0).toUpperCase() + words.slice(1)
}

/** The accepted-estimate note (handoff §3: acceptance keeps Olumi as the origin; it is not better evidence). */
export const ACCEPTED_ESTIMATE_NOTE = 'The estimate still originates from Olumi.'

export type InputRowValues =
  /** A recorded value on both sides (or a value that appeared or went: the missing side reads "Not set"). */
  | { readonly kind: 'pair'; readonly before: string; readonly after: string; readonly beforeMissing: boolean; readonly afterMissing: boolean }
  /** A change with no value to show: an option joining or leaving, a link added or removed. */
  | { readonly kind: 'status'; readonly text: string }
  /** A link's strength band, before → after, with each side's band position. */
  | { readonly kind: 'strength'; readonly before: string | null; readonly after: string | null; readonly beforeBand: number | null; readonly afterBand: number | null }
  /** Whose estimate a link's size is, before → after; with the strength change folded in when the producer sent one. */
  | {
      readonly kind: 'sizing'
      readonly before: string | null
      readonly after: string | null
      readonly accepted: boolean
      readonly strength: Extract<InputRowValues, { kind: 'strength' }> | null
    }

const NOT_SET = 'Not set'

function strengthValues(before: string | null, after: string | null): Extract<InputRowValues, { kind: 'strength' }> {
  return { kind: 'strength', before: strengthBandWords(before), after: strengthBandWords(after), beforeBand: strengthBandIndex(before), afterBand: strengthBandIndex(after) }
}

/** What the row's value line shows. Branches on the producer's `kind`, `change` and `field` by identity, never on text. */
export function inputRowValues(row: RunDeltaInputRow): InputRowValues {
  if (row.kind === 'option') return { kind: 'status', text: row.change === 'added' ? 'Joined the comparison' : row.change === 'removed' ? 'Left the comparison' : 'Changed' }
  if (row.kind === 'link' && row.change !== 'changed') return { kind: 'status', text: row.change === 'added' ? 'Added to the model' : 'Removed from the model' }
  if (row.kind === 'link' && row.field === 'strength') return strengthValues(row.before, row.after)
  if (row.kind === 'link' && row.field === 'sizing') {
    return {
      kind: 'sizing',
      before: sizingLabel(row.before),
      after: sizingLabel(row.after),
      accepted: row.after === 'olumi_accepted',
      strength: row.strength ? strengthValues(row.strength.before, row.strength.after) : null,
    }
  }
  return {
    kind: 'pair',
    before: row.before ?? NOT_SET,
    after: row.after ?? NOT_SET,
    beforeMissing: row.before === null,
    afterMissing: row.after === null,
  }
}

/** The row's own name: the input ("Pro price"), a link as "A → B". Falls back to the sentence subject. */
export function inputRowName(row: RunDeltaInputRow): string {
  return row.name ?? row.subject
}

/**
 * The short context under the name (handoff §3 row anatomy): which option an option setting belongs to, or what kind of
 * input it is. `null` when the row says nothing more than its name.
 */
export function inputRowContext(row: RunDeltaInputRow): string | null {
  switch (row.kind) {
    case 'option_setting':
      return row.optionLabel ?? null
    case 'factor_value':
      return 'Shared assumption'
    case 'goal':
      return 'Goal definition'
    case 'constraint':
      return 'Limit'
    case 'option':
      return 'Option participation'
    case 'link':
      return row.change === 'changed' && row.field === 'sizing' ? 'Recorded origin of the estimate'
        : row.change === 'changed' && row.field === 'strength' ? 'Relationship strength'
        : 'Relationship'
    default:
      return null
  }
}
