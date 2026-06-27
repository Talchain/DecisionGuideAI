/**
 * Deterministic hero-state selection.
 *
 * Source of truth: docs/investigations/analysis-hero-v17.md §10. The
 * thresholds below are copied verbatim from that section; do not adjust
 * them here without updating the investigation.
 *
 * Note: the investigation referenced `decisionState` values of
 * `'GAP' | 'ROBUST' | 'SENSITIVE'`. The actual `ResultsVM.decisionState`
 * type is `'robust' | 'sensitive' | 'indeterminate'`. The mapping is
 * documented at the call site below.
 */

import type { DecisionState, RobustnessLevel } from '../types'
import type { HeroState } from './analysisHeroVM.types'

export interface StateSelectionInputs {
  /** Whether a recommended option exists. */
  hasWinner: boolean
  /** Tri-state from `buildResultsVM`. `'robust'` corresponds to the investigation's `ROBUST`;
   *  `'indeterminate'` corresponds to `GAP`; `'sensitive'` corresponds to `SENSITIVE`. */
  decisionState: DecisionState
  /** Numeric stability 0..1 from `data.recommendation.recommendationStability`. */
  stability: number | null
  /** Count of unresolved evidence gaps (from `data.confidence.topEvidenceGaps`). */
  evidenceGapCount: number
  /** Count of fragile connections (typically `meta.fragileEdgeCount`). */
  fragileEdgeCount: number
  /** Count of options in the analysis. */
  optionCount: number
  /** Count of bias findings (from `data.confidence.m2BiasFindings`). */
  biasFindings: number
  /** Optional framing-check flag — defaults to false in v1 (data not plumbed yet). */
  framingFlag: boolean
  /**
   * Display-safe robustness verdict (`data.recommendation.robustnessVerdict`).
   * REQUIRED for the confident 'strong' posture — raw `stability` alone must
   * never unlock "Ready to brief"/"Create decision brief" (single-source rule,
   * see ROBUSTNESS-VERDICT-CONTRACT). Undefined today → 'strong' is unreachable
   * and the hero falls back to the neutral 'moderate'/'reflect' posture.
   */
  robustnessVerdict?: RobustnessLevel | null
}

export function selectHeroState(input: StateSelectionInputs): HeroState {
  const {
    hasWinner,
    decisionState,
    stability,
    evidenceGapCount,
    fragileEdgeCount,
    optionCount,
    biasFindings,
    framingFlag,
    robustnessVerdict,
  } = input

  // 1. WEAK — no clear winner, low-stability with many gaps, many gaps,
  //    or only a single option.
  if (!hasWinner) return 'weak'
  if (stability !== null && stability < 0.5 && evidenceGapCount >= 3) return 'weak'
  if (evidenceGapCount >= 4) return 'weak'
  if (optionCount < 2) return 'weak'

  // 2. STRONG — confident "ready to brief" posture. Gated on the display-safe
  //    robustness verdict (`robustnessVerdict === 'high'`) IN ADDITION to the
  //    quality signals: high stability + ≤1 evidence gap + no fragile edges.
  //    Raw stability alone must NOT unlock the confident posture (single-source
  //    rule — ROBUSTNESS-VERDICT-CONTRACT). No display-safe verdict exists in
  //    the contract today, so this branch is currently unreachable and the hero
  //    falls back to the neutral 'moderate'/'reflect' posture instead of
  //    over-claiming "Ready to brief" from an uncertified stability number.
  if (
    robustnessVerdict === 'high' &&
    stability !== null && stability >= 0.85 &&
    evidenceGapCount <= 1 && fragileEdgeCount === 0
  ) {
    return 'strong'
  }

  // 3. REFLECT — stable result but reflective signals present.
  if (decisionState === 'robust' && (biasFindings >= 1 || framingFlag)) {
    return 'reflect'
  }

  // 4. Default — MODERATE.
  return 'moderate'
}
