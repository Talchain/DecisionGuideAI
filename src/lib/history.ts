// src/lib/history.ts
// Local, metadata-only history for Scenario Sandbox runs.
// No PII, no transcripts. Newest-first cap.

export type RunMeta = {
  id: string
  ts: number
  status: 'done' | 'aborted' | 'limited' | 'error'
  durationMs?: number
  estCost?: number
  seed?: string
  budget?: number
  model?: string
  route: 'critique' | 'ghost'
  sessionId: string
  org: string
}

const KEY = 'sandbox.history'
const MAX = 5

export function load(): RunMeta[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr as RunMeta[]
  } catch {}
  return []
}

export function save(list: RunMeta[]): void {
  try {
    const trimmed = list.slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {}
}

export function listRuns(limit = MAX): RunMeta[] {
  const items = load()
  // items are stored newest-first already; just slice
  return items.slice(0, limit)
}

export function record(meta: RunMeta): void {
  try {
    const items = load()
    let id = meta.id
    let n = 1
    while (items.some((x) => x.id === id)) {
      id = `${meta.id}-${n++}`
    }
    items.unshift({ ...meta, id })
    save(items)
  } catch {}
}

export function clear(): void {
  try { localStorage.removeItem(KEY) } catch {}
}

export const __HISTORY__ = { KEY, MAX }
