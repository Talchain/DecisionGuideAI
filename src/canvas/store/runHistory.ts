/**
 * Run History Storage
 *
 * Local-first storage for the last 20 analysis runs.
 * Persists to localStorage with automatic pruning.
 */

import type { ReportV1 } from '@/adapters/plot/v1/types'

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
}

const STORAGE_KEY = 'olumi-canvas-run-history'
const MAX_RUNS = 20
const MAX_PINNED = 5

/**
 * Generate a stable hash for graph+seed to enable reproduce
 */
export function generateGraphHash(nodes: unknown[], edges: unknown[], seed: number): string {
  const payload = JSON.stringify({ nodes, edges, seed })

  // Simple hash function (djb2)
  let hash = 5381
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i)
  }

  return Math.abs(hash).toString(36)
}

/**
 * Load all runs from localStorage
 */
export function loadRuns(): StoredRun[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const runs = JSON.parse(stored) as StoredRun[]
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
  try {
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
    console.error('[runHistory] Failed to save:', error)
  }
}

/**
 * Add a new run to history
 */
export function addRun(run: StoredRun): void {
  const runs = loadRuns()
  runs.unshift(run) // Add to front
  saveRuns(runs)
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
}

/**
 * Delete a run
 */
export function deleteRun(runId: string): void {
  const runs = loadRuns().filter(r => r.id !== runId)
  saveRuns(runs)
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
