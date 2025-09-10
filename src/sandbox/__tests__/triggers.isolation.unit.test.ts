import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enableTriggers = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxTriggersBasicEnabled: () => true,
    }
  })
}

describe('Triggers isolation by decisionId', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.clearAllMocks() })

  it('arming A and B, firing A only does not affect B', async () => {
    await enableTriggers()
    const calls: Array<{ event: string, props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({
      track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) },
      model_segment_changed: () => {},
    }))

    const { armDecision, disarmDecision, getActiveTrigger, updateKRFromP50 } = await import('@/sandbox/bridge/triggers')

    // Arm two decisions
    armDecision('A')
    armDecision('B')

    // Fire A only with low p50
    updateKRFromP50('A', 0.1)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.runOnlyPendingTimersAsync()

    const a = getActiveTrigger('A')
    const b = getActiveTrigger('B')

    expect(a).toBeTruthy()
    expect(b).toBeNull()

    // Telemetry only for A
    const trig = calls.filter(c => c.event === 'sandbox_trigger')
    expect(trig).toHaveLength(1)
    expect(trig[0].props.decisionId).toBe('A')

    // Cleanup
    disarmDecision('A')
    disarmDecision('B')
  })
})
