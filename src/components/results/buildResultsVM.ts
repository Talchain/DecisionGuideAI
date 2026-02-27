/**
 * buildResultsVM — Pure enrichment layer over ResultsSectionDataReturn.
 *
 * Adds 5 derived fields (decisionState, gapTop2, hinge, evidenceLevel, topAction)
 * without replacing the existing useResultsSectionData hook.
 *
 * Architecture: Option B — Layered Enrichment
 * useResultsSectionData() → ResultsSectionDataReturn
 *                              ↓
 *                    buildResultsVM(data, meta) → ResultsVM
 *                              ↓
 *                   Components read from ResultsVM
 */

import type { ResultsSectionDataReturn } from './useResultsSectionData'
import type {
  DecisionState,
  EvidenceLevel,
  HingeInfo,
  TopAction,
  BuildResultsVMMeta,
  ResultsVM,
  RobustnessLevel,
} from './types'
import { sanitizeCoachingText } from './utils/cleanFactorLabel'

// ─── Thresholds ─────────────────────────────────────────────────────────────

/** 10pp gap required to distinguish winner from runner-up */
export const GAP_THRESHOLD = 0.10

/** Stability must be >= 80% for robust classification */
export const ROBUST_THRESHOLD = 0.80

/** Below 55% stability → indeterminate */
export const SENSITIVE_THRESHOLD = 0.55

// ─── Stability Fallback ─────────────────────────────────────────────────────

/**
 * UI-SEM-007: Stability fabrication from categorical robustness level.
 * When PLoT omits numeric recommendation_stability, reverse-engineers an
 * approximate numeric value from the categorical level (high→0.85, etc.).
 * The fabricated value feeds deriveDecisionState (UI-SEM-006) — it is never
 * displayed numerically to users. The categorical label remains primary.
 * Classification: F.6 concern — PLoT should always provide numeric stability.
 * TODO: F.6 — remove when PLoT guarantees numeric recommendation_stability.
 */
const LEVEL_STABILITY_MAP: Record<string, number> = {
  high: 0.85,
  moderate: 0.65,
  low: 0.50,
  very_low: 0.35,
}

/**
 * Resolve a numeric stability value from available data.
 * Ladder: recommendationStability → robustnessLevel map → default 0.50
 *
 * Note: is_robust is NOT available in ResultsSectionDataReturn (it flows to
 * useAnalysisMetadata for the canvas stability chip). robustnessLevel already
 * covers the equivalent mapping (high→0.85, low→0.50).
 */
export function resolveStability(
  recommendationStability: number | undefined,
  robustnessLevel: RobustnessLevel | undefined,
): number {
  if (typeof recommendationStability === 'number') return recommendationStability
  if (robustnessLevel && robustnessLevel in LEVEL_STABILITY_MAP) {
    return LEVEL_STABILITY_MAP[robustnessLevel]
  }
  return 0.50
}

// ─── Decision State ─────────────────────────────────────────────────────────

/**
 * UI-SEM-006: DecisionState thresholds (GAP 0.10, ROBUST 0.80, SENSITIVE 0.55).
 * Derives tri-state decision classification (robust/sensitive/indeterminate)
 * from win-probability gap and stability score. These thresholds determine
 * user-facing coaching language. Acceptable at VM layer — display derivation.
 * Classification: VM-layer display derivation — legitimate.
 *
 * Derive the tri-state decision classification.
 * Gap rule evaluated FIRST — prevents "robust" on indistinguishable winners.
 */
/**
 * V14.1: Decision state derives EXCLUSIVELY from computational robustness.
 * Readiness concerns (needs_framing, needs_evidence) surface through coaching
 * actions, readiness bars, and next-action items — not the decision dot.
 */
export function deriveDecisionState(
  gapTop2: number,
  stability: number | null | undefined,
): DecisionState {
  // V12.2: Handle null/undefined stability (treat as unknown data)
  if (stability == null) {
    if (gapTop2 < GAP_THRESHOLD) return 'indeterminate'
    if (gapTop2 >= 0.30) return 'sensitive'  // large gap, some signal
    return 'indeterminate'  // moderate gap but no stability data
  }

  if (gapTop2 < GAP_THRESHOLD) return 'indeterminate'
  if (stability >= ROBUST_THRESHOLD) return 'robust'
  if (stability >= SENSITIVE_THRESHOLD) return 'sensitive'
  return 'indeterminate'
}

// ─── Gap Computation ────────────────────────────────────────────────────────

/**
 * Compute absolute win-probability gap between #1 and #2.
 * All values in 0-1 scale.
 */
export function computeGapTop2(options: Array<{ winProbability?: number }>): number {
  if (options.length === 0) return 0
  const sorted = [...options].sort(
    (a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0),
  )
  const first = sorted[0].winProbability ?? 0
  if (sorted.length === 1) return first
  const second = sorted[1].winProbability ?? 0
  return Math.abs(first - second)
}

// ─── Hinge Selection ────────────────────────────────────────────────────────

/**
 * Select the single most important uncertainty (the "hinge").
 *
 * Priority:
 * 0. M1 coaching top_fragile_edge (highest authority — coaching's explicit pick)
 * 1. Fragile edge with highest |switch_probability| (from robustness topFragileEdge)
 * 2. Top VOI evidence gap
 * 3. Heuristic: |elasticity| × (1 - confidence) from drivers
 * 4. null
 */
export function selectHinge(data: ResultsSectionDataReturn): HingeInfo | null {
  // Priority 0: M1 coaching top fragile edge (coaching's explicit pick)
  const coachingEdge = data.confidence.m1CoachingTopFragileEdge
  if (coachingEdge && coachingEdge.fromId) {
    return {
      label: sanitizeCoachingText(coachingEdge.fromLabel),
      nodeId: coachingEdge.fromId,
      kind: 'edge',
      reason: 'fragile_edge',
      edgeDetail: `${sanitizeCoachingText(coachingEdge.fromLabel)} to ${sanitizeCoachingText(coachingEdge.toLabel)}`,
      alternativeWinnerLabel: coachingEdge.alternativeWinnerLabel ?? null,
    }
  }

  // Priority 1: Top fragile edge from robustness (sorted by switch_probability in useResultsSectionData)
  const tfe = data.confidence.topFragileEdge
  if (tfe && tfe.fromId) {
    return {
      label: sanitizeCoachingText(tfe.fromLabel),
      nodeId: tfe.fromId,
      kind: 'edge',
      reason: 'fragile_edge',
      edgeDetail: `${sanitizeCoachingText(tfe.fromLabel)} to ${sanitizeCoachingText(tfe.toLabel)}`,
      alternativeWinnerLabel: tfe.alternativeWinnerLabel ?? null,
    }
  }

  // Priority 2: Top evidence gap by VOI
  const topGap = data.confidence.topEvidenceGaps?.[0] ?? data.confidence.evidenceGaps?.[0]
  if (topGap) {
    return {
      label: sanitizeCoachingText(topGap.factorLabel),
      nodeId: topGap.targetNodeId ?? topGap.factorId,
      kind: 'node',
      reason: 'voi',
      edgeDetail: null,
      alternativeWinnerLabel: null,
    }
  }

  // Priority 3: Heuristic — |elasticity| × (1 - confidence)
  const drivers = data.drivers.drivers
  if (drivers.length > 0) {
    let bestScore = -1
    let bestDriver = drivers[0]
    for (const d of drivers) {
      const score = Math.abs(d.rawElasticity) * (1 - (d.confidence ?? 0))
      if (score > bestScore) {
        bestScore = score
        bestDriver = d
      }
    }
    if (bestDriver && bestScore > 0) {
      return {
        label: sanitizeCoachingText(bestDriver.factorLabel),
        nodeId: bestDriver.matchedNodeId ?? bestDriver.factorKey,
        kind: 'node',
        reason: 'heuristic',
        edgeDetail: null,
        alternativeWinnerLabel: bestDriver.fragileEdgeInfo?.alternativeWinnerLabel ?? null,
      }
    }
  }

  return null
}

// ─── Evidence Level ─────────────────────────────────────────────────────────

/**
 * Derive evidence quality from decision state + fragile ratio.
 * fragileRatio = fragileEdgeCount / totalEdgeCount (0 when data missing).
 */
export function deriveEvidenceLevel(
  state: DecisionState,
  fragileEdgeCount: number,
  totalEdgeCount: number,
): EvidenceLevel {
  const fragileRatio = totalEdgeCount > 0 ? fragileEdgeCount / totalEdgeCount : 0

  if (state === 'robust' && fragileRatio <= 0.1) return 'good'
  if (state === 'indeterminate' || fragileRatio > 0.3) return 'needs_work'
  return 'fair'
}

// ─── Top Action ─────────────────────────────────────────────────────────────

function deriveTopAction(hinge: HingeInfo | null): TopAction | null {
  if (!hinge) return null
  return {
    label: hinge.label,
    nodeId: hinge.nodeId,
    couldFlip: hinge.reason === 'fragile_edge',
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export function buildResultsVM(
  data: ResultsSectionDataReturn,
  meta?: BuildResultsVMMeta,
): ResultsVM {
  const { recommendation, confidence } = data

  // Gap
  const gapTop2 = computeGapTop2(recommendation.allOptions)

  // Stability
  const stability = resolveStability(
    recommendation.recommendationStability,
    recommendation.robustnessLevel,
  )

  // Decision state
  const decisionState = deriveDecisionState(
    gapTop2,
    stability,
  )

  // Hinge
  const hinge = selectHinge(data)

  // Evidence level
  const fragileEdgeCount = meta?.fragileEdgeCount ?? confidence.totalHighRiskEdges ?? 0
  const totalEdgeCount = meta?.totalEdgeCount ?? 0
  const evidenceLevel = deriveEvidenceLevel(decisionState, fragileEdgeCount, totalEdgeCount)

  // Top action
  const topAction = deriveTopAction(hinge)

  return {
    decisionState,
    gapTop2,
    hinge,
    evidenceLevel,
    topAction,
    raw: data,
  }
}
