import { describe, it, expect, beforeEach, vi } from 'vitest'
import { encodeScenarioToUrlParam, tryDecodeScenarioParam } from '../scenarios'

function bigString(n: number): string {
  return Array.from({ length: n }, (_, i) => `S${i.toString(36)}`).join(' ')
}

describe('scenarios codec', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('base64 path encodes/decodes small payloads', () => {
    const small = { v: 1 as const, name: 'Small', seed: '1', budget: '0.1', model: 'local' }
    const param = encodeScenarioToUrlParam(small)
    expect(typeof param).toBe('string')
    // small inputs should not be prefixed
    expect(param.startsWith('z')).toBe(false)
    const back = tryDecodeScenarioParam(param)
    expect(back?.name).toBe('Small')
    expect(back?.seed).toBe('1')
    expect(back?.budget).toBe('0.1')
    expect(back?.model).toBe('local')
  })

  it('compressed path encodes/decodes when large (>1.5kB)', () => {
    const large = { v: 1 as const, name: bigString(200), seed: bigString(200), budget: '1.23', model: 'gpt-4o-mini' }
    const param = encodeScenarioToUrlParam(large)
    expect(typeof param).toBe('string')
    expect(param.startsWith('z:')).toBe(true)
    const back = tryDecodeScenarioParam(param)
    expect(back?.name).toBe(large.name)
    expect(back?.seed).toBe(large.seed)
    expect(back?.budget).toBe('1.23')
    expect(back?.model).toBe('gpt-4o-mini')
  })

  // Note: We intentionally avoid asserting the >8kB-reject path in unit tests because
  // compression ratio can vary and make the assertion brittle across environments.
})
