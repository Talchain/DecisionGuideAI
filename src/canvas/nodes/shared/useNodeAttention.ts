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
 *
 * ⛔ AND "CURRENT" MEANS THE COMPOSED VERDICT TOO (reviewer blocker on Paul 23
 * Sep contract feedback points 11/14). The local-only hook lets a run through
 * when CEE's wire says `refused` / `unknown_degraded` over locally fresh fields
 * (its own docblock names that gap). `FactorNode` already withholds its driver
 * line and turning point on `useRunCurrency() !== 'current'` (Codex #63
 * 5801431996), so the rail and the inspector's "Worth reviewing" reasons must
 * too, or they name a rank / turning point the card withholds. Both must agree.
 *
 * ⭐ AND A KNOWN-CHANGED MODEL KEEPS THE LAST RUN'S CUE, LABELLED (design-gap
 * row 23; visual contract v3 §02 stale tooltip "Last run focus: these reasons
 * refer to the previous model."). Dropping the run's reasons the moment the
 * user edits silently deleted the run's focus. They are now kept — in
 * `fromLastRun`, NEVER in `reasons` — only when the model is KNOWN to have
 * changed since the run (`useModelChangedSinceRun`, the `'changed'` state every
 * other card surface labels `Last run ·` from). `reasons` keeps its contract
 * (current-only), so the inspector, which renders it verbatim, cannot present a
 * last-run reason as current. Cannot-confirm and never-run carry neither.
 */
import { useCanvasStore } from '../../store'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { useModelChangedSinceRun } from '../../hooks/useModelChangedSinceRun'
import { useRunCurrency } from './runCurrency'
import { selectDriverPolicyFeed } from '../../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../../components/results/types'
import { resolveBiasSignal } from '../../shared/biasSignalTitles'
import { factorValueIsUnconfirmedEstimate } from '../../domain/valueProvenance'
import { resolveNodeTypeLiteral } from '../../domain/nodes'
import { rankFactor } from './rankFactor'
import { selectTurningPoints } from './factorTurningPoint'
import {
  ATTENTION_BUDGET,
  deriveAttentionPlan,
  EMPTY_ATTENTION_PLAN,
  type AttentionPlan,
  type AttentionReason,
} from './nodeAttention'

type NodeLike = { id: string; type?: string; data?: Record<string, unknown> }

let cache: { deps: readonly unknown[]; plan: AttentionPlan } | null = null

const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

/**
 * The unit the factor CARD shows its value in, exactly as `FactorNode` passes it
 * to the turning-point track: `undefined` when the card shows no value (nothing
 * to disagree with), else the observed unit or `null`.
 */
function shownFactorUnit(data: Record<string, unknown> | undefined): string | null | undefined {
  const obs = (data?.observedState ?? data?.observed_state) as { value?: unknown; unit?: unknown } | undefined
  if (typeof obs?.value !== 'number') return undefined
  return typeof obs.unit === 'string' ? obs.unit : null
}

function planNodesOf(nodes: ReadonlyArray<NodeLike>) {
  return nodes.map((n) => ({
    id: n.id,
    label: typeof n.data?.label === 'string' ? (n.data.label as string) : '',
    unconfirmedEstimate: resolveNodeTypeLiteral(n as never) === 'factor' && factorValueIsUnconfirmedEstimate(n.data),
    factorUnit: shownFactorUnit(n.data),
  }))
}

/** The run-derived inputs, read from a completed report. Moved verbatim from `attentionPlanFor`. */
function runInputsOf(
  nodes: ReadonlyArray<NodeLike>,
  report: object,
  reviewBiasFindings: unknown,
): NonNullable<Parameters<typeof deriveAttentionPlan>[0]['run']> {
  const feed = selectDriverPolicyFeed(report as ResultsReport)
  const ranks = new Map<string, { sensitivityRank: number | null; voiRank: number | null; influenceSetSize: number; rankedSetSize: number }>()
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
  return {
    ranks,
    turningPoints: selectTurningPoints(report),
    fragileEdgeSources: fragile,
    reviewBiasFindings: Array.isArray(reviewBiasFindings) ? reviewBiasFindings : [],
  }
}

const resolveBiasTitle = (code: unknown) => resolveBiasSignal(code)?.title ?? null

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

  const run = runIsCurrent && report && typeof report === 'object'
    ? runInputsOf(nodes, report, reviewBiasFindings)
    : null

  const plan = deriveAttentionPlan({
    nodes: planNodesOf(nodes),
    run,
    ceeBiasFindings: Array.isArray(ceeBiasFindings) ? ceeBiasFindings : [],
    resolveBiasTitle,
  })
  cache = { deps, plan }
  return plan
}

let lastRunCache: { deps: readonly unknown[]; plan: AttentionPlan } | null = null

/**
 * ⭐ THE LAST RUN'S FOCUS, for a model KNOWN to have changed since it (row 23).
 * The run-derived reasons ONLY — CEE's pre-run bias findings are not run output
 * and stay in the current plan — selected inside what is left of the ONE board
 * budget after the current plan's marks, so the board never carries more than
 * `ATTENTION_BUDGET` markers in total. Its own cache: the card asks for both
 * plans on every render, and one shared slot would recompute both each time.
 */
export function lastRunAttentionPlanFor(
  nodes: ReadonlyArray<NodeLike> | undefined,
  report: unknown,
  reviewBiasFindings: unknown,
  budget: number,
): AttentionPlan {
  const deps = [nodes, report, reviewBiasFindings, budget]
  if (lastRunCache && same(lastRunCache.deps, deps)) return lastRunCache.plan
  if (!Array.isArray(nodes) || nodes.length === 0 || !report || typeof report !== 'object') {
    lastRunCache = { deps, plan: EMPTY_ATTENTION_PLAN }
    return EMPTY_ATTENTION_PLAN
  }
  const plan = deriveAttentionPlan(
    {
      nodes: planNodesOf(nodes),
      run: runInputsOf(nodes, report, reviewBiasFindings),
      ceeBiasFindings: [],
      resolveBiasTitle,
    },
    budget,
  )
  lastRunCache = { deps, plan }
  return plan
}

export interface NodeAttention {
  /** The node's grounded reasons (drives the rail's evidence/behaviour icons). */
  reasons: readonly AttentionReason[]
  /** Whether this node carries the budgeted "Worth reviewing" marker. */
  marked: boolean
  markedCount: number
  candidateCount: number
  /**
   * The LAST run's run-derived reasons, present only when the model is KNOWN to
   * have changed since that run (`useModelChangedSinceRun`); `null` otherwise.
   * Never merged into `reasons`: a reader that shows them must label them as the
   * previous model's (`attentionCueSentence`, `nodeAttention.ts`).
   */
  fromLastRun: {
    reasons: readonly AttentionReason[]
    marked: boolean
    markedCount: number
    candidateCount: number
  } | null
}

const NONE: NodeAttention = { reasons: [], marked: false, markedCount: 0, candidateCount: 0, fromLastRun: null }

export function useNodeAttention(nodeId: string): NodeAttention {
  const nodes = useCanvasStore((s) => s.nodes) as unknown as NodeLike[] | undefined
  const report = useCanvasStore((s) => (s.results?.status === 'complete' ? s.results?.report : null))
  const ceeBiasFindings = useCanvasStore((s) => s.ceeAnalysisReady?.bias_findings)
  const reviewBiasFindings = useCanvasStore((s) =>
    s.runMeta?.reviewStatus === 'complete'
      ? (s.runMeta?.m1ReviewAssumptions as { bias_findings?: unknown } | null | undefined)?.bias_findings
      : undefined,
  )
  const locallyCurrent = useAnalysisResultsAreCurrent()
  const runIsCurrent = useRunCurrency() === 'current' && locallyCurrent
  const modelChangedSinceRun = useModelChangedSinceRun()
  const plan = attentionPlanFor(nodes, report, runIsCurrent, ceeBiasFindings, reviewBiasFindings)
  const lastRunPlan = modelChangedSinceRun && !runIsCurrent
    ? lastRunAttentionPlanFor(nodes, report, reviewBiasFindings, Math.max(0, ATTENTION_BUDGET - plan.marked.size))
    : null
  const reasons = plan.reasonsByNode.get(nodeId)
  const lastRunReasons = lastRunPlan?.reasonsByNode.get(nodeId)
  if (!reasons && !lastRunReasons) return NONE
  return {
    reasons: reasons ?? [],
    marked: plan.marked.has(nodeId),
    markedCount: plan.marked.size,
    candidateCount: plan.candidateCount,
    fromLastRun: lastRunPlan && lastRunReasons
      ? {
          reasons: lastRunReasons,
          marked: lastRunPlan.marked.has(nodeId),
          markedCount: lastRunPlan.marked.size,
          candidateCount: lastRunPlan.candidateCount,
        }
      : null,
  }
}
