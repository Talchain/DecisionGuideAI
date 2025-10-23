import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Always start on real timers; opt-in to fakes per-test only
beforeEach(() => vi.useRealTimers())
afterEach(() => {
  cleanup()        // unmount everything
  vi.resetModules() // clear module state
  vi.clearAllMocks()
  vi.useRealTimers()
})
