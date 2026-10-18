/**
 * WHAT THE MODEL RESTS ON — the assumption map's one classification, a pure read of the drawn model.
 *
 * Every figure the result could rest on (a factor's value, a causal link's strength) lands in exactly one cell:
 *   - ROW: is it on a path to the goal? Directed reachability over the drawn links (structural wiring included),
 *     nothing inferred. It states CONNECTION only: it says nothing about how much a figure moves the result.
 *   - COLUMN: how firmly is it known? Taken from the estate's own owners, never re-derived here:
 *       factor values → `factorValueSourceMark` and the `est.` gate (`factorValueIsUnconfirmedEstimate`);
 *       link strengths → the ONE link classifier `edgeProvenance` and the strength display it already reads.
 *     Each item keeps its owner's own words, so the map can never say something the card does not.
 *
 * Not on the map: links that hold by definition or by an exact identity (not assumptions), and structural wiring
 * (`linkIsStructural`: question → option, option → factor), whose figures are the option's own changes, shown on the
 * option card.
 */
import type { Edge, Node } from '@xyflow/react'
import { EDGE_PROVENANCE, edgeProvenance } from '../domain/edgeProvenance'
import { resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'
import { factorValueIsUnconfirmedEstimate } from '../domain/valueProvenance'
import { factorValueSourceMark } from '../nodes/shared/valueSourceMark'
import type { GraphChangeTarget } from '../graphChanges/graphChangesView'
import { linkIsStructural } from '../edges/edgePresentation'

export type AssumptionRow = 'on_path' | 'off_path'
export type AssumptionColumn = 'yours' | 'unchecked' | 'missing'

export interface AssumptionItem {
  readonly target: GraphChangeTarget
  readonly label: string
  /** The owner's own source words for this figure. */
  readonly source: string
  readonly row: AssumptionRow
  readonly column: AssumptionColumn
}

export const ASSUMPTION_MAP_COPY = {
  title: 'What the model rests on',
  rows: { on_path: 'On a path to your goal', off_path: 'Not linked to your goal' },
  inModel: 'In the model',
  columns: { yours: 'You stated or accepted', unchecked: 'Not yet checked', missing: 'No figure yet' },
  noGoal: 'Your model has no goal yet, so these are not grouped by it.',
  optionsNote: 'Each option’s own changes are on its card.',
  noStrength: 'No strength set',
  empty: 'Nothing in this model carries a figure yet.',
} as const

/** Ids that reach the goal along the drawn links, source → target (the goal included). One walk, O(V + E). */
function reachesGoal(goalId: string, edges: readonly Edge[]): ReadonlySet<string> {
  const into = new Map<string, string[]>()
  for (const e of edges) {
    const sources = into.get(e.target)
    if (sources) sources.push(e.source)
    else into.set(e.target, [e.source])
  }
  const reached = new Set<string>([goalId])
  const stack = [goalId]
  while (stack.length > 0) {
    for (const source of into.get(stack.pop()!) ?? []) {
      if (!reached.has(source)) {
        reached.add(source)
        stack.push(source)
      }
    }
  }
  return reached
}

function factorItem(node: Node, row: AssumptionRow): AssumptionItem | null {
  const mark = factorValueSourceMark(node.data)
  if (mark === null) return null
  const column: AssumptionColumn = mark.kind === 'you' || mark.kind === 'brief' || mark.kind === 'panel'
    || (mark.kind === 'olumi' && !factorValueIsUnconfirmedEstimate(node.data))
    ? 'yours' : 'unchecked'
  return { target: { kind: 'node', id: node.id }, label: String(node.data?.label ?? node.id), source: mark.label, row, column }
}

function linkItem(edge: Edge, label: string, row: AssumptionRow): AssumptionItem | null {
  const data = edge.data as Record<string, unknown> | undefined
  const provenance = edgeProvenance(data)
  const target: GraphChangeTarget = { kind: 'edge', id: edge.id }
  if (provenance === null) {
    // No author anything can attest: no figure at all, or a figure whose source was never recorded.
    const shown = data ? resolveEdgeSignedStrengthDisplay(data).show : false
    return shown
      ? { target, label, source: 'Source not recorded', row, column: 'unchecked' }
      : { target, label, source: ASSUMPTION_MAP_COPY.noStrength, row, column: 'missing' }
  }
  const { kind } = provenance
  if (kind === 'definitional' || kind === 'exact') return null
  const column: AssumptionColumn = kind === 'placeholder' ? 'missing'
    : kind === 'user' || kind === 'brief' || kind === 'accepted' ? 'yours' : 'unchecked'
  return { target, label, source: EDGE_PROVENANCE[kind].words ?? '', row, column }
}

export interface AssumptionMap {
  readonly hasGoal: boolean
  readonly items: readonly AssumptionItem[]
}

/** `goalId` is the caller's resolved active goal (`resolveActiveGoalNodeId`); null groups nothing by it. */
export function assumptionMapOf(nodes: readonly Node[], edges: readonly Edge[], goalId: string | null): AssumptionMap {
  const reached = goalId === null ? new Set<string>() : reachesGoal(goalId, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rowOf = (id: string): AssumptionRow => (reached.has(id) ? 'on_path' : 'off_path')
  const items: AssumptionItem[] = []
  for (const node of nodes) {
    if (node.type !== 'factor') continue
    const item = factorItem(node, rowOf(node.id))
    if (item) items.push(item)
  }
  for (const edge of edges) {
    const from = byId.get(edge.source)
    const to = byId.get(edge.target)
    if (!from || !to || linkIsStructural(from.type, to.type, edge.data)) continue
    const item = linkItem(edge, `${String(from.data?.label ?? from.id)} → ${String(to.data?.label ?? to.id)}`, rowOf(edge.target))
    if (item) items.push(item)
  }
  return { hasGoal: goalId !== null, items }
}
