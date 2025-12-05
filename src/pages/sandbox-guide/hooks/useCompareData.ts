/**
 * useCompareData Hook
 *
 * Fetches and computes comparison data between two model runs:
 * - Delta calculation (value, percentage, direction)
 * - Top causal drivers from explain_delta
 * - Structural diff from /v1/diff endpoint
 *
 * Used by CompareState to display real backend data.
 */

import { useState, useEffect } from 'react'
import { loadRuns, type StoredRun } from '../../../canvas/store/runHistory'

export interface CompareData {
  baseline: StoredRun | null
  current: StoredRun | null
  delta: {
    value: number
    percentage: number
    direction: 'increase' | 'decrease' | 'unchanged'
  } | null
  changeDrivers: Array<{
    nodeId: string
    nodeLabel: string
    contribution: number
    direction: 'positive' | 'negative'
  }>
  structuralDiff: {
    nodesAdded: number
    nodesRemoved: number
    edgesAdded: number
    edgesRemoved: number
    details?: any
  } | null
  loading: boolean
  error: string | null
}

interface UseCompareDataParams {
  baselineRunId: string | null
  currentRunId: string | null
}

export function useCompareData({
  baselineRunId,
  currentRunId,
}: UseCompareDataParams): CompareData {
  const [runs, setRuns] = useState<StoredRun[]>([])
  const [structuralDiff, setStructuralDiff] = useState<CompareData['structuralDiff']>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load runs from localStorage
  useEffect(() => {
    setRuns(loadRuns())
  }, [baselineRunId, currentRunId])

  // Find baseline and current runs from history
  const baseline = runs.find((run) => run.id === baselineRunId) || null
  const current = runs.find((run) => run.id === currentRunId) || null

  // Calculate delta from report outcome values
  const delta =
    baseline && current
      ? (() => {
          // Extract outcome values from reports
          const baseValue = baseline.report?.outcome?.value ?? 0
          const currValue = current.report?.outcome?.value ?? 0
          const diff = currValue - baseValue
          const percentage = baseValue !== 0 ? (diff / baseValue) * 100 : 0
          const direction =
            diff > 0 ? ('increase' as const) : diff < 0 ? ('decrease' as const) : ('unchanged' as const)

          return {
            value: diff,
            percentage,
            direction,
          }
        })()
      : null

  // Extract change drivers - prefer change_attribution, fallback to explain_delta.top_drivers
  const changeDrivers = (() => {
    // Try new change_attribution field first
    if (current?.report?.change_attribution?.primary_drivers) {
      return current.report.change_attribution.primary_drivers.map((driver: any) => ({
        nodeId: driver.affected_nodes?.[0] || driver.driver_id || '',
        nodeLabel: driver.driver_label || 'Unknown Node',
        contribution: driver.contribution_pct || 0,
        direction: driver.polarity === 'increase' ? ('positive' as const) : ('negative' as const),
        // NEW: Include all affected nodes for multi-node highlighting
        affectedNodes: driver.affected_nodes || [],
        contributionPct: driver.contribution_pct || 0,
      }))
    }

    // Fallback to old explain_delta.top_drivers format
    if (current?.report?.explain_delta?.top_drivers) {
      return current.report.explain_delta.top_drivers.map((driver: any) => ({
        nodeId: driver.node_id || driver.nodeId || '',
        nodeLabel: driver.node_label || driver.label || driver.node_id || 'Unknown Node',
        contribution: driver.contribution || driver.impact || 0,
        direction: (driver.contribution || driver.impact || 0) >= 0 ? ('positive' as const) : ('negative' as const),
        // Legacy format - single node only
        affectedNodes: driver.node_id ? [driver.node_id] : [],
        contributionPct: driver.contribution || driver.impact || 0,
      }))
    }

    return []
  })()

  // Fetch structural diff from /v1/diff endpoint
  useEffect(() => {
    if (!baseline || !current) {
      setStructuralDiff(null)
      return
    }

    const fetchDiff = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/bff/engine/v1/diff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            graph_a: baseline.graph,
            graph_b: current.graph,
          }),
        })

        if (!response.ok) {
          throw new Error(`Diff API failed: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        setStructuralDiff({
          nodesAdded: data.nodes_added?.length || 0,
          nodesRemoved: data.nodes_removed?.length || 0,
          edgesAdded: data.edges_added?.length || 0,
          edgesRemoved: data.edges_removed?.length || 0,
          details: data,
        })
      } catch (err) {
        console.error('Failed to fetch structural diff:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch structural diff')
        setStructuralDiff(null)
      } finally {
        setLoading(false)
      }
    }

    fetchDiff()
  }, [baseline, current])

  return {
    baseline,
    current,
    delta,
    changeDrivers,
    structuralDiff,
    loading,
    error,
  }
}
