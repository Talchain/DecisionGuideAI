/**
 * ConditionalWinnerCards — factor-dependent leadership splits (ISL).
 *
 * V6 Science-to-Reasoning slice: the card binds to the PRODUCER's claims,
 * never to display-label comparison.
 *
 *   - A scenario is a row the producer ATTESTED with `winner_flips: true`
 *     (schemas 0.46: "says THAT the winner changes across the split, never
 *     WHICH option"). Label inequality is not a flip test: two options can
 *     share one display label (a real flip a label filter cannot see) and a
 *     label churn is not a flip (trap 19).
 *
 *   - Direction binds by IDENTITY: `winner_id` vs `recommendedOptionId`
 *     (`report.robustness.recommended_option_id`). If the recommended id
 *     sits in the LOW bucket, the flip happens when the factor EXCEEDS the
 *     split; in the HIGH bucket, when it FALLS BELOW. Labels are display
 *     only.
 *
 *   - When direction cannot be bound by ID (identity withheld by CEE's
 *     withheld-claim projection, recommended id absent, or matching neither
 *     bucket), the card renders the NEUTRAL two-sided arm — the factor and
 *     the threshold with no option name and no direction — instead of
 *     guessing or vanishing. CEE ships identity-stripped rows deliberately
 *     ("dropping the key whole would be the over-suppression failure");
 *     rendering nothing would drop that claim on the floor.
 *
 *   - Absent numerics render as absent. A row without a finite
 *     `split_value` is not renderable as a threshold claim and is skipped
 *     (defence in depth — the projection already drops it). An absent
 *     `win_probability` omits the percentage; it is never minted as 0%.
 */

import { useMemo } from 'react'
import { GitBranch, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import type { ConditionalWinner, ConditionalWinnerBucket } from './types'
// Canonical glossary check shared with the v17 hero row builders + body
// sub-components. Used in v17 mode to sanitise user-supplied factor /
// option labels before they enter generated prose. The raw label still
// appears verbatim in the legacy panel (default useV17Copy=false).
import { safeInterpolatedLabel } from './utils/glossaryCheck'

const MAX_CONDITIONAL_CARDS = 3

interface ConditionalWinnerCardsProps {
  winners: ConditionalWinner[]
  /**
   * `report.robustness.recommended_option_id` — the backend's own
   * leading-option identity. Direction wording derives from comparing this
   * to the buckets' `winner_id`s BY IDENTITY; display labels never decide
   * direction. Absent (or matching neither bucket) ⇒ the neutral arm.
   */
  recommendedOptionId?: string
  onFocusNode?: (nodeId: string) => void
  /**
   * v17 hero mode (Round-7 review). When true:
   *   - The header info tooltip + sr-only text drop the banned word
   *     "recommendation" in favour of "which option leads".
   *   - All interpolated user labels (`factor_label`, the chosen `alt`
   *     winner_label, and the two bucket `winner_label`s in the Above/Below
   *     footer) route through `safeInterpolatedLabel` so a user-named
   *     option like "Winning strategy" cannot smuggle a banned term into
   *     the visible prose. The raw label still appears verbatim when
   *     `useV17Copy=false`.
   *
   * Default: false — the copy the legacy panel used before it was deleted,
   * kept so remaining callers and tests are untouched.
   */
  useV17Copy?: boolean
}

/** Which direction arm a row can honestly claim. */
type DirectionArm = 'high-alt' | 'low-alt' | 'neutral'

export function ConditionalWinnerCards({
  winners,
  recommendedOptionId,
  onFocusNode,
  useV17Copy = false,
}: ConditionalWinnerCardsProps) {
  // Producer attestation ONLY — label comparison cannot see a same-label
  // flip and renders label churn as a phantom scenario. A row without a
  // finite split_value cannot state "flips at N" and is skipped.
  const flipping = useMemo(
    () => winners.filter(w => w.winner_flips === true && Number.isFinite(w.split_value)),
    [winners],
  )
  if (flipping.length === 0) return null
  const visible = flipping.slice(0, MAX_CONDITIONAL_CARDS)
  // (Round-7 P1.1, P0 follow-up) Glossary-safe header copy. Both v17 hero
  // and legacy panel now use glossary-safe wording — the P0 surface-copy
  // cleanup retired the "the recommendation" legacy string. The branches
  // remain distinct so the v17 hero can use the more pointed "which
  // option leads" phrasing.
  const headerHelpText = useV17Copy
    ? 'Factors that change which option leads when they shift'
    : 'Factors that change the result when they shift'

  return (
    <div className="space-y-2 pt-2 border-t border-panel-border/50" data-testid="conditional-winner-cards">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-info flex-shrink-0" aria-hidden="true" />
        <h4 className={`${typography.panelHeader} text-text-header`}>
          Conditional scenarios
        </h4>
        <span
          className={`${typography.panelMeta} text-text-light`}
          title={headerHelpText}
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">{headerHelpText}</span>
        </span>
      </div>
      {visible.map((w, idx) => {
        const canFocus = !!w.factor_id
        const handleFocus = () => {
          if (w.factor_id) {
            if (onFocusNode) onFocusNode(w.factor_id)
            else focusNodeById(w.factor_id)
          }
        }
        // Direction by IDENTITY. The recommended option id must match
        // exactly one bucket's winner_id; anything else — identity withheld,
        // recommended absent, or an id the buckets don't carry — is the
        // neutral arm, never a guess.
        const highId = w.high_bucket.winner_id
        const lowId = w.low_bucket.winner_id
        let arm: DirectionArm = 'neutral'
        if (recommendedOptionId && highId && lowId && highId !== lowId) {
          if (lowId === recommendedOptionId) arm = 'high-alt'
          else if (highId === recommendedOptionId) arm = 'low-alt'
        }
        // A directional sentence names the alternative; without its label
        // there is nothing honest to name — fall back to the neutral arm.
        const altBucket: ConditionalWinnerBucket | undefined =
          arm === 'high-alt' ? w.high_bucket : arm === 'low-alt' ? w.low_bucket : undefined
        if (arm !== 'neutral' && altBucket?.winner_label === undefined) arm = 'neutral'

        const splitDisplay = `${w.split_value.toLocaleString()}${w.split_unit ?? ''}`
        // (Round-7 P1.1) v17 mode: gate every user-supplied label that
        // enters the visible prose through `safeInterpolatedLabel`. The
        // legacy panel keeps the raw labels verbatim (default).
        const factorLabelDisplay = useV17Copy
          ? safeInterpolatedLabel(w.factor_label, 'this factor')
          : w.factor_label
        const altDisplay = altBucket?.winner_label !== undefined
          ? (useV17Copy ? safeInterpolatedLabel(altBucket.winner_label, 'the other option') : altBucket.winner_label)
          : undefined

        // Footer sides render exactly what the producer sent: label when
        // present, percentage when present, neither minted. A side with
        // nothing to say is omitted; so is an empty footer.
        const sideText = (bucket: ConditionalWinnerBucket): string | undefined => {
          const label = bucket.winner_label !== undefined
            ? (useV17Copy ? safeInterpolatedLabel(bucket.winner_label, 'the other option') : bucket.winner_label)
            : undefined
          const pct = bucket.win_probability !== undefined
            ? `${Math.round(bucket.win_probability * 100)}%`
            : undefined
          if (label !== undefined && pct !== undefined) return `${label} (${pct})`
          if (label !== undefined) return label
          if (pct !== undefined) return pct
          return undefined
        }
        const aboveText = sideText(w.high_bucket)
        const belowText = sideText(w.low_bucket)

        return (
          <div
            key={`${w.factor_id}-${idx}`}
            data-cw-arm={arm}
            className={`p-3 bg-panel border border-info/30 rounded-lg ${canFocus ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all' : ''}`}
            onClick={canFocus ? handleFocus : undefined}
            role={canFocus ? 'button' : undefined}
            tabIndex={canFocus ? 0 : undefined}
            onKeyDown={canFocus ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } } : undefined}
          >
            {arm === 'neutral' ? (
              <p className={`${typography.panelBody} text-text-body`}>
                Which option leads depends on <span className="text-text-header">{factorLabelDisplay}</span> — the analysis flips at {splitDisplay}.
              </p>
            ) : (
              <p className={`${typography.panelBody} text-text-body`}>
                When <span className="text-text-header">{factorLabelDisplay}</span> {arm === 'high-alt' ? 'exceeds' : 'falls below'} {splitDisplay}, <span className="text-text-header">{altDisplay}</span> leads instead.
              </p>
            )}
            {(aboveText !== undefined || belowText !== undefined) && (
              <div className={`${typography.panelMeta} text-text-light mt-1 flex gap-4`}>
                {aboveText !== undefined && <span>Above: {aboveText}</span>}
                {belowText !== undefined && <span>Below: {belowText}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ConditionalWinnerCards
