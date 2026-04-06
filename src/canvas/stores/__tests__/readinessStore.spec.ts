/**
 * readinessStore — single-source-of-truth readiness state tests.
 *
 * Verifies:
 * - Single fetch per graph change (not N per consumer)
 * - Debounce coalesces rapid changes
 * - refresh() bypasses debounce
 * - reset() unsubscribes and clears state
 * - Fallback on 404 / backoff on 429
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore, __test__ } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

// ── Mock fetch ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

function mockSuccessResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 75,
        readiness_level: 'strong',
        can_run_analysis: true,
        confidence_explanation: 'Looks good',
        improvements: [],
        ...overrides,
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function mock429Response() {
  return {
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve('rate limited'),
    headers: new Headers(),
  }
}

function mock404Response() {
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve('not found'),
    headers: new Headers(),
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  const edges =
    count > 1
      ? [
          {
            id: 'edge-0-1',
            source: 'node-0',
            target: 'node-1',
            data: { weight: 0.5, direction: 'positive' },
          },
        ]
      : []
  useCanvasStore.setState({ nodes: nodes as any, edges: edges as any })
}

// ── Setup / teardown ────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(mockSuccessResponse())
  useReadinessStore.getState().reset()
  // Clear inflight cache from previous tests
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

// ── Tests ───────────────────────────────────────────────────────────

describe('readinessStore', () => {
  describe('startListening', () => {
    it('fires an immediate fetch on first listen', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()

      // Allow the immediate fetch to resolve
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(useReadinessStore.getState().readiness).not.toBeNull()
      expect(useReadinessStore.getState().readiness!.readiness_score).toBe(75)
    })

    it('is idempotent — calling twice does not double-subscribe', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      useReadinessStore.getState().startListening()

      await vi.runAllTimersAsync()

      // Only one fetch from the initial listen, not two
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('debounce', () => {
    it('coalesces rapid graph changes into one fetch', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()

      // Initial fetch
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      // Rapid changes — 5 node additions within 200ms
      for (let i = 10; i < 15; i++) {
        const prev = useCanvasStore.getState().nodes
        useCanvasStore.setState({
          nodes: [
            ...prev,
            {
              id: `node-${i}`,
              type: 'factor',
              position: { x: 0, y: 0 },
              data: { label: `Factor ${i}`, kind: 'factor' },
            },
          ] as any,
        })
        await vi.advanceTimersByTimeAsync(40)
      }

      // At this point debounce timer is running but hasn't fired
      expect(mockFetch).not.toHaveBeenCalled()

      // Advance past debounce (500ms from last change)
      await vi.advanceTimersByTimeAsync(500)

      // Exactly 1 coalesced fetch
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('skips fetch when fingerprint is unchanged', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      // Set nodes to identical array (same content, new reference)
      const currentNodes = useCanvasStore.getState().nodes
      useCanvasStore.setState({ nodes: [...currentNodes] as any })

      await vi.advanceTimersByTimeAsync(600)

      // Fingerprint same → no fetch
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('fetches immediately without debounce', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('clears payload hash so identical payload still fetches', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      // Refresh with same graph — should still fetch because hash is cleared
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('reset', () => {
    it('clears state and unsubscribes from canvas store', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness).not.toBeNull()

      useReadinessStore.getState().reset()

      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().loading).toBe(false)
      expect(useReadinessStore.getState().error).toBeNull()
      expect(__test__.getModuleState().hasSubscription).toBe(false)
    })

    it('prevents stale listener from firing after reset', async () => {
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      useReadinessStore.getState().reset()

      // Change graph after reset — should NOT trigger fetch
      seedCanvasWithNodes(5)
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('ref-counted listener lifecycle', () => {
    it('keeps subscription alive when one consumer unmounts but another remains', async () => {
      seedCanvasWithNodes(3)

      // Two consumers subscribe
      const unsub1 = useReadinessStore.getState().startListening()
      const unsub2 = useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      expect(__test__.getModuleState().listenerRefCount).toBe(2)
      expect(__test__.getModuleState().hasSubscription).toBe(true)

      // First consumer unmounts
      unsub1()

      expect(__test__.getModuleState().listenerRefCount).toBe(1)
      expect(__test__.getModuleState().hasSubscription).toBe(true) // still alive

      // Graph change should still trigger fetch
      const prev = useCanvasStore.getState().nodes
      useCanvasStore.setState({
        nodes: [
          ...prev,
          {
            id: 'node-new',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: { label: 'New Factor', kind: 'factor' },
          },
        ] as any,
      })
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('tears down subscription when last consumer unmounts', async () => {
      seedCanvasWithNodes(3)

      const unsub1 = useReadinessStore.getState().startListening()
      const unsub2 = useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      mockFetch.mockClear()

      unsub1()
      unsub2()

      expect(__test__.getModuleState().listenerRefCount).toBe(0)
      expect(__test__.getModuleState().hasSubscription).toBe(false)

      // Graph change should NOT trigger fetch
      seedCanvasWithNodes(5)
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('falls back to local readiness on 404', async () => {
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).not.toBeNull()
      // Fallback score for 3 nodes + 1 edge: 50 + 10 + 10 + 10 = 80
      expect(state.readiness!.readiness_score).toBeGreaterThan(0)
      expect(state.error).toBeNull()
    })

    it('backs off on 429 and uses fallback', async () => {
      mockFetch.mockResolvedValue(mock429Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).not.toBeNull()
      expect(state.error).toBe('Rate limited - using local validation')
    })
  })

  describe('empty graph', () => {
    it('returns needs_work without fetching when no nodes', async () => {
      useCanvasStore.setState({ nodes: [], edges: [] })
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(mockFetch).not.toHaveBeenCalled()
      const state = useReadinessStore.getState()
      expect(state.readiness).not.toBeNull()
      expect(state.readiness!.readiness_level).toBe('needs_work')
      expect(state.readiness!.can_run_analysis).toBe(false)
    })
  })
})
