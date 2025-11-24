import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderCanvas, cleanupCanvas, flushRAF } from './__helpers__/renderCanvas'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../lib/telemetry'
import { useCanvasStore } from '../store'

function ensureMatchMedia() {
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

function ensureResizeObserver() {
  if (typeof (globalThis as any).ResizeObserver !== 'function') {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as any).ResizeObserver = ResizeObserverStub
  }
}

async function renderCanvasMVP() {
  ensureMatchMedia()
  ensureResizeObserver()
  const { default: CanvasMVP } = await import('../../routes/CanvasMVP')
  return renderCanvas(<CanvasMVP />)
}

describe('ReactFlowGraph keyboard run telemetry', () => {
  beforeEach(() => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()
  })

  afterEach(() => {
    cleanupCanvas()
  })

  it('tracks sandbox.run.blocked when Cmd+Enter is pressed on an empty graph', async () => {
    await renderCanvasMVP()
    await flushRAF()

    const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
    window.dispatchEvent(event)

    await waitFor(() => {
      const counters = __getTelemetryCounters()
      expect(counters['sandbox.run.blocked']).toBe(1)
      expect(counters['sandbox.run.clicked']).toBe(0)
    })
  })

  it('tracks sandbox.run.clicked when Cmd+Enter is pressed on a non-empty, healthy graph', async () => {
    await renderCanvasMVP()
    await flushRAF()

    const { addNode } = useCanvasStore.getState()
    addNode({ x: 0, y: 0 })
    useCanvasStore.setState({ graphHealth: null } as any)

    const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
    window.dispatchEvent(event)

    await waitFor(() => {
      const counters = __getTelemetryCounters()
      expect(counters['sandbox.run.clicked']).toBe(1)
      expect(counters['sandbox.run.blocked']).toBe(0)
    })
  })
})
