// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enable = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isSandboxTriggersBasicEnabled: () => true }
  })
}

describe('Trigger rules & payload', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('CONFLICTING_IMPACTS when large swings flip direction', async () => {
    await enable()
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()
    const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')

    updateKRFromP50('tc', 0.30)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    updateKRFromP50('tc', 0.55) // +0.25
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    updateKRFromP50('tc', 0.30) // -0.25
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()

    const buf = (analytics.__getTestBuffer?.() || []) as any[]
    const trig = buf.filter(c => c.event === 'sandbox_trigger').at(-1) as any
    expect(trig).toBeTruthy()
    expect(trig.props?.rule).toBe('CONFLICTING_IMPACTS')
    expect(trig.props?.priority).toBeDefined()
    expect(trig.props?.payload).toBeTruthy()
    expect(trig.props?.payload?.rule).toBe('CONFLICTING_IMPACTS')
  })

  it('COUNTER_GUARDRAIL_BREACH: manual overrides dynamic sigma', async () => {
    await enable()
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()
    const { updateKRFromP50, __setActuals, __setManualThreshold } = await import('@/sandbox/bridge/triggers')

    __setActuals('tg', [0.4, 0.5, 0.45, 0.55, 0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.5, 0.5])
    __setManualThreshold('tg', 0.08)
    updateKRFromP50('tg', 0.50)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    updateKRFromP50('tg', 0.61) // +0.11 > 0.08
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()

    const buf = (analytics.__getTestBuffer?.() || []) as any[]
    const trig = buf.find(c => c.event === 'sandbox_trigger' && c.props?.rule === 'COUNTER_GUARDRAIL_BREACH')
    expect(trig).toBeTruthy()
    expect(trig!.props.severity).toBe('high')
  })

  it('STALE_ASSUMPTION when assumptions timestamp too old', async () => {
    await enable()
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()
    const { updateKRFromP50, __setAssumptionTs, STALE_MS } = await import('@/sandbox/bridge/triggers')

    // set assumptions ts to stale
    __setAssumptionTs('ts', Date.now() - STALE_MS - 1)
    updateKRFromP50('ts', 0.5)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    const buf = (analytics.__getTestBuffer?.() || []) as any[]
    const trig = buf.find(c => c.event === 'sandbox_trigger' && c.props?.rule === 'STALE_ASSUMPTION')
    expect(trig).toBeTruthy()
  })

  it('Cooldown override when |Δp50| >= 5%', async () => {
    await enable()
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()
    const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')

    updateKRFromP50('co', 0.35)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    let buf = (analytics.__getTestBuffer?.() || []) as any[]
    const baseCount = buf.filter(c => c.event === 'sandbox_trigger').length

    // Within cooldown (we do not advance 24h), delta < 5% => should NOT add
    updateKRFromP50('co', 0.37)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    buf = (analytics.__getTestBuffer?.() || []) as any[]
    const afterSmall = buf.filter(c => c.event === 'sandbox_trigger').length
    expect(afterSmall).toBe(baseCount)

    // Now big delta >= 5% => override cooldown and emit
    updateKRFromP50('co', 0.45)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    buf = (analytics.__getTestBuffer?.() || []) as any[]
    const afterBig = buf.filter(c => c.event === 'sandbox_trigger').length
    expect(afterBig).toBeGreaterThan(baseCount)
  })

  it('CONFLICTING_IMPACTS boundary: |pos-neg| < 0.02 and (|pos|+|neg|) >= 0.08 fires; edges do not', async () => {
    await enable()
    const analytics = await import('@/lib/analytics')
    analytics.__clearTestBuffer?.()
    const { updateKRFromP50, __setImpactSums } = await import('@/sandbox/bridge/triggers')

    // Below total impact threshold (0.079)
    __setImpactSums('b0', 0.0395, 0.0395) // |pos-neg| = 0, total = 0.079 < 0.08
    updateKRFromP50('b0', 0.5)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    let buf = (analytics.__getTestBuffer?.() || []) as any[]
    expect(buf.find(c => c.event === 'sandbox_trigger' && c.props?.rule === 'CONFLICTING_IMPACTS')).toBeFalsy()

    // On the edge: |pos-neg| just under 0.02 and total >= 0.08
    __setImpactSums('ok', 0.05, 0.031) // |diff| = 0.019 < 0.02, total = 0.081 >= 0.08
    updateKRFromP50('ok', 0.5)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    buf = (analytics.__getTestBuffer?.() || []) as any[]
    expect(buf.find(c => c.event === 'sandbox_trigger' && c.props?.rule === 'CONFLICTING_IMPACTS')).toBeTruthy()

    // Just over boundary: |pos-neg| = 0.0201 should NOT fire
    __setImpactSums('hi', 0.06005, 0.0400) // diff ≈ 0.02005 > 0.02
    updateKRFromP50('hi', 0.5)
    await vi.advanceTimersByTimeAsync(30_000); await vi.runOnlyPendingTimersAsync()
    buf = (analytics.__getTestBuffer?.() || []) as any[]
    const hiConflicts = buf.filter(c => c.event === 'sandbox_trigger' && c.props?.decisionId === 'hi' && c.props?.rule === 'CONFLICTING_IMPACTS')
    expect(hiConflicts.length).toBe(0)
  })
})
