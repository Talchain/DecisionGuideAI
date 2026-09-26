import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseHealth, fetchHealth, type Health } from '../../lib/health'

describe('health.parse', () => {
  it('parses minimal health shape', () => {
    const inp = { status: 'ok', p95_ms: 420, version: 'engine-1.3.0' }
    const out: Health = parseHealth(inp)
    expect(out).toEqual({ status: 'ok', p95_ms: 420, version: 'engine-1.3.0' })
  })

  it('normalizes status and p95, guards invalid inputs', () => {
    const inp = { status: 'WeIrD', p95_ms: '9' }
    const out = parseHealth(inp)
    expect(out).toEqual({ status: 'ok', p95_ms: 9 })

    const neg = parseHealth({ status: 'down', p95_ms: -5 })
    expect(neg).toEqual({ status: 'down', p95_ms: 0 })

    const empty = parseHealth(undefined as any)
    expect(empty).toEqual({ status: 'degraded', p95_ms: 0 })
  })
})

/**
 * A16 AUDIT — a failed FETCH is not the same fact as the engine reporting its
 * own degraded status, and `fetchHealth`'s catch used to collapse both into
 * 'degraded'. These test the real function (not a mock of it), because the
 * DegradedBanner specs mock `fetchHealth` entirely and so never exercise this
 * catch branch.
 */
describe('health.fetchHealth — a failed fetch is honest about being unreachable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves "unreachable", never "degraded", when fetch() itself throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const out = await fetchHealth('/health')
    expect(out).toEqual({ status: 'unreachable', p95_ms: 0 })
  })

  it('resolves "unreachable", never "degraded", when the endpoint answers non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const out = await fetchHealth('/health')
    expect(out).toEqual({ status: 'unreachable', p95_ms: 0 })
  })

  it('POSITIVE CONTROL: a real 2xx response with a degraded body still reads as degraded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'degraded', p95_ms: 900 }) }),
    )
    const out = await fetchHealth('/health')
    expect(out).toEqual({ status: 'degraded', p95_ms: 900 })
  })
})
