/**
 * useNodeAttention — this node's "Worth reviewing" reasons, or null.
 *
 * The plan is GRAPH-LEVEL (a budget ranks nodes against each other), so it is
 * computed once per canvas state and shared: every card asks the same cached
 * plan for its own id. The inputs are the producer fields the cards already
 * read — the published ranks come from `rankFactor`, the same derivation
 * `useNodeDisplayMetadata` uses — so the marker can never disagree with the
 * card about a rank. See `nodes/shared/nodeAttention.ts` for the rules.
 */
import { useCanvasStore } from '../store'
import { useModelChangedSinceRun } from './useModelChangedSinceRun'
import { rankFactor } from './rankFactor'
import { selectDriverPolicyFeed } from '../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../components/results/types'
import { sanitizeCoachingText } from '../../components/results/utils/cleanFactorLabel'
import { resolveBiasSignal } from '../shared/biasSignalTitles'
import { deriveAttentionPlan, type AttentionReason } from '../nodes/shared/nodeAttention'
import { selectFactorTurningPoint } from '../nodes/shared/factorTurningPoint'

type Plan = ReadonlyMap<string, readonly AttentionReason[]>
const EMPTY: Plan = new Map()

let cache: { deps: readonly unknown[]; plan: Plan } | null = null

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

/** Exported for tests: the plan for the given inputs, memoised on identity. */
export function attentionPlanFor(
  report: unknown,
  resultsComplete: boolean,
  ceeAnalysisReady: unknown,
  runBiasFindings: unknown,
  nodeIdsKey: string,
  factorIdsKey: string,
  runIsStale: boolean,
): Plan {
  const deps = [report, resultsComplete, ceeAnalysisReady, runBiasFindings, nodeIdsKey, factorIdsKey, runIsStale]
  if (cache && sameDeps(cache.deps, deps)) return cache.plan

  const nodeIds = new Set(nodeIdsKey ? nodeIdsKey.split('\u0000') : [])
  const factorIds = factorIdsKey ? factorIdsKey.split('\u0000') : []
  const r = (resultsComplete ? report : null) as Record<string, unknown> | null
  const robustness = (r?.robustness ?? null) as Record<string, unknown> | null

  const factorRanks = new Map<string, { sensitivityRank: number | null; voiRank: number | null }>()
  const turningPointNodeIds = new Set<string>()
  if (r) {
    for (const id of factorIds) {
      if (selectFactorTurningPoint(r, id) !== null) turningPointNodeIds.add(id)
    }
    const feed = selectDriverPolicyFeed(r as unknown as ResultsReport)
    for (const id of factorIds) {
      const ranks = rankFactor(feed.policyRows, feed.displayModel, id)
      factorRanks.set(id, { sensitivityRank: ranks.sensitivityRank, voiRank: ranks.voiRank })
    }
  }

  const cee = (ceeAnalysisReady ?? null) as { bias_findings?: unknown } | null
  const plan =
    nodeIds.size === 0
      ? EMPTY
      : deriveAttentionPlan({
          nodeIds,
          factorRanks,
          turningPointNodeIds,
          fragileEdges: Array.isArray(robustness?.fragile_edges) ? (robustness!.fragile_edges as unknown[]) : null,
          ceeBiasFindings: Array.isArray(cee?.bias_findings) ? (cee!.bias_findings as unknown[]) : null,
          runBiasFindings: resultsComplete && Array.isArray(runBiasFindings) ? (runBiasFindings as unknown[]) : null,
          runIsStale,
          resolveBiasTitle: (code) => resolveBiasSignal(code)?.title ?? null,
          cleanText: sanitizeCoachingText,
        })
  cache = { deps, plan }
  return plan
}

export function useNodeAttention(nodeId: string): readonly AttentionReason[] | null {
  const report = useCanvasStore((s) => s.results?.report)
  const resultsComplete = useCanvasStore((s) => s.results?.status === 'complete')
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  // M2 findings ride only once PLoT's review is complete (the results panel's
  // own gate, `useResultsSectionData`).
  const runBiasFindings = useCanvasStore((s) =>
    s.runMeta?.reviewStatus === 'complete'
      ? (s.runMeta?.m1ReviewAssumptions as { bias_findings?: unknown } | null | undefined)?.bias_findings
      : undefined,
  )
  const nodeIdsKey = useCanvasStore((s) => (s.nodes ?? []).map((n) => n.id).join('\u0000'))
  const factorIdsKey = useCanvasStore((s) =>
    (s.nodes ?? []).filter((n) => n.type === 'factor').map((n) => n.id).join('\u0000'),
  )
  // The ONE stale key the factor card uses (#1891, Paul's accepted Q2).
  const runIsStale = useModelChangedSinceRun()
  const plan = attentionPlanFor(
    report,
    resultsComplete,
    ceeAnalysisReady,
    runBiasFindings,
    nodeIdsKey,
    factorIdsKey,
    runIsStale,
  )
  return plan.get(nodeId) ?? null
}
