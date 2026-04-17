/**
 * ConditionalWinnerCards — factor-dependent recommendation splits (ISL).
 *
 * Brief 4 Task 10. Post-analysis surfaces where the recommendation flips
 * when a factor crosses a split point. Gated on at least one winner-flip
 * entry being present (entries where high/low buckets share the same
 * winner are not "scenarios" and are filtered out).
 *
 * Copy derives the direction from which bucket carries the ALTERNATIVE
 * winner relative to the overall recommended option:
 *   - if the flip happens on the HIGH side → "When X exceeds N, ALT leads instead"
 *   - if the flip happens on the LOW side  → "When X falls below N, ALT leads instead"
 * When the recommended option label is unknown, fall back to "exceeds" with
 * the high-bucket winner — this is the most conservative phrasing and matches
 * PLoT's typical monotone interpretation of split values.
 */

import { useMemo } from 'react'
import { GitBranch, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import type { ConditionalWinner } from './types'

const MAX_CONDITIONAL_CARDS = 3

interface ConditionalWinnerCardsProps {
  winners: ConditionalWinner[]
  /** Label of the overall recommended option (drives direction wording). */
  recommendedLabel?: string
  onFocusNode?: (nodeId: string) => void
}

export function ConditionalWinnerCards({
  winners,
  recommendedLabel,
  onFocusNode,
}: ConditionalWinnerCardsProps) {
  const flipping = useMemo(
    () => winners.filter(w => w.high_bucket.winner_label !== w.low_bucket.winner_label),
    [winners],
  )
  if (flipping.length === 0) return null
  const visible = flipping.slice(0, MAX_CONDITIONAL_CARDS)

  return (
    <div className="space-y-2 pt-2 border-t border-panel-border/50" data-testid="conditional-winner-cards">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-info flex-shrink-0" aria-hidden="true" />
        <h4 className={`${typography.panelHeader} text-text-header`}>
          Conditional scenarios
        </h4>
        <span
          className={`${typography.panelMeta} text-text-light`}
          title="Factors that change the recommendation when they shift"
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">Factors that change the recommendation when they shift</span>
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
        // Direction: if the recommended option matches the LOW bucket winner,
        // then the flip happens when the factor EXCEEDS the split (HIGH bucket
        // is the alternative). If it matches the HIGH bucket, flip happens
        // when the factor FALLS BELOW the split.
        const highIsAlt = recommendedLabel != null
          ? w.low_bucket.winner_label === recommendedLabel
          : true
        const direction = highIsAlt ? 'exceeds' : 'falls below'
        const alt = highIsAlt ? w.high_bucket.winner_label : w.low_bucket.winner_label
        const splitSuffix = w.split_unit ? w.split_unit : ''
        return (
          <div
            key={`${w.factor_id}-${idx}`}
            className={`p-3 bg-panel border border-info/30 rounded-lg ${canFocus ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all' : ''}`}
            onClick={canFocus ? handleFocus : undefined}
            role={canFocus ? 'button' : undefined}
            tabIndex={canFocus ? 0 : undefined}
            onKeyDown={canFocus ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } } : undefined}
          >
            <p className={`${typography.panelBody} text-text-body`}>
              When <span className="text-text-header">{w.factor_label}</span> {direction} {w.split_value.toLocaleString()}{splitSuffix}, <span className="text-text-header">{alt}</span> leads instead.
            </p>
            <div className={`${typography.panelMeta} text-text-light mt-1 flex gap-4`}>
              <span>Above: {w.high_bucket.winner_label} ({Math.round(w.high_bucket.win_probability * 100)}%)</span>
              <span>Below: {w.low_bucket.winner_label} ({Math.round(w.low_bucket.win_probability * 100)}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ConditionalWinnerCards
