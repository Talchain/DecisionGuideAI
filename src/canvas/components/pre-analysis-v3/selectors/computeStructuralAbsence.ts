/**
 * computeStructuralAbsence — what the model does not contain, diagnosed from
 * causal STRUCTURE alone (Paul, 2026-08-24: "Strategy fails on what is MISSING,
 * and nothing in the default surfaces absence").
 *
 * The existing registry signals answer PRESENCE/COUNT questions — is there a
 * goal, how many options, how many risks. Those are already live. This module
 * answers the different question the panel could not previously ask: given the
 * nodes and edges that ARE here, what SHAPE of reasoning is absent?
 *
 * ⚠ THREE CHECKS, NOT FOUR. The fourth structural check originally named —
 * "no feedback anywhere" — IS NOT IMPLEMENTED AND MUST NOT BE. This product
 * forbids feedback loops end to end: the UI blocks their creation
 * (`validation/graphGuardrails.wouldCreateCycle`, wired into `ReactFlowGraph`
 * and the edge-reversal context action) and CEE rejects them as a structural
 * violation (`orchestrator/graph-structure-validator.ts`, `CYCLE_DETECTED`).
 * Every graph reaching this selector is therefore acyclic BY CONSTRUCTION, so
 * the check would fire on 100% of models — and its advice would name an edit
 * the canvas physically refuses and the analyser rejects. A signal that is
 * always true and never actionable is noise with a science badge on it.
 *
 * ⚠ NEVER INVENT AN ABSENCE. Each check carries a PRECONDITION naming the data
 * it needs. When that data is not present the check does not run and this
 * module returns `null` — it never reports "missing" about a field the model
 * simply does not populate. This is the difference between "there is no
 * external factor" and "nobody has told us which factors are external", and
 * reporting the second as the first is the fabrication class this panel exists
 * to avoid.
 *
 * ⚠ ONE FINDING, NOT A LIST. Checks run in a fixed priority order and the
 * FIRST match wins ("three excellent suggestions beat twenty AI observations",
 * Paul). The ranking is by how badly the absence distorts a decision:
 *   1. no_downside        — the model can only say yes
 *   2. shared_mechanism   — the options are not really alternatives
 *   3. no_external_factor — the model assumes total control
 *
 * REUSE, NOT RE-SPELLING (trap 12). Edge direction comes from
 * `resolveEdgeDirectionDisplay`, the read-side gate that already decides when a
 * direction is knowable; node kind comes from `kindOf`. Neither predicate is
 * restated here.
 */

import type { Edge, Node } from '@xyflow/react'
import { resolveEdgeDirectionDisplay } from '../../../domain/edgeValueProvenance'
import { kindOf } from './graphFacts'

export type StructuralAbsenceKind = 'no_downside' | 'shared_mechanism' | 'no_external_factor'

export interface StructuralAbsence {
  kind: StructuralAbsenceKind
  /** Options in the model when the finding fired — copy names the quantity. */
  optionCount: number
}

/**
 * Minimum shape before structural critique is meaningful.
 *
 * Below two options the foundational signals (`sig_goal_missing`,
 * `sig_success_missing`, `sig_option_breadth`) are the right advice and already
 * fire; adding "your options all act through the same parts" to a one-option
 * sketch is noise, and it would double-report what `sig_option_breadth` owns.
 */
const MIN_OPTIONS_FOR_STRUCTURAL_CRITIQUE = 2

type KnownControllability = 'controllable' | 'observable' | 'external' | 'partial'

function isKnownControllability(value: unknown): value is KnownControllability {
  return (
    value === 'controllable' ||
    value === 'observable' ||
    value === 'external' ||
    value === 'partial'
  )
}

function resolveKnownControllability(
  data: Record<string, unknown> | undefined,
): KnownControllability | null {
  // `category` takes precedence over `controllability` — the precedence is
  // declared at `domain/nodes.ts` (`FactorNodeDataSchema.category`: "Explicit
  // category from CEE analysis (takes precedence over derived controllability)").
  // Presence is not knowledge: `controllability: 'unknown'` must hold the
  // finding closed, and an invalid explicit category must not silently fall
  // back to a weaker derived field.
  if (data?.category != null) {
    return isKnownControllability(data.category) ? data.category : null
  }
  return isKnownControllability(data?.controllability) ? data.controllability : null
}

/** Forward-reachable node ids from `start`, following edge direction. */
function forwardReachable(start: string, adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      stack.push(next)
    }
  }
  return seen
}

export function computeStructuralAbsence(
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): StructuralAbsence | null {
  if (edges.length === 0) return null

  const optionIds: string[] = []
  const riskIds = new Set<string>()
  const factorNodes: Node[] = []

  for (const node of nodes) {
    switch (kindOf(node)) {
      case 'option':
        optionIds.push(node.id)
        break
      case 'risk':
        riskIds.add(node.id)
        break
      case 'factor':
        factorNodes.push(node)
        break
      default:
        break
    }
  }

  if (optionIds.length < MIN_OPTIONS_FOR_STRUCTURAL_CRITIQUE) return null

  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.source)
    if (list) list.push(edge.target)
    else adjacency.set(edge.source, [edge.target])
  }

  /**
   * ⚠ GLOBAL PRECONDITION: CAUSAL CRITIQUE PRESUPPOSES A CAUSAL STRUCTURE.
   *
   * Every option must have at least one outgoing edge. Where an option is
   * connected to nothing, "nothing bad happens on any of your options" is
   * TRUE and USELESS — nothing at all happens on them, and the honest finding
   * is that the model is not wired yet, which the ladder and the foundational
   * signals already say. Saying it in the language of downside blindness would
   * dress an unwired sketch up as a reasoning flaw.
   *
   * Measured against the panel's own fixture (`PreAnalysisPanelV3.spec.tsx`):
   * two options with no edges and two floating risks. Without this gate the
   * downside check fires there, correctly by its own logic and wrongly as
   * advice.
   */
  const everyOptionActs = optionIds.every(id => (adjacency.get(id)?.length ?? 0) > 0)
  if (!everyOptionActs) return null

  // ── 1. no_downside ────────────────────────────────────────────────────────
  // PRECONDITION: the model must CONTAIN a downside to be blind to. Downside
  // elements are risk nodes and edges the producer states are negative. With
  // none of either, "no option reaches a downside" is indistinguishable from
  // "no downside is modelled at all" — which `sig_risk_count` already owns, and
  // reporting it here would be a second answer to one question.
  const negativeEdges = edges.filter(e => {
    const display = resolveEdgeDirectionDisplay(e.data as Record<string, unknown> | undefined)
    return display.show && display.direction === 'negative'
  })
  const hasDownsideElement = riskIds.size > 0 || negativeEdges.length > 0
  if (hasDownsideElement) {
    const negativeEdgeSources = new Set(negativeEdges.map(e => e.source))
    const anyOptionReachesDownside = optionIds.some(optionId => {
      const reachable = forwardReachable(optionId, adjacency)
      for (const id of reachable) {
        if (riskIds.has(id)) return true
        // A negative edge is traversed when its source is reachable (or is the
        // option itself) — the option's causal path runs through a stated harm.
        if (negativeEdgeSources.has(id)) return true
      }
      return negativeEdgeSources.has(optionId)
    })
    if (!anyOptionReachesDownside) {
      return { kind: 'no_downside', optionCount: optionIds.length }
    }
  }

  // ── 2. shared_mechanism ───────────────────────────────────────────────────
  // PRECONDITION: every option must have at least one outgoing edge. An option
  // with none is unconnected — a different defect, and claiming its mechanism
  // "overlaps" would be a statement about an empty set.
  const targetSets = optionIds.map(id => new Set(adjacency.get(id) ?? []))
  if (targetSets.every(s => s.size > 0)) {
    const [first, ...rest] = targetSets
    const allIdentical = rest.every(
      s => s.size === first.size && [...s].every(t => first.has(t)),
    )
    if (allIdentical) {
      return { kind: 'shared_mechanism', optionCount: optionIds.length }
    }
  }

  // ── 3. no_external_factor ─────────────────────────────────────────────────
  // PRECONDITION: every factor must carry a known controllability value. One
  // unknown factor is enough to make the absence unknowable — it could be the
  // external factor — so "nothing outside your control is modelled" would be
  // a claim about our own missing metadata, dressed as a claim about the
  // user's thinking.
  if (factorNodes.length > 0) {
    const resolved = factorNodes.map(n =>
      resolveKnownControllability(n.data as Record<string, unknown> | undefined),
    )
    const everyFactorKnown = resolved.every(value => value !== null)
    if (everyFactorKnown && !resolved.includes('external')) {
      return { kind: 'no_external_factor', optionCount: optionIds.length }
    }
  }

  return null
}
