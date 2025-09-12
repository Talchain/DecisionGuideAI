// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, act } from '@testing-library/react'

const decisionId = 'cooldown-x'

describe('TriggerCooldownIndicator', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('appears after trigger fires and disappears after cooldown', async () => {
    // Enable triggers basic + strategy bridge via config mock
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return { ...actual, isSandboxTriggersBasicEnabled: () => true, isStrategyBridgeEnabled: () => true }
    })

    // Local analytics mock (optional)
    vi.doMock('@/lib/analytics', () => ({ track: () => {}, model_segment_changed: () => {} }))

    const { IntelligencePanel } = await import('@/sandbox/panels/IntelligencePanel')

    renderSandbox(<IntelligencePanel decisionId={decisionId} />, { sandbox: true, strategyBridge: true })
    // Schedule interval effects
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Fire a high severity trigger: p50 well below 0.2
    await act(async () => {
      const { updateKRFromP50 } = await import('@/sandbox/bridge/triggers')
      updateKRFromP50(decisionId, 0.1)
      await vi.advanceTimersByTimeAsync(30_000) // DEBOUNCE_MS
    })
    // Let 1s indicator tick observe cooldown
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

    // Indicator should appear (deterministic)
    expect(screen.getByLabelText('Trigger cooldown active')).toBeTruthy()

    // Advance beyond cooldown window so indicator disappears
    await act(async () => {
      const { COOLDOWN_MS } = await import('@/sandbox/bridge/triggers')
      await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 2_000)
    })
    // One more tick to update UI
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })

    expect(screen.queryByLabelText('Trigger cooldown active')).toBeNull()
  })
})
