import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { toHaveNoViolations } from 'vitest-axe/matchers'

expect.extend(matchers)
expect.extend(toHaveNoViolations)

// Mock window.matchMedia for theme detection and reduced motion hooks.
// Uses a plain function (not vi.fn()) so vitest's mockReset: true doesn't
// strip the implementation between tests.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
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
beforeEach(() => {
  vi.useRealTimers()
})
afterEach(() => {
  cleanup()        // unmount everything
  vi.clearAllMocks()
  vi.useRealTimers()
})


// ── V5 endpoint: configured by default for the whole suite ───────────────────
// `src/v5/v5Adapter.ts::resolveEndpoint` FAILS CLOSED — absent/blank config
// throws rather than silently selecting the retired `/bff/orchestrate/*`
// family, which is closed at the Netlify edge. Deployed staging always bakes
// `VITE_V5_ENDPOINT`, so "configured" is the realistic default state and this
// setup reproduces it once for every spec.
//
// Specs that are ABOUT resolution (src/v5/__tests__/v5Adapter.test.ts) delete
// this in their own beforeEach to exercise the unconfigured branch — so this
// line makes the suite realistic without making the fail-closed path untested.
if (!import.meta.env.VITE_V5_ENDPOINT) {
  ;(import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT =
    'https://cee.test/proxy/v5/turn'
}
