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
 * ⛔ IT SPLITS ONLY WHAT IT WAS HANDED SPLIT. `parts` comes from
 * `factorDisplayParts`, which returns a split only for a value COMPOSED from a
 * raw number plus a known unit. A producer `display_value`, a collapsed
 * estimate or any other string renders exactly as it did — one string, no
 * markup — and so does a split that no longer joins back to `readout`
 * byte for byte (the visible text can never differ from the unsplit value).
 */
import { typography } from '../../../styles/typography'
import { joinFactorDisplayParts, type FactorDisplayParts } from '../../../utils/formatFactorDisplayValue'

export function FactorValueFigure({ readout, parts, nodeId }: {
  /** The card's recorded readout — the one string every affordance shows. */
  readout: string | null
  /** The same value, split, or `null` where it must stay one string. */
  parts: FactorDisplayParts | null
  nodeId: string
}) {
  if (readout === null || parts === null || joinFactorDisplayParts(parts) !== readout) return <>{readout}</>
  return (
    <>
      <strong data-testid={`factor-value-figure-${nodeId}`} className="font-[610]">{parts.figure}</strong>
      {parts.unit !== null && (
        <>
          {' '}
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
