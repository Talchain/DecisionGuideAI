// Safe localStorage persistence with schema validation
import { Node, Edge } from '@xyflow/react'

const STORAGE_KEY = 'canvas-storage'

interface PersistedState {
  nodes: Node[]
  edges: Edge[]
}

function isValidState(data: unknown): data is PersistedState {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.nodes) && Array.isArray(d.edges)
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return isValidState(data) ? data : null
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[CANVAS] Failed to save state:', err)
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
