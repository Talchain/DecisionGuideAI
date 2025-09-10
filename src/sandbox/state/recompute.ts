import { computeProjection } from '../../../packages/scenario-engine/computeProjection'
import type { ProjectionResult, OptionInput } from '../../../packages/scenario-engine/types'
import { track } from '@/lib/analytics'
import { mark, measure } from '@/lib/perf'

export type RecomputeReason = 'prob_edit' | 'conf_edit' | 'restore' | 'seed'

export type RecomputeState = {
  version: number
  lastTs: number
  lastReason: RecomputeReason
  bands: ProjectionResult['bands']
}

const state = new Map<string, RecomputeState>()
const listeners = new Map<string, Set<(s: RecomputeState) => void>>()
const history = new Map<string, RecomputeState[]>() // capped to 12
const pendingArchived = new Map<string, number>() // accumulate overflow counts

export function getRecompute(decisionId: string): RecomputeState | null {
  return state.get(decisionId) ?? null
}

export function subscribeRecompute(decisionId: string, cb: (s: RecomputeState) => void): () => void {
  if (!listeners.has(decisionId)) listeners.set(decisionId, new Set())
  const set = listeners.get(decisionId)!
  set.add(cb)
  const cur = state.get(decisionId)
  if (cur) cb(cur)
  return () => set.delete(cb)
}

function emit(decisionId: string, s: RecomputeState) {
  // Emit any pending backlog from previous trims BEFORE processing the new state
  const backlog = pendingArchived.get(decisionId) ?? 0
  if (backlog > 0) {
    // TODO(server-archival): When backend ready, POST archived points to Edge Function
    // to store in decision_analysis.historical_projections with RLS.
    track('history_archived', { scenario_id: decisionId, archived_count: backlog, ts: s.lastTs })
    pendingArchived.delete(decisionId)
  }

  state.set(decisionId, s)
  // push to history and cap at 12; accumulate archived count for future emission
  const arr = history.get(decisionId) ?? []
  arr.push(s)
  let archived = 0
  while (arr.length > 12) { arr.shift(); archived++ }
  history.set(decisionId, arr)
  if (archived > 0) {
    const cur = pendingArchived.get(decisionId) ?? 0
    pendingArchived.set(decisionId, cur + archived)
  }
  const set = listeners.get(decisionId)
  if (set) set.forEach(cb => cb(s))
}

export function notifyRecompute(decisionId: string, reason: RecomputeReason, options: OptionInput[], asOfMs = Date.now()): RecomputeState {
  try { mark('recompute-start') } catch {}
  const prev = state.get(decisionId)
  const version = (prev?.version ?? 0) + 1
  const res = computeProjection(options, { asOfMs })
  const s: RecomputeState = { version, lastTs: asOfMs, lastReason: reason, bands: res.bands }
  emit(decisionId, s)
  try { mark('recompute') } catch {}
  try {
    mark('recompute-end')
    measure('recompute', 'recompute-start', 'recompute-end')
  } catch {}
  try { (globalThis as any).__dmRecomputeEntries = ((globalThis as any).__dmRecomputeEntries ?? 0) + 1 } catch {}
  return s
}

// Convenience: per-KR telemetry emission when card resolves
export function trackProjectionResolved(decisionId: string, krId: string) {
  const s = state.get(decisionId)
  if (!s) return
  track('sandbox_projection', { op: 'recompute', decisionId, krId, reason: s.lastReason, ts: s.lastTs })
}

// Test helper: allow emitting custom recompute states (e.g., out-of-order versions)
// Use only in unit/RTL tests.
export function __emitTest(decisionId: string, s: RecomputeState) {
  emit(decisionId, s)
}

// Inspectors
export function getHistory(decisionId: string): RecomputeState[] { return [...(history.get(decisionId) ?? [])] }

// Test-only: clear all recompute state
export function __clearForTest() {
  state.clear()
  listeners.clear()
  history.clear()
  pendingArchived.clear()
}
