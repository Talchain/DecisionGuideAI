// Safe localStorage persistence with schema validation, versioning, and quota handling
import { Node, Edge } from '@xyflow/react'
import type { EdgeData } from './domain/edges'

const STORAGE_KEY = 'canvas-storage'
const SNAPSHOT_PREFIX = 'canvas-snapshot-'
const MAX_SNAPSHOTS = 10
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024 // 5MB

interface PersistedState {
  version: number
  timestamp: number
  nodes: Node[]
  edges: Edge<EdgeData>[]
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

/**
 * Deep sanitizer to remove non-serializable properties
 * Strips: DOM refs, React fibers, functions, symbols, internal ReactFlow props, circular references
 */
function deepSanitize(obj: unknown, seen = new WeakSet()): unknown {
  // Primitives pass through
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  // Circular reference detection
  if (seen.has(obj as object)) {
    return undefined // Skip circular references
  }
  seen.add(obj as object)

  // Arrays: sanitize each element
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, seen))
  }

  // Objects: filter out non-serializable properties
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip non-serializable properties
    if (
      key.startsWith('__') ||           // React internals (__reactFiber$, __reactProps$)
      key === 'measured' ||              // ReactFlow internal
      key === 'resizing' ||              // ReactFlow internal
      key === 'dragging' ||              // ReactFlow internal
      key === 'internals' ||             // ReactFlow internal
      key === 'handleBounds' ||          // ReactFlow internal
      key === 'isParent' ||              // ReactFlow internal (can cause issues)
      typeof value === 'function' ||     // Functions
      typeof value === 'symbol'          // Symbols
    ) {
      continue
    }

    // Check for DOM elements (have nodeType property)
    if (value && typeof value === 'object' && 'nodeType' in value) {
      continue // Skip DOM elements
    }

    // Recursively sanitize nested objects/arrays
    sanitized[key] = deepSanitize(value, seen)
  }

  return sanitized
}

function sanitizeNodeData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return { label: 'Untitled' }
  const d = data as Record<string, unknown>
  const sanitized = deepSanitize(d) as Record<string, unknown>
  return {
    ...sanitized,
    label: sanitizeLabel(sanitized.label),
  }
}

function sanitizeState(state: PersistedState): PersistedState {
  return {
    ...state,
    nodes: state.nodes.map((node) => {
      const sanitizedNode = deepSanitize(node) as Node
      return {
        ...sanitizedNode,
        data: sanitizeNodeData(sanitizedNode.data),
      }
    }),
    edges: state.edges.map((edge) => {
      const sanitizedEdge = deepSanitize(edge) as Edge<EdgeData>
      return {
        ...sanitizedEdge,
        label: sanitizedEdge.label ? sanitizeLabel(sanitizedEdge.label) : undefined,
      }
    }),
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

export function saveState(state: { nodes: Node[]; edges: Edge<EdgeData>[] }): boolean {
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

export function saveSnapshot(state: { nodes: Node[]; edges: Edge<EdgeData>[] }): boolean {
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

import { importSnapshot, exportSnapshot } from './domain/migrations'

export interface ExportData {
  version: number
  timestamp: number
  nodes: Node[]
  edges: Edge<EdgeData>[]
}

export function exportCanvas(state: { nodes: Node[]; edges: Edge<EdgeData>[] }): string {
  // Use migration API to produce current schema snapshot
  const snapshot = exportSnapshot(state.nodes, state.edges)
  const sanitized = sanitizeState(snapshot)
  return JSON.stringify(sanitized, null, 2)
}

export function importCanvas(json: string): { nodes: Node[]; edges: Edge<EdgeData>[] } | null {
  try {
    const parsed = JSON.parse(json)
    
    // Route through migration API for automatic v1→v2 upgrade
    const normalized = importSnapshot(parsed)
    if (!normalized) {
      console.error('[CANVAS] Invalid import data structure')
      return null
    }

    // Sanitize all strings
    const sanitized = sanitizeState(normalized)

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
