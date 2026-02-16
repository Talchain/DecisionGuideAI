/**
 * Tests for PLoT adapter constants — timeout values.
 */

import { describe, it, expect } from 'vitest'
import { TIMEOUTS } from '../constants'

describe('TIMEOUTS', () => {
  it('SYNC_REQUEST_MS is 150 seconds', () => {
    expect(TIMEOUTS.SYNC_REQUEST_MS).toBe(150_000)
  })

  it('SYNC_REQUEST_MS is at least 120s to cover CEE backend timeout', () => {
    expect(TIMEOUTS.SYNC_REQUEST_MS).toBeGreaterThanOrEqual(120_000)
  })
})
