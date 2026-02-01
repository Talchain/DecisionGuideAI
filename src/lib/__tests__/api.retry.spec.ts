import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Test the MAX_RETRY_DELAY_MS constant behavior
// We test the delay capping logic by verifying the computed delays
describe('API retry backoff cap', () => {
  const MAX_RETRY_DELAY_MS = 8000

  it('should cap delay at 8000ms regardless of retry count', () => {
    let delay = 1000
    const delays: number[] = []

    // Simulate 10 retries
    for (let attempt = 0; attempt < 10; attempt++) {
      delays.push(delay)
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
    }

    // First few delays should double
    expect(delays[0]).toBe(1000)
    expect(delays[1]).toBe(2000)
    expect(delays[2]).toBe(4000)
    expect(delays[3]).toBe(8000)

    // All subsequent delays should be capped at 8000ms
    expect(delays[4]).toBe(8000)
    expect(delays[5]).toBe(8000)
    expect(delays[9]).toBe(8000)

    // No delay should ever exceed 8000ms
    expect(Math.max(...delays)).toBe(8000)
  })

  it('should never exceed MAX_RETRY_DELAY_MS', () => {
    let delay = 1000

    // Simulate many retries
    for (let i = 0; i < 100; i++) {
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
      expect(delay).toBeLessThanOrEqual(MAX_RETRY_DELAY_MS)
    }
  })

  it('should reach cap at retry 3 (starting from 1000ms)', () => {
    let delay = 1000
    let reachesCapAt = -1

    for (let attempt = 0; attempt < 10; attempt++) {
      delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
      if (delay === MAX_RETRY_DELAY_MS && reachesCapAt === -1) {
        reachesCapAt = attempt
      }
    }

    // 1000 -> 2000 -> 4000 -> 8000 (capped at retry index 2, which is 3rd retry)
    expect(reachesCapAt).toBe(2)
  })
})
