/**
 * usePreAnalysisModel — the single derivation for every v3 panel section.
 *
 * Single source of truth: all sections render from this memoised model, so
 * one store commit (e.g. saving the success measure) updates bars, ladder,
 * pills, signals and footer in the same pass. The only local state anywhere
 * in the panel tree is uncommitted input text.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useCanvasStore } from '../../../store'
import { useGraphReadiness } from '../../../hooks/useGraphReadiness'
import { isReviewedByUser } from '../../pre-analysis/utils/isReviewedByUser'
import { computeBars, type BarsModel } from '../selectors/computeBars'
import { computeEstimateRanking } from '../selectors/computeEstimateRanking'
import { computeGraphFacts, computeProvenanceCounts } from '../selectors/graphFacts'
import { computeInfluenceCoverage } from '../selectors/computeInfluenceCoverage'
import { computeLadder } from '../selectors/computeLadder'
import { computeSuccessState, type SuccessState } from '../selectors/computeSuccessState'
import { buildEstimateRows, topUncalibrated } from '../selectors/buildEstimateRows'
import { deriveSignalViews } from '../signals/deriveSignalViews'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import { FOOTER_COPY } from '../constants'
import type {
  Attribution,
  EstimateRowModel,
  LadderStep,
  RankingSource,
  SignalView,
} from '../types'

export interface PreAnalysisModel {
  hero: {
    decisionTitle: string | null
    goal: { nodeId: string; label: string } | null
    success: SuccessState
    goalNodeId: string | null
    coaching: { text: string; attribution: Attribution } | null
  }
  bars: BarsModel
  ladder: LadderStep
  sharpen: SignalView[]
  estimates: {
    rows: EstimateRowModel[]
    rankingSource: RankingSource
    checkedCount: number
    checkableCount: number
    needsValueCount: number
  }
  options: Array<{ nodeId: string; label: string }>
  risks: Array<{ nodeId: string; label: string; attribution: Attribution }>
  advanced: {
    factorCount: number
    connectionCount: number
    readinessScore: number | null
    canRun: boolean | null
    aiEstimatedCount: number
    reviewedCount: number
  }
  footer: {
    dot: 'muted' | 'warning' | 'success'
    headline: string
    subline: string
  }
}

export function usePreAnalysisModel(): PreAnalysisModel {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const draftCoaching = useCanvasStore(s => s.draftCoaching)
  const analysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const sensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const currentBriefText = useCanvasStore(s => s.currentBriefText)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const { readiness } = useGraphReadiness()
  const seen = useSignalSessionStore(s => s.seen)
  const markSeen = useSignalSessionStore(s => s.markSeen)
  const resetLedger = useSignalSessionStore(s => s.reset)

  // Session ledger resets when the scenario changes (not on first mount).
  const prevScenarioRef = useRef(scenarioId)
  useEffect(() => {
    if (prevScenarioRef.current !== scenarioId) {
      prevScenarioRef.current = scenarioId
      resetLedger()
    }
  }, [scenarioId, resetLedger])

  const facts = useMemo(() => computeGraphFacts(nodes), [nodes])

  const success = useMemo(
    () =>
      computeSuccessState(
        facts.goalNode,
        (analysisReady as Record<string, unknown> | null) ?? null,
        null,
      ),
    [facts.goalNode, analysisReady],
  )

  const provenance = useMemo(
    () => computeProvenanceCounts(facts.factorNodes),
    [facts.factorNodes],
  )

  const ranking = useMemo(
    () => computeEstimateRanking(facts.factorNodes, edges, sensitivity),
    [facts.factorNodes, edges, sensitivity],
  )

  const rows = useMemo(
    () => buildEstimateRows(facts.factorNodes, ranking, null),
    [facts.factorNodes, ranking],
  )

  const top = useMemo(() => topUncalibrated(rows), [rows])

  const rowCounts = useMemo(() => {
    const needsValueCount = rows.filter(r => r.needsValue).length
    return {
      checkedCount: rows.filter(r => r.reviewed).length,
      checkableCount: rows.length - needsValueCount,
      needsValueCount,
    }
  }, [rows])

  const coverage = useMemo(
    () => computeInfluenceCoverage(facts.factorNodes, ranking.weights, isReviewedByUser),
    [facts.factorNodes, ranking.weights],
  )

  const decisionPresent =
    facts.decisionNode != null || (currentBriefText != null && currentBriefText.trim().length > 0)

  const bars = useMemo(
    () =>
      computeBars({
        decisionPresent,
        goalPresent: facts.goalNode != null,
        successSet: success.isSet,
        optionCount: facts.optionCount,
        riskCount: facts.riskCount,
        estimates: {
          coverage: coverage.influenceCoverage,
          ...rowCounts,
        },
      }),
    [decisionPresent, facts, success.isSet, coverage.influenceCoverage, rowCounts],
  )

  const ladder = useMemo(
    () =>
      computeLadder({
        goalPresent: facts.goalNode != null,
        successSet: success.isSet,
        topUncalibrated: top,
        canRunAnalysis: readiness ? readiness.can_run_analysis : null,
        readinessExplanation: readiness?.confidence_explanation ?? null,
      }),
    [facts.goalNode, success.isSet, top, readiness],
  )

  const narrowFramingDetail = useMemo(() => {
    const signal = draftCoaching?.biasSignals?.find(b => b.type === 'narrow_framing')
    return signal?.detail && signal.detail.trim().length > 0 ? signal.detail : null
  }, [draftCoaching])

  const biasFindingExplanation = useMemo(() => {
    const findings = (analysisReady as { bias_findings?: Array<{ explanation?: string }> } | null)
      ?.bias_findings
    const first = findings?.find(f => typeof f.explanation === 'string' && f.explanation.length > 0)
    return first?.explanation ?? null
  }, [analysisReady])

  const derived = useMemo(
    () =>
      deriveSignalViews(
        {
          goalPresent: facts.goalNode != null,
          successSet: success.isSet,
          optionCount: facts.optionCount,
          riskCount: facts.riskCount,
          risksAllOlumi: facts.risksAllOlumi,
          aiEstimatedCount: provenance.aiEstimatedCount,
          topUncalibrated: top,
          narrowFramingDetail,
          biasFindingExplanation,
        },
        seen,
      ),
    [facts, success.isSet, provenance.aiEstimatedCount, top, narrowFramingDetail, biasFindingExplanation, seen],
  )

  useEffect(() => {
    if (derived.newlySeen.length > 0) markSeen(derived.newlySeen, Date.now())
  }, [derived.newlySeen, markSeen])

  const coachingText =
    draftCoaching?.summary?.trim() ||
    ((analysisReady as { coaching_summary?: string | null } | null)?.coaching_summary?.trim() ?? '')

  const options = useMemo(
    () =>
      nodes
        .filter(n => {
          const kind = (n.data as Record<string, unknown> | undefined)?.kind ?? n.type
          return kind === 'option'
        })
        .map(n => ({
          nodeId: n.id,
          label:
            typeof (n.data as Record<string, unknown>)?.label === 'string'
              ? ((n.data as Record<string, unknown>).label as string)
              : n.id,
        })),
    [nodes],
  )

  const risks = useMemo(
    () =>
      nodes
        .filter(n => {
          const kind = (n.data as Record<string, unknown> | undefined)?.kind ?? n.type
          return kind === 'risk'
        })
        .map(n => {
          const data = n.data as Record<string, unknown>
          return {
            nodeId: n.id,
            label: typeof data?.label === 'string' ? (data.label as string) : n.id,
            attribution: (data?.provenance === 'ai_inferred'
              ? { kind: 'olumi' }
              : { kind: 'person', displayName: 'You' }) as Attribution,
          }
        }),
    [nodes],
  )

  const canRun = readiness ? readiness.can_run_analysis : null
  const footer = useMemo(() => {
    if (canRun === false) {
      return {
        dot: 'muted' as const,
        headline: FOOTER_COPY.notReady,
        subline: readiness?.confidence_explanation?.trim() || FOOTER_COPY.notReadySubFallback,
      }
    }
    if (!success.isSet) {
      return {
        dot: 'warning' as const,
        headline: FOOTER_COPY.ready,
        subline: FOOTER_COPY.readySubSuccessUnset,
      }
    }
    return {
      dot: 'success' as const,
      headline: FOOTER_COPY.ready,
      subline: top ? FOOTER_COPY.readySubEstimates : FOOTER_COPY.readySubAllSet,
    }
  }, [canRun, success.isSet, top, readiness?.confidence_explanation])

  const decisionLabel = facts.decisionNode
    ? ((facts.decisionNode.data as Record<string, unknown>)?.label as string | undefined)
    : undefined
  // The user's own question outranks the drafted decision label (item 6).
  const briefTitle = currentBriefText?.trim()
  const goalLabel = facts.goalNode
    ? ((facts.goalNode.data as Record<string, unknown>)?.label as string | undefined)
    : undefined

  return {
    hero: {
      decisionTitle: briefTitle && briefTitle.length > 0 ? briefTitle : decisionLabel ?? null,
      goal: facts.goalNode ? { nodeId: facts.goalNode.id, label: goalLabel ?? '' } : null,
      success,
      goalNodeId: facts.goalNode?.id ?? null,
      coaching: coachingText ? { text: coachingText, attribution: { kind: 'olumi' } } : null,
    },
    bars,
    ladder,
    sharpen: derived.sharpen,
    estimates: {
      rows,
      rankingSource: ranking.source,
      ...rowCounts,
    },
    options,
    risks,
    advanced: {
      factorCount: facts.factorNodes.length,
      connectionCount: edges.length,
      readinessScore: readiness?.readiness_score ?? null,
      canRun,
      aiEstimatedCount: provenance.aiEstimatedCount,
      reviewedCount: provenance.reviewedCount,
    },
    footer,
  }
}
