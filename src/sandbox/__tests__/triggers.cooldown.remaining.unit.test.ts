// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Boundaries for getCooldownRemainingMs
// Strategy: enable triggers via config mock, fire once via updateKRFromP50,
// advance fake timers and assert remaining ms decreases to 0.

describe('triggers.getCooldownRemainingMs boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers() })

  it('start/mid/expired windows', async () => {
    // Enable triggers in this test only
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return { ...actual, isSandboxTriggersBasicEnabled: () => true }
    })

    const { updateKRFromP50, getCooldownRemainingMs, COOLDOWN_MS } = await import('@/sandbox/bridge/triggers')

    const decisionId = 'cooldown-remaining'

    // Initially no cooldown
    expect(getCooldownRemainingMs(decisionId)).toBe(0)

    // Fire once; debounced
    updateKRFromP50(decisionId, 0.1)
    await vi.advanceTimersByTimeAsync(30_000 + 5)

    // Immediately after fire, remaining ~ full cooldown
    const remStart = getCooldownRemainingMs(decisionId)
    expect(remStart).toBeGreaterThan(0)
    expect(remStart).toBeLessThanOrEqual(COOLDOWN_MS)

    // Advance a small amount; remaining decreases
    await vi.advanceTimersByTimeAsync(1000)
    const remMid = getCooldownRemainingMs(decisionId)
    expect(remMid).toBeLessThan(remStart)
    expect(remMid).toBeGreaterThan(0)

    // Advance beyond cooldown → 0
    await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 10)
    expect(getCooldownRemainingMs(decisionId)).toBe(0)
  })
})
