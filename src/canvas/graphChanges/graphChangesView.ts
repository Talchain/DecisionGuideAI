/**
 * ⭐ THE CHANGES VIEW — WHAT DIFFERED BETWEEN TWO RUNS, AND WHAT MOVED, AS MARKS ON THE CURRENT GRAPH
 * (row E; SC-24 v3 #84 5917800325 / 5917976874; lease DL #75 5920620752).
 *
 * ⛔ IT READS NOTHING BUT THE ONE READER'S OUTPUT. The input is the `RunDeltaView` that `displayedRunDeltaView`
 * built for the analysis on screen — the SAME object the Compare tab's list renders — so the list and the graph can
 * never disagree about what changed. There is no second parse of `run_delta`, no label rule, no key parsing: every
 * mark is bound to a row's producer ids (`entityId` / `optionId` / `linkEnds`, copied verbatim by the reader).
 *
 * ⛔ IT COMPUTES NO DIFF AND NO CAUSE. It says, for the graph the user is looking at NOW:
 *   - `changed` — a node or link whose input differed between the two Runs (one producer row);
 *   - `added`   — an option that ENTERED THE COMPARISON (not "new on the graph": it may have been drawn but excluded);
 *   - `moved`   — an option whose share of runs moved BEYOND run-to-run noise (`noiseVerdict === 'signal'`, the
 *                 producer's tag), only when win shares may be shown at all (`winShareGate`, row 9), and ONLY ON AN
 *                 ATTRIBUTABLE PAIR (`view.attributable`, C1). ⛔ On any other pair a "Changed" card beside a
 *                 "Result moved" card reads as "the edit moved it" — the cause the producer says it cannot
 *                 establish (AIQ #2370 5921417329; the same class PANEL fixed on #2368). There, the input marks stay
 *                 and the Compare tab states the movement with its limit.
 * Removed inputs, and changed inputs with nothing drawn to mark, are left to the list (the Compare tab already says
 * each one in words). No ghosts, no second graph, no historical layout.
 *
 * ⚠ LIMITS ARE NOT NODES. A limit is a pill on the goal card, so a `constraint` row marks the goal node — only when
 * the graph has exactly one goal. Otherwise nothing is guessed onto one of several goals.
 */
import type { RunDeltaInputRow, RunDeltaView } from '../../components/results/analysisNew/runDeltaView'

/** The graph as drawn now: node ids with kinds, and links with their ends. */
export interface CurrentGraph {
  readonly nodes: ReadonlyArray<{ readonly id: string; readonly kind?: string }>
  readonly edges: ReadonlyArray<{ readonly id: string; readonly source: string; readonly target: string }>
}

export type RunChangeMark = 'changed' | 'added' | 'moved'

export interface GraphChangeTarget {
  readonly kind: 'node' | 'edge'
  readonly id: string
}

export interface GraphChangesView {
  readonly nodeMarks: ReadonlyMap<string, RunChangeMark>
  readonly edgeMarks: ReadonlyMap<string, RunChangeMark>
  /** Each input row's canvas element, by the row's React key; `null` = nothing on the current graph stands for it. */
  readonly focusByRowKey: ReadonlyMap<string, GraphChangeTarget | null>
  /** True when nothing is marked (the canvas then dims nothing). */
  readonly empty: boolean
}

/** Where one row lives on the current graph, or null. One rule per kind; ids only. */
export function targetOfRow(row: RunDeltaInputRow, graph: CurrentGraph): GraphChangeTarget | null {
  switch (row.kind) {
    case 'link': {
      const ends = row.linkEnds
      if (ends === null) return null
      const edge = graph.edges.find(e => e.source === ends.from && e.target === ends.to)
      return edge ? { kind: 'edge', id: edge.id } : null
    }
    // An option's setting of a factor is drawn on the OPTION's card (its change rows), so the option carries it.
    case 'option_setting':
      return row.optionId !== null && graph.nodes.some(n => n.id === row.optionId) ? { kind: 'node', id: row.optionId } : null
    case 'constraint': {
      const goals = graph.nodes.filter(n => n.kind === 'goal')
      return goals.length === 1 ? { kind: 'node', id: goals[0].id } : null
    }
    default:
      return graph.nodes.some(n => n.id === row.entityId) ? { kind: 'node', id: row.entityId } : null
  }
}

const RANK: Record<RunChangeMark, number> = { moved: 0, changed: 1, added: 2 }
function put(marks: Map<string, RunChangeMark>, id: string, mark: RunChangeMark): void {
  const cur = marks.get(id)
  // `added` outranks `changed` outranks `moved`: what differed in the INPUT is said first; a result mark never hides it.
  if (cur === undefined || RANK[mark] > RANK[cur]) marks.set(id, mark)
}

/**
 * Build the marks. `view` is the one reader's output for the analysis on screen (`null` = no comparison, nothing
 * marked). `winSharesWithheld` is `selectWinSharesWithheld` — when the producer withholds shares, no option is
 * marked as moved, because the mark would name a movement the canvas may not show.
 */
export function buildGraphChangesView(
  view: RunDeltaView | null,
  graph: CurrentGraph,
  winSharesWithheld: boolean,
): GraphChangesView {
  const nodeMarks = new Map<string, RunChangeMark>()
  const edgeMarks = new Map<string, RunChangeMark>()
  const focusByRowKey = new Map<string, GraphChangeTarget | null>()

  if (view !== null) {
    // Input rows carry marks only where the producer compared the inputs (`not_recorded` sends none by contract).
    const inputs = view.inputs
    if (inputs !== null && (inputs.coverage === 'complete' || inputs.coverage === 'partial')) {
      for (const row of inputs.rows) {
        const target = targetOfRow(row, graph)
        focusByRowKey.set(row.key, target)
        // A removed input is listed by the Compare tab, never drawn: the later Run no longer had it.
        if (row.change === 'removed' || target === null) continue
        const mark: RunChangeMark = row.kind === 'option' && row.change === 'added' ? 'added' : 'changed'
        put(target.kind === 'node' ? nodeMarks : edgeMarks, target.id, mark)
      }
    }
    // Only C1 may put a change and a movement on the canvas together (AIQ 5921417329).
    if (!winSharesWithheld && view.attributable) {
      const nodeIds = new Set(graph.nodes.map(n => n.id))
      for (const m of view.movements) {
        if (m.noiseVerdict === 'signal' && m.direction !== 'level' && nodeIds.has(m.optionId)) put(nodeMarks, m.optionId, 'moved')
      }
    }
  }

  return { nodeMarks, edgeMarks, focusByRowKey, empty: nodeMarks.size === 0 && edgeMarks.size === 0 }
}
