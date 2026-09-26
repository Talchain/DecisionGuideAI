/**
 * ⭐ CONTRACT §02 — THE CARD VALUE IS A FIGURE, AND ITS UNIT IS QUIETER.
 *
 * `.node .own-value strong{font-weight:610}` and
 * `.node .own-value span{font-size:11px;color:var(--muted)}`: the figure is a
 * `<strong>` at weight 610, the unit word a separate smaller, muted,
 * regular-weight span. The figure stays at the value token's 14px (Canvas lead
 * ruling: the design system's 14px minimum outranks the contract's 13px), so
 * the weight is set HERE, on the figure only — never on the shared
 * `typography.nodeValue`, which the settlement words and every other value
 * line also wear.
 *
 * ⭐ 610 FOR EVERY VALUE — contract v3.1 (DESIGN-GAP-v31 #35). The weight used
 * to reach ONLY a value composed from a number plus a unit; a qualitative word
 * ("Very high"), a producer `display_value` and a collapsed estimate rendered at
 * the value token's 500, weaker than the 610 title above them (measured on
 * served `eec722ab`: "Very high" 14px/500, "£60,000" 14px/610 on the same
 * board). Every value is now the contract's `strong`: an unsplit readout is ONE
 * `<strong>` holding the whole string (`factor-value-whole-{id}`), with no unit
 * split invented for it.
 *
 * ⛔ IT SPLITS ONLY WHAT IT WAS HANDED SPLIT. `parts` comes from
 * `factorDisplayParts`, which returns a split only for a value COMPOSED from a
 * raw number plus a known unit. A producer `display_value`, a collapsed
 * estimate or any other string renders exactly as it did — one string, never
 * re-cut into figure + unit — and so does a split that no longer joins back to
 * `readout` byte for byte (the visible text can never differ from the unsplit
 * value).
 *
 * The ONE exception is the currency-rate re-spelling (`39,000 GBP/year` shown
 * as `£39,000/year`, prototype 25 Sep): it binds through `parts.restates`, the
 * formatter's own unsplit string, so it still renders only when that string IS
 * this card's readout. The rate suffix is attached to the figure with no space.
 */
import { typography } from '../../../styles/typography'
import { factorCardVisibleText, joinFactorDisplayParts, type FactorDisplayParts } from '../../../utils/formatFactorDisplayValue'
import { classifyValueProvenance, factorValueIsUnconfirmedEstimate } from '../../domain/valueProvenance'
import { classifyUnit } from '../../../utils/unitClassifier'
import { isSuppressedUnit } from '../../utils/labelUtils'

export function FactorValueFigure({ readout, parts, nodeId }: {
  /** The card's recorded readout — the one string every affordance shows. */
  readout: string | null
  /** The same value, split, or `null` where it must stay one string. */
  parts: FactorDisplayParts | null
  nodeId: string
}) {
  if (readout === null) return null
  if (parts === null || factorCardVisibleText(readout, parts) !== joinFactorDisplayParts(parts)) {
    return <strong data-testid={`factor-value-whole-${nodeId}`} className="font-[610]">{readout}</strong>
  }
  return (
    <>
      <strong data-testid={`factor-value-figure-${nodeId}`} className="font-[610]">{parts.figure}</strong>
      {parts.unit !== null && (
        <>
          {parts.attached ? null : ' '}
          <span
            data-testid={`factor-value-unit-${nodeId}`}
            className={`${typography.edgeLabel} font-normal text-text-light`}
          >
            {parts.unit}
          </span>
        </>
      )}
    </>
  )
}

/** A readout that is nothing but one number: "0.5", "1", ".25". */
const BARE_NUMBER = /^-?(\d+(\.\d+)?|\.\d+)$/

/**
 * ⭐⭐ IS THIS READOUT A BARE INTERNAL MODEL NUMBER? — contract v3.1
 * `checks.factor`: "Own-unit value … no bare internal model scale"
 * (DESIGN-GAP-v31 #20; ruling: omit, never invent).
 *
 * Measured before (served `eec722ab`): market-entry "Localisation and
 * Compliance Cost · 0.5 est." and vendor-selection "Operational overhead · 0.5
 * est." — the producer's `0.5 scale` with the placeholder word dropped
 * (`placeholderMagnitudeNumber`), leaving a number on the model's 0–1 scale that
 * no reader can hold against anything.
 *
 * True — and the card omits the value line, substituting nothing — only when
 * ALL of these hold:
 *   · the readout is ONE bare number inside 0–1 (a qualitative word, a
 *     producer phrase, a unit or a second number all keep the line);
 *   · the node declares no real unit (absent, or a placeholder such as
 *     `scale`) — a real unit means the figure IS in the reader's units;
 *   · the number is OLUMI'S UNCONFIRMED ESTIMATE — the exact gate that prints
 *     `est.` (`factorValueIsUnconfirmedEstimate`, one owner). A person's value,
 *     an unacknowledged keystroke (`pending_user_value`), a person's edit still
 *     awaiting its receipt (the withdrawn-marker state, which the gate already
 *     refuses) and a number of unrecorded origin are NEVER hidden: nobody may
 *     lose sight of a number that could be theirs.
 *
 * ⚠ KNOWN LIMIT, stated: an Olumi-estimated COUNT of 0 or 1 sent with no unit
 * at all ("1") is indistinguishable from a 0–1 model value and is omitted too.
 * That fails towards omission, which the ruling prefers to a number read on the
 * wrong scale; the inspector and the Model tab still state it.
 */
export function readoutIsBareModelScale(readout: string | null, data: unknown): boolean {
  if (readout === null) return false
  const text = readout.trim()
  if (!BARE_NUMBER.test(text)) return false
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n > 1) return false
  const d = data as Record<string, unknown> | null | undefined
  if (d?.pending_user_value != null) return false
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  const rawUnit = typeof obs?.unit === 'string' ? obs.unit : typeof d?.unit === 'string' ? (d.unit as string) : null
  // The card's own display guard: an internal descriptor ("other") is no unit.
  const unit = rawUnit !== null && !isSuppressedUnit(rawUnit) ? rawUnit : null
  const unitKind = classifyUnit(unit).kind
  if (unitKind !== 'none' && unitKind !== 'placeholder') return false
  const source = typeof obs?.source === 'string' ? obs.source : null
  if (classifyValueProvenance(source)?.userOwned === true) return false
  return factorValueIsUnconfirmedEstimate(data)
}
