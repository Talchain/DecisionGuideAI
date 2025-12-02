// src/poc/state/persist.ts
// PoC: Minimal persistence for sandbox graph state

import type { SamState } from './history'

const KEY = 'sandbox.state.v1'

export function loadState(): SamState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // Accept both legacy (no schemaVersion) and v1 (schemaVersion:1)
    const isV1 = (parsed as any).schemaVersion === 1
    const rawNodes = (parsed as any).nodes
    const rawEdges = (parsed as any).edges

    // For v1, nodes/edges MUST be arrays; otherwise treat as garbage
    if (isV1 && (!Array.isArray(rawNodes) || !Array.isArray(rawEdges))) {
      return null
    }

    const nodes = Array.isArray(rawNodes) ? rawNodes : []
    const edges = Array.isArray(rawEdges) ? rawEdges : []
    const renames = (parsed as any).renames && typeof (parsed as any).renames === 'object' ? (parsed as any).renames : {}

    // Minimal structural validation: legacy payloads are accepted if shapes look right
    if (Array.isArray(nodes) && Array.isArray(edges)) {
      return { nodes, edges, renames }
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state: SamState): void {
  try {
    const safe = JSON.stringify({ schemaVersion: 1, nodes: state.nodes, edges: state.edges, renames: state.renames })
    localStorage.setItem(KEY, safe)
  } catch {}
}

export function clearState(): void {
  try { localStorage.removeItem(KEY) } catch {}
}
