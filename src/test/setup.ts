import { expect, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
expect.extend(matchers);

// TLDraw / font preload polyfills for jsdom
try {
  if (!(globalThis as any).FontFace) {
    (globalThis as any).FontFace = class {
      family: string
      constructor(family: string) { this.family = family }
      load() { return Promise.resolve(this) }
    } as any
  }
  if (!(document as any).fonts) {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: () => {},
        delete: () => {},
        clear: () => {},
        ready: Promise.resolve(),
      }
    })
  }
} catch {}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Cleanup after each test
afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  try { performance.clearMarks(); performance.clearMeasures(); } catch {}
  try {
    const analytics = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics')
    analytics.__clearTestBuffer?.()
  } catch {}
  try {
    const recompute = await vi.importActual<typeof import('@/sandbox/state/recompute')>('@/sandbox/state/recompute')
    recompute.__clearForTest?.()
  } catch {}
  try {
    const reapply = await vi.importActual<typeof import('@/sandbox/state/reapply')>('@/sandbox/state/reapply')
    reapply.__clearForTest?.()
  } catch {}
  try {
    const boardMeta = await vi.importActual<typeof import('@/sandbox/state/boardMeta')>('@/sandbox/state/boardMeta')
    boardMeta.__clearDraftsForTest?.()
  } catch {}
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

// Robust performance polyfill: ensure marks/measures are retrievable (patch both window and global)
{ // begin perf polyfill block
  const perfWindow: any = (typeof window !== 'undefined' ? window.performance : undefined)
  const perfGlobal: any = (globalThis as any).performance
  const targets: any[] = []
  if (perfWindow) targets.push(perfWindow)
  if (perfGlobal && perfGlobal !== perfWindow) targets.push(perfGlobal)
  // Shared backing arrays across both targets
  const _marks: Array<{ name: string }> = []
  const _measures: Array<{ name: string }> = []
  for (const perf of targets) {
    if (!perf || perf.__dmPerfPatched) continue
    const _orig = {
      mark: perf.mark?.bind(perf),
      measure: perf.measure?.bind(perf),
      getEntriesByName: perf.getEntriesByName?.bind(perf),
      clearMarks: perf.clearMarks?.bind(perf),
      clearMeasures: perf.clearMeasures?.bind(perf),
    }
    perf.mark = (name: string, ...rest: any[]) => {
      try { _orig.mark?.(name, ...rest) } catch {}
      try { _marks.push({ name }) } catch {}
    }
    perf.measure = (name: string, start?: string, end?: string) => {
      try { _orig.measure?.(name, start as any, end as any) } catch {}
      try { _measures.push({ name }) } catch {}
    }
    perf.getEntriesByName = (name: string) => {
      try {
        const orig = _orig.getEntriesByName?.(name)
        if (orig && Array.isArray(orig) && orig.length > 0) return orig
      } catch {}
      // Fallback to our in-memory lists
      return [..._marks.filter(e => e.name === name), ..._measures.filter(e => e.name === name)]
    }
    perf.clearMarks = (name?: string) => {
      try { _orig.clearMarks?.(name) } catch {}
      if (name) {
        for (let i = _marks.length - 1; i >= 0; i--) if (_marks[i].name === name) _marks.splice(i, 1)
      } else {
        _marks.length = 0
      }
    }
    perf.clearMeasures = (name?: string) => {
      try { _orig.clearMeasures?.(name) } catch {}
      if (name) {
        for (let i = _measures.length - 1; i >= 0; i--) if (_measures[i].name === name) _measures.splice(i, 1)
      } else {
        _measures.length = 0
      }
    }
    Object.defineProperty(perf, '__dmPerfPatched', { value: true, configurable: false, enumerable: false, writable: false })
  }
} // end perf polyfill block

// Note: We intentionally do not globally mock '@/lib/analytics' here.
// Tests that need to intercept telemetry should vi.doMock within the test file,
// and analytics mapping tests rely on the real implementation.

// Ensure rAF is timer-backed so vi.useFakeTimers can advance it deterministically
(window as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
(window as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as number)
