import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { toHaveNoViolations } from 'vitest-axe/matchers'

expect.extend(matchers)
expect.extend(toHaveNoViolations)

// jsdom's canvas.getContext throws by default (not implemented); axe-core expects it.
// Provide a minimal stub so a11y tests that touch <canvas> do not throw.
if (typeof HTMLCanvasElement !== 'undefined') {
  ;(HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null)
}

// Always start on real timers; opt-in to fakes per-test only
beforeEach(() => vi.useRealTimers())
afterEach(() => {
  cleanup()        // unmount everything
  vi.resetModules() // clear module state
  vi.clearAllMocks()
  vi.useRealTimers()
})
