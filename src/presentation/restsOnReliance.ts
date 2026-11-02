/**
 * v10 (#/canvas2), "Rests on": which figures each option stands on, counted by who they came from.
 *
 * Nothing here is a new measurement. The figures and their authors are the lens's own (`assumptionMapOf`), and an
 * option's path is the drawn links followed forward from the option. The result is a COUNT of figures. It does not say
 * how much any figure moves the option's result (no such share by author is served), so it is never drawn or worded
 * as "where its uncertainty comes from".
 */
import type { Edge, Node } from '@xyflow/react'
import { type AssumptionColumn, type AssumptionItem } from '../canvas/artefacts/assumptionMapModel'

export type RelianceCounts = Readonly<Record<AssumptionColumn, number>>

export interface OptionReliance {
  readonly optionId: string
  readonly label: string
  readonly counts: RelianceCounts
  readonly total: number
}

const emptyCounts = (): Record<AssumptionColumn, number> => ({ yours: 0, accepted: 0, unchecked: 0, unknown: 0, missing: 0 })

/** Node ids reached from `startId` along the drawn links (the start excluded unless a cycle returns to it). */
function reachedFrom(startId: string, edges: readonly Edge[]): ReadonlySet<string> {
  const out = new Map<string, string[]>()
  for (const e of edges) {
    const list = out.get(e.source)
    if (list) list.push(e.target)
    else out.set(e.source, [e.target])
  }
  const reached = new Set<string>()
  const stack = [startId]
  while (stack.length > 0) {
    for (const next of out.get(stack.pop()!) ?? []) {
      if (!reached.has(next)) {
        reached.add(next)
        stack.push(next)
      }
    }
  }
  return reached
}

/**
 * One row per option. A figure is on an option's path when it is a factor reached from the option, or a link between
 * the option (or a factor it reaches) and a factor it reaches. With a goal, only figures on a path to it count.
 */
export function relianceByOption(
  nodes: readonly Node[],
  edges: readonly Edge[],
  items: readonly AssumptionItem[],
  hasGoal: boolean,
): readonly OptionReliance[] {
  const edgeById = new Map(edges.map((e) => [e.id, e]))
  return nodes.filter((n) => n.type === 'option').map((option) => {
    const reached = reachedFrom(option.id, edges)
    const counts = emptyCounts()
    for (const item of items) {
      if (hasGoal && item.row !== 'on_path') continue
      const onPath = item.target.kind === 'node'
        ? reached.has(item.target.id)
        : (() => {
            const edge = edgeById.get(item.target.id)
            return edge !== undefined && (edge.source === option.id || reached.has(edge.source)) && reached.has(edge.target)
          })()
      if (onPath) counts[item.column] += 1
    }
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    return { optionId: option.id, label: String(option.data?.label ?? option.id), counts, total }
  })
}

/** The same counts for the whole model, keyed like the lens's own marks. */
export function relianceTotals(items: readonly AssumptionItem[]): RelianceCounts {
  const counts = emptyCounts()
  for (const item of items) counts[item.column] += 1
  return counts
}
