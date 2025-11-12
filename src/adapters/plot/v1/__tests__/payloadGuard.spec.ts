/**
 * M1.6: Payload Guard Tests
 */

import { describe, it, expect } from 'vitest'
import { validatePayloadSize } from '../payloadGuard'

describe('validatePayloadSize (M1.6)', () => {
  it('accepts payloads under 96KB', () => {
    const smallPayload = { data: 'x'.repeat(1000) }
    const result = validatePayloadSize(smallPayload)

    expect(result.valid).toBe(true)
    expect(result.sizeKB).toBeLessThan(96)
  })

  it('rejects payloads over 96KB', () => {
    const largePayload = { data: 'x'.repeat(100000) }
    const result = validatePayloadSize(largePayload)

    expect(result.valid).toBe(false)
    expect(result.sizeKB).toBeGreaterThan(96)
    expect(result.error).toContain('96KB')
  })

  it('correctly calculates payload size in KB', () => {
    const payload = { data: 'x'.repeat(50000) }
    const result = validatePayloadSize(payload)

    expect(result.sizeKB).toBeGreaterThan(0)
    expect(typeof result.sizeKB).toBe('number')
  })

  it('rejects exactly at 97KB', () => {
    // Create payload slightly over 96KB
    const payload = { data: 'x'.repeat(97 * 1024) }
    const result = validatePayloadSize(payload)

    expect(result.valid).toBe(false)
  })
})
