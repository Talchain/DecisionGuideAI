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
  /**
   * Direction of the causal effect, or `undefined` when NOBODY HAS STATED ONE.
   *
   * ROADMAP 2.263: the prop used to be required and every caller had already
   * coerced an unstated direction to `'positive'` before reaching here, so the
   * bar filled its green half and printed a green `+0.30` for an edge the
   * producer never characterised. `undefined` is now a first-class input and
   * renders the magnitude with no sign, no green, and no filled half.
   */
  direction: 'positive' | 'negative' | undefined
}

export function StrengthBar({ weight, direction }: StrengthBarProps) {
  const isNegative = direction === 'negative'
  const isStated = direction !== undefined
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
            !isStated ? 'text-text-light' : isNegative ? 'text-danger' : weight > 0 ? 'text-success' : 'text-text-light'
          }`}
        >
          {!isStated
            ? Math.abs(signedValue).toFixed(2)
            : `${signedValue >= 0 ? '+' : '\u2212'}${Math.abs(signedValue).toFixed(2)}`}
        </span>
      </div>

      {/* Bar track — 120px wide, centred at midpoint */}
      <div className="relative h-2 bg-panel-border rounded-full overflow-hidden" style={{ width: 120 }}>
        {/* Centre line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-text-light/30" />

        {/* Fill — left half for negative, right half for positive.
            No fill at all when the direction is unstated: which half fills IS
            the direction claim, so there is no honest side to paint. */}
        {weight > 0 && isStated && (
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
            !isStated ? 'bg-text-light' : isNegative ? 'bg-danger' : weight > 0 ? 'bg-success' : 'bg-text-light'
          }`}
          style={{
            // WHICH SIDE OF CENTRE the dot sits on is a direction claim with no
            // words attached — the quietest channel on this control. With no
            // stated direction the dot sits ON the centre line rather than
            // drifting into the "Helps" half on the strength of a UI default.
            left: isStated ? `${50 + signedValue * 50}%` : '50%',
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
