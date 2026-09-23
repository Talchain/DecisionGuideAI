/**
 * The board-wide "Worth reviewing" plan, read per node. The plan itself is pure
 * (`nodeAttention.ts`); this hook only gathers its inputs from the store and
 * memoises ONE plan per input set at module level, so twenty cards asking do
 * not derive it twenty times.
 *
 * ⛔ RUN INPUTS ARE PASSED ONLY WHILE THE ANALYSIS IS CURRENT
 * (`useAnalysisResultsAreCurrent`) — the same licence the driver line uses, so
 * the marker can never name a rank the card itself withholds (purpose audit,
 * cross-cutting "one licence for all run-derived comparative claims").
 */
import { useCanvasStore } from '../../store'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { selectDriverPolicyFeed } from '../../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../../components/results/types'
import { resolveBiasSignal } from '../../shared/biasSignalTitles'
import { factorValueIsUnconfirmedEstimate } from '../../domain/valueProvenance'
import { resolveNodeTypeLiteral } from '../../domain/nodes'
import { rankFactor } from './rankFactor'
import { selectTurningPoints } from './factorTurningPoint'
import {
  deriveAttentionPlan,
  EMPTY_ATTENTION_PLAN,
  type AttentionPlan,
  type AttentionReason,
} from './nodeAttention'

type NodeLike = { id: string; type?: string; data?: Record<string, unknown> }

let cache: { deps: readonly unknown[]; plan: AttentionPlan } | null = null

const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

export function attentionPlanFor(
  nodes: ReadonlyArray<NodeLike> | undefined,
  report: unknown,
  runIsCurrent: boolean,
  ceeBiasFindings: unknown,
  reviewBiasFindings: unknown,
): AttentionPlan {
  const deps = [nodes, report, runIsCurrent, ceeBiasFindings, reviewBiasFindings]
  if (cache && same(cache.deps, deps)) return cache.plan
  if (!Array.isArray(nodes) || nodes.length === 0) {
    cache = { deps, plan: EMPTY_ATTENTION_PLAN }
    return EMPTY_ATTENTION_PLAN
  }

  const planNodes = nodes.map((n) => ({
    id: n.id,
    label: typeof n.data?.label === 'string' ? (n.data.label as string) : '',
    unconfirmedEstimate: resolveNodeTypeLiteral(n as never) === 'factor' && factorValueIsUnconfirmedEstimate(n.data),
  }))

  let run: Parameters<typeof deriveAttentionPlan>[0]['run'] = null
  if (runIsCurrent && report && typeof report === 'object') {
    const feed = selectDriverPolicyFeed(report as ResultsReport)
    const ranks = new Map<string, { sensitivityRank: number | null; voiRank: number | null; influenceSetSize: number }>()
    for (const n of nodes) {
      if (resolveNodeTypeLiteral(n as never) !== 'factor') continue
      if (!feed.policyRows.some((r) => r.key === n.id)) continue
      ranks.set(n.id, rankFactor(feed.policyRows, feed.displayModel, n.id))
    }
    const robustness = (report as { robustness?: { fragile_edges?: unknown } }).robustness
    const fragile = new Set<string>()
    if (Array.isArray(robustness?.fragile_edges)) {
      for (const fe of robustness!.fragile_edges as unknown[]) {
        const e = (fe ?? {}) as Record<string, unknown>
        const from = [e.from_id, e.fromId, e.source].find((v) => typeof v === 'string' && v.trim().length > 0)
        if (typeof from === 'string') fragile.add(from.trim())
      }
    }
    run = {
      ranks,
      turningPoints: selectTurningPoints(report),
      fragileEdgeSources: fragile,
      reviewBiasFindings: Array.isArray(reviewBiasFindings) ? reviewBiasFindings : [],
    }
  }

  const plan = deriveAttentionPlan({
    nodes: planNodes,
    run,
    ceeBiasFindings: Array.isArray(ceeBiasFindings) ? ceeBiasFindings : [],
    resolveBiasTitle: (code) => resolveBiasSignal(code)?.title ?? null,
  })
  cache = { deps, plan }
  return plan
}

export interface NodeAttention {
  /** The node's grounded reasons (drives the rail's evidence/behaviour icons). */
  reasons: readonly AttentionReason[]
  /** Whether this node carries the budgeted "Worth reviewing" marker. */
  marked: boolean
  markedCount: number
  candidateCount: number
}

const NONE: NodeAttention = { reasons: [], marked: false, markedCount: 0, candidateCount: 0 }

export function useNodeAttention(nodeId: string): NodeAttention {
  const nodes = useCanvasStore((s) => s.nodes) as unknown as NodeLike[] | undefined
  const report = useCanvasStore((s) => (s.results?.status === 'complete' ? s.results?.report : null))
  const ceeBiasFindings = useCanvasStore((s) => s.ceeAnalysisReady?.bias_findings)
  const reviewBiasFindings = useCanvasStore((s) =>
    s.runMeta?.reviewStatus === 'complete'
      ? (s.runMeta?.m1ReviewAssumptions as { bias_findings?: unknown } | null | undefined)?.bias_findings
      : undefined,
  )
  const runIsCurrent = useAnalysisResultsAreCurrent()
  const plan = attentionPlanFor(nodes, report, runIsCurrent, ceeBiasFindings, reviewBiasFindings)
  const reasons = plan.reasonsByNode.get(nodeId)
  if (!reasons) return NONE
  return {
    reasons,
    marked: plan.marked.has(nodeId),
    markedCount: plan.marked.size,
    candidateCount: plan.candidateCount,
  }
}
