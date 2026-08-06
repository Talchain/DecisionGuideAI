/**
 * readinessStore — single-source-of-truth readiness state tests.
 *
 * Verifies:
 * - Single fetch per graph change (not N per consumer)
 * - Debounce coalesces rapid changes
 * - refresh() bypasses debounce
 * - reset() unsubscribes and clears state
 * - No verdict + error on 404 (ROADMAP 2.329) / backoff on 429
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
        readiness_level: 'ready', // ROADMAP 2.635 — was 'strong', the local heuristic's spelling of the top band; that heuristic is deleted and the level with it. `ready` is the producer's own top band at this score.
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
    // ROADMAP 2.329 — this test used to read `falls back to local readiness on
    // 404` and asserted `error === null` with a locally-computed verdict
    // present. It was pinning the defect: a 404 on the readiness path is an
    // outage (no deployed configuration produces one by design — derived at the
    // deployed bytes, PHASE0-EVIDENCE-2026-07-28/adjudication-2329-404-branch.md)
    // and an outage is not a readiness verdict. The full treatment, with its
    // positive controls and identity-bound prior-verdict clause, lives in
    // readinessStore.notFound.spec.tsx; this is the sibling suite's own guard
    // against the old behaviour returning.
    it('publishes no verdict and reports an error on 404', async () => {
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    // ROADMAP 2.635 — was `backs off on 429 and uses fallback`, asserting
    // `readiness` was non-null and the error read "using local validation".
    // The fallback it referred to (`calculateFallbackReadiness`) is DELETED:
    // it always granted the run pre-first-analysis and could overwrite a
    // server refusal. A 429 is a statement about the SERVICE, so the arm now
    // publishes no verdict — the backoff, which is what this test is really
    // about, is unchanged and asserted directly.
    it('backs off on 429 and publishes no verdict', async () => {
      mockFetch.mockResolvedValue(mock429Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).toMatch(/rate limited/i)
      expect(__test__.getModuleState().backoff.delay).toBeGreaterThan(0)
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

  // UI-SEM-091: the scaffold intent must survive the normaliser — an
  // unforwarded field would be silently dropped (the schema-skew hazard).
  describe('scaffold_plan forwarding (UI-SEM-091)', () => {
    it('forwards a well-formed scaffold_plan verbatim', async () => {
      mockFetch.mockResolvedValue(
        mockSuccessResponse({
          can_run_analysis: false,
          scaffold_plan: { will_scaffold_options: true, option_count: 3 },
        }),
      )
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const r = useReadinessStore.getState().readiness!
      expect(r.can_run_analysis).toBe(false)
      expect(r.scaffold_plan).toEqual({ will_scaffold_options: true, option_count: 3 })
    })

    it('omits option_count when the wire omits it', async () => {
      mockFetch.mockResolvedValue(
        mockSuccessResponse({ scaffold_plan: { will_scaffold_options: false } }),
      )
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const r = useReadinessStore.getState().readiness!
      expect(r.scaffold_plan).toEqual({ will_scaffold_options: false })
    })

    it('leaves scaffold_plan undefined when the wire omits it (fail-safe)', async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness!.scaffold_plan).toBeUndefined()
    })
  })
})

// ── F4: factor observed_state on the graph-readiness REQUEST ─────────
//
// Request-side contract (A1, byte-confirmed against merged CEE schema):
//   FACTOR nodes emit TOP-LEVEL `observed_state: { value, raw_value? }`
//   (sibling of `data`, snake_case). `value` REQUIRED (0-1 model scale);
//   `raw_value` OPTIONAL (display magnitude). NO metadata/unit/source key —
//   a metadata-shaped key routes CEE to the strict constraint branch → 400.
//   Non-factor nodes never get observed_state. Lets CEE report
//   scaffold_plan.will_scaffold_options (fixes "blocked despite scaffold fired").

/** Parse the POSTed graph-readiness request body and return graph.nodes keyed by id. */
async function captureRequestNodesById(): Promise<Record<string, any>> {
  const call = [...mockFetch.mock.calls]
    .reverse()
    .find((c) => typeof c?.[0] === 'string' && c[0].endsWith('/graph-readiness'))
  expect(call, 'expected a POST to /graph-readiness').toBeDefined()
  const body = JSON.parse((call![1] as any).body as string)
  const byId: Record<string, any> = {}
  for (const node of body.graph.nodes) byId[node.id] = node
  return byId
}

/** Seed a mixed graph exercising every observed_state gate, then fetch & capture. */
async function seedAndCaptureF4Graph(): Promise<Record<string, any>> {
  useCanvasStore.setState({
    nodes: [
      // factor with numeric value + raw_value; also carries data.value to prove the
      // observed_state attach is independent of the data:{value} branch.
      {
        id: 'fac1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Team size', kind: 'factor', value: 0.9, observedState: { value: 0.4, raw_value: 200 } },
      },
      // factor with value but unit/source and NO raw_value.
      {
        id: 'fac2',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Spend', kind: 'factor', observedState: { value: 0.4, unit: '%', source: 'cee_inference' } },
      },
      // factor with NO observedState.
      {
        id: 'fac3',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Bare factor', kind: 'factor' },
      },
      // factor with observedState but non-numeric value.
      {
        id: 'fac4',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Nullish factor', kind: 'factor', observedState: { value: null, raw_value: 5 } },
      },
      // NON-factor (constraint) carrying a numeric observedState.value.
      {
        id: 'con1',
        type: 'constraint',
        position: { x: 0, y: 0 },
        data: { label: 'Budget cap', kind: 'constraint', observedState: { value: 0.7, raw_value: 1000 } },
      },
      // NON-factor (goal) carrying a numeric observedState.value.
      {
        id: 'goal1',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { label: 'Goal', kind: 'goal', observedState: { value: 0.6 } },
      },
    ] as any,
    edges: [] as any,
  })

  useReadinessStore.getState().startListening()
  await vi.runAllTimersAsync()
  return captureRequestNodesById()
}

describe('readinessStore — F4 factor observed_state (request-side)', () => {
  // (1) factor with value + raw_value → observed_state {value, raw_value}; no leak; data:{value} intact.
  it('attaches observed_state {value, raw_value} on a factor and leaks no metadata/unit/source', async () => {
    const nodes = await seedAndCaptureF4Graph()
    expect(nodes.fac1.observed_state).toEqual({ value: 0.4, raw_value: 200 })
    expect(nodes.fac1.observed_state).not.toHaveProperty('metadata')
    expect(nodes.fac1.observed_state).not.toHaveProperty('unit')
    expect(nodes.fac1.observed_state).not.toHaveProperty('source')
    // The independent data:{value} branch is unaffected by the restructure.
    expect(nodes.fac1.data).toEqual({ value: 0.9 })
  })

  // (2) factor with value + unit/source but no raw_value → observed_state {value} only.
  it('emits observed_state {value} only when raw_value is absent, never leaking unit/source', async () => {
    const nodes = await seedAndCaptureF4Graph()
    expect(nodes.fac2.observed_state).toEqual({ value: 0.4 })
    expect(nodes.fac2.observed_state).not.toHaveProperty('raw_value')
    expect(nodes.fac2.observed_state).not.toHaveProperty('unit')
    expect(nodes.fac2.observed_state).not.toHaveProperty('source')
  })

  // (3) factor with no observedState / non-numeric value → no observed_state key.
  it('omits observed_state when the factor has no observedState or a non-numeric value', async () => {
    const nodes = await seedAndCaptureF4Graph()
    expect(nodes.fac3).not.toHaveProperty('observed_state')
    expect(nodes.fac4).not.toHaveProperty('observed_state')
  })

  // (4) non-factor nodes never get observed_state (kind gate).
  it('never attaches observed_state to non-factor nodes (constraint, goal)', async () => {
    const nodes = await seedAndCaptureF4Graph()
    expect(nodes.con1).not.toHaveProperty('observed_state')
    expect(nodes.goal1).not.toHaveProperty('observed_state')
  })
})
