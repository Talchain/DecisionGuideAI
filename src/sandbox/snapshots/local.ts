import { v4 as uuidv4 } from 'uuid'
import type { Snapshot, SnapshotMeta } from './types'

const storage = typeof window !== 'undefined' ? window.localStorage : undefined

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
  // btoa expects binary string
  return btoa(binary)
}

const fromB64 = (b64: string): Uint8Array => {
  try {
    const B: any = (globalThis as any).Buffer
    if (B) return new Uint8Array(B.from(b64, 'base64'))
  } catch {}
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export const key = (decisionId: string) => `sandbox:snapshots:${decisionId}`

export function list(decisionId: string): SnapshotMeta[] {
  if (!storage) return []
  const arr = safeParse<Snapshot[]>(storage.getItem(key(decisionId))) || []
  return arr
    .map((s) => ({ id: s.id, label: s.label, createdAt: s.createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function save(decisionId: string, label: string, update: Uint8Array): Snapshot {
  if (!storage) {
    // Ephemeral fallback for non-browser env
    return { id: uuidv4(), label, createdAt: Date.now(), updateB64: toB64(update) }
  }
  const existing = safeParse<Snapshot[]>(storage.getItem(key(decisionId))) || []
  const snap: Snapshot = { id: uuidv4(), label, createdAt: Date.now(), updateB64: toB64(update) }
  const next = [...existing, snap]
  storage.setItem(key(decisionId), safeStringify(next))
  return snap
}

export function load(decisionId: string, snapshotId: string): Uint8Array | null {
  if (!storage) return null
  const arr = safeParse<Snapshot[]>(storage.getItem(key(decisionId))) || []
  const found = arr.find((s) => s.id === snapshotId)
  if (!found) return null
  return fromB64(found.updateB64)
}
