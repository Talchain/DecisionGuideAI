/**
 * readinessStore — a 404 from the readiness service is an OUTAGE, not a verdict.
 *
 * ROADMAP 2.329. PR #564 made a rejected fetch publish no verdict and say why,
 * and deliberately left the 404 branch alone pending adjudication. The
 * adjudication is now derived, at the deployed bytes
 * (`PHASE0-EVIDENCE-2026-07-28/adjudication-2329-404-branch.md`):
 *
 *   · No deployed configuration produces a 404 on this path BY DESIGN. On the
 *     PLoT deploy branch the route is registered unconditionally — no flag or
 *     env posture can remove it — and a missing `CEE_BASE_URL`/`CEE_API_KEY`
 *     yields an error RESPONSE from a registered handler, never a 404. Staging
 *     answers 401 (registered, auth-gated) against a control path that 404s.
 *   · The `'/bff/cee'` same-origin fallback does not survive minification in
 *     either deployed bundle (zero literals across an 81-chunk staging crawl
 *     and a 40-chunk production crawl), so the "dead SPA redirect" 404 vector
 *     is unreachable in the shipped artifacts.
 *   · One deployed configuration DOES 404 in steady state: production, whose
 *     PLoT predates the route by ~6.5 months while its paired UI bundle bakes
 *     the call in. That is deploy drift — the outage class — and this very
 *     branch is what has kept it invisible.
 *
 * So the 404 branch was answering an outage with a locally-computed verdict
 * and `error: null`: the same defect 2.319(a) fixed for transport failures,
 * on the branch that was left out of it. These tests pin the same treatment —
 * publish no verdict, set a truthful error, stay retryable.
 *
 * Scope notes:
 *   · CLAUDE.md trap 3 — every store assertion here is on store state. The one
 *     component test asserts the PRESENCE of the retry control in the rendered
 *     output; it is not a visibility, layout or above-the-fold claim.
 *   · CLAUDE.md trap 13 — the absence assertions are preceded by positive
 *     controls proving this harness can SEE a verdict and a null error arrive.
 *   · The prior-verdict test binds by OBJECT IDENTITY (`toBe`), not by field
 *     values, so no re-derived look-alike object can satisfy it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useReadinessStore, __test__ } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { PreAnalysisHealth } from '../../components/PreAnalysisHealth'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/**
 * What the readiness path returns when the route is not there. Shaped as
 * `deduplicatedFetch` sees it: `ok: false`, so it RESOLVES rather than
 * rejecting, and the body is read with `.text()`.
 */
function mock404Response() {
  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve('{"message":"Route POST:/v1/cee/graph-readiness not found"}'),
    headers: new Headers(),
  }
}

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

/** A server answer that OPENS the gate — the trap-13 positive control. */
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
  // graphHealth is deliberately left at its initial `null` — the state of a
  // canvas that has not yet been analysed. That is what made the local
  // heuristic find zero blockers and therefore ALWAYS grant the run.
  useCanvasStore.setState({ nodes: nodes as any, edges: edges as any })
}

beforeEach(() => {
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('readinessStore — a 404 is an outage, not a verdict (ROADMAP 2.329)', () => {
  // ── Positive controls (CLAUDE.md trap 13) ────────────────────────
  // Prove the harness can observe BOTH a verdict arriving and a null error,
  // before asserting that a 404 produces neither.
  describe('positive control — the harness can observe a real server verdict', () => {
    it('observes can_run_analysis true and error null when the server opens the gate', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })

    it('observes can_run_analysis false when the server closes the gate', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(false)
    })
  })

  // ── RED 1 — the silent half: a 404 reported as no failure at all ──
  describe('a 404 is reported as a failure', () => {
    it('does not report error: null when the readiness route is not found', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    it('names the failure as the service not being found, distinctly from unreachable and unreadable', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const error = useReadinessStore.getState().error
      expect(error).toMatch(/could not find/i)
      // The three no-verdict paths stay tellable apart at the store: this is
      // not the transport failure (2.319a) and not the unreadable body.
      expect(error).not.toMatch(/could not reach/i)
      expect(error).not.toMatch(/could not read the/i)
    })
  })

  // ── RED 2 — the dangerous half: the gate opened on local authority ──
  describe('a 404 never grants the run on local authority', () => {
    it('does not set can_run_analysis true when the readiness route is not found', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mock404Response())
      // 3 nodes + 1 edge with graphHealth null — the heuristic's most
      // permissive input: it scores 80 and finds zero blockers.
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).not.toBe(true)
    })

    it('publishes no locally-invented verdict at all when it has never had one from the server', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      // `readiness === null` alongside a non-null `error` is the store's
      // pre-existing "unknown" state — the same one 2.319(a) restored for
      // transport failures. No third state is introduced here.
      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().error).not.toBeNull()
    })
  })

  // ── RED 3 — a 404 must not overwrite a verdict the server gave ────
  describe('a 404 never replaces a verdict the server already gave', () => {
    it('leaves the exact verdict object the server produced in place', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      // Bind to the verdict by IDENTITY. A value predicate (score === 62)
      // could be satisfied by any object carrying the same numbers; this can
      // only be satisfied by the object the server's answer produced.
      const serverVerdict = useReadinessStore.getState().readiness
      expect(serverVerdict).not.toBeNull()
      expect(serverVerdict!.can_run_analysis).toBe(false)

      // The route disappears under it. refresh() clears the payload hash, so
      // this is a real second request for the same graph, exactly as a retry
      // or a redeploy mid-session would be.
      mockFetch.mockResolvedValue(mock404Response())
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness).toBe(serverVerdict)
      expect(useReadinessStore.getState().error).not.toBeNull()
    })
  })

  // ── Preserved behaviour (passes at pristine — pinned, not claimed) ──
  describe('a 404 stays retryable', () => {
    it('leaves the failed payload re-requestable — a 404 is not sticky', async () => {
      vi.useFakeTimers()
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Re-enter with the IDENTICAL payload, deliberately NOT via refresh():
      // refresh() clears `lastPayloadHash` itself and would therefore mask a
      // hash the 404 had poisoned. clearInflightCache() isolates the store's
      // own hash from the 750ms dedup window.
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

  // ── The state a 404 leaves is one a surface can act on ────────────
  //
  // PRESENCE, not visibility (CLAUDE.md trap 3): this renders the component
  // that owns the `error && !readiness` branch and asserts the retry control
  // is in the output. It binds to the real component rather than restating
  // its predicate, so a change that made the 404 state unreachable from that
  // branch would fail here.
  //
  // ⚠ HONEST SCOPE — this proves the state is ACTIONABLE, not that any user
  // sees it: `PreAnalysisHealth` has ZERO importers in `src/` at this commit
  // (derived: `grep -arn PreAnalysisHealth` over the tree hits only the
  // component itself, this spec, a store comment and two CI-baseline
  // artifacts). Mounting it is separate work and is NOT claimed by this PR.
  describe('the state a 404 leaves is one the health surface can act on', () => {
    it('reaches the retry control in PreAnalysisHealth after a 404', async () => {
      mockFetch.mockResolvedValue(mock404Response())
      seedCanvasWithNodes(3)

      render(<PreAnalysisHealth />)

      expect(
        await screen.findByRole('button', { name: /retry health check/i }),
      ).toBeInTheDocument()
    })

    it('positive control — the same surface does NOT show retry when the server answers', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)

      render(<PreAnalysisHealth />)

      // Wait for the verdict to land, then assert the retry branch is absent.
      expect(await screen.findByTestId('pre-analysis-health')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /retry health check/i })).toBeNull()
    })
  })
})
