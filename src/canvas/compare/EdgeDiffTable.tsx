/**
 * N1 + S6-COMPARE + S9-DIFFS: Edge Diff Table
 *
 * Displays top 5 edge differences between two runs
 * Matches edges by stable ID; marks added/removed edges
 * Shows weight, belief context, and provenance
 * S6-COMPARE: Adds driver ranking with badges (1st, 2nd, 3rd)
 * S9-DIFFS: Adds |Δbelief| secondary sort, focus-on-click, edge counts
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
  deltaBelief: number // S9-DIFFS: signed belief delta
  rank?: number // S6-COMPARE: Driver ranking (1-indexed)
}

interface EdgeDiffTableProps {
  runA: StoredRun
  runB: StoredRun
  limit?: number
  onFocusEdge?: (edgeId: string) => void // S9-DIFFS: Focus edge on canvas
}

/** S6-COMPARE: Render rank badge for top 3 drivers */
function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) return null

  const colors = {
    1: 'bg-yellow-100 text-yellow-800 border-yellow-300', // Gold
    2: 'bg-gray-100 text-gray-700 border-gray-300',       // Silver
    3: 'bg-orange-100 text-orange-700 border-orange-300'  // Bronze
  }

  const labels = {
    1: '1st',
    2: '2nd',
    3: '3rd'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[rank as keyof typeof colors]}`}
      aria-label={`Rank ${rank}`}
      data-testid={`rank-badge-${rank}`}
    >
      {labels[rank as keyof typeof labels]}
    </span>
  )
}

/** S9-DIFFS: Edge summary counts */
function EdgeSummary({ diffs }: { diffs: EdgeDiffRow[] }) {
  const added = diffs.filter((d) => d.status === 'added').length
  const removed = diffs.filter((d) => d.status === 'removed').length
  const matched = diffs.filter((d) => d.status === 'matched').length
  const total = diffs.length

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 bg-blue-50 border-b border-blue-200 text-sm"
      role="status"
      aria-label="Edge comparison summary"
    >
      <span className="font-medium text-blue-900">Edge Summary:</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-700">
          <span className="font-semibold text-success-700">{added}</span> added
        </span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-700">
          <span className="font-semibold text-danger-700">{removed}</span> removed
        </span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-700">
          <span className="font-semibold text-gray-900">{matched}</span> matched
        </span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-700">
          <span className="font-semibold text-gray-900">{total}</span> total
        </span>
      </div>
    </div>
  )
}

export function EdgeDiffTable({ runA, runB, limit = 5, onFocusEdge }: EdgeDiffTableProps) {
  const diffs = computeEdgeDiffs(runA, runB, limit)

  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        No edge differences found
      </div>
    )
  }

  const handleRowClick = (edgeId: string) => {
    if (onFocusEdge) {
      onFocusEdge(edgeId)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* S9-DIFFS: Edge summary counts */}
      <EdgeSummary diffs={diffs} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide w-20">
                Rank
              </th>
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
                Δw / Δb
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Provenance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {diffs.map((row) => (
              <tr
                key={row.edgeId}
                className={`hover:bg-blue-50 transition-colors ${onFocusEdge ? 'cursor-pointer' : ''}`}
                onClick={() => handleRowClick(row.edgeId)}
                role={onFocusEdge ? 'button' : undefined}
                tabIndex={onFocusEdge ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onFocusEdge && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    handleRowClick(row.edgeId)
                  }
                }}
                aria-label={onFocusEdge ? `Focus edge ${row.from} to ${row.to}` : undefined}
              >
                <td className="px-4 py-3">
                  {row.rank && <RankBadge rank={row.rank} />}
                </td>
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
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          row.deltaWeight > 0
                            ? 'text-success-600'
                            : row.deltaWeight < 0
                            ? 'text-danger-600'
                            : 'text-gray-500'
                        }`}
                      >
                        <span className="text-gray-400 text-xs font-normal">Δw:</span>{' '}
                        {row.deltaWeight > 0 ? '+' : ''}
                        {row.deltaWeight.toFixed(3)}
                      </span>
                      <span
                        className={`font-mono text-xs ${
                          row.deltaBelief > 0
                            ? 'text-success-600'
                            : row.deltaBelief < 0
                            ? 'text-danger-600'
                            : 'text-gray-500'
                        }`}
                      >
                        <span className="text-gray-400 text-xs font-normal">Δb:</span>{' '}
                        {row.deltaBelief > 0 ? '+' : ''}
                        {row.deltaBelief.toFixed(3)}
                      </span>
                    </div>
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
 * S9-DIFFS: Returns top N by |Δweight| then |Δbelief| (secondary sort)
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
    const deltaBelief = status === 'matched' ? beliefB - beliefA : 0 // S9-DIFFS

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
      deltaWeight,
      deltaBelief // S9-DIFFS
    })
  }

  // S9-DIFFS: Sort by |Δweight| descending, then |Δbelief| descending (secondary)
  const sorted = diffs
    .sort((a, b) => {
      const absDeltaWeightDiff = Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight)
      if (absDeltaWeightDiff !== 0) {
        return absDeltaWeightDiff
      }
      // Secondary sort by |Δbelief|
      return Math.abs(b.deltaBelief) - Math.abs(a.deltaBelief)
    })
    .slice(0, limit)

  // S6-COMPARE: Assign ranks (1-indexed) to all diffs
  return sorted.map((diff, index) => ({
    ...diff,
    rank: index + 1
  }))
}

/**
 * Extract edges from a stored run
 */
function extractEdges(run: StoredRun): Edge[] {
  return run.graph?.edges ?? []
}
