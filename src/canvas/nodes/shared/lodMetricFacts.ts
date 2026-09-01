/**
 * `resolveLodMetricFacts` — the facts a reduced line needs that do NOT live on
 * the node it is about.
 *
 * ⭐ WHY THIS IS ITS OWN MODULE AND NOT AN INLINE `useMemo` IN `BaseNode`.
 *
 * The gap this closes is the whole defect. A risk's strength lives on its EDGE
 * to the goal; a decision's option count is a graph traversal; an option's
 * change count lives in `ceeAnalysisReady`. `resolveLodMetricLine` is handed a
 * node's `data` and its display metadata and can see NONE of them — which is
 * why, before this, those card types could only say anything once an analysis
 * had run, and went blank on every freshly drafted model.
 *
 * Written as a pure function so the corpus spec can drive the SAME derivation
 * the component drives. If this lived inside `BaseNode`'s memo, a test would
 * have to restate it, and a restated derivation that drifts from the real one
 * is a suite that agrees with itself while the product is broken
 * (CLAUDE.md trap 12).
 *
 * ⚠ THE LIMIT, STATED (trap 20): this pins the DERIVATION, not the WIRING. That
 * `BaseNode` passes the right store values in — and that the resulting line
 * reaches a pixel — is only settled in a real browser. jsdom cannot prove
 * visibility (trap 3), and it is visibility that the user complained about.
 */
import type { Edge, Node } from '@xyflow/react'
import { resolveBridgeStrengthToGoal } from './bridgeStrengthToGoal'
import { resolveOptionInterventionCount } from './optionInterventionCount'
import { detectBaseline } from '../../utils/baselineDetection'
import type { LodMetricFacts } from './lodMetricLine'

/**
 * How many options a decision compares — `DecisionNode.optionCount`'s rule,
 * shared rather than restated: outgoing edges whose target is an option, by
 * the same `type ?? data.type` test the rest of the canvas uses.
 */
export function countDecisionOptions(decisionId: string, nodes: Node[], edges: Edge[]): number {
  return edges.filter(e => {
    if (e.source !== decisionId) return false
    const target = nodes.find(n => n.id === e.target)
    return target?.type === 'option' || target?.data?.type === 'option'
  }).length
}

export interface LodMetricFactsInputs {
  nodeType: string
  nodeId: string
  /** The node's own `data` — the option-intervention fallback reads it. */
  data: Record<string, unknown> | undefined
  /** The model's goal node id, or null when it has none. */
  goalNodeId: string | null
  edges: Edge[]
  ceeOptions: { id: string; interventions?: Record<string, unknown> }[] | null | undefined
  /** Pre-counted by the caller's store selector; null for non-decision nodes. */
  decisionOptionCount: number | null
}

/**
 * ⚠ EVERY FIELD IS `null` FOR THE TYPES THAT DO NOT USE IT, AND THAT IS NOT
 * TIDINESS. `null` is the resolver's WITHHOLD signal, and it has to stay
 * distinguishable from a real zero: an option that changes no factors and an
 * option whose change count could not be established are different states, and
 * only one of them may say "No factor changes".
 */
export function resolveLodMetricFacts({
  nodeType,
  nodeId,
  data,
  goalNodeId,
  edges,
  ceeOptions,
  decisionOptionCount,
}: LodMetricFactsInputs): LodMetricFacts {
  return {
    bridgeStrength:
      nodeType === 'risk' || nodeType === 'outcome'
        ? resolveBridgeStrengthToGoal(nodeId, goalNodeId, edges)
        : null,
    optionInterventionCount:
      nodeType === 'option'
        ? resolveOptionInterventionCount(nodeId, {
            ceeOptions,
            nodeInterventions: data?.interventions,
          })
        : null,
    // ⛔ THE BASELINE FLAG IS NOT OPTIONAL POLISH — WITHOUT IT THE LINE
    // CONTRADICTS THE CARD. A status-quo option is BACKFILLED with
    // interventions (measured on the Headcount starter:
    // `interventionBackfilledCount: 4`, the baseline among them), so a raw
    // count says "Changes 2 factors" about the very card whose body reads
    // "No changes to factors". `OptionNode` checks this flag FIRST and never
    // reaches its count for a baseline; so does the reduced line.
    // `detectBaseline` is that component's own detector, not a second rule.
    optionIsBaseline:
      nodeType === 'option'
        ? (typeof data?.is_baseline === 'boolean'
            ? (data.is_baseline as boolean)
            : detectBaseline(String(data?.label ?? '')).isBaseline)
        : null,
    decisionOptionCount,
  }
}
