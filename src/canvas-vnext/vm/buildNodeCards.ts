// Stage-3 node-card builders — Decision, Factor, Risk, Outcome, Goal.
// Pure functions; every result-derived claim gates on the AnalysisContextVM.
//
// UI-SEM-077: factor flag priority ladder (top_driver > could_flip >
// weak_evidence > worth_checking), ONE flag max, live flags post-analysis
// only; worth_checking uses the shared confidence ladder's low band (<0.40,
// UI-SEM-010/017); 'worth_discussing' is fixture-only.
// UI-SEM-078: outcome goal-effect polarity words from computeSignedMean sign
// (model input); risk fragile-incidence count from the canonical matcher;
// decision lead sentence reuses the UI-SEM-072 fail-closed identity.

import { computeSignedMean } from '../../canvas/domain/edges'
import { isEdgeFragile } from '../../canvas/utils/fragileEdgeMatch'
import type { FragileEdgeCandidate } from '../../canvas/utils/fragileEdgeMatch'
import { formatWinProbability } from '../../canvas/utils/labelUtils'
import {
  decisionLeadSentence,
  sensitiveToLine,
  goalTargetLine,
  riskLikelihoodLine,
  riskImpactLine,
} from './strings'
import { detectStructural } from './buildRelationshipCard'
import type { DriverSignal, EvidenceGapSignal } from './resultSignals'
import type {
  AnalysisContextVM,
  DecisionCardVM,
  FactorCardVM,
  FactorFlag,
  RiskCardVM,
  OutcomeCardVM,
  GoalCardVM,
} from './types'

interface MinimalNode {
  id: string
  type?: string
  data?: Record<string, unknown> | undefined
}

interface MinimalEdge {
  id: string
  source: string
  target: string
  data?: Record<string, unknown> | undefined
}

/** Result-context inputs shared by the Stage-3 builders. */
export interface NodeCardResultInputs {
  /** Canonical state copy from useAnalysisDisplayState (null in fixtures
   * that want no state line). */
  stateHeadline: string | null
  driverSignals: readonly DriverSignal[]
  evidenceGapSignals: readonly EvidenceGapSignal[]
  /** selectHinge(sectionData)?.label — reused from buildResultsVM. */
  hingeLabel: string | null
}

function nodeLabel(n: MinimalNode): string {
  const label = n.data?.label
  return typeof label === 'string' && label ? label : 'Untitled'
}

function kindOf(n: MinimalNode): string | undefined {
  return n.type || (n.data?.kind as string | undefined)
}

// --- Decision ---------------------------------------------------------------

export function buildDecisionCards(
  nodes: readonly MinimalNode[],
  report: Record<string, any> | null,
  analysis: AnalysisContextVM,
  results: NodeCardResultInputs,
): Record<string, DecisionCardVM> {
  const cards: Record<string, DecisionCardVM> = {}

  let leadSentence: string | null = null
  if (analysis.hasResults && analysis.leadingOptionId != null && analysis.leadingOptionLabel != null) {
    const win = report?.option_probabilities?.[analysis.leadingOptionId]?.win_probability
    if (typeof win === 'number') {
      leadSentence = decisionLeadSentence(analysis.leadingOptionLabel, formatWinProbability(win))
    }
  }
  const sensitiveTo =
    analysis.hasResults && results.hingeLabel ? sensitiveToLine(results.hingeLabel) : null

  for (const n of nodes) {
    if (kindOf(n) !== 'decision') continue
    cards[n.id] = {
      nodeId: n.id,
      label: nodeLabel(n),
      stateLine: results.stateHeadline,
      leadSentence,
      sensitiveTo,
      isStaleResult: analysis.isStaleResult,
    }
  }
  return cards
}

// --- Factor ------------------------------------------------------------------

function factorValueDisplay(n: MinimalNode): string | null {
  const observed = n.data?.observedState as Record<string, unknown> | undefined
  const value = observed?.value
  if (value == null || value === '') return null
  const unit = typeof observed?.unit === 'string' && observed.unit ? ` ${observed.unit}` : ''
  return `${value}${unit}`
}

/** UI-SEM-077 ladder — live signals only, one flag, fail-closed. */
export function deriveFactorFlag(
  nodeId: string,
  analysis: AnalysisContextVM,
  results: NodeCardResultInputs,
): FactorFlag | null {
  if (!analysis.hasResults) return null
  const driver = results.driverSignals.find((d) => d.nodeId === nodeId)
  if (driver?.influenceRank === 1) return 'top_driver'
  if (driver?.canFlipResult) return 'could_flip'
  if (results.evidenceGapSignals.some((g) => g.nodeId === nodeId)) return 'weak_evidence'
  if (driver?.confidence != null && driver.confidence < 0.4) return 'worth_checking'
  return null
}

export function buildFactorCards(
  nodes: readonly MinimalNode[],
  analysis: AnalysisContextVM,
  results: NodeCardResultInputs,
  /** FIXTURE-ONLY overrides (demo map); the live adapter never passes this. */
  fixtureFactorFlags?: Record<string, FactorFlag>,
): Record<string, FactorCardVM> {
  const cards: Record<string, FactorCardVM> = {}
  for (const n of nodes) {
    if (kindOf(n) !== 'factor') continue
    const fixtureFlag = fixtureFactorFlags?.[n.id] ?? null
    const liveFlag = deriveFactorFlag(n.id, analysis, results)
    cards[n.id] = {
      nodeId: n.id,
      label: nodeLabel(n),
      valueDisplay: factorValueDisplay(n),
      flag: fixtureFlag ?? liveFlag,
      flagIsResultDerived: fixtureFlag == null && liveFlag != null,
      isStaleResult: analysis.isStaleResult,
    }
  }
  return cards
}

// --- Risk ---------------------------------------------------------------------

export function buildRiskCards(
  nodes: readonly MinimalNode[],
  edges: readonly MinimalEdge[],
  report: Record<string, any> | null,
  analysis: AnalysisContextVM,
): Record<string, RiskCardVM> {
  const cards: Record<string, RiskCardVM> = {}
  const fragileEdges: FragileEdgeCandidate[] = analysis.hasResults
    ? ((report?.robustness?.fragile_edges as FragileEdgeCandidate[] | undefined) ?? [])
    : []

  for (const n of nodes) {
    if (kindOf(n) !== 'risk') continue

    const probability = n.data?.probability
    const impact = n.data?.impact
    const fragileLinkCount =
      fragileEdges.length === 0
        ? 0
        : edges.filter(
            (e) =>
              (e.source === n.id || e.target === n.id) &&
              isEdgeFragile(e.id, e.source, e.target, fragileEdges),
          ).length

    cards[n.id] = {
      nodeId: n.id,
      label: nodeLabel(n),
      likelihoodDisplay: typeof probability === 'number' ? riskLikelihoodLine(probability) : null,
      impactDisplay: typeof impact === 'string' && impact ? riskImpactLine(impact) : null,
      fragileLinkCount,
      isStaleResult: analysis.isStaleResult,
    }
  }
  return cards
}

// --- Outcome -------------------------------------------------------------------

export function buildOutcomeCards(
  nodes: readonly MinimalNode[],
  edges: readonly MinimalEdge[],
): Record<string, OutcomeCardVM> {
  const cards: Record<string, OutcomeCardVM> = {}
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const goalIds = new Set(nodes.filter((n) => kindOf(n) === 'goal').map((n) => n.id))

  for (const n of nodes) {
    if (kindOf(n) !== 'outcome') continue

    // Polarity of this outcome's causal edge toward a goal — model input.
    // Structural edges never carry polarity; no goal-directed edge ⇒ null.
    let goalEffect: 'helps' | 'hurts' | null = null
    const goalEdge = edges.find(
      (e) => e.source === n.id && goalIds.has(e.target) && !detectStructural(e, nodesById).isStructural,
    )
    if (goalEdge) {
      const signed = computeSignedMean(goalEdge.data)
      goalEffect = signed === 0 ? null : signed > 0 ? 'helps' : 'hurts'
    }

    cards[n.id] = { nodeId: n.id, label: nodeLabel(n), goalEffect }
  }
  return cards
}

// --- Goal ----------------------------------------------------------------------

export function buildGoalCards(
  nodes: readonly MinimalNode[],
  analysis: AnalysisContextVM,
): Record<string, GoalCardVM> {
  const cards: Record<string, GoalCardVM> = {}
  for (const n of nodes) {
    if (kindOf(n) !== 'goal') continue
    const hasTarget = analysis.goalThreshold != null
    cards[n.id] = {
      nodeId: n.id,
      label: nodeLabel(n),
      // Raw user units, untransformed (UI-SEM-071 family: user target only).
      targetDisplay: hasTarget ? goalTargetLine(String(analysis.goalThreshold)) : null,
      needsTargetHint: !hasTarget,
    }
  }
  return cards
}
