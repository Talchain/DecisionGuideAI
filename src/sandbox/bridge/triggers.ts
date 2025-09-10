import { track } from '@/lib/analytics'
import { isSandboxTriggersBasicEnabled } from '@/lib/config'
import { subscribeRecompute } from '@/sandbox/state/recompute'
import { isBoardDraft } from '@/sandbox/state/boardMeta'
import { getAlignment, wireAlignmentToRecompute } from '@/sandbox/state/voting'

export type TriggerRule = 'KR_MISS_PROJECTION' | 'LOW_ALIGNMENT' | 'CONFLICTING_IMPACTS' | 'COUNTER_GUARDRAIL_BREACH' | 'STALE_ASSUMPTION'
export type TriggerSeverity = 'high' | 'amber'
export type TriggerState = { decisionId: string; rule: TriggerRule; severity: TriggerSeverity; ts: number } | null

const listeners = new Map<string, Set<(state: TriggerState) => void>>()
const active = new Map<string, TriggerState>()
const debounceTimers = new Map<string, number>()
const lastFireAt = new Map<string, number>()
const armed = new Set<string>()
const unsubs = new Map<string, () => void>()

const DEBOUNCE_MS = 30_000
export const COOLDOWN_MS = 24 * 60 * 60 * 1000
const DELTA_BALANCE_MAX = 0.02 // |Σpos − Σneg|
const TOTAL_IMPACT_MIN = 0.08  // (|Σpos| + |Σneg|)
const ALIGN_LOW_THRESHOLD = 60 // <60 considered low alignment
const consecutiveLow = new Map<string, number>()
// Guardrail dynamic sigma (last 12 actuals); tests can inject via __setActuals
const last12Actuals = new Map<string, number[]>()
const manualThreshold = new Map<string, number>()
const lastP50 = new Map<string, number>()
const lastCooldownNoticeAt = new Map<string, number>()
const lastAssumptionTs = new Map<string, number>()
export const STALE_MS = 60_000 // 1 minute for tests; product can raise to 7 days
const DELTA_OVERRIDE = 0.05 // 5% delta override to bypass cooldown

// Pure evaluator (unit-first): evaluate consolidated trigger conditions without timers/state
export type TriggerEvalOpts = {
  p50DeltaAbs: number
  impactSums: { totalImpact: number; deltaBalance: number }
  highRules: string[]
  krIds?: string[]
}

export function evaluateTriggers(opts: TriggerEvalOpts): { fire: boolean; rule?: 'MULTI_HIGH' | TriggerRule; rules?: string[]; kr_ids?: string[] } {
  const { p50DeltaAbs, impactSums, highRules, krIds } = opts
  // Group multiple high rules
  if (highRules && highRules.length > 1) {
    return { fire: true, rule: 'MULTI_HIGH', rules: [...highRules], kr_ids: krIds && krIds.length ? [...krIds] : undefined }
  }
  // Conflicting impacts boundary
  if (impactSums && Math.abs(impactSums.deltaBalance) < DELTA_BALANCE_MAX && impactSums.totalImpact >= TOTAL_IMPACT_MIN) {
    return { fire: true, rule: 'CONFLICTING_IMPACTS', kr_ids: krIds && krIds.length ? [...krIds] : undefined }
  }
  // Counter guardrail (fallback threshold = 10%)
  if (typeof p50DeltaAbs === 'number' && p50DeltaAbs > 0.10) {
    return { fire: true, rule: 'COUNTER_GUARDRAIL_BREACH', kr_ids: krIds && krIds.length ? [...krIds] : undefined }
  }
  return { fire: false }
}

function emit(decisionId: string, state: TriggerState) {
  active.set(decisionId, state)
  const subs = listeners.get(decisionId)
  if (subs) {
    subs.forEach((cb) => cb(state))
  }
}

export function getActiveTrigger(decisionId: string): TriggerState {
  if (!isSandboxTriggersBasicEnabled()) return null
  return active.get(decisionId) ?? null
}

export function subscribe(decisionId: string, cb: (state: TriggerState) => void): () => void {
  if (!listeners.has(decisionId)) listeners.set(decisionId, new Set())
  const set = listeners.get(decisionId)!
  set.add(cb)
  // push current state immediately
  cb(getActiveTrigger(decisionId))
  return () => { set.delete(cb) }
}

// Read-only helpers for UI: indicate whether cooldown is active and remaining time
export function isCooldownActive(decisionId: string): boolean {
  const last = lastFireAt.get(decisionId) || 0
  const now = Date.now()
  return now - last < COOLDOWN_MS
}

export function getCooldownRemainingMs(decisionId: string): number {
  const last = lastFireAt.get(decisionId) || 0
  const now = Date.now()
  const rem = COOLDOWN_MS - (now - last)
  return rem > 0 ? rem : 0
}

// Attach to recompute stream once per decision; evaluates p50 against thresholds
export function armDecision(decisionId: string): void {
  if (armed.has(decisionId)) return
  if (isBoardDraft(decisionId)) {
    // Draft mode → do not arm triggers
    armed.add(decisionId)
    active.set(decisionId, null)
    return
  }
  armed.add(decisionId)
  // Ensure alignment recomputes on projection recomputes
  try { wireAlignmentToRecompute(decisionId) } catch {}
  const unsub = subscribeRecompute(decisionId, (s) => {
    if (!isSandboxTriggersBasicEnabled()) return
    const p50 = s.bands.p50
    // Reuse shared debounced path via explicit helper
    updateKRFromP50(decisionId, p50)
  })
  unsubs.set(decisionId, unsub)
}

export function disarmDecision(decisionId: string): void {
  if (!armed.has(decisionId)) return
  armed.delete(decisionId)
  const unsub = unsubs.get(decisionId)
  if (unsub) {
    try { unsub() } catch {}
    unsubs.delete(decisionId)
  }
  const t = debounceTimers.get(decisionId)
  if (t) { clearTimeout(t); debounceTimers.delete(decisionId) }
}

// External input for tests or UI to update KRs probabilities
export function updateKRProbabilities(decisionId: string, probs: number[]): void {
  if (!isSandboxTriggersBasicEnabled()) return
  // Debounce per decision
  const prev = debounceTimers.get(decisionId)
  if (prev) clearTimeout(prev)
  const t = window.setTimeout(() => {
    const state = computeFromProbs(decisionId, probs)
    if (!state) {
      emit(decisionId, null)
      return
    }
    // Cooldown check
    const last = lastFireAt.get(decisionId) || 0
    const now = Date.now()
    if (now - last < COOLDOWN_MS) {
      // keep existing active state, but do not re-emit telemetry
      emit(decisionId, active.get(decisionId) ?? state)
      return
    }
    lastFireAt.set(decisionId, now)
    emit(decisionId, state)
    track('sandbox_trigger', { rule: state.rule, severity: state.severity, decisionId, ts: now })
  }, DEBOUNCE_MS)
  debounceTimers.set(decisionId, t)
}

// New input using engine p50 directly
export function updateKRFromP50(decisionId: string, p50: number): void {
  if (!isSandboxTriggersBasicEnabled()) return
  const prevP50 = lastP50.get(decisionId)
  const now = Date.now()
  lastP50.set(decisionId, p50)
  // p50 update tracked; assumptions timestamp separately managed
  const prev = debounceTimers.get(decisionId)
  if (prev) clearTimeout(prev)
  // lifecycle telemetry
  track('trigger_evaluation_cycle', { decisionId, ts: now })
  track('trigger_debounced', { decisionId, window_ms: DEBOUNCE_MS, ts: now })
  const t = window.setTimeout(() => {
    const candidates: Array<Exclude<TriggerState, null>> = []
    let state = evaluate(decisionId, p50)
    if (state) candidates.push(state)
    // Alignment evaluation — two consecutive low alignment cycles
    const align = getAlignment(decisionId)
    if (align && align.score < ALIGN_LOW_THRESHOLD) {
      const n = (consecutiveLow.get(decisionId) || 0) + 1
      consecutiveLow.set(decisionId, n)
      if (n >= 2) {
        const severity = manualThreshold.get(decisionId) ? 'high' : 'amber'
        candidates.push({ decisionId, rule: 'LOW_ALIGNMENT', severity, ts: now })
      }
    } else {
      consecutiveLow.set(decisionId, 0)
    }
    // Stale assumption check
    if (lastAssumptionTs.has(decisionId)) {
      const lastTs = lastAssumptionTs.get(decisionId) as number
      if (now - lastTs > STALE_MS) candidates.push({ decisionId, rule: 'STALE_ASSUMPTION', severity: 'amber', ts: now })
    }
    // Conflicting impacts (boundary spec): use injected sums if present
    const sums = impactSums.get(decisionId)
    if (sums) {
      const pos = Math.abs(sums.pos || 0)
      const neg = Math.abs(sums.neg || 0)
      if (Math.abs(pos - neg) < DELTA_BALANCE_MAX && (pos + neg) >= TOTAL_IMPACT_MIN) {
        candidates.push({ decisionId, rule: 'CONFLICTING_IMPACTS', severity: 'high', ts: now })
      }
    } else if (prevP50 !== undefined) {
      // fallback heuristic using p50 swings
      const delta = p50 - prevP50
      const prevDelta = (lastDelta.get(decisionId) ?? 0)
      if (Math.sign(prevDelta) !== 0 && Math.sign(prevDelta) !== Math.sign(delta) && Math.abs(prevDelta) >= 0.2 && Math.abs(delta) >= 0.2) {
        candidates.push({ decisionId, rule: 'CONFLICTING_IMPACTS', severity: 'high', ts: now })
      }
      lastDelta.set(decisionId, delta)
    } else {
      lastDelta.set(decisionId, 0)
    }
    // Guardrail breach
    const actuals = last12Actuals.get(decisionId)
    if (actuals && actuals.length >= 3 && prevP50 !== undefined) {
      const mean = actuals.reduce((a, b) => a + b, 0) / actuals.length
      const variance = actuals.reduce((a, b) => a + (b - mean) ** 2, 0) / actuals.length
      const sigma = Math.sqrt(variance)
      const manual = manualThreshold.get(decisionId)
      const threshold = manual ?? (sigma > 0 ? sigma : 0.10)
      if (Math.abs(p50 - prevP50) > threshold) {
        candidates.push({ decisionId, rule: 'COUNTER_GUARDRAIL_BREACH', severity: 'high', ts: now })
      }
    }
    // choose highest priority candidate (high before amber); default to first state if set
    const last = lastFireAt.get(decisionId) || 0
    const overrideDelta = prevP50 !== undefined ? Math.abs(p50 - prevP50) >= DELTA_OVERRIDE : false
    if (candidates.length === 0) {
      // Allow cooldown override to re-emit the last active state if a large delta occurred
      const prevState = active.get(decisionId)
      if (overrideDelta && prevState) {
        lastFireAt.set(decisionId, now)
        emit(decisionId, prevState)
        const krIds = cycleKRIds.get(decisionId) ?? ['kr1']
        const payload = { trigger_id: `${decisionId}-${now}`, scenario_id: decisionId, kr_ids: krIds, rule: prevState.rule }
        const priority = prevState.severity === 'high' ? 'High' : 'Amber'
        track('sandbox_trigger', { rule: prevState.rule, severity: prevState.severity, decisionId, priority, payload, ts: now })
      } else {
        emit(decisionId, null)
      }
      return
    }
    const highs: Array<Exclude<TriggerState, null>> = candidates.filter((c): c is Exclude<TriggerState, null> => c.severity === 'high')
    const chosen: Exclude<TriggerState, null> = highs[0] ?? candidates[0]
    state = chosen
    if (!overrideDelta && (now - last < COOLDOWN_MS)) {
      emit(decisionId, active.get(decisionId) ?? state)
      // cooldown lifecycle notification (only once per window)
      const lastNote = lastCooldownNoticeAt.get(decisionId) || 0
      if (now - lastNote > 1000) { // allow minimal spacing in tests
        track('trigger_cooldown_started', { decisionId, cooldown_ms: COOLDOWN_MS, override_allowed: false, ts: now })
        lastCooldownNoticeAt.set(decisionId, now)
      }
      return
    }
    lastFireAt.set(decisionId, now)
    emit(decisionId, state)
    // Telemetry with priority and payload
    const krIds = cycleKRIds.get(decisionId) ?? ['kr1']
    const payload = { trigger_id: `${decisionId}-${now}`, scenario_id: decisionId, kr_ids: krIds, rule: (state as Exclude<TriggerState, null>).rule }
    const priority = (state as Exclude<TriggerState, null>).severity === 'high' ? 'High' : 'Amber'
    if (highs.length > 1) {
      // Group multiple High rules into one event (payload contains all kr_ids)
      track('sandbox_trigger', { rule: 'MULTI_HIGH', severity: 'high', decisionId, priority, payload: { ...payload, rules: highs.map((h: Exclude<TriggerState, null>) => h.rule) }, ts: now })
    } else {
      track('sandbox_trigger', { rule: (state as Exclude<TriggerState, null>).rule, severity: (state as Exclude<TriggerState, null>).severity, decisionId, priority, payload, ts: now })
    }
  }, DEBOUNCE_MS)
  debounceTimers.set(decisionId, t)
}

function computeFromProbs(decisionId: string, probs: number[]): TriggerState {
  if (!probs || probs.length === 0) return null
  // Derive p50 from simple mean as a fallback path; engine path preferred
  const mean = probs.reduce((a, b) => a + b, 0) / probs.length
  return evaluate(decisionId, mean)
}

function evaluate(decisionId: string, p50: number): TriggerState {
  if (p50 < 0.2) return { decisionId, rule: 'KR_MISS_PROJECTION', severity: 'high', ts: Date.now() }
  if (p50 < 0.4) return { decisionId, rule: 'KR_MISS_PROJECTION', severity: 'amber', ts: Date.now() }
  return null
}

// Internal state helper for conflict
const lastDelta = new Map<string, number>()

// Injected impacts for conflict boundary tests
const impactSums = new Map<string, { pos: number; neg: number }>()
const cycleKRIds = new Map<string, string[]>()

// Test helpers
export function __setActuals(decisionId: string, values: number[]) {
  last12Actuals.set(decisionId, values)
}
export function __setManualThreshold(decisionId: string, value: number | undefined) {
  if (value === undefined) manualThreshold.delete(decisionId)
  else manualThreshold.set(decisionId, value)
}
export function __setAssumptionTs(decisionId: string, ts: number) {
  lastAssumptionTs.set(decisionId, ts)
}
export function __setImpactSums(decisionId: string, pos: number, neg: number) {
  impactSums.set(decisionId, { pos, neg })
}
export function __setCycleKRIds(decisionId: string, ids: string[]) {
  cycleKRIds.set(decisionId, ids)
}
