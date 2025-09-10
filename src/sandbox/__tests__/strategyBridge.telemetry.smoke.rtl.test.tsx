// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { StrategyBridgeShell } from '@/sandbox/layout/StrategyBridgeShell'
import * as analytics from '@/lib/analytics'

// Smoke: StrategyBridgeShell emits sandbox_bridge on mount via useTelemetry

describe('StrategyBridgeShell telemetry (smoke)', () => {
  beforeEach(() => {
    analytics.__clearTestBuffer()
    analytics.__setProdSchemaForTest(true)
    analytics.__setProdSchemaModeForTest('replace')
    vi.useFakeTimers()
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); analytics.__clearTestBuffer(); analytics.__setProdSchemaModeForTest(null as any) })

  it('emits sandbox_bridge on open', async () => {
    renderSandbox(<StrategyBridgeShell decisionId="sb-1" />, { sandbox: true, strategyBridge: true })
    await vi.advanceTimersByTimeAsync(1)
    const names = analytics.__getTestBuffer().map(p => p.event)
    expect(names).toContain('sandbox_bridge')
  })
})
