/**
 * N1: Edge Diff Table
 *
 * Displays top 5 edge differences between two runs
 * Matches edges by stable ID; marks added/removed edges
 * Shows weight, belief context, and provenance
 */

import { type Edge } from '@xyflow/react'
import type { StoredRun } from '../store/runHistory'

export interface EdgeDiffRow {
  edgeId: string
  from: string
  to: string
  status: 'matched' | 'added' | 'removed'
  runA?: {
    weight: number
    belief: number
    provenance?: string
  }
  runB?: {
    weight: number
    belief: number
    provenance?: string
  }
  deltaWeight: number // signed delta
}

interface EdgeDiffTableProps {
  runA: StoredRun
  runB: StoredRun
  limit?: number
}

export function EdgeDiffTable({ runA, runB, limit = 5 }: EdgeDiffTableProps) {
  const diffs = computeEdgeDiffs(runA, runB, limit)

  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        No edge differences found
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Edge (From → To)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Run A (w/b)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Run B (w/b)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Δw
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Provenance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {diffs.map((row) => (
              <tr key={row.edgeId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.status === 'added' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800">
                        +
                      </span>
                    )}
                    {row.status === 'removed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger-100 text-danger-800">
                        −
                      </span>
                    )}
                    <span className="font-medium text-gray-900">
                      {row.from} → {row.to}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {row.runA ? (
                    <div className="font-mono text-xs">
                      <span className="text-gray-900">{row.runA.weight.toFixed(2)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-600">{row.runA.belief.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.runB ? (
                    <div className="font-mono text-xs">
                      <span className="text-gray-900">{row.runB.weight.toFixed(2)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-600">{row.runB.belief.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.status === 'matched' ? (
                    <span
                      className={`font-mono text-xs font-semibold ${
                        row.deltaWeight > 0
                          ? 'text-success-600'
                          : row.deltaWeight < 0
                          ? 'text-danger-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {row.deltaWeight > 0 ? '+' : ''}
                      {row.deltaWeight.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    {row.runA?.provenance && (
                      <div className="flex items-start gap-1">
                        <span className="font-semibold shrink-0">A:</span>
                        <span className="truncate" title={row.runA.provenance}>
                          {row.runA.provenance}
                        </span>
                      </div>
                    )}
                    {row.runB?.provenance && (
                      <div className="flex items-start gap-1">
                        <span className="font-semibold shrink-0">B:</span>
                        <span className="truncate" title={row.runB.provenance}>
                          {row.runB.provenance}
                        </span>
                      </div>
                    )}
                    {!row.runA?.provenance && !row.runB?.provenance && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Compute edge diffs between two runs
 * Matches by stable edge ID; marks added/removed
 * Returns top N by |Δweight|
 */
export function computeEdgeDiffs(
  runA: StoredRun,
  runB: StoredRun,
  limit: number
): EdgeDiffRow[] {
  const edgesA = extractEdges(runA)
  const edgesB = extractEdges(runB)

  const diffs: EdgeDiffRow[] = []

  // Build maps for efficient lookup
  const mapA = new Map(edgesA.map((e) => [e.id, e]))
  const mapB = new Map(edgesB.map((e) => [e.id, e]))

  // Find all unique edge IDs
  const allIds = new Set([...mapA.keys(), ...mapB.keys()])

  for (const edgeId of allIds) {
    const eA = mapA.get(edgeId)
    const eB = mapB.get(edgeId)

    // Determine status
    let status: 'matched' | 'added' | 'removed'
    if (eA && eB) status = 'matched'
    else if (!eA && eB) status = 'added'
    else status = 'removed'

    const weightA = eA?.data?.weight ?? 1.0
    const weightB = eB?.data?.weight ?? 1.0
    const beliefA = eA?.data?.belief ?? weightA
    const beliefB = eB?.data?.belief ?? weightB

    const deltaWeight = status === 'matched' ? weightB - weightA : 0

    diffs.push({
      edgeId,
      from: eA?.source ?? eB?.source ?? '?',
      to: eA?.target ?? eB?.target ?? '?',
      status,
      runA: eA
        ? {
            weight: weightA,
            belief: beliefA,
            provenance: eA.data?.provenance
          }
        : undefined,
      runB: eB
        ? {
            weight: weightB,
            belief: beliefB,
            provenance: eB.data?.provenance
          }
        : undefined,
      deltaWeight
    })
  }

  // Sort by |Δweight| descending
  return diffs.sort((a, b) => Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight)).slice(0, limit)
}

/**
 * Extract edges from a stored run
 */
function extractEdges(run: StoredRun): Edge[] {
  return run.graph?.edges ?? []
}
