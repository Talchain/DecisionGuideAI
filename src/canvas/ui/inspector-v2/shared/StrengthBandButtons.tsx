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
}

const BANDS: StrengthBand[] = [
  { label: 'Slight',      midpoint: 0.10 },
  { label: 'Moderate',    midpoint: 0.35 },
  { label: 'Strong',      midpoint: 0.50 },
  { label: 'Very strong', midpoint: 0.80 },
]

/** Tolerance for matching current value to a band midpoint */
const MATCH_TOLERANCE = 0.05

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
      if (Math.abs(absMagnitude - BANDS[i].midpoint) <= MATCH_TOLERANCE) {
        return i
      }
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
            className={`${typography.panelMeta} px-2 py-0.5 rounded-full bg-transparent border transition-colors
              ${isActive
                ? 'border-primary/50 text-primary font-medium'
                : 'border-panel-border text-text-body hover:border-text-light'
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
