import { v4 as uuidv4 } from 'uuid'
import { SNAPSHOT_VERSION } from '@/sandbox/state/boardState'
import { track } from '@/lib/analytics'

export type SnapshotId = string

export type SnapshotMeta = {
  id: SnapshotId
  decisionId: string
  version: number // SNAPSHOT_VERSION
  createdAt: number // epoch ms
  note?: string
  probTotal?: number
}

export type SnapshotPayload = {
  meta: SnapshotMeta
  ydoc: string // base64 of Uint8Array from getUpdate()
}

const storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined

const idxKey = (decisionId: string) => `olumi:ss:index:${decisionId}`
const itemKey = (decisionId: string, snapshotId: string) => `olumi:ss:${decisionId}:${snapshotId}`

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const safeStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(obj)
  } catch {
    return '[]'
  }
}

const toB64 = (bytes: Uint8Array): string => {
  try {
    // Node/test environment
    const B: any = (globalThis as any).Buffer
    if (B) return B.from(bytes).toString('base64')
  } catch {}
  // Browser
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export const fromB64 = (b64: string): Uint8Array => {
  try {
    const B: any = (globalThis as any).Buffer
    if (B) return new Uint8Array(B.from(b64, 'base64'))
  } catch {}
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function saveSnapshot(decisionId: string, yUpdate: Uint8Array, meta: Partial<SnapshotMeta> = {}): SnapshotMeta {
  const now = Date.now()
  const id = uuidv4()
  const fullMeta: SnapshotMeta = {
    id,
    decisionId,
    version: SNAPSHOT_VERSION,
    createdAt: now,
    note: meta.note,
    probTotal: meta.probTotal,
  }
  const payload: SnapshotPayload = {
    meta: fullMeta,
    ydoc: toB64(yUpdate),
  }
  if (!storage) return fullMeta

  // Save payload
  storage.setItem(itemKey(decisionId, id), safeStringify(payload))

  // Update index with cap of last 10 (drop oldest)
  const existing = safeParse<SnapshotMeta[]>(storage.getItem(idxKey(decisionId))) || []
  const sorted = [fullMeta, ...existing].sort((a, b) => b.createdAt - a.createdAt)
  const kept = sorted.slice(0, 10)
  const dropped = sorted.slice(10)
  // Persist trimmed index
  storage.setItem(idxKey(decisionId), safeStringify(kept))
  // Delete payloads for dropped snapshots
  if (dropped.length) {
    for (const m of dropped) {
      storage.removeItem(itemKey(decisionId, m.id))
    }
    // Telemetry: cap trim occurred
    track('sandbox_snapshot', {
      op: 'trim',
      decisionId,
      droppedCount: dropped.length,
      droppedIds: dropped.map(d => d.id),
      keptCount: kept.length,
      ts: now,
    })
  }
  return fullMeta
}

export function listSnapshots(decisionId: string): SnapshotMeta[] {
  if (!storage) return []
  const existing = safeParse<SnapshotMeta[]>(storage.getItem(idxKey(decisionId))) || []
  return existing.sort((a, b) => b.createdAt - a.createdAt)
}

export function loadSnapshot(decisionId: string, id: SnapshotId): SnapshotPayload | null {
  if (!storage) return null
  const raw = storage.getItem(itemKey(decisionId, id))
  const payload = safeParse<SnapshotPayload>(raw)
  if (!payload) return null
  if (payload.meta.version !== SNAPSHOT_VERSION) return null
  return payload
}

export function deleteSnapshot(decisionId: string, id: SnapshotId): void {
  if (!storage) return
  storage.removeItem(itemKey(decisionId, id))
  const existing = safeParse<SnapshotMeta[]>(storage.getItem(idxKey(decisionId))) || []
  const next = existing.filter(m => m.id !== id)
  storage.setItem(idxKey(decisionId), safeStringify(next))
  // Telemetry: explicit delete
  track('sandbox_snapshot', { op: 'delete', decisionId, snapshotId: id, ts: Date.now() })
}

export function clearSnapshots(decisionId: string): void {
  if (!storage) return
  const existing = safeParse<SnapshotMeta[]>(storage.getItem(idxKey(decisionId))) || []
  for (const m of existing) {
    storage.removeItem(itemKey(decisionId, m.id))
    // Telemetry: per-snapshot delete during clear
    track('sandbox_snapshot', { op: 'delete', decisionId, snapshotId: m.id, ts: Date.now() })
  }
  storage.removeItem(idxKey(decisionId))
  // Telemetry: clear all
  track('sandbox_snapshot', { op: 'clear', decisionId, count: existing.length, ts: Date.now() })
}
