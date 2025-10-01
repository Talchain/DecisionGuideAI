import { describe, it, expect } from 'vitest'
import { parseHealth, type Health } from '../../lib/health'

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
