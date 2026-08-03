/**
 * readinessStore — "I could not reach the server" is not a server verdict.
 *
 * ROADMAP 2.319(a). `deduplicatedFetch` performs BOTH the `fetch()` and the
 * `response.json()` inside one async IIFE, so `await promise` in
 * `fetchReadiness` rejects for EVERY transport failure — cold start, CORS,
 * DNS, TLS — and not merely for a non-JSON body. The deployed UI calls its
 * readiness service cross-origin, so those are live failure modes, not
 * theoretical ones.
 *
 * At pristine that rejection fell through to `calculateFallbackReadiness` — a
 * node/edge-count heuristic whose verdict is `can_run_analysis:
 * blockers.length === 0`, where `blockers` come from `graphHealth`, which is
 * `null` until an analysis has already run (canvas `store.ts` initial state).
 * So on the pre-analysis canvas the heuristic ALWAYS granted the run, and the
 * store reported `error: null` — presenting a locally-invented verdict as the
 * server's, on the exact surface ROADMAP 2.308 had just repaired.
 *
 * What these tests pin:
 *   1. a transport failure never reports `error: null`;
 *   2. a transport failure never grants `can_run_analysis` on local authority;
 *   3. a transport failure never REPLACES a verdict the server already gave —
 *      this is the clause that keeps the 2.308 blocked state closed;
 *   4. the jsdom accommodation the original catch was written for still holds:
 *      a rejecting fetch settles the store instead of crashing or hanging.
 *
 * Scope note (CLAUDE.md trap 3): every assertion here is on store state. No
 * claim in this file is a layout or visibility claim.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore, __test__ } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/** A server answer that CLOSES the gate — the ROADMAP 2.308 blocked state. */
function mockBlockedServerResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 62,
        readiness_level: 'fair',
        can_run_analysis: false,
        confidence_explanation: 'One option still needs its effect values',
        improvements: [],
        options_ready: 1,
        options_total: 2,
        goal_node_valid: true,
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

/** A server answer that OPENS the gate — used as the trap-13 positive control. */
function mockOpenServerResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 88,
        readiness_level: 'ready',
        can_run_analysis: true,
        confidence_explanation: 'Ready to analyse',
        improvements: [],
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

/**
 * What `fetch()` does when the host is unreachable. undici (Node's fetch, the
 * one jsdom uses) rejects with a TypeError for a cold start, a CORS refusal, a
 * DNS failure, a TLS failure AND for the invalid relative URL that jsdom
 * produces — one class, one rejection, all arriving at the same catch.
 */
function networkRejection() {
  return Promise.reject(new TypeError('Failed to fetch'))
}

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
  // graphHealth is deliberately left at its initial `null`: that is the state
  // of a canvas that has not yet been analysed, and it is what makes the local
  // heuristic's `blockers.length === 0` grant the run.
  useCanvasStore.setState({ nodes: nodes as any, edges: edges as any })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('readinessStore — unreachable readiness service (ROADMAP 2.319a)', () => {
  // ── Positive control (CLAUDE.md trap 13) ─────────────────────────
  // Before asserting what the store does NOT report on a rejection, prove this
  // harness can SEE both verdicts arriving from a server that does answer.
  // Without this, every assertion below could pass by testing nothing.
  describe('positive control — the harness can observe a real server verdict', () => {
    it('observes can_run_analysis true and a null error when the server opens the gate', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })

    it('observes can_run_analysis false when the server closes the gate', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)
    })
  })

  // ── RED 1 — the silent part of the defect ────────────────────────
  describe('a transport failure is reported as a failure', () => {
    it('does not report error: null when the readiness service cannot be reached', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    it('names the failure as a reachability failure, not a model verdict', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().error).toMatch(/could not reach/i)
    })
  })

  // ── RED 2 — the dangerous part of the defect ─────────────────────
  describe('a transport failure never grants the run on local authority', () => {
    it('does not set can_run_analysis true when the readiness service cannot be reached', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      // 3 nodes + 1 edge with graphHealth null — the heuristic's most
      // permissive input, scoring 80 and finding zero blockers.
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).not.toBe(true)
    })

    it('publishes no locally-invented verdict at all when it has never had one from the server', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      // `readiness === null` alongside a non-null `error` is the store's
      // existing, already-rendered "unknown" state (PreAnalysisHealth's
      // "Could not check graph health" + Retry). No third state is invented.
      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().error).not.toBeNull()
    })
  })

  // ── RED 3 — the ROADMAP 2.308 clause ─────────────────────────────
  describe('a transport failure never replaces a verdict the server already gave', () => {
    it('keeps the server\'s can_run_analysis:false when the next fetch cannot reach the server', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)

      // The network drops. refresh() clears the payload hash so this is a real
      // second request for the same graph, exactly as a retry would be.
      mockFetch.mockImplementation(() => networkRejection())
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(false)
      expect(state.readiness?.confidence_explanation).toBe(
        'One option still needs its effect values',
      )
      expect(state.error).not.toBeNull()
    })

    it('does not overwrite the server verdict with the heuristic score', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      mockFetch.mockImplementation(() => networkRejection())
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      // The heuristic would score this graph 80 ('strong'); the server said 62.
      expect(useReadinessStore.getState().readiness?.readiness_score).toBe(62)
      expect(useReadinessStore.getState().readiness?.readiness_level).toBe('fair')
    })
  })

  // ── The two failure modes are told apart ─────────────────────────
  describe('a 2xx whose body will not parse is reported as its own failure', () => {
    it('says the response was unreadable, not that the service was unreachable', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
        text: () => Promise.resolve('<html>maintenance</html>'),
        headers: new Headers(),
      })
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.error).toMatch(/could not read/i)
      expect(state.error).not.toMatch(/could not reach/i)
      // Still no verdict — an unreadable answer is not an answer.
      expect(state.readiness).toBeNull()
    })
  })

  // ── The accommodation the original catch existed for ─────────────
  describe('the jsdom accommodation still holds', () => {
    it('settles rather than crashing or hanging when fetch rejects', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)

      expect(() => useReadinessStore.getState().startListening()).not.toThrow()
      await expect(vi.runAllTimersAsync()).resolves.toBeDefined()

      expect(useReadinessStore.getState().loading).toBe(false)
    })

    it('leaves the failed payload re-requestable — a transport failure is not sticky', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Re-enter the fetch with the IDENTICAL payload. Deliberately NOT via
      // refresh(): refresh() clears `lastPayloadHash` itself, so it would mask
      // a hash the failure had poisoned — an earlier draft of this test did
      // exactly that and a mutant caching the failed hash SURVIVED it.
      // clearInflightCache() isolates the store's own hash from the 750ms
      // dedup window, which under fake timers would otherwise replay the same
      // rejected promise.
      clearInflightCache()
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      await __test__.fetchReadiness()
      await vi.runAllTimersAsync()

      // A second real request went out — the failed payload was not cached.
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })
  })
})
