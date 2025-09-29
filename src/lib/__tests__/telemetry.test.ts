import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('telemetry counters', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('OFF → no increments', async () => {
    vi.doMock('../../flags', () => ({ isTelemetryEnabled: () => false, isScenariosEnabled: () => false }))
    const mod = await import('../telemetry')
    const { track, __getTelemetryCounters, __resetTelemetryCounters } = mod
    __resetTelemetryCounters()
    track('edge.stream.start')
    track('edge.stream.done')
    const c = __getTelemetryCounters()
    expect(c['edge.stream.start']).toBe(0)
    expect(c['edge.stream.done']).toBe(0)
  })

  it('ON → increments; no payloads', async () => {
    vi.doMock('../../flags', () => ({ isTelemetryEnabled: () => true, isScenariosEnabled: () => false }))
    const mod = await import('../telemetry')
    const { track, __getTelemetryCounters, __resetTelemetryCounters } = mod
    __resetTelemetryCounters()
    track('edge.stream.start')
    track('edge.stream.token')
    track('edge.stream.token')
    track('edge.stream.done')
    const c = __getTelemetryCounters()
    expect(c['edge.stream.start']).toBe(1)
    expect(c['edge.stream.token']).toBe(2)
    expect(c['edge.stream.done']).toBe(1)
  })
})
