import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enableBridge = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return { ...actual, isStrategyBridgeEnabled: () => true }
  })
}

describe('Draft completeness — writebacks blocked', () => {
  beforeEach(() => { /* no module resets */ })
  afterEach(() => { vi.resetAllMocks() })

  it('writeBack returns { ok:false, reason:"draft" } and emits no telemetry when in Draft', async () => {
    await enableBridge()
    // Set board meta to draft
    const { __setDraft } = await import('@/sandbox/state/boardMeta')
    __setDraft('dw1', true)

    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (e: string, p: Record<string, any> = {}) => { calls.push({ event: e, props: p }) }, model_segment_changed: () => {} }))

    const { writeBack } = await import('@/sandbox/bridge/contracts')
    const res = writeBack('dw1', { linkKRToTile: { krId: 'kr1', tileId: 'tile1' } })
    expect(res).toEqual({ ok: false, reason: 'draft' })

    // No sandbox_* telemetry should have been emitted from writeBack path
    const sandboxEvents = calls.filter(c => c.event.startsWith('sandbox_'))
    expect(sandboxEvents.length).toBe(0)
  })
})
