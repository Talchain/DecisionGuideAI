import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { toHaveNoViolations } from 'vitest-axe/matchers'

expect.extend(matchers)
expect.extend(toHaveNoViolations)

// Mock window.matchMedia for theme detection and reduced motion hooks
// Must be defined before any modules that use matchMedia are imported
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })),
})

// Mock ResizeObserver for ReactFlow and other components
// jsdom doesn't implement ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as any

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
