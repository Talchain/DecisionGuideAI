// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { act } from '@testing-library/react'

// Use flags + IntelligencePanel to exercise the indicator

describe('TriggerCooldownIndicator a11y', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('aria-label present only during cooldown', async () => {
    // Local config to enable triggers
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return { ...actual, isSandboxTriggersBasicEnabled: () => true, isStrategyBridgeEnabled: () => true }
    })
    // Lightweight analytics mock
    vi.doMock('@/lib/analytics', () => ({ track: () => {}, __getTestBuffer: () => [], __clearTestBuffer: () => {}, __setProdSchemaForTest: () => {}, __setProdSchemaModeForTest: () => {} }))

    const { IntelligencePanel } = await import('@/sandbox/panels/IntelligencePanel')
    const { updateKRFromP50, COOLDOWN_MS } = await import('@/sandbox/bridge/triggers')

    const decisionId = 'cooldown-a11y'
    renderSandbox(<IntelligencePanel decisionId={decisionId} />, { sandbox: true, strategyBridge: true })

    // Initially off
    expect(document.querySelector('[aria-label="Trigger cooldown active"]')).toBeNull()

    // Fire; debounce then indicator visible (with title)
    updateKRFromP50(decisionId, 0.1)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    const el = document.querySelector('[aria-label="Trigger cooldown active"]') as HTMLElement | null
    expect(el).not.toBeNull()
    expect(el?.getAttribute('title')).toBe('Triggers are in cooldown')

    // After cooldown, it disappears
    await act(async () => { await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 1000) })
    expect(document.querySelector('[aria-label="Trigger cooldown active"]')).toBeNull()
  })
})
