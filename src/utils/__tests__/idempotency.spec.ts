import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey } from '../idempotency'

describe('idempotency helpers', () => {
  it('generateIdempotencyKey returns a non-empty string', () => {
    const key = generateIdempotencyKey()
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('generateIdempotencyKey produces probabilistically unique keys across many calls', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 50; i++) {
      keys.add(generateIdempotencyKey())
    }
    expect(keys.size).toBe(50)
  })
})
