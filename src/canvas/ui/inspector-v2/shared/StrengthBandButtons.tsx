/**
 * StrengthBandButtons — quick-select buttons for edge strength bands (B.4).
 *
 * Renders a row of outlined pill buttons for Slight / Moderate / Strong / Very strong.
 * Each button discloses the exact midpoint it will write; a categorical label
 * must not silently become an exact number attributed to the user. Clicking a
 * button preserves the current direction sign. The active band is highlighted.
 *
 * ⚠ THE BANDS ARE IMPORTED, NOT RESTATED (18 Sep 2026). This file used to carry
 * its own `BANDS` array under the comment *"Thresholds align with
 * inspectorStrings.ts getStrengthLabel()"* — four labels, four cuts and four
 * midpoints, hand-kept in lockstep with the contract's table one directory
 * along. They aligned on the day they were typed, and nothing would have gone
 * red when they stopped (CLAUDE.md trap 12). That mattered more here than
 * anywhere else on the canvas, because these buttons WRITE THE MIDPOINT INTO
 * THE MODEL: a cut that drifted would have stamped a number the user did not
 * choose under a word that no longer described it. `CANVAS_STRENGTH_BANDS`
 * (`domain/vocabulary.ts`) is now the only copy.
 */

import { memo, useMemo, useCallback } from 'react'
import { typography } from '../../../../styles/typography'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../../../domain/vocabulary'

interface StrengthBandButtonsProps {
  /** Current signed strength value (-1 to +1) */
  value: number
  /** Callback with new signed strength value (band midpoint with current sign preserved) */
  onChange: (signedValue: number) => void
  /**
   * ⛔ NOBODY HAS STATED A STRENGTH — LIGHT NOTHING.
   *
   * Without this the component highlights a band derived from `value`, and for a
   * link the user just drew that value is `USER_EDGE_DEFAULTS.weight` (0.3) —
   * so the UI would PROPOSE a number nobody supplied, with `aria-pressed="true"`
   * on it. Accepting the highlighted band would then stamp `weightSource: 'user'`
   * and turn a fabricated default into a stated fact.
   *
   * `captureStructuralAddEdge`'s header calls putting that exact constant on the
   * wire *"a fabricated number reaching the model through the one door this
   * estate guards hardest"*. The wire guard holds; this is the same defect
   * arriving through the pixels, and this flag is where it is refused.
   *
   * DISPLAY-LEVEL ONLY — there is deliberately no second store field.
   */
  unset?: boolean
}

export const StrengthBandButtons = memo(function StrengthBandButtons({
  value,
  onChange,
  unset = false,
}: StrengthBandButtonsProps) {
  const absMagnitude = Math.abs(value)
  const isNegative = value < 0

  // ⚠ THE `-1` ARM IS LOAD-BEARING AND IS NOT WHAT `getCanvasStrengthBand` RETURNS.
  // The canonical resolver is TOTAL — it falls through to the lowest band for
  // any input, including `NaN`, so that no caller can be handed `undefined`.
  // This component needs the opposite for a non-number: "light nothing" is the
  // same refusal the `unset` prop below exists for, and lighting *Slight* on a
  // value that is not a value would propose a band nobody supplied. So the
  // finiteness check stays here, where the display decision lives, and the
  // table stays total where the domain decision lives.
  const activeBandIndex = useMemo(() => {
    if (!Number.isFinite(absMagnitude)) return -1
    return CANVAS_STRENGTH_BANDS.indexOf(getCanvasStrengthBand(absMagnitude))
  }, [absMagnitude])

  const handleClick = useCallback((midpoint: number) => {
    const signed = isNegative ? -midpoint : midpoint
    onChange(signed)
  }, [isNegative, onChange])

  return (
    <div className="flex gap-1 mb-2" role="group" aria-label="Strength presets">
      {CANVAS_STRENGTH_BANDS.map((band, i) => {
        // `unset` wins over any derived band — see the prop's note.
        const isActive = !unset && activeBandIndex === i
        return (
          <button
            key={band.label}
            type="button"
            onClick={() => handleClick(band.midpoint)}
            aria-label={`${band.label}: set strength to ${band.midpoint.toFixed(2)}`}
            className={`${typography.panelMeta} px-2 py-1 rounded-full bg-transparent border transition-colors cursor-pointer inline-flex flex-col items-center leading-tight
              ${isActive
                ? 'border-primary text-primary'
                : 'border-panel-border text-text-light hover:border-text-light hover:bg-panel-hover'
              }`}
            aria-pressed={isActive}
            data-testid={`strength-band-${band.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span>{band.label}</span>
            <span className="font-mono text-[9px] opacity-75">{band.midpoint.toFixed(2)}</span>
          </button>
        )
      })}
    </div>
  )
})
