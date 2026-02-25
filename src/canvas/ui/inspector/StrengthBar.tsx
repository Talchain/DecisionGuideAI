/**
 * StrengthBar — read-only visual indicator for edge effect size
 *
 * S.5: 120px horizontal bar centred at zero.
 * Left half fills bg-danger for negative, right half fills bg-success for positive.
 * Correction #5: Labelled "Effect size", not "Helps/Hurts".
 */

import { typography } from '../../../styles/typography'

export interface StrengthBarProps {
  /** 0–1 magnitude */
  weight: number
  /** Direction of the causal effect */
  direction: 'positive' | 'negative'
}

export function StrengthBar({ weight, direction }: StrengthBarProps) {
  const isNegative = direction === 'negative'
  const signedValue = isNegative ? -weight : weight
  // Fill width as percentage of half-bar (50% = full strength)
  const fillPct = Math.min(weight, 1) * 50

  return (
    <div data-testid="strength-bar">
      {/* Label */}
      <div className="flex justify-between items-center mb-1">
        <span className={`${typography.panelMeta} text-text-light`}>Effect size</span>
        <span
          className={`${typography.panelMeta} tabular-nums font-medium ${
            isNegative ? 'text-danger' : weight > 0 ? 'text-success' : 'text-text-light'
          }`}
        >
          {signedValue >= 0 ? '+' : '\u2212'}{Math.abs(signedValue).toFixed(2)}
        </span>
      </div>

      {/* Bar track — 120px wide, centred at midpoint */}
      <div className="relative h-2 bg-panel-border rounded-full overflow-hidden" style={{ width: 120 }}>
        {/* Centre line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-text-light/30" />

        {/* Fill — left half for negative, right half for positive */}
        {weight > 0 && (
          <div
            className={`absolute inset-y-0 rounded-full transition-all duration-200 ${
              isNegative ? 'bg-danger' : 'bg-success'
            }`}
            style={
              isNegative
                ? { right: '50%', width: `${fillPct}%` }
                : { left: '50%', width: `${fillPct}%` }
            }
          />
        )}

        {/* Current value marker dot */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
            isNegative ? 'bg-danger' : weight > 0 ? 'bg-success' : 'bg-text-light'
          }`}
          style={{
            left: `${50 + signedValue * 50}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-0.5" style={{ width: 120 }}>
        <span className={`${typography.panelMeta} text-text-light`}>Hurts</span>
        <span className={`${typography.panelMeta} text-text-light`}>Neutral</span>
        <span className={`${typography.panelMeta} text-text-light`}>Helps</span>
      </div>
    </div>
  )
}
