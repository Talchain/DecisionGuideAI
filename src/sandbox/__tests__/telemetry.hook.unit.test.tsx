// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { useTelemetry } from '@/lib/useTelemetry'
import * as analytics from '@/lib/analytics'

function HookHarness() {
  const { track } = useTelemetry()
  React.useEffect(() => {
    track('sandbox_panel', { op: 'tab_select', tab: 'goals', decisionId: 'd-test' })
  }, [track])
  return null
}

describe('useTelemetry hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    analytics.__clearTestBuffer()
    analytics.__setProdSchemaForTest(true)
    analytics.__setProdSchemaModeForTest('replace')
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks(); analytics.__clearTestBuffer(); analytics.__setProdSchemaModeForTest(null as any) })

  it('forwards events to analytics and maps to PRD name when replace mode', async () => {
    renderSandbox(<HookHarness />)
    // allow effect to run
    await vi.advanceTimersByTimeAsync(1)
    const buf = analytics.__getTestBuffer()
    // expect mapped event present
    const mapped = buf.find(p => p.event === 'panel_view_changed')
    expect(mapped).toBeTruthy()
    expect(mapped?.props).toMatchObject({ decision_id: 'd-test', client_ts: expect.any(Number) })
  })
})
