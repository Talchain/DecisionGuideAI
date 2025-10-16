// Safe localStorage persistence with schema validation, versioning, and quota handling
import { Node, Edge } from '@xyflow/react'

const STORAGE_KEY = 'canvas-storage'
const SNAPSHOT_PREFIX = 'canvas-snapshot-'
const MAX_SNAPSHOTS = 10
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024 // 5MB

interface PersistedState {
  version: number
  timestamp: number
  nodes: Node[]
  edges: Edge[]
}

interface SnapshotMetadata {
  key: string
  timestamp: number
  size: number
}

function isValidState(data: unknown): data is PersistedState {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.version === 'number' &&
    typeof d.timestamp === 'number' &&
    Array.isArray(d.nodes) &&
    Array.isArray(d.edges)
  )
}

export function sanitizeLabel(label: unknown): string {
  if (typeof label !== 'string') return 'Untitled'
  // Strip HTML tags, control characters, and limit length
  return label
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 100)
    .trim() || 'Untitled'
}

function sanitizeNodeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return { label: 'Untitled' }
  const d = data as Record<string, unknown>
  return {
    ...d,
    label: sanitizeLabel(d.label),
  }
}

function sanitizeState(state: PersistedState): PersistedState {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({
      ...node,
      data: sanitizeNodeData(node.data),
    })),
    edges: state.edges.map((edge) => ({
      ...edge,
      label: edge.label ? sanitizeLabel(edge.label) : undefined,
    })),
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!isValidState(data)) return null
    return sanitizeState(data)
  } catch {
    return null
  }
}

export function saveState(state: { nodes: Node[]; edges: Edge[] }): boolean {
  try {
    const persisted: PersistedState = {
      version: 1,
      timestamp: Date.now(),
      ...state,
    }
    const sanitized = sanitizeState(persisted)
    const payload = JSON.stringify(sanitized)

    if (payload.length > MAX_PAYLOAD_SIZE) {
      console.warn('[CANVAS] Payload exceeds 5MB, save aborted')
      return false
    }

    localStorage.setItem(STORAGE_KEY, payload)
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.error('[CANVAS] LocalStorage quota exceeded')
      return false
    }
    console.warn('[CANVAS] Failed to save state:', err)
    return false
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// Snapshot management (versioned saves)

export function saveSnapshot(state: { nodes: Node[]; edges: Edge[] }): boolean {
  try {
    const persisted: PersistedState = {
      version: 1,
      timestamp: Date.now(),
      ...state,
    }
    const sanitized = sanitizeState(persisted)
    const payload = JSON.stringify(sanitized)

    if (payload.length > MAX_PAYLOAD_SIZE) {
      console.warn('[CANVAS] Snapshot exceeds 5MB, save aborted')
      return false
    }

    const key = `${SNAPSHOT_PREFIX}${persisted.timestamp}`
    localStorage.setItem(key, payload)

    // Rotate old snapshots
    rotateSnapshots()

    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.error('[CANVAS] LocalStorage quota exceeded, cannot save snapshot')
      return false
    }
    console.warn('[CANVAS] Failed to save snapshot:', err)
    return false
  }
}

export function listSnapshots(): SnapshotMetadata[] {
  const snapshots: SnapshotMetadata[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(SNAPSHOT_PREFIX)) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const parsed = JSON.parse(data)
            if (isValidState(parsed)) {
              snapshots.push({
                key,
                timestamp: parsed.timestamp,
                size: data.length,
              })
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return snapshots.sort((a, b) => b.timestamp - a.timestamp)
}

export function loadSnapshot(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!isValidState(data)) return null
    return sanitizeState(data)
  } catch {
    return null
  }
}

export function deleteSnapshot(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function rotateSnapshots(): void {
  const snapshots = listSnapshots()
  if (snapshots.length > MAX_SNAPSHOTS) {
    // Delete oldest snapshots
    const toDelete = snapshots.slice(MAX_SNAPSHOTS)
    toDelete.forEach((s) => deleteSnapshot(s.key))
  }
}

// Import/Export

export interface ExportData {
  version: number
  timestamp: number
  nodes: Node[]
  edges: Edge[]
}

export function exportCanvas(state: { nodes: Node[]; edges: Edge[] }): string {
  const exportData: ExportData = {
    version: 1,
    timestamp: Date.now(),
    ...state,
  }
  const sanitized = sanitizeState(exportData)
  return JSON.stringify(sanitized, null, 2)
}

export function importCanvas(json: string): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const data = JSON.parse(json)

    // Validate structure
    if (!isValidState(data)) {
      console.error('[CANVAS] Invalid import data structure')
      return null
    }

    // Sanitize all strings
    const sanitized = sanitizeState(data)

    // Basic validation
    if (!Array.isArray(sanitized.nodes) || !Array.isArray(sanitized.edges)) {
      return null
    }

    // Validate node structure
    for (const node of sanitized.nodes) {
      if (!node.id || typeof node.id !== 'string') {
        console.error('[CANVAS] Invalid node ID')
        return null
      }
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.error('[CANVAS] Invalid node position')
        return null
      }
    }

    // Validate edge structure
    for (const edge of sanitized.edges) {
      if (!edge.id || !edge.source || !edge.target) {
        console.error('[CANVAS] Invalid edge structure')
        return null
      }
    }

    return {
      nodes: sanitized.nodes,
      edges: sanitized.edges,
    }
  } catch (err) {
    console.error('[CANVAS] Failed to parse import JSON:', err)
    return null
  }
}
