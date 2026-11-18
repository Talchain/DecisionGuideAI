/**
 * THE BOX'S VALUE, ONE PER OPTION (final-pair P1, 18 Nov; Codex CODEX-UI-A998B787): a calculated card's value differs by option, and a held proposal
 * may move some options' values and not others. The card's one box (LaneInspector, preview and pinned alike) reads each option's value here, exactly
 * as the Detailed strips read it (detailed/charts.tsx Strips):
 *   - core's own words for that option's value (`values[i].text`);
 *   - core's own mark where a held proposal moves THAT value (`values[i].if_approved`: its glyph and its words, "if approved; now …"), and nothing
 *     where core sends none (an unrelated proposal never marks a value it leaves alone);
 *   - core's own reason for an option it could not work out (`values_withheld`), never a number for it.
 * Null where the card's one figure line already says everything: no per-option values, or a single value that nothing pending moves (an ordinary
 * current value, drawn as before). Option names are the model's own option headings. No number is formatted, parsed or compared here.
 */
import type { ViewCard, ViewModel } from '../../client'
import { ifApprovedFieldOf } from '../../standin'
import { withheldValues } from '../contract'

export type OptionValue = {
  readonly option: string
  /** The model's own heading for the option ('' where the model has no such card). */
  readonly heading: string
  /** Core's words: the option's value, or (withheld) core's reason it has none. */
  readonly text: string
  /** Core's mark where a held proposal moves this value; null where it moves nothing. Always null on a withheld option. */
  readonly ifApproved: { readonly glyph: string; readonly title: string } | null
  /** The value's own place in core's `values` (for the View path of its mark); null on a withheld option. */
  readonly at: number | null
  readonly withheld: boolean
}

export function optionValuesOf(card: ViewCard, model: ViewModel | null): readonly OptionValue[] | null {
  const held = withheldValues(card), heldIds = new Set(held.map((w) => w.option))
  const heading = (id: string): string => model?.cards.find((c) => c.id === id)?.heading ?? ''
  // An option core withheld is its reason alone, never also a value (as bandsOf keeps it out of the bands).
  const values = (card.values ?? []).map((v, at) => ({ v, at })).filter(({ v }) => !heldIds.has(v.option))
  const rows: OptionValue[] = [
    ...values.map(({ v, at }) => ({ option: v.option, heading: heading(v.option), text: v.text, ifApproved: ifApprovedFieldOf(v) ?? null, at, withheld: false })),
    ...held.map((w) => ({ option: w.option, heading: heading(w.option), text: w.text, ifApproved: null, at: null, withheld: true })),
  ]
  return rows.length > 1 || rows.some((r) => r.ifApproved !== null) ? rows : null
}
