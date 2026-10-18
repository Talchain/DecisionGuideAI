/**
 * WHAT THE MODEL RESTS ON — the assumption map's one classification, a pure read of the drawn model.
 *
 * Every figure the result could rest on (a factor's value, a causal link's strength) lands in exactly one cell:
 *   - ROW: is it on a path to the goal? Directed reachability over the drawn links (structural wiring included),
 *     nothing inferred. It states CONNECTION only: it says nothing about how much a figure moves the result.
 *   - STATE: WHO the figure came from, and whether the user has checked it. Authorship, never confidence or truth
 *     (PL, 18 Oct 2026: "yours" must not mean true or checked). Five states, from the estate's own owners, never
 *     re-derived here: factor values → `factorValueSourceMark` and the owner's acceptance reader
 *     (`isAcceptedOlumiFigure`); link strengths → the ONE link classifier `edgeProvenance` and the strength display it
 *     already reads.
 *       yours      the user stated it (typed it, their brief, a panel);
 *       accepted   Olumi's estimate the user accepted: its origin stays Olumi's;
 *       unchecked  Olumi's estimate (or example) nobody has checked;
 *       unknown    an origin nobody can attest: never shown as the user's (DL, 18 Oct 2026);
 *       missing    no figure yet (a placeholder, or no strength at all).
 *     Each item keeps its owner's own words, so the map can never say something the card does not.
 *
 * Not on the map: links that hold by definition or by an exact identity (not assumptions), and structural wiring
 * (`linkIsStructural`: question → option, option → factor), whose figures are the option's own changes, shown on the
 * option card.
 */
import type { Edge, Node } from '@xyflow/react'
import { EDGE_PROVENANCE, edgeProvenance } from '../domain/edgeProvenance'
import { resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'
import { isAcceptedOlumiFigure } from '../domain/valueProvenance'
import { factorValueSourceMark } from '../nodes/shared/valueSourceMark'
import type { GraphChangeTarget } from '../graphChanges/graphChangesView'
import { linkIsStructural } from '../edges/edgePresentation'

export type AssumptionRow = 'on_path' | 'off_path'
export type AssumptionColumn = 'yours' | 'accepted' | 'unchecked' | 'unknown' | 'missing'

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
  columns: {
    yours: 'Yours',
    accepted: 'Olumi’s estimate, you accepted it',
    unchecked: 'Olumi’s estimate, not yet checked',
    unknown: 'Origin not known',
    missing: 'No figure yet',
  },
  sourceNotRecorded: 'Source not recorded',
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
  const column: AssumptionColumn = mark.kind === 'you' || mark.kind === 'brief' || mark.kind === 'panel' ? 'yours'
    // An Olumi value is the user's ACCEPTED figure only when the owner says so (`isAcceptedOlumiFigure`): a drafted value
    // with no marker is still Olumi's and unchecked, never assumed accepted.
    : mark.kind === 'olumi' ? (isAcceptedOlumiFigure(node.data) ? 'accepted' : 'unchecked')
      : 'unknown'
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
      ? { target, label, source: ASSUMPTION_MAP_COPY.sourceNotRecorded, row, column: 'unknown' }
      : { target, label, source: ASSUMPTION_MAP_COPY.noStrength, row, column: 'missing' }
  }
  const { kind } = provenance
  if (kind === 'definitional' || kind === 'exact') return null
  const column: AssumptionColumn = kind === 'placeholder' ? 'missing'
    : kind === 'user' || kind === 'brief' ? 'yours'
      : kind === 'accepted' ? 'accepted'
        : 'unchecked'
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
