/**
 * N1: Compare Summary Header
 *
 * Displays high-level summary of differences between two runs
 * "Nodes: +X/-Y • Edges: +A/-B • Top changes: 5"
 */

import type { StoredRun } from '../store/runHistory'

interface CompareSummaryProps {
  runA: StoredRun
  runB: StoredRun
}

interface DiffCounts {
  nodesAdded: number
  nodesRemoved: number
  edgesAdded: number
  edgesRemoved: number
}

export function CompareSummary({ runA, runB }: CompareSummaryProps) {
  const counts = computeDiffCounts(runA, runB)

  return (
    <div className="px-4 py-3 bg-info-50 border-b border-info-200">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-info-900">Summary:</span>
        <div className="flex items-center gap-3 text-info-800">
          <span>
            Nodes:{' '}
            {counts.nodesAdded > 0 && (
              <span className="font-semibold text-success-700">+{counts.nodesAdded}</span>
            )}
            {counts.nodesAdded > 0 && counts.nodesRemoved > 0 && <span className="mx-1">/</span>}
            {counts.nodesRemoved > 0 && (
              <span className="font-semibold text-danger-700">−{counts.nodesRemoved}</span>
            )}
            {counts.nodesAdded === 0 && counts.nodesRemoved === 0 && (
              <span className="text-gray-600">No changes</span>
            )}
          </span>
          <span className="text-gray-400">•</span>
          <span>
            Edges:{' '}
            {counts.edgesAdded > 0 && (
              <span className="font-semibold text-success-700">+{counts.edgesAdded}</span>
            )}
            {counts.edgesAdded > 0 && counts.edgesRemoved > 0 && <span className="mx-1">/</span>}
            {counts.edgesRemoved > 0 && (
              <span className="font-semibold text-danger-700">−{counts.edgesRemoved}</span>
            )}
            {counts.edgesAdded === 0 && counts.edgesRemoved === 0 && (
              <span className="text-gray-600">No changes</span>
            )}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-info-700">
            Top changes: <span className="font-semibold">5</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Compute diff counts between two runs
 */
function computeDiffCounts(runA: StoredRun, runB: StoredRun): DiffCounts {
  const nodesA = new Set((runA.graph?.nodes ?? []).map((n) => n.id))
  const nodesB = new Set((runB.graph?.nodes ?? []).map((n) => n.id))
  const edgesA = new Set((runA.graph?.edges ?? []).map((e) => e.id))
  const edgesB = new Set((runB.graph?.edges ?? []).map((e) => e.id))

  let nodesAdded = 0
  let nodesRemoved = 0
  let edgesAdded = 0
  let edgesRemoved = 0

  // Count added nodes/edges (in B but not A)
  for (const id of nodesB) {
    if (!nodesA.has(id)) nodesAdded++
  }
  for (const id of edgesB) {
    if (!edgesA.has(id)) edgesAdded++
  }

  // Count removed nodes/edges (in A but not B)
  for (const id of nodesA) {
    if (!nodesB.has(id)) nodesRemoved++
  }
  for (const id of edgesA) {
    if (!edgesB.has(id)) edgesRemoved++
  }

  return { nodesAdded, nodesRemoved, edgesAdded, edgesRemoved }
}
