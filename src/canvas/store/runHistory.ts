/**
 * Run History Storage
 *
 * Local-first storage for the last 20 analysis runs.
 * Persists to localStorage with automatic pruning.
 */

import type { ReportV1 } from '../../adapters/plot/v1/types'
import { computeClientHash } from '../../adapters/plot/v1/mapper'
import type { Node, Edge } from '@xyflow/react'

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
}

const STORAGE_KEY = 'olumi-canvas-run-history'
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
 * @returns true if this was a duplicate run, false if new
 */
export function addRun(run: StoredRun): boolean {
  const runs = loadRuns()

  // v1.2: Check if this response_hash already exists
  if (run.hash) {
    const existingIndex = runs.findIndex(r => r.hash === run.hash)
    if (existingIndex !== -1) {
      // Hash collision - this is a duplicate run
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
      return true // Duplicate detected
    }
  }

  // No duplicate found - add as new run
  runs.unshift(run)
  saveRuns(runs)
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
