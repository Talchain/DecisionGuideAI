/**
 * ⭐ GRAPH DIFF, STAGE 1 — WHAT CHANGED BETWEEN TWO RUNS, AS MARKS ON THE CURRENT GRAPH
 * (DL #75 5918004424, ChatGPT 5917976405; row E "what changed between Runs").
 *
 * Pure. It reads the producer's exact input changes (SC-24 `RunDelta.input_changes`, schemas 0.68 — the same rows
 * `runDeltaView.ts` reads) and says, for the graph the user is looking at NOW:
 *   - which nodes and links to mark (`changed`, or `added` for an option that entered the comparison);
 *   - which inputs the later Run no longer had (the removed list), each with a focus target if it is still drawn;
 *   - which changed inputs are not on the current graph (the model moved since the later Run) — listed, never dropped.
 *
 * ⛔ IT COMPUTES NO DIFF. Every mark comes from one producer row, by id. There are no ghosts, no second graph and no
 * layout history. Side by side waits for Run→saved-version binding.
 *
 * ⚠ `presence: added` on an option means it ENTERED THE RUN'S COMPARISON, not that the node is new on the graph.
 * The option may have been drawn but excluded before. The words at integration say "added to the comparison".
 *
 * ⚠ LIMITS ARE NOT NODES. A limit is a pill on the goal card (`goalLimitPills`, keyed by `constraint_id`), so a
 * `constraint` row marks the goal node — only when the graph has exactly one goal. Otherwise the row is listed,
 * never guessed onto one of several goals.
 */

/** The fields of one SC-24 input change this module reads (structurally `RunDeltaInputChange`, schemas 0.68). */
export interface GraphChangeInput {
  readonly entity_kind: 'option_setting' | 'option' | 'factor_value' | 'goal' | 'constraint' | 'link'
  readonly entity_id: string
  readonly option_id?: string
  readonly link?: { readonly from: string; readonly to: string }
  readonly field: string
  readonly label_before?: string
  readonly label_after?: string
  readonly change: 'changed' | 'added' | 'removed'
}

export type GraphChangeCoverage = 'complete' | 'partial' | 'not_recorded' | 'unknown'

/** The graph as drawn now: node ids with kinds and labels, and links with their ends. */
export interface CurrentGraph {
  readonly nodes: ReadonlyArray<{ readonly id: string; readonly kind?: string; readonly label?: string }>
  readonly edges: ReadonlyArray<{ readonly id: string; readonly source: string; readonly target: string }>
}

export type GraphChangeMark = 'changed' | 'added'

export interface GraphChangeTarget {
  readonly kind: 'node' | 'edge'
  readonly id: string
}

export interface GraphChangeListItem {
  /** Stable per producer row (`entity_kind:entity_id:field[:option_id]`). */
  readonly key: string
  readonly entityKind: GraphChangeInput['entity_kind']
  readonly field: string
  /** The producer's own label for the input, else the current graph's, else null (the caller words it). */
  readonly label: string | null
  /** What a click focuses; null when nothing on the current graph stands for it. */
  readonly focus: GraphChangeTarget | null
}

export interface GraphChangesView {
  readonly coverage: GraphChangeCoverage
  readonly nodeMarks: ReadonlyMap<string, GraphChangeMark>
  readonly edgeMarks: ReadonlyMap<string, GraphChangeMark>
  /** Inputs the earlier Run had and the later one did not, in the producer's order. */
  readonly removed: readonly GraphChangeListItem[]
  /** Changed or added inputs with nothing on the current graph to mark, in the producer's order. */
  readonly notOnGraph: readonly GraphChangeListItem[]
  /** True when there is nothing to mark and nothing to list. */
  readonly empty: boolean
}

function rowKey(row: GraphChangeInput): string {
  return `${row.entity_kind}:${row.entity_id}:${row.field}${row.option_id !== undefined ? `:${row.option_id}` : ''}`
}

/** Where a row lives on the current graph, or null. One rule per kind. */
function targetOf(row: GraphChangeInput, graph: CurrentGraph, nodeIds: ReadonlySet<string>): GraphChangeTarget | null {
  switch (row.entity_kind) {
    case 'link': {
      if (row.link === undefined) return null
      const edge = graph.edges.find(e => e.source === row.link!.from && e.target === row.link!.to)
      return edge ? { kind: 'edge', id: edge.id } : null
    }
    // An option's setting of a factor is drawn on the OPTION's card (its change rows), so the option carries it.
    case 'option_setting':
      return row.option_id !== undefined && nodeIds.has(row.option_id) ? { kind: 'node', id: row.option_id } : null
    case 'constraint': {
      const goals = graph.nodes.filter(n => n.kind === 'goal')
      return goals.length === 1 ? { kind: 'node', id: goals[0].id } : null
    }
    default:
      return nodeIds.has(row.entity_id) ? { kind: 'node', id: row.entity_id } : null
  }
}

function labelOf(row: GraphChangeInput, graph: CurrentGraph): string | null {
  const own = row.label_before ?? row.label_after
  if (own !== undefined && own.trim() !== '') return own
  if (row.entity_kind === 'link' || row.entity_kind === 'constraint') return null
  const id = row.entity_kind === 'option_setting' ? row.option_id : row.entity_id
  return graph.nodes.find(n => n.id === id)?.label ?? null
}

/**
 * Build the view. `coverage` is the producer's `input_coverage`; pass `undefined` for a pre-0.68 producer, which
 * reads as `unknown` and marks nothing. `not_recorded` marks nothing too: its rows are absent by contract.
 */
export function buildGraphChangesView(
  rows: readonly GraphChangeInput[] | undefined,
  coverage: 'complete' | 'partial' | 'not_recorded' | undefined,
  graph: CurrentGraph,
): GraphChangesView {
  const nodeMarks = new Map<string, GraphChangeMark>()
  const edgeMarks = new Map<string, GraphChangeMark>()
  const removed: GraphChangeListItem[] = []
  const notOnGraph: GraphChangeListItem[] = []
  const known: GraphChangeCoverage = coverage ?? 'unknown'

  if (known === 'complete' || known === 'partial') {
    const nodeIds = new Set(graph.nodes.map(n => n.id))
    for (const row of rows ?? []) {
      const target = targetOf(row, graph, nodeIds)
      const item = { key: rowKey(row), entityKind: row.entity_kind, field: row.field, label: labelOf(row, graph), focus: target }
      if (row.change === 'removed') { removed.push(item); continue }
      if (target === null) { notOnGraph.push(item); continue }
      const mark: GraphChangeMark = row.entity_kind === 'option' && row.field === 'presence' && row.change === 'added' ? 'added' : 'changed'
      const marks = target.kind === 'node' ? nodeMarks : edgeMarks
      // `added` outranks `changed`: an option that entered the comparison says so even if its settings also moved.
      if (marks.get(target.id) !== 'added') marks.set(target.id, mark)
    }
  }

  return {
    coverage: known,
    nodeMarks,
    edgeMarks,
    removed,
    notOnGraph,
    empty: nodeMarks.size === 0 && edgeMarks.size === 0 && removed.length === 0 && notOnGraph.length === 0,
  }
}
