/**
 * readinessStore — a 5xx is the service failing, not the model being graded.
 *
 * ROADMAP 2.339, found by the #564 review: that PR's body said "only 429
 * remains untouched", and the bytes refuted it. Any non-ok response that is
 * neither 429 nor 404 — 500, 502, 503, 401, 403 — was thrown into the OUTER
 * catch, which still published `calculateFallbackReadiness` as the readiness
 * verdict. That is the last fabrication path in the file, and it is the most
 * likely one to fire in production: a Render cold start answers 502.
 *
 * Why it matters exactly as much as the transport path #564 closed:
 *
 *   · `calculateFallbackReadiness` sets `can_run_analysis: blockers.length === 0`
 *     where the blockers come from `graphHealth`, which is `null` until an
 *     analysis has already run. On the PRE-analysis canvas it therefore always
 *     finds zero blockers and always grants the run.
 *   · It OVERWRITES `readiness`, so a `can_run_analysis: false` the server had
 *     already given — the ROADMAP 2.308 blocked state, pinned shut on the
 *     transport and 404 paths by #564 — was replaced by a locally invented
 *     `true` that no consumer could tell from the server's own answer.
 *   · Its error string was the raw `HTTP <status> - <body>`, i.e. the response
 *     body rendered into user-facing copy. For the outage shape that matters
 *     most — a proxy's HTML error page — that is a page of markup where a
 *     sentence belongs.
 *
 * The treatment is the one #564 established, applied to the limb it left:
 * publish no verdict, name the failure truthfully without echoing the body,
 * retain any prior server verdict BY IDENTITY, stay retryable.
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

/**
 * A gateway error, shaped as `deduplicatedFetch` sees it: `ok: false`, so it
 * RESOLVES rather than rejecting, and the body is read with `.text()`. The
 * body is deliberately an HTML error page — the real shape a proxy returns,
 * and the one the pristine error string pasted into the UI.
 */
function mockStatusResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('not json')),
    text: () =>
      Promise.resolve(
        '<html><head><title>502 Bad Gateway</title></head><body>upstream connect error</body></html>',
      ),
    headers: new Headers(),
  }
}

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

/** The ROADMAP 2.308 blocked state — the verdict a 5xx must never overwrite. */
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
  // `graphHealth` stays at its initial `null` — the state of a canvas that has
  // not been analysed, and the state in which the heuristic finds no blockers
  // and grants the run.
  useCanvasStore.setState({
    nodes: nodes as any,
    edges: edges as any,
    ceeAnalysisReady: null,
    currentBriefText: null,
  })
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

describe('readinessStore — a server error is not a verdict (ROADMAP 2.339)', () => {
  // ── Positive control (CLAUDE.md trap 13) ─────────────────────────
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

  // ── RED 1 — the fabricated verdict ───────────────────────────────
  describe('a 502 publishes no locally-invented verdict', () => {
    it('leaves readiness null when the service answers 502 and it has no prior verdict', async () => {
      mockFetch.mockResolvedValue(mockStatusResponse(502, 'Bad Gateway'))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    it('does not grant the run on local authority when the service answers 502', async () => {
      mockFetch.mockResolvedValue(mockStatusResponse(502, 'Bad Gateway'))
      // Three nodes and an edge with graphHealth null: the heuristic's most
      // permissive input, scoring 80 and finding zero blockers.
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).not.toBe(true)
    })
  })

  // ── RED 2 — the ROADMAP 2.308 clause, on this limb ───────────────
  describe('a 502 never replaces a verdict the server already gave', () => {
    it('retains the prior server verdict BY IDENTITY when the next answer is 502', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const served = useReadinessStore.getState().readiness
      expect(served?.can_run_analysis).toBe(false)

      clearInflightCache()
      mockFetch.mockResolvedValue(mockStatusResponse(502, 'Bad Gateway'))
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      const after = useReadinessStore.getState()
      // Identity, not field equality — a re-derived look-alike cannot satisfy
      // this, and the heuristic would have scored this graph 80 / 'strong'.
      expect(after.readiness).toBe(served)
      expect(after.readiness?.readiness_score).toBe(62)
      expect(after.error).not.toBeNull()
    })
  })

  // ── RED 3 — every status on the limb, not just the one we named ──
  describe('the whole non-429, non-404 status class takes the honest path', () => {
    it.each([
      [500, 'Internal Server Error'],
      [502, 'Bad Gateway'],
      [503, 'Service Unavailable'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
    ])('publishes no verdict on HTTP %i', async (status, statusText) => {
      mockFetch.mockResolvedValue(mockStatusResponse(status as number, statusText as string))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()
    })
  })

  // ── RED 4 — the error is a sentence, not a response body ─────────
  describe('the failure is named without echoing the response body', () => {
    it('reports a readable sentence carrying the status, and no markup', async () => {
      mockFetch.mockResolvedValue(mockStatusResponse(502, 'Bad Gateway'))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const error = useReadinessStore.getState().error ?? ''
      expect(error).toMatch(/could not answer/i)
      expect(error).toMatch(/502/)
      expect(error).not.toMatch(/</)
      expect(error).not.toMatch(/upstream connect error/)
    })

    it('tells a server error apart from an unreachable service', async () => {
      mockFetch.mockResolvedValue(mockStatusResponse(503, 'Service Unavailable'))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const error = useReadinessStore.getState().error ?? ''
      expect(error).not.toMatch(/could not reach/i)
      expect(error).not.toMatch(/could not find/i)
    })
  })

  // ── The retained guarantee — a 5xx is not sticky ─────────────────
  //
  // GREEN at pristine (`lastPayloadHash` is only written on success). Kept as a
  // regression pin: the honest-path rewrite must not start caching the failed
  // payload, or a redeploy would never be picked up.
  describe('a 502 leaves the payload re-requestable', () => {
    it('issues a real second request for the identical graph once the service recovers', async () => {
      mockFetch.mockResolvedValue(mockStatusResponse(502, 'Bad Gateway'))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Deliberately NOT via refresh(): refresh() clears the payload hash
      // itself and would mask a hash the failure had poisoned.
      clearInflightCache()
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      await __test__.fetchReadiness()
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })
  })

  // ── The one limb deliberately left alone ─────────────────────────
  //
  // 429 still publishes the local fallback, with an error string that says so.
  // It is out of scope for 2.339 (named in the PR body and rowed separately);
  // this pin exists so its behaviour cannot drift silently while the sibling
  // limbs are being rewritten.
  describe('the 429 limb is unchanged and still labelled', () => {
    it('publishes the local fallback with the rate-limit label', async () => {
      mockFetch.mockResolvedValue(mock429Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).not.toBeNull()
      expect(state.error).toBe('Rate limited - using local validation')
    })

    // ROADMAP 2.332 — `verdictAtMs` means "when `readiness` was last set from
    // an ANSWER". The 429 arm sets `readiness` from the LOCAL heuristic, so
    // stamping it would let a surface cite a time for a number no server
    // produced — the fabrication class this slice closes, re-created one field
    // over. It is explicitly nulled, and this is the pin.
    it('does not stamp verdictAtMs on the local rate-limit fallback', async () => {
      mockFetch.mockResolvedValue(mock429Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).not.toBeNull()
      expect(state.verdictAtMs).toBeNull()
    })

    // Same invariant, the limb the adversarial review found me breaking in my
    // own file: the empty-canvas arm composes its verdict LOCALLY ("Add some
    // nodes to get started") and was stamping `verdictAtMs: Date.now()` on it.
    // Reachable on the deployed configuration: open an empty canvas, add the
    // first node while the service is down, and the footer cites "Showing the
    // check from HH:MM" for a verdict no server ever produced — the exact
    // claim I nulled the 429 arm to prevent, one branch over.
    it('does not stamp verdictAtMs on the locally-composed empty-canvas verdict', async () => {
      useCanvasStore.setState({
        nodes: [] as any,
        edges: [] as any,
        ceeAnalysisReady: null,
        currentBriefText: null,
      })
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      // The verdict is published (it is a real, honest state) …
      expect(state.readiness?.readiness_score).toBe(0)
      expect(state.readiness?.can_run_analysis).toBe(false)
      // … and no request was made, so there is no answer to timestamp.
      expect(mockFetch).not.toHaveBeenCalled()
      expect(state.verdictAtMs).toBeNull()
    })

    it('clears a real verdict timestamp when a later 429 replaces the verdict', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().verdictAtMs).toEqual(expect.any(Number))

      // The 429 arm OVERWRITES the server verdict with the heuristic (its own
      // pre-existing defect, rowed separately). What must not survive that is
      // the timestamp of the answer it replaced.
      clearInflightCache()
      mockFetch.mockResolvedValue(mock429Response())
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().verdictAtMs).toBeNull()
    })
  })
})
