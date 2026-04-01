/**
 * StrengthBandButtons — quick-select buttons for edge strength bands (B.4).
 *
 * Renders a row of outlined pill buttons for Slight / Moderate / Strong / Very strong.
 * Clicking a button sets the edge strength magnitude to the band midpoint while
 * preserving the current direction sign. The active band is highlighted.
 *
 * Thresholds align with inspectorStrings.ts getStrengthLabel():
 *   Very strong >= 0.70, Strong >= 0.40, Moderate >= 0.20, Slight < 0.20
 */

import { memo, useMemo, useCallback } from 'react'
import { typography } from '../../../../styles/typography'

interface StrengthBand {
  label: string
  midpoint: number
  /** Lower bound (inclusive) */
  min: number
  /** Upper bound (exclusive for all but last band, which is inclusive up to 1.0) */
  max: number
}

const BANDS: StrengthBand[] = [
  { label: 'Slight',      midpoint: 0.10, min: 0.00, max: 0.20 },
  { label: 'Moderate',    midpoint: 0.30, min: 0.20, max: 0.40 },
  { label: 'Strong',      midpoint: 0.55, min: 0.40, max: 0.70 },
  { label: 'Very strong', midpoint: 0.85, min: 0.70, max: 1.00 },
]

interface StrengthBandButtonsProps {
  /** Current signed strength value (-1 to +1) */
  value: number
  /** Callback with new signed strength value (band midpoint with current sign preserved) */
  onChange: (signedValue: number) => void
}

export const StrengthBandButtons = memo(function StrengthBandButtons({
  value,
  onChange,
}: StrengthBandButtonsProps) {
  const absMagnitude = Math.abs(value)
  const isNegative = value < 0

  const activeBandIndex = useMemo(() => {
    for (let i = 0; i < BANDS.length; i++) {
      const band = BANDS[i]
      const inBand = absMagnitude >= band.min && (absMagnitude < band.max || i === BANDS.length - 1)
      if (inBand) return i
    }
    return -1
  }, [absMagnitude])

  const handleClick = useCallback((midpoint: number) => {
    const signed = isNegative ? -midpoint : midpoint
    onChange(signed)
  }, [isNegative, onChange])

  return (
    <div className="flex flex-wrap gap-1 mb-2" role="group" aria-label="Strength presets">
      {BANDS.map((band, i) => {
        const isActive = activeBandIndex === i
        return (
          <button
            key={band.label}
            type="button"
            onClick={() => handleClick(band.midpoint)}
            className={`${typography.panelMeta} px-3.5 py-1.5 rounded-full bg-transparent border transition-colors cursor-pointer
              ${isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-panel-border text-text-light hover:border-text-light hover:bg-panel-hover'
              }`}
            aria-pressed={isActive}
            data-testid={`strength-band-${band.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {band.label}
          </button>
        )
      })}
    </div>
  )
})
