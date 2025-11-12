/**
 * Run History Storage
 *
 * Local-first storage for the last 20 analysis runs.
 * Persists to localStorage with automatic pruning.
 *
 * Emits events via runsBus when runs are added/modified/deleted,
 * enabling live refresh across components and tabs.
 */

import type { ReportV1 } from '../../adapters/plot/v1/types'
import { computeClientHash } from '../../adapters/plot/v1/mapper'
import type { Node, Edge } from '@xyflow/react'
import * as runsBus from './runsBus'

export interface StoredRun {
  id: string // uuid
  ts: number // timestamp ms
  seed: number
  hash?: string
  templateId?: string
  adapter: 'mock' | 'httpv1' | 'auto'
  summary: string // from report
  graphHash: string // stable hash of graph+seed for reproduce
  report: ReportV1 // full report
  drivers?: Array<{ kind: 'node' | 'edge'; id?: string; label?: string }>
  isPinned?: boolean
  isDuplicate?: boolean // v1.2: true if this hash already exists in history
  duplicateCount?: number // v1.2: number of times this hash has been re-run
  graph?: { // v1.2: Graph snapshot for computing deltas
    nodes: Node[]
    edges: Edge[]
  }
}

export const STORAGE_KEY = 'olumi-canvas-run-history' // Exported for cross-tab listening
const MAX_RUNS = 20
const MAX_PINNED = 5

/**
 * Generate a stable hash for graph+seed to enable reproduce
 * Uses computeClientHash which sorts nodes/edges for determinism
 */
export function generateGraphHash(nodes: Node[], edges: Edge[], seed: number): string {
  return computeClientHash({ nodes, edges }, seed)
}

/**
 * Check if localStorage is available (guards against SSR, tests)
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Load all runs from localStorage
 */
export function loadRuns(): StoredRun[] {
  if (!isLocalStorageAvailable()) {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const runs = JSON.parse(stored) as StoredRun[]

    // Validate runs array
    if (!Array.isArray(runs)) {
      console.warn('[runHistory] Invalid runs format, resetting')
      return []
    }

    return runs.sort((a, b) => b.ts - a.ts) // Latest first
  } catch (error) {
    console.error('[runHistory] Failed to load:', error)
    return []
  }
}

/**
 * Save runs to localStorage, pruning to MAX_RUNS
 */
export function saveRuns(runs: StoredRun[]): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    // Validate input
    if (!Array.isArray(runs)) {
      console.warn('[runHistory] Invalid runs input, skipping save')
      return
    }

    // Separate pinned and unpinned
    const pinned = runs.filter(r => r.isPinned).slice(0, MAX_PINNED)
    const unpinned = runs.filter(r => !r.isPinned)

    // Keep pinned + most recent unpinned, total MAX_RUNS
    const pruned = [
      ...pinned,
      ...unpinned.slice(0, MAX_RUNS - pinned.length)
    ].sort((a, b) => b.ts - a.ts)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        console.error('[runHistory] Storage quota exceeded, clearing oldest runs')
        // Try to save with fewer runs
        try {
          const minimal = runs.slice(0, 10)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
        } catch {
          console.error('[runHistory] Failed to save even minimal history')
        }
      } else {
        console.error('[runHistory] Storage error:', error.message)
      }
    } else {
      console.error('[runHistory] Failed to save:', error)
    }
  }
}

/**
 * Add a new run to history
 * v1.2: Implements determinism dedupe - if hash exists, consolidates instead of adding
 * RC2 Fix: Also check graphHash (includes seed) to prevent force-rerun deduplication
 * @returns true if this was a duplicate run, false if new
 */
export function addRun(run: StoredRun): boolean {
  const runs = loadRuns()

  // v1.2: Check if this response_hash + graphHash already exist
  // graphHash includes seed, so force reruns with bumped seed won't be treated as duplicates
  if (run.hash && run.graphHash) {
    const existingIndex = runs.findIndex(r => r.hash === run.hash && r.graphHash === run.graphHash)
    if (existingIndex !== -1) {
      // Both hashes match - this is a true duplicate run (same graph + seed + response)
      const existing = runs[existingIndex]

      // Update the existing run with new timestamp and increment duplicate count
      runs[existingIndex] = {
        ...existing,
        ts: run.ts, // Use new timestamp
        isDuplicate: true,
        duplicateCount: (existing.duplicateCount || 1) + 1
      }

      // Move to front (most recent)
      const updated = runs.splice(existingIndex, 1)[0]
      runs.unshift(updated)

      saveRuns(runs)
      runsBus.emit() // Notify observers
      return true // Duplicate detected
    }
  }

  // No duplicate found - add as new run
  runs.unshift(run)
  saveRuns(runs)
  runsBus.emit() // Notify observers
  return false // New run
}

/**
 * Toggle pin status
 */
export function togglePin(runId: string): void {
  const runs = loadRuns()
  const run = runs.find(r => r.id === runId)
  if (!run) return

  run.isPinned = !run.isPinned
  saveRuns(runs)
  runsBus.emit() // Notify observers
}

/**
 * Delete a run
 */
export function deleteRun(runId: string): void {
  const runs = loadRuns().filter(r => r.id !== runId)
  saveRuns(runs)
  runsBus.emit() // Notify observers
}

/**
 * Get a run by ID
 */
export function getRun(runId: string): StoredRun | undefined {
  return loadRuns().find(r => r.id === runId)
}

/**
 * Compare two runs and compute deltas
 */
export interface RunComparison {
  runA: StoredRun
  runB: StoredRun
  summaryChanged: boolean
  driversAdded: Array<{ kind: 'node' | 'edge'; id?: string; label?: string }>
  driversRemoved: Array<{ kind: 'node' | 'edge'; id?: string; label?: string }>
  driversCommon: Array<{ kind: 'node' | 'edge'; id?: string; label?: string }>
}

export function compareRuns(runIdA: string, runIdB: string): RunComparison | null {
  const runA = getRun(runIdA)
  const runB = getRun(runIdB)

  if (!runA || !runB) return null

  const driversA = runA.drivers || []
  const driversB = runB.drivers || []

  // Compute set operations on drivers
  const driversAdded = driversB.filter(
    b => !driversA.some(a => driverEquals(a, b))
  )
  const driversRemoved = driversA.filter(
    a => !driversB.some(b => driverEquals(a, b))
  )
  const driversCommon = driversA.filter(
    a => driversB.some(b => driverEquals(a, b))
  )

  return {
    runA,
    runB,
    summaryChanged: runA.summary !== runB.summary,
    driversAdded,
    driversRemoved,
    driversCommon
  }
}

/**
 * Check if two drivers are equal (by ID or label)
 */
function driverEquals(
  a: { kind: 'node' | 'edge'; id?: string; label?: string },
  b: { kind: 'node' | 'edge'; id?: string; label?: string }
): boolean {
  if (a.kind !== b.kind) return false
  if (a.id && b.id) return a.id === b.id
  return a.label === b.label
}

/**
 * Extract p50 (median) probability from a report
 * Prefers normalized run.bands.p50, falls back to results.likely
 */
export function extractP50(report: ReportV1): number | null {
  // v1.2: Use normalized bands if available
  if (report.run?.bands?.p50 != null) {
    return report.run.bands.p50
  }

  // Legacy fallback: use results.likely
  if (report.results?.likely != null) {
    return report.results.likely
  }

  return null
}

/**
 * Compute summary string for a run: "p50 0.62 (Δ −0.05) · 3 edges changed"
 */
export interface RunSummaryData {
  p50Text: string // "p50 0.62" or "p50 N/A"
  deltaText: string | null // "(Δ −0.05)" or null if no prior
  edgesChangedText: string | null // "3 edges changed", "No material change", or null if no prior
}

export function computeRunSummary(run: StoredRun, priorRun: StoredRun | undefined): RunSummaryData {
  const p50 = extractP50(run.report)
  const p50Text = p50 != null ? `p50 ${p50.toFixed(2)}` : 'p50 N/A'

  if (!priorRun) {
    return { p50Text, deltaText: null, edgesChangedText: null }
  }

  // Compute delta
  const priorP50 = extractP50(priorRun.report)
  let deltaText: string | null = null
  if (p50 != null && priorP50 != null) {
    const delta = p50 - priorP50
    const sign = delta >= 0 ? '+' : '−' // Use proper minus sign
    const deltaValue = Math.abs(delta).toFixed(2)
    deltaText = `(Δ ${sign}${deltaValue})`
  }

  // Count edges changed (weight or belief changed beyond epsilon)
  // RC2 Fix: Check if graph data is available before computing delta
  let edgesChangedText: string
  if (!priorRun.graph || !priorRun.graph.edges) {
    edgesChangedText = 'Snapshot unavailable – rerun to compare'
  } else {
    const edgesChanged = countEdgesChanged(run, priorRun)
    edgesChangedText = edgesChanged > 0
      ? `${edgesChanged} edge${edgesChanged === 1 ? '' : 's'} changed`
      : 'No material change'
  }

  return { p50Text, deltaText, edgesChangedText }
}

/**
 * Count edges where weight or belief changed beyond epsilon
 * Epsilon = 1e-6 for floating point tolerance
 */
const EPSILON = 1e-6

function countEdgesChanged(run: StoredRun, priorRun: StoredRun): number {
  if (!run.graph || !priorRun.graph) {
    return 0
  }

  const currentEdges = run.graph.edges
  const priorEdges = priorRun.graph.edges

  // Create a map of prior edges by id for fast lookup
  const priorEdgeMap = new Map(
    priorEdges.map(e => [e.id, e])
  )

  let changedCount = 0

  for (const currentEdge of currentEdges) {
    const priorEdge = priorEdgeMap.get(currentEdge.id)

    if (!priorEdge) {
      // Edge is new (added), count as changed
      changedCount++
      continue
    }

    // Compare weight
    const currentWeight = currentEdge.data?.weight ?? 0
    const priorWeight = priorEdge.data?.weight ?? 0
    if (Math.abs(currentWeight - priorWeight) > EPSILON) {
      changedCount++
      continue
    }

    // Compare belief (if present)
    const currentBelief = currentEdge.data?.belief
    const priorBelief = priorEdge.data?.belief
    if (currentBelief != null && priorBelief != null) {
      if (Math.abs(currentBelief - priorBelief) > EPSILON) {
        changedCount++
        continue
      }
    } else if (currentBelief != null || priorBelief != null) {
      // One has belief, the other doesn't - count as changed
      changedCount++
      continue
    }

    // Compare confidence (fallback if weight/belief not present)
    const currentConfidence = currentEdge.data?.confidence
    const priorConfidence = priorEdge.data?.confidence
    if (currentConfidence != null && priorConfidence != null) {
      if (Math.abs(currentConfidence - priorConfidence) > EPSILON) {
        changedCount++
      }
    } else if (currentConfidence != null || priorConfidence != null) {
      // One has confidence, the other doesn't - count as changed
      changedCount++
    }
  }

  // Count edges that were removed
  const currentEdgeIds = new Set(currentEdges.map(e => e.id))
  const removedCount = priorEdges.filter(e => !currentEdgeIds.has(e.id)).length
  changedCount += removedCount

  return changedCount
}
