/**
 * Snapshots v2: Named, Timestamped Local Snapshots
 *
 * Features:
 * - Max 10 snapshots with FIFO rotation
 * - Named snapshots with timestamps
 * - Explicit property extraction (nodes, edges, meta)
 * - Never stores preview/debug/interim data
 * - Sanitized labels on save
 *
 * Flag: VITE_FEATURE_SNAPSHOTS_V2=0|1 (default OFF)
 */

import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import { sanitizeLabel } from '../persist'

export interface SnapshotMeta {
  id: string
  name: string
  created_at: number
  seed?: number
  hash?: string  // response_hash from run
}

export interface Snapshot {
  meta: SnapshotMeta
  nodes: Array<{
    id: string
    label: string
    x: number
    y: number
    type?: string
  }>
  edges: Array<{
    from: string
    to: string
    label?: string
    weight?: number
  }>
}

const STORAGE_KEY = 'canvas-snapshots-v2'
const MAX_SNAPSHOTS = 10

/**
 * Generate unique snapshot ID
 */
function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Load all snapshots from localStorage
 */
export function listSnapshots(): Snapshot[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return []

    const snapshots = JSON.parse(json)
    return Array.isArray(snapshots) ? snapshots : []
  } catch (err) {
    console.error('[Snapshots] Failed to load:', err)
    return []
  }
}

/**
 * Save a new snapshot with FIFO rotation
 *
 * @param name - User-provided name for the snapshot
 * @param nodes - Canvas nodes (sanitized labels)
 * @param edges - Canvas edges (sanitized labels)
 * @param meta - Optional metadata (seed, hash)
 * @returns Snapshot ID
 */
export function saveSnapshot(
  name: string,
  nodes: Node[],
  edges: Edge<EdgeData>[],
  meta?: { seed?: number; hash?: string }
): string {
  try {
    const snapshots = listSnapshots()

    // Deep-clone graph before extracting snapshot fields to avoid retaining live references
    const { nodes: safeNodes, edges: safeEdges } = JSON.parse(
      JSON.stringify({ nodes, edges }),
    ) as { nodes: Node[]; edges: Edge<EdgeData>[] }

    // Create snapshot with explicit property extraction
    const snapshot: Snapshot = {
      meta: {
        id: generateSnapshotId(),
        name: sanitizeLabel(name),
        created_at: Date.now(),
        seed: meta?.seed,
        hash: meta?.hash,
      },
      nodes: safeNodes.map(node => ({
        id: node.id,
        label: sanitizeLabel(node.data?.label || node.id),
        x: node.position.x,
        y: node.position.y,
        type: node.type,
      })),
      edges: safeEdges.map(edge => ({
        from: edge.source,
        to: edge.target,
        label: edge.data?.label ? sanitizeLabel(edge.data.label) : undefined,
        weight: edge.data?.weight,
      })),
    }

    // Add to snapshots array
    snapshots.push(snapshot)

    // Rotate if exceeds max (FIFO)
    if (snapshots.length > MAX_SNAPSHOTS) {
      const removed = snapshots.shift()
      if (import.meta.env.DEV) {
        console.log(`[Snapshots] Rotated out oldest snapshot: ${removed?.meta.name}`)
      }
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))

    if (import.meta.env.DEV) {
      console.log(`[Snapshots] Saved "${snapshot.meta.name}" (${snapshot.meta.id})`)
    }
    return snapshot.meta.id
  } catch (err) {
    console.error('[Snapshots] Failed to save:', err)
    throw new Error('Failed to save snapshot')
  }
}

/**
 * Get a specific snapshot by ID
 */
export function getSnapshot(id: string): Snapshot | null {
  const snapshots = listSnapshots()
  return snapshots.find(s => s.meta.id === id) || null
}

/**
 * Delete a snapshot by ID
 */
export function deleteSnapshot(id: string): boolean {
  try {
    const snapshots = listSnapshots()
    const filtered = snapshots.filter(s => s.meta.id !== id)

    if (filtered.length === snapshots.length) {
      console.warn(`[Snapshots] Snapshot not found: ${id}`)
      return false
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    if (import.meta.env.DEV) {
      console.log(`[Snapshots] Deleted snapshot: ${id}`)
    }
    return true
  } catch (err) {
    console.error('[Snapshots] Failed to delete:', err)
    return false
  }
}

/**
 * Restore snapshot to canvas
 *
 * @returns {nodes, edges} Ready for React Flow
 */
export function restoreSnapshot(id: string): {
  nodes: Node[]
  edges: Edge<EdgeData>[]
} | null {
  const snapshot = getSnapshot(id)
  if (!snapshot) return null

  // Convert snapshot format back to React Flow format
  const nodes: Node[] = snapshot.nodes.map(node => ({
    id: node.id,
    type: node.type || 'decision',
    position: { x: node.x, y: node.y },
    data: { label: node.label },
  }))

  const edges: Edge<EdgeData>[] = snapshot.edges.map((edge, idx) => ({
    id: `edge-${idx}`,
    source: edge.from,
    target: edge.to,
    data: {
      label: edge.label,
      weight: edge.weight,
    },
  }))

  return { nodes, edges }
}

/**
 * Clear all snapshots
 */
export function clearAllSnapshots(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    if (import.meta.env.DEV) {
      console.log('[Snapshots] Cleared all snapshots')
    }
  } catch (err) {
    console.error('[Snapshots] Failed to clear:', err)
  }
}

/**
 * Get snapshot count
 */
export function getSnapshotCount(): number {
  return listSnapshots().length
}

/**
 * Check if at max capacity
 */
export function isAtMaxCapacity(): boolean {
  return getSnapshotCount() >= MAX_SNAPSHOTS
}
