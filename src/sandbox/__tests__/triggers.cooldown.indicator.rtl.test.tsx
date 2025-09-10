// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { IntelligencePanel } from '@/sandbox/panels/IntelligencePanel'
import { updateKRFromP50, COOLDOWN_MS } from '@/sandbox/bridge/triggers'
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

    // Fire a high severity trigger: p50 well below 0.2
    await act(async () => {
      updateKRFromP50(decisionId, 0.1)
      await vi.advanceTimersByTimeAsync(30_000) // DEBOUNCE_MS
    })

    // Indicator should appear
    expect(await screen.findByLabelText('Trigger cooldown active')).toBeTruthy()

    // Advance beyond cooldown window so indicator disappears
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 2_000)
    })

    expect(screen.queryByLabelText('Trigger cooldown active')).toBeNull()
  })
})
