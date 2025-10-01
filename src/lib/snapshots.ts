// src/lib/snapshots.ts
export type Snapshot = { id: string; at: string; seed: string; model: string; data: any }
const KEY = 'snapshots.v1'
export function list(): Snapshot[] { try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Snapshot[] } catch { return [] } }
export function save(s: Snapshot) { const xs = list(); xs.unshift(s); localStorage.setItem(KEY, JSON.stringify(xs)) }
export function get(id: string) { return list().find((x) => x.id === id) }
