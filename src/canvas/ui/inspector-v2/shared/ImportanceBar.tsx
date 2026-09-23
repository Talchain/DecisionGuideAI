/**
 * ImportanceBar — compact ISL sensitivity bar for factor panels.
 *
 * v6.2 layout: single horizontal row — rank on left (16px semibold, primary),
 * bar in middle (6px height, primary fill on panel-border track), percentage
 * on right (panelMeta, medium weight). Below the row: descriptive text
 * "Influence on results".
 *
 * Replaces the WhatIfChart approach from v6.1 — single scalar, no trend line.
 *
 * The score is consumed via `useNodeDisplayMetadata().influence`, which
 * already normalises across `influence_score` / `elasticity` /
 * `sensitivity_score` / `importance_score` fallbacks.
 */

import { typography } from '../../../../styles/typography'
import { INLINE_LABELS } from '../inspectorStrings'
import { useModelChangedSinceRun } from '../../../hooks/useModelChangedSinceRun'
import { LAST_RUN_PREFIX } from '../../../nodes/shared/metricVocabulary'

interface ImportanceBarProps {
  /** 0..1 normalised importance score. Null → pre-analysis empty state. */
  importanceScore: number | null
  /** Ordinal rank among factors (1 = most influential). Null → no rank label. */
  sensitivityRank: number | null
  /**
   * ⭐⭐ THE BASIS THAT LICENSES THE PERCENTAGE. REQUIRED ON PURPOSE — a missing
   * arm is a TYPE ERROR, which is the compiler enforcing the rule rather than a
   * fifth hand-maintained copy of it (CLAUDE.md trap 12).
   *
   * Every other renderer of this datum already requires it beside the number:
   * `FactorNode.tsx:759,770,1086` and `lodMetricLine.ts:279`, whose comment
   * states it out loud — "Fail-closed on provenance, exactly as FactorNode's own
   * influence row does." This component is the ONE renderer shared by all four
   * inspector panels (factor-controllable / -external / -observable, and goal),
   * so the rule belongs here and not at four call sites.
   *
   * ⛔ THE HARM IS NAMED AT FACTORNODE'S OWN GATE: "on the fallback basis the top
   * driver shows 100% BY CONSTRUCTION." Measured across 970 debug bundles: 747 of
   * 1850 rendered factors (40.4%) carry no value, 90 carry an influence score
   * with no value, and 15 of 399 boards rank a VALUELESS factor most influential
   * — each at influence 1.0.
   *
   * ⚠ NULL WITHHOLDS THE PERCENTAGE AND THE BAR, NEVER THE RANK. The rank is
   * licensed separately (`MAX_BADGED_RANK`, withheld on ties) and an earlier
   * version of this fix gated the SCORE at the call site instead — which hit
   * `importanceScore == null` below and silently dropped the rank as well.
   * `Brief4Panels.spec.tsx` caught that, and it was right to.
   */
  influenceProvenance: string | null
}

const RANK_ORDINALS = ['', '1st', '2nd', '3rd']

function ordinalFor(rank: number): string {
  if (rank >= 1 && rank <= 3) return RANK_ORDINALS[rank]
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`
  const mod10 = rank % 10
  if (mod10 === 1) return `${rank}st`
  if (mod10 === 2) return `${rank}nd`
  if (mod10 === 3) return `${rank}rd`
  return `${rank}th`
}

export function ImportanceBar({ importanceScore, sensitivityRank, influenceProvenance }: ImportanceBarProps) {
  /**
   * ⭐ A STALE RUN'S ORDINAL AND PERCENTAGE ARE LABELLED, NEVER WITHHELD —
   * Paul's Ruling 3 (ROADMAP 2.651): "out-of-date results are labelled, not
   * withheld … No dimming, no aria-disabled lockout." Asked HERE, not at the
   * four panels, for the same reason the basis gate is: this is the one
   * renderer all four mount. The label rides on the caption beneath the row
   * (`Last run · Influence on results`), so the row itself is untouched.
   *
   * ⚠ Called before the early return because it is a hook.
   */
  const fromLastRun = useModelChangedSinceRun()
  if (importanceScore == null) return null

  const pct = Math.max(0, Math.min(1, importanceScore)) * 100
  const rankLabel = sensitivityRank != null ? ordinalFor(sensitivityRank) : null
  // ⭐ The number needs its basis; the rank does not. See `influenceProvenance`.
  const mayStateThePercentage = influenceProvenance != null

  return (
    <div data-testid="importance-bar">
      {/* Single row: rank | bar | percentage */}
      <div className="flex items-center gap-2">
        {rankLabel && (
          <span className={`${typography.panelHeader} text-primary flex-shrink-0`}>
            {rankLabel}
          </span>
        )}
        {mayStateThePercentage && (
          <div
            className="flex-1 h-1.5 rounded-full bg-panel-border overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Relative influence"
          >
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {mayStateThePercentage && (
          <span className={`${typography.panelMeta} text-text-body flex-shrink-0`}>
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <div className={`${typography.panelMeta} text-text-light mt-1`}>
        {fromLastRun ? LAST_RUN_PREFIX : ''}{INLINE_LABELS.influenceOnResults}
      </div>
    </div>
  )
}
