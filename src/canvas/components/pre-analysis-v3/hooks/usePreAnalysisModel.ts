/**
 * usePreAnalysisModel — the single derivation for every v3 panel section.
 *
 * Single source of truth: all sections render from this memoised model, so
 * one store commit (e.g. saving the success measure) updates bars, ladder,
 * pills, signals and footer in the same pass. The only local state anywhere
 * in the panel tree is uncommitted input text.
 */

import { useEffect, useMemo } from 'react'
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
import { CEE_FALLBACK_COPY, FOOTER_COPY, LADDER_COPY } from '../constants'
import { guardCeeText, guardCeeTextOrNull, categoriseCoaching } from '../signals/ceeTextGuard'
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
  // Stored goal constraints (CEE response root, ingested verbatim by
  // DraftChat/applyDraftResult) — the provenance carrier for the
  // success-target attribution (lane 35 fix 2).
  const goalConstraints = useCanvasStore(s => s.goalConstraints)
  const sensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const currentBriefText = useCanvasStore(s => s.currentBriefText)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const { readiness } = useGraphReadiness()
  const seen = useSignalSessionStore(s => s.seen)
  const markSeen = useSignalSessionStore(s => s.markSeen)
  const ensureScenario = useSignalSessionStore(s => s.ensureScenario)

  // Bind the ledger to the scenario. The store-side check also covers
  // scenario switches that happened while the panel was unmounted (the
  // module-level ledger outlives mounts).
  useEffect(() => {
    ensureScenario(scenarioId)
  }, [scenarioId, ensureScenario])

  const facts = useMemo(() => computeGraphFacts(nodes), [nodes])

  const success = useMemo(
    () =>
      computeSuccessState(
        facts.goalNode,
        (analysisReady as Record<string, unknown> | null) ?? null,
        null,
        goalConstraints,
      ),
    [facts.goalNode, analysisReady, goalConstraints],
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

  // UI-SEM-091: runnable-via-scaffold. CEE (#612) rides a scaffold intent on
  // the readiness response; when it will draft the remaining options the graph
  // is runnable despite can_run_analysis being false. Both the footer and the
  // ladder disclose it instead of showing the not-ready copy.
  const willScaffoldOptions = readiness?.scaffold_plan?.will_scaffold_options === true
  const scaffoldOptionCount = readiness?.scaffold_plan?.option_count

  const ladder = useMemo(
    () =>
      computeLadder({
        goalPresent: facts.goalNode != null,
        successSet: success.isSet,
        topUncalibrated: top,
        canRunAnalysis: readiness ? readiness.can_run_analysis : null,
        readinessExplanation: readiness?.confidence_explanation
          ? guardCeeText(readiness.confidence_explanation, LADDER_COPY.readiness_fallback).text
          : null,
        willScaffoldOptions,
        scaffoldOptionCount,
      }),
    [facts.goalNode, success.isSet, top, readiness, willScaffoldOptions, scaffoldOptionCount],
  )

  const narrowFramingDetail = useMemo(() => {
    const signal = draftCoaching?.biasSignals?.find(b => b.type === 'narrow_framing')
    const detail = signal?.detail && signal.detail.trim().length > 0 ? signal.detail : null
    // Glossary guard: an unsafe swap degrades to the deterministic copy.
    return guardCeeTextOrNull(detail)
  }, [draftCoaching])

  const biasFindingExplanation = useMemo(() => {
    const findings = (analysisReady as { bias_findings?: Array<{ explanation?: string }> } | null)
      ?.bias_findings
    const first = findings?.find(f => typeof f.explanation === 'string' && f.explanation.length > 0)
    if (!first?.explanation) return null
    // Glossary guard: unsafe CEE wording degrades to a safe coaching line.
    return guardCeeText(first.explanation, CEE_FALLBACK_COPY.biasRow).text
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

  const coaching = useMemo(() => {
    const raw =
      draftCoaching?.summary?.trim() ||
      ((analysisReady as { coaching_summary?: string | null } | null)?.coaching_summary?.trim() ??
        '')
    if (!raw) return null
    // Sanitise in place first; only if a residual term has no safe substitute
    // do we fall back, and then to a fallback matched to the coaching's theme.
    const category = categoriseCoaching(raw)
    const fallback =
      category === 'framing'
        ? CEE_FALLBACK_COPY.heroFraming
        : category === 'assumption'
          ? CEE_FALLBACK_COPY.heroAssumption
          : category === 'comparison'
            ? CEE_FALLBACK_COPY.heroComparison
            : CEE_FALLBACK_COPY.heroCoaching
    return {
      text: guardCeeText(raw, fallback).text,
      attribution: { kind: 'olumi' } as Attribution,
    }
  }, [draftCoaching, analysisReady])

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

  // UI-SEM-091: effective runnable ORs the scaffold intent, so advanced.canRun
  // and the footer agree with the run gate (canRunAnalysis util).
  const canRun = readiness ? readiness.can_run_analysis || willScaffoldOptions : null
  const footer = useMemo(() => {
    // UI-SEM-091: readiness reports not-runnable, but CEE will draft the
    // remaining options — disclose the draft, never the not-ready copy.
    if (readiness?.can_run_analysis === false && willScaffoldOptions) {
      return {
        dot: 'warning' as const,
        headline: FOOTER_COPY.ready,
        subline:
          typeof scaffoldOptionCount === 'number'
            ? FOOTER_COPY.scaffoldSub(scaffoldOptionCount)
            : FOOTER_COPY.scaffoldSubNoCount,
      }
    }
    if (canRun === false) {
      const explanation = readiness?.confidence_explanation?.trim()
      return {
        dot: 'muted' as const,
        headline: FOOTER_COPY.notReady,
        subline: explanation
          ? guardCeeText(explanation, FOOTER_COPY.notReadySubFallback).text
          : FOOTER_COPY.notReadySubFallback,
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
  }, [
    canRun,
    willScaffoldOptions,
    scaffoldOptionCount,
    success.isSet,
    top,
    readiness?.can_run_analysis,
    readiness?.confidence_explanation,
  ])

  // Memoised slices so the memo()'d sections actually bail out when their
  // inputs are unchanged (a fresh object tree every render defeats them).
  const hero = useMemo(() => {
    const decisionLabel = facts.decisionNode
      ? ((facts.decisionNode.data as Record<string, unknown>)?.label as string | undefined)
      : undefined
    // The user's own question outranks the drafted decision label (item 6).
    const briefTitle = currentBriefText?.trim()
    const goalLabel = facts.goalNode
      ? ((facts.goalNode.data as Record<string, unknown>)?.label as string | undefined)
      : undefined
    return {
      decisionTitle: briefTitle && briefTitle.length > 0 ? briefTitle : decisionLabel ?? null,
      goal: facts.goalNode ? { nodeId: facts.goalNode.id, label: goalLabel ?? '' } : null,
      success,
      goalNodeId: facts.goalNode?.id ?? null,
      coaching,
    }
  }, [facts.decisionNode, facts.goalNode, currentBriefText, success, coaching])

  const estimates = useMemo(
    () => ({ rows, rankingSource: ranking.source, ...rowCounts }),
    [rows, ranking.source, rowCounts],
  )

  const advanced = useMemo(
    () => ({
      factorCount: facts.factorNodes.length,
      connectionCount: edges.length,
      readinessScore: readiness?.readiness_score ?? null,
      canRun,
      aiEstimatedCount: provenance.aiEstimatedCount,
      reviewedCount: provenance.reviewedCount,
    }),
    [facts.factorNodes.length, edges.length, readiness?.readiness_score, canRun, provenance],
  )

  return useMemo(
    () => ({
      hero,
      bars,
      ladder,
      sharpen: derived.sharpen,
      estimates,
      options,
      risks,
      advanced,
      footer,
    }),
    [hero, bars, ladder, derived.sharpen, estimates, options, risks, advanced, footer],
  )
}
