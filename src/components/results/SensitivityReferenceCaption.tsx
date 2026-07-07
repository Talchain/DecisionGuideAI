/**
 * SensitivityReferenceCaption — reference-option disclosure (Lane UI-W5).
 *
 * PLoT /v2/run now discloses `sensitivity_reference_option_id`: the option
 * that edge/factor sensitivities and the fragile-edge classification were
 * computed against (ISL currently uses the first option in the request).
 * This caption surfaces that fact honestly wherever sensitivities or
 * fragile edges render, so per-factor influence is never read as
 * option-neutral.
 *
 * One component reused across surfaces (DriversSection, StressTestSection).
 *
 * Fail-closed rendering contract:
 *   - absent field (older PLoT/ISL builds) → parent passes null → renders
 *     nothing (honest absence — never invent a baseline);
 *   - id present but unresolvable to a label on this canvas (deleted node,
 *     recovered session with different ids) → renders nothing rather than
 *     leaking an internal node id as user copy.
 *
 * Copy is provisional_doctrine_v0 — wording pending doctrine review.
 */

import { typography } from '../../styles/typography'

export interface SensitivityReferenceCaptionProps {
  /**
   * Resolved reference-option label. Null/undefined/empty → no caption
   * (see fail-closed contract above).
   */
  optionLabel?: string | null
  className?: string
}

export function SensitivityReferenceCaption({
  optionLabel,
  className = '',
}: SensitivityReferenceCaptionProps) {
  if (typeof optionLabel !== 'string' || optionLabel.trim().length === 0) {
    return null
  }

  return (
    <p
      role="note"
      data-testid="sensitivity-reference-caption"
      className={`${typography.panelMeta} text-text-light ${className}`.trim()}
    >
      {/* provisional_doctrine_v0: disclosure wording pending doctrine review */}
      Sensitivities computed against {optionLabel}
    </p>
  )
}

export default SensitivityReferenceCaption
