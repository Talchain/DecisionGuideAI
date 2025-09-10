import { track } from '@/lib/analytics'

export type ReapplyOp = {
  ts: number
  clientId: string
  seq: number
  type: string
  payload?: unknown
}

export type ReapplyResult = {
  kept: ReapplyOp[]
  invalid: Array<{ op: Partial<ReapplyOp>; reason: string }>
  collisions: Array<{ id: string; field: string }>
}

const PENDING = new Map<string, ReapplyOp[]>()
const COLLISIONS = new Map<string, Array<{ id: string; field: string }>>()
const LAST_CLEARED_VERSION = new Map<string, number>()

export function setPendingOps(decisionId: string, ops: ReapplyOp[]) {
  PENDING.set(decisionId, ops)
}

const validTypes = new Set(['add', 'update', 'delete'])

export function reapply(decisionId: string): ReapplyResult {
  const ops = [...(PENDING.get(decisionId) ?? [])]
  // Sort deterministically by (ts, clientId, seq)
  ops.sort((a, b) => (a.ts - b.ts) || a.clientId.localeCompare(b.clientId) || (a.seq - b.seq))

  const kept: ReapplyOp[] = []
  const invalid: Array<{ op: Partial<ReapplyOp>; reason: string }> = []
  const simple: Op[] = []

  for (const op of ops) {
    const reasons: string[] = []
    if (!Number.isFinite(op.ts) || op.ts < 0) reasons.push('ts_invalid')
    if (!op.clientId) reasons.push('client_missing')
    if (!Number.isInteger(op.seq) || op.seq < 0) reasons.push('seq_invalid')
    if (!validTypes.has(op.type)) reasons.push('type_invalid')
    if (reasons.length > 0) {
      invalid.push({ op, reason: reasons.join('|') })
      continue
    }
    const p = op.payload as any
    if (p && p.id && p.field) {
      simple.push({ id: String(p.id), field: String(p.field), value: p.value, clientId: op.clientId })
    }
    kept.push(op)
  }

  const collisions = detectCollisions(simple).map(c => ({ id: c.nodeId, field: c.field, prev: c.prev, next: c.next, winnerClientId: c.winnerClientId }))

  if (invalid.length > 0) {
    track('sandbox_delta_reapply', { op: 'ops_dropped_invalid', decisionId, count: invalid.length, reasons: Array.from(new Set(invalid.map(i => i.reason))), ts: Date.now() })
  }
  if (collisions.length > 0) {
    const payload = collisions.map(c => ({ nodeId: c.id, field: c.field, prev: c.prev, next: c.next, winnerClientId: (c as any).winnerClientId }))
    track('sandbox_rival_edit', { decisionId, count: collisions.length, collisions: payload, ts: Date.now() })
  }
  COLLISIONS.set(decisionId, collisions)
  try { window.dispatchEvent(new CustomEvent('sandbox:reapply-done', { detail: { decisionId } })) } catch {}
  return { kept, invalid, collisions }
}

export function getCollisions(decisionId: string): Array<{ id: string; field: string; prev?: any; next?: any; winnerClientId?: string }> { return [...(COLLISIONS.get(decisionId) ?? [])] }
export function clearCollisions(decisionId: string) { COLLISIONS.delete(decisionId) }

// Accepted-version chip clear helpers
export function markClearedVersion(decisionId: string, version: number) {
  LAST_CLEARED_VERSION.set(decisionId, version)
}
export function getLastClearedVersion(decisionId: string): number {
  return LAST_CLEARED_VERSION.get(decisionId) ?? -1
}

// Test-only: clear all reapply state
export function __clearForTest() {
  PENDING.clear()
  COLLISIONS.clear()
  LAST_CLEARED_VERSION.clear()
}

// ————————————————————————————————————————————————————————————————————————
// Pure collision detector for unit-first testing
// ————————————————————————————————————————————————————————————————————————
export type Op = { id: string; field: string; value: any; clientId?: string }

export function detectCollisions(ops: Op[]): Array<{ nodeId: string; field: string; prev: any; next: any; winnerClientId?: string }> {
  // Deterministically group by (id, field) and detect cross-client last-writer wins
  const seen: Map<string, { count: number; clients: Set<string>; last?: any; secondLast?: any; lastClient?: string }> = new Map()
  for (const op of ops) {
    if (!op || !op.id || !op.field) continue
    const key = `${op.id}:${op.field}`
    const rec = seen.get(key) ?? { count: 0, clients: new Set<string>(), last: undefined, secondLast: undefined, lastClient: undefined }
    rec.count += 1
    if (op.clientId) rec.clients.add(op.clientId)
    rec.secondLast = rec.last
    rec.last = op.value
    rec.lastClient = op.clientId
    seen.set(key, rec)
  }
  const out: Array<{ nodeId: string; field: string; prev: any; next: any; winnerClientId?: string }> = []
  for (const [key, rec] of seen) {
    if (rec.count > 1 && rec.clients.size > 1) {
      const [id, field] = key.split(':')
      out.push({ nodeId: id, field, prev: rec.secondLast, next: rec.last, winnerClientId: rec.lastClient })
    }
  }
  return out
}
