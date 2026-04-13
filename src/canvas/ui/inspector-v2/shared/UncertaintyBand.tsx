/**
 * UncertaintyBand — translucent overlay on strength slider
 * Width = 2 * std, centred on current strength position
 * Colour = direction colour at 20% opacity
 */

interface UncertaintyBandProps {
  /** Current strength value (-1 to +1) */
  strength: number
  /** Standard deviation */
  std: number
  /** Slider width in pixels */
  sliderWidth?: number
}

export function UncertaintyBand({ strength, std, sliderWidth = 100 }: UncertaintyBandProps) {
  if (std <= 0) return null

  // Map strength from [-1, +1] to [0, sliderWidth]
  const center = ((strength + 1) / 2) * sliderWidth
  const bandHalf = std * sliderWidth / 2 // std is in the same scale as strength range (2)
  const left = Math.max(0, center - bandHalf)
  const right = Math.min(sliderWidth, center + bandHalf)
  const width = right - left

  const color = strength >= 0
    ? 'var(--success)'
    : 'var(--danger)'

  return (
    <div
      className="absolute top-[-3px] h-[12px] rounded pointer-events-none"
      style={{
        left: `${(left / sliderWidth) * 100}%`,
        width: `${(width / sliderWidth) * 100}%`,
        background: color,
        opacity: 0.2,
        border: `1px solid ${color}30`,
      }}
      aria-hidden="true"
    />
  )
}
