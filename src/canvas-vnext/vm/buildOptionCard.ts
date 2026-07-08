// Option card builder (UI-SEM-072 status banding, UI-SEM-073 key reason).
//
// The key reason is a PARITY RE-DERIVATION of OptionNode.tsx's
// computeBehindReason + getBehindReasonContext + the behindReason memo's
// leader tolerance (1e-4) and identical-reason suppression (UI-SEM-067).
// OptionNode.tsx churned in #239 and is deliberately not edited or imported;
// parity is pinned by buildOptionCard.spec.ts shared fixtures. If the two
// ever diverge, fix the derivation here to match OptionNode, never the
// reverse.
//
// Status banding is deliberately STRICTER than OptionNode's isRecommended:
// there is no win-max fallback when the producer recommendation is missing —
// fail-closed identity comes from buildAnalysisContext (UI-SEM-072).

import { GAP_THRESHOLD } from '../../components/results/buildResultsVM'
import {
  cleanFactorLabel,
  formatWinProbability,
  unwrapInterventionValue,
} from '../../canvas/utils/labelUtils'
import { detectBaseline } from '../../canvas/utils/baselineDetection'
import type { AnalysisContextVM, OptionCardVM, OptionCardStatus } from './types'

interface MinimalNode {
  id: string
  type?: string
  data?: Record<string, unknown> | undefined
}

type CeeAnalysisReadyLike = {
  options?: { id: string; interventions?: Record<string, unknown> }[]
} | null

export interface OptionCardsInputs {
  nodes: readonly MinimalNode[]
  report: Record<string, any> | null
  ceeAnalysisReady: CeeAnalysisReadyLike
  analysis: AnalysisContextVM
}

function isOptionNode(n: MinimalNode): boolean {
  return n.type === 'option' || n.data?.type === 'option'
}

function nodeLabel(n: MinimalNode): string {
  const label = n.data?.label
  return typeof label === 'string' && label ? label : n.id
}

function isBaselineOption(n: MinimalNode): boolean {
  const explicit = n.data?.is_baseline as boolean | null | undefined
  return explicit ?? detectBaseline((n.data?.label as string) ?? '').isBaseline
}

// --- Behind-reason parity (mirrors OptionNode.tsx:32-149) -------------------

const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i
function stripFactorSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

interface BehindReasonContext {
  recommendedOptionId: string | undefined
  hasSensitivity: boolean
  topFactorId: string | undefined
  strippedLabel: string | null
  winnerInterventions: Record<string, unknown>
}

function buildBehindReasonContext(
  report: any,
  ceeAnalysisReady: CeeAnalysisReadyLike,
  nodes: readonly MinimalNode[],
): BehindReasonContext {
  const recommendedOptionId = report?.robustness?.recommended_option_id as string | undefined
  const sensitivity = report?.enrichment?.sensitivity_analysis?.factors ?? report?.factor_sensitivity ?? []
  const hasSensitivity = Array.isArray(sensitivity) && sensitivity.length > 0

  let topFactorId: string | undefined
  let strippedLabel: string | null = null
  if (hasSensitivity) {
    const rankedFactors = [...sensitivity]
      .map((f: any) => ({
        id: (f.factor_id || f.factorId || f.node_id || f.nodeId) as string | undefined,
        label: (f.label ?? f.node_label) as string | undefined,
        score: Math.abs(f.importance_score ?? f.elasticity ?? f.sensitivity_score ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
    const topFactor = rankedFactors[0]
    topFactorId = topFactor?.id
    if (topFactorId) {
      const factorNode = nodes.find((n) => n.id === topFactorId)
      const factorLabel = topFactor?.label
        ?? (factorNode ? (cleanFactorLabel((factorNode.data?.label as string) ?? '') || (factorNode.data?.label as string)) : null)
        ?? null
      strippedLabel = factorLabel ? (stripFactorSuffixes(factorLabel) || factorLabel) : null
    }
  }

  const winnerCee = ceeAnalysisReady?.options?.find((opt) => opt.id === recommendedOptionId)
  return {
    recommendedOptionId,
    hasSensitivity,
    topFactorId,
    strippedLabel,
    winnerInterventions: winnerCee?.interventions ?? {},
  }
}

/** Parity mirror of OptionNode.tsx computeBehindReason (lines 113-149). */
export function computeBehindReasonParity(
  optionId: string,
  isBaseline: boolean,
  report: any,
  ceeAnalysisReady: CeeAnalysisReadyLike,
  nodes: readonly MinimalNode[],
  ctx?: BehindReasonContext,
): string | null {
  if (isBaseline) return 'no changes from current state'
  if (!report) return null

  const context = ctx ?? buildBehindReasonContext(report, ceeAnalysisReady, nodes)
  if (!context.recommendedOptionId) return null
  if (!context.hasSensitivity) return 'fewer key changes'
  if (!context.topFactorId || !context.strippedLabel) return 'fewer key changes'

  const thisCee = ceeAnalysisReady?.options?.find((opt) => opt.id === optionId)
  const thisInterventions = thisCee?.interventions ?? {}

  const winnerHasFactor = context.topFactorId in context.winnerInterventions
  const thisHasFactor = context.topFactorId in thisInterventions

  if (winnerHasFactor && !thisHasFactor) {
    return `no ${context.strippedLabel.toLowerCase()} added`
  }

  if (winnerHasFactor && thisHasFactor) {
    const { value: winnerVal } = unwrapInterventionValue(context.winnerInterventions[context.topFactorId])
    const { value: thisVal } = unwrapInterventionValue(thisInterventions[context.topFactorId])
    if (winnerVal != null && thisVal != null && Math.abs(winnerVal - thisVal) >= 1e-6) {
      return `${context.strippedLabel.toLowerCase()} lower`
    }
  }

  return 'fewer key changes'
}

// --- Card assembly ----------------------------------------------------------

export function buildOptionCards(inputs: OptionCardsInputs): Record<string, OptionCardVM> {
  const { nodes, report, ceeAnalysisReady, analysis } = inputs
  const optionNodes = nodes.filter(isOptionNode)
  const cards: Record<string, OptionCardVM> = {}
  if (optionNodes.length === 0) return cards

  const probs: Record<string, { win_probability?: number; goal_probability?: number }> =
    (analysis.hasResults ? report?.option_probabilities : undefined) ?? {}

  const leaderId = analysis.leadingOptionId
  const leaderWin = leaderId != null ? probs[leaderId]?.win_probability : undefined

  // Leader tolerance for the suppression pass — mirrors the behindReason memo
  // (UI-SEM-067): win within 1e-4 of the max is "the leader"; missing win ⇒
  // non-leader.
  const rates = optionNodes
    .map((n) => probs[n.id]?.win_probability)
    .filter((v): v is number => typeof v === 'number')
  const maxRate = rates.length > 0 ? Math.max(...rates) : null
  const isWinMaxLeader = (id: string): boolean => {
    const w = probs[id]?.win_probability
    return maxRate != null && typeof w === 'number' && w >= maxRate - 0.0001
  }

  const ctx = analysis.hasResults && report
    ? buildBehindReasonContext(report, ceeAnalysisReady, nodes)
    : undefined

  // First pass: raw reasons for every non-leading option (suppression input).
  const rawReasons = new Map<string, string | null>()
  if (analysis.hasResults && report) {
    for (const n of optionNodes) {
      if (leaderId != null && n.id === leaderId) {
        rawReasons.set(n.id, null)
        continue
      }
      rawReasons.set(
        n.id,
        computeBehindReasonParity(n.id, isBaselineOption(n), report, ceeAnalysisReady, nodes, ctx),
      )
    }
  }

  for (const n of optionNodes) {
    const baseline = isBaselineOption(n)
    const win = probs[n.id]?.win_probability

    let status: OptionCardStatus | null = null
    if (leaderId != null && n.id === leaderId) {
      status = 'leading'
    } else if (baseline) {
      status = 'baseline'
    } else if (leaderId != null && analysis.hasResults) {
      const gapKnown = typeof win === 'number' && typeof leaderWin === 'number'
      status = gapKnown && (leaderWin - win) < GAP_THRESHOLD ? 'close_second' : 'behind'
    }

    // Identical-reason suppression across non-leading siblings (UI-SEM-067).
    let keyReason: string | null = null
    const myReason = rawReasons.get(n.id) ?? null
    if (myReason) {
      const hasDuplicate = optionNodes.some((sibling) => {
        if (sibling.id === n.id || isWinMaxLeader(sibling.id)) return false
        return rawReasons.get(sibling.id) === myReason
      })
      keyReason = hasDuplicate ? null : myReason
    }

    const gapToLeaderPp =
      leaderId != null && n.id !== leaderId && typeof win === 'number' && typeof leaderWin === 'number'
        ? Math.max(0, Math.round((leaderWin - win) * 100))
        : null

    // Goal fit gates on the USER target only (UI-SEM-071): no target ⇒ no
    // goal claim, even when the producer synthesised a goal probability.
    const goalProb = probs[n.id]?.goal_probability
    const goalFitDisplay =
      analysis.goalThreshold != null && analysis.hasResults && typeof goalProb === 'number'
        ? formatWinProbability(goalProb)
        : null

    cards[n.id] = {
      nodeId: n.id,
      label: nodeLabel(n),
      status,
      winDisplay: analysis.hasResults && typeof win === 'number' ? formatWinProbability(win) : null,
      keyReason,
      gapToLeaderPp,
      goalFitDisplay,
      isStaleResult: analysis.isStaleResult,
    }
  }

  return cards
}
