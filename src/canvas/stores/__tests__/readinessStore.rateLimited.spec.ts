/**
 * readinessStore — a 429 is not a verdict either (ROADMAP 2.635, invariant I-1).
 *
 * ── The last fabrication limb ────────────────────────────────────────────
 * ROADMAP 2.319(a)/2.329/2.339 closed the transport, 404 and 5xx arms: each now
 * publishes NO verdict and a truthful `error`. The 429 arm was deliberately left
 * behind ("this arm's BEHAVIOUR is deliberately unchanged … retiring that is a
 * separate row"). This is that row.
 *
 * At pristine the 429 arm published `calculateFallbackReadiness` INTO
 * `readiness` — a node/edge-count heuristic whose verdict is
 * `can_run_analysis: blockers.length === 0`, where `blockers` come from
 * `graphHealth`, which is `null` until an analysis has already completed. So
 * before the first analysis there are never any blockers to find, and a rate
 * limit did not merely RISK opening the gate: it ALWAYS granted the run, on the
 * most common path there is. Worse, it OVERWROTE a `can_run_analysis: false`
 * the server had already given, with a locally invented `true` no consumer
 * could distinguish from the server's own answer.
 *
 * It could also print `readiness_level: 'strong'` — a level NO CEE code path
 * assigns to this field (`useGraphReadiness.CEE_READINESS_LEVELS`). A surface
 * showing `strong` is showing a band its producer cannot emit.
 *
 * ── What these tests pin ─────────────────────────────────────────────────
 *   1. a 429 publishes no locally-invented verdict when there has never been
 *      a server one (`readiness` stays `null`);
 *   2. a 429 never REPLACES a server verdict — in particular never flips a
 *      server `can_run_analysis: false` to a local `true`;
 *   3. a 429 can never publish `strong`, a level the producer never emits;
 *   4. the error names rate limiting truthfully rather than implying an
 *      assessment ("using local validation" implied one);
 *   5. the backoff the arm exists for still arms — the fix retires the
 *      FABRICATION, not the rate-limit handling.
 *
 * Scope note (CLAUDE.md trap 3): every assertion here is on store state. No
 * claim in this file is a layout or visibility claim.
 *
 * Binding note (CLAUDE.md trap 19): the retained-verdict assertions bind to the
 * server verdict by IDENTITY — its own `confidence_explanation` string and
 * score — not by a value predicate (`can_run_analysis === false`) that a
 * locally invented verdict could also satisfy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore, __test__ } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache, CEE_READINESS_LEVELS } from '../../hooks/useGraphReadiness'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/**
 * A server answer that CLOSES the gate, with an IDENTIFYING sentence and score
 * the local heuristic cannot produce. `blockers.length === 0` on a null
 * graphHealth makes the heuristic say `true`; this says `false`.
 */
const SERVER_BLOCKED_SENTENCE = 'One option still needs its effect values (server verdict A7)'

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
        confidence_explanation: SERVER_BLOCKED_SENTENCE,
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

/** HTTP 429, the shape `deduplicatedFetch` hands the store. */
function mockRateLimitedResponse(retryAfterSeconds?: number) {
  const headers = new Headers()
  if (retryAfterSeconds !== undefined) headers.set('Retry-After', String(retryAfterSeconds))
  return {
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('rate limited'),
    headers,
  }
}

/**
 * Seed the canvas with the heuristic's MOST PERMISSIVE input: enough nodes and
 * edges to score >= 70 (which is the `strong` band) with `graphHealth` left at
 * its initial `null`, so the heuristic finds zero blockers and grants the run.
 * If the fabrication survives anywhere, this input is what surfaces it.
 */
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
  useCanvasStore.setState({ nodes: nodes as never, edges: edges as never })
}

/** Nudge the canvas so the store sees a NEW payload and refetches. */
function mutateCanvas(tag: string) {
  const nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({
    nodes: [
      ...nodes,
      {
        id: `extra-${tag}`,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: `Extra ${tag}`, kind: 'factor' },
      },
    ] as never,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  useCanvasStore.setState({ nodes: [] as never, edges: [] as never, graphHealth: null } as never)
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('readinessStore — rate limited (ROADMAP 2.635, I-1)', () => {
  // ── Positive control (CLAUDE.md trap 13) ─────────────────────────
  // Before asserting what a 429 does NOT publish, prove this harness can SEE
  // both verdicts arriving from a server that does answer. Without this every
  // assertion below could pass by testing nothing.
  describe('positive control — the harness can observe a real server verdict', () => {
    it('observes can_run_analysis true when the server opens the gate', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })

    it('observes the identifying server sentence when the server closes the gate', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(false)
      expect(state.readiness?.confidence_explanation).toBe(SERVER_BLOCKED_SENTENCE)
    })
  })

  // ── RED 1 — the fabrication, with no prior server answer ─────────
  describe('a 429 publishes no locally-invented verdict', () => {
    it('does not grant can_run_analysis on local authority when rate limited', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      // 3 nodes + 1 edge, graphHealth null — the heuristic's most permissive
      // input: it scores 80 and finds zero blockers.
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).not.toBe(true)
    })

    it('publishes no verdict at all when it has never had one from the server', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      // `readiness === null` alongside a non-null `error` is the store's own
      // pre-existing "unknown" state — the same one the transport, 404 and 5xx
      // arms already use. No third state is invented (trap 12).
      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    it('never publishes a readiness_level the producer does not emit', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      // 5 nodes + an edge scores 85 — squarely in the heuristic's `strong` band.
      seedCanvasWithNodes(5)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const level = useReadinessStore.getState().readiness?.readiness_level
      if (level !== undefined) {
        // Derived from the producer mirror, not a literal: a level added to CEE
        // tomorrow must not fail this, and `strong` must never pass it.
        expect(CEE_READINESS_LEVELS as readonly string[]).toContain(level)
      }
      expect(level).not.toBe('strong')
    })
  })

  // ── RED 2 — the dangerous part: overwriting the server's refusal ──
  describe('a 429 never replaces a verdict the server already gave', () => {
    it('leaves an existing server "cannot run" verdict intact, by identity', async () => {
      // 1. A real server verdict lands and CLOSES the gate.
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().readiness?.confidence_explanation).toBe(
        SERVER_BLOCKED_SENTENCE,
      )

      // 2. The next fetch is rate limited.
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      mutateCanvas('a')
      await vi.runAllTimersAsync()

      // 3. The verdict on screen must still be the SERVER's — asserted by its
      //    own sentence, not by `can_run_analysis === false`, which the
      //    heuristic could also satisfy on a different input (trap 19).
      const state = useReadinessStore.getState()
      expect(state.readiness?.confidence_explanation).toBe(SERVER_BLOCKED_SENTENCE)
      expect(state.readiness?.readiness_score).toBe(62)
      expect(state.readiness?.can_run_analysis).toBe(false)
    })

    it('does not stamp verdictAtMs for a rate-limited attempt', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      // `verdictAtMs` means "when `readiness` was last set from an ANSWER".
      // A rate limit is not one.
      expect(useReadinessStore.getState().verdictAtMs).toBeNull()
    })
  })

  // ── RED 3 — the copy ─────────────────────────────────────────────
  describe('the error names the failure honestly', () => {
    it('says readiness could not be checked, not that local validation was used', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const error = useReadinessStore.getState().error ?? ''
      expect(error).toMatch(/could not check/i)
      // The pristine string was 'Rate limited - using local validation', which
      // asserts an assessment was made. It was not.
      expect(error).not.toMatch(/local validation/i)
    })
  })

  // ── Preserved behaviour — this row retires the fabrication only ───
  describe('the rate-limit handling itself is unchanged', () => {
    it('still arms the backoff on a 429', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(__test__.getModuleState().backoff.delay).toBeGreaterThan(0)
    })

    it('still honours a Retry-After header', async () => {
      mockFetch.mockResolvedValue(mockRateLimitedResponse(7))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(__test__.getModuleState().backoff.delay).toBe(7000)
    })
  })
})
