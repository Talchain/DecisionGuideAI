// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { useTelemetry } from '@/lib/useTelemetry'
import * as analytics from '@/lib/analytics'

function AdoptionHarness() {
  const { track } = useTelemetry()
  React.useEffect(() => {
    track('sandbox_bridge', { op: 'open', decisionId: 'd-a', ts: 123 })
    track('sandbox_panel', { op: 'tab_select', tab: 'goals', decisionId: 'd-a' })
    track('sandbox_snapshot', { action: 'save', decisionId: 'd-a', snapshotId: 's1' })
    track('sandbox_model', { op: 'generate', decisionId: 'd-a', ts: 124 })
  }, [track])
  return null
}

describe('useTelemetry adoption (names only)', () => {
  beforeEach(() => {
    analytics.__clearTestBuffer()
    analytics.__setProdSchemaForTest(true)
    analytics.__setProdSchemaModeForTest('replace')
    vi.useFakeTimers()
  })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); analytics.__clearTestBuffer(); analytics.__setProdSchemaModeForTest(null as any) })

  it('emits expected events via the hook', async () => {
    renderSandbox(React.createElement(AdoptionHarness))
    await vi.advanceTimersByTimeAsync(1)
    const buf = analytics.__getTestBuffer()
    const names = buf.map(p => p.event)
    expect(names).toContain('sandbox_bridge')
    expect(names).toContain('panel_view_changed') // mapped PRD name
    expect(names).toContain('sandbox_snapshot')
    expect(names).toContain('sandbox_model')
  })
})
