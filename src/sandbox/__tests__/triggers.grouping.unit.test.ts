// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enable = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isSandboxTriggersBasicEnabled: () => true }
  })
}

describe('Trigger grouping & lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('groups multiple High rules into a single sandbox_trigger with multiple kr_ids', async () => {
    await enable()
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (e: string, p: Record<string, any> = {}) => { calls.push({ event: e, props: p }) }, model_segment_changed: () => {} }))
    const { updateKRFromP50, __setActuals, __setImpactSums, __setCycleKRIds } = await import('@/sandbox/bridge/triggers')

    // Inject both guardrail breach and conflicting impacts to produce multiple Highs
    __setActuals('g1', [0.5, 0.5, 0.5])
    __setImpactSums('g1', 0.05, 0.05) // |pos-neg|=0 < DELTA_BALANCE_MAX and pos+neg=0.1 >= TOTAL_IMPACT_MIN
    __setCycleKRIds('g1', ['krA', 'krB', 'krC'])

    updateKRFromP50('g1', 0.20) // edge near breach; previous unknown, second call to cause guardrail vs prevP50
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    updateKRFromP50('g1', 0.35) // trigger sigma breach comparing prevP50
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()

    const trig = calls.filter(c => c.event === 'sandbox_trigger').at(-1)
    expect(trig).toBeTruthy()
    expect(trig!.props.severity).toBe('high')
    // Grouping marker
    expect(['MULTI_HIGH', 'CONFLICTING_IMPACTS', 'COUNTER_GUARDRAIL_BREACH']).toContain(trig!.props.rule)
    // Payload contains grouped kr_ids
    expect(Array.isArray(trig!.props.payload.kr_ids)).toBe(true)
    expect(trig!.props.payload.kr_ids.length).toBe(3)
  })

  it('emits lifecycle: evaluation_cycle and debounced once per update; cooldown_started within window', async () => {
    await enable()
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (e: string, p: Record<string, any> = {}) => { calls.push({ event: e, props: p }) }, model_segment_changed: () => {} }))
    const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')

    updateKRFromP50('cycle1', 0.31)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()

    // Immediately schedule again within cooldown and small delta
    updateKRFromP50('cycle1', 0.33)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()

    const evals = calls.filter(c => c.event === 'trigger_evaluation_cycle')
    const debs = calls.filter(c => c.event === 'trigger_debounced')
    const cooldowns = calls.filter(c => c.event === 'trigger_cooldown_started')
    expect(evals.length).toBe(2)
    expect(debs.length).toBe(2)
    expect(cooldowns.length).toBeGreaterThan(0)
  })
})
