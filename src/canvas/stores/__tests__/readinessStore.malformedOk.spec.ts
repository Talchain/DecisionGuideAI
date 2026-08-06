/**
 * readinessStore — a 200 that does not answer the question is not a "yes"
 * (ROADMAP 2.635, invariant I-2).
 *
 * ── The limb ─────────────────────────────────────────────────────────────
 * The normaliser defaulted the ONE gating field on the whole response:
 *
 *     can_run_analysis:
 *       typeof data.can_run_analysis === 'boolean' ? data.can_run_analysis : true
 *
 * A 2xx whose body carries no `can_run_analysis` boolean — a partial write, a
 * proxy that rewrote the body, a producer that renamed the field, a CEE
 * deployment on an older contract — therefore GRANTED the run, and stamped
 * `verdictAtMs`, and reported `error: null`. Every downstream surface read that
 * as the server's own assessment. It is the same fabrication class as the 429
 * arm (I-1), just spelled as a default instead of a heuristic, and it is
 * strictly harder to notice because nothing about it is labelled.
 *
 * ── The chosen fail direction (I-2) ──────────────────────────────────────
 * A malformed 200 is treated as UNKNOWN, not as `true`, and unknown is the
 * store's existing state: publish no verdict, retain whatever the server last
 * actually said, set a truthful `error`. The run gate's own posture on an
 * unknown verdict is unchanged and is stated in `canRunAnalysis` — a readiness
 * check that cannot be obtained does not brick the Run button for a healthy
 * user; it is disclosed. What changes here is only that the store stops
 * INVENTING the answer.
 *
 * ── What these tests pin ─────────────────────────────────────────────────
 *   1. a 200 without the boolean does not grant the run;
 *   2. it publishes no verdict at all when there has never been a server one;
 *   3. it never replaces a server `false` with a local `true`;
 *   4. it says so — a truthful `error`, and no `verdictAtMs` stamp;
 *   5. THE DISCRIMINATING HALF: a well-formed 200 still flows through
 *      byte-identically in BOTH directions. This is not "null everything".
 *
 * Scope note (CLAUDE.md trap 3): every assertion here is on store state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

const SERVER_BLOCKED_SENTENCE = 'One option still needs its effect values (server verdict B4)'

function ok(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

/** A well-formed answer that CLOSES the gate, identifiable by its own sentence. */
function mockBlockedServerResponse() {
  return ok({
    readiness_score: 62,
    readiness_level: 'fair',
    can_run_analysis: false,
    confidence_explanation: SERVER_BLOCKED_SENTENCE,
    improvements: [],
    options_ready: 1,
    options_total: 2,
    goal_node_valid: true,
  })
}

/** A well-formed answer that OPENS the gate. */
function mockOpenServerResponse() {
  return ok({
    readiness_score: 88,
    readiness_level: 'ready',
    can_run_analysis: true,
    confidence_explanation: 'Ready to analyse',
    improvements: [],
  })
}

/**
 * A 200 that is otherwise plausible but carries NO `can_run_analysis` boolean.
 * Everything else the normaliser reads is present, so the ONLY thing missing is
 * the answer to the question the request asked.
 */
function mockMalformedOkResponse(extra: Record<string, unknown> = {}) {
  return ok({
    readiness_score: 88,
    readiness_level: 'ready',
    confidence_explanation: 'Ready to analyse',
    improvements: [],
    options_ready: 2,
    options_total: 2,
    goal_node_valid: true,
    ...extra,
  })
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
  useCanvasStore.setState({ nodes: nodes as never, edges: edges as never })
}

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

describe('readinessStore — malformed 200 (ROADMAP 2.635, I-2)', () => {
  // ── Positive control + the DISCRIMINATING half (traps 13 / 13b) ───
  //
  // These two tests are not decoration. They are what stops the fix being
  // "treat every 200 as unknown", which would satisfy every RED below while
  // destroying the feature. A guard that only proves the hole is closed has not
  // proved it did not swallow the behaviour while closing it.
  describe('a well-formed 200 is untouched, in both directions', () => {
    it('still lands can_run_analysis true when the server says true', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
      expect(state.verdictAtMs).not.toBeNull()
    })

    it('still lands can_run_analysis false when the server says false', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(false)
      expect(state.readiness?.confidence_explanation).toBe(SERVER_BLOCKED_SENTENCE)
      expect(state.error).toBeNull()
    })
  })

  // ── RED 1 — the default that invented a "yes" ────────────────────
  describe('a 200 missing can_run_analysis does not grant the run', () => {
    it('does not set can_run_analysis true', async () => {
      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(useReadinessStore.getState().readiness?.can_run_analysis).not.toBe(true)
    })

    it('publishes no verdict at all when it has never had one from the server', async () => {
      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness).toBeNull()
      expect(state.error).not.toBeNull()
      expect(state.loading).toBe(false)
    })

    it.each([
      ['a string "true"', 'true'],
      ['a number 1', 1],
      ['null', null],
      ['an object', {}],
    ])('treats %s in can_run_analysis as no answer, not as yes', async (_label, value) => {
      mockFetch.mockResolvedValue(mockMalformedOkResponse({ can_run_analysis: value }))
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).not.toBe(true)
      expect(state.error).not.toBeNull()
    })
  })

  // ── RED 2 — never overwrite the server's refusal ─────────────────
  describe('a malformed 200 never replaces a verdict the server already gave', () => {
    it('leaves an existing server "cannot run" verdict intact, by identity', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().readiness?.confidence_explanation).toBe(
        SERVER_BLOCKED_SENTENCE,
      )

      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      mutateCanvas('a')
      await vi.runAllTimersAsync()

      // Bound by the server sentence, not by `can_run_analysis === false`
      // (trap 19): a fabricated verdict could satisfy the boolean too.
      const state = useReadinessStore.getState()
      expect(state.readiness?.confidence_explanation).toBe(SERVER_BLOCKED_SENTENCE)
      expect(state.readiness?.readiness_score).toBe(62)
      expect(state.readiness?.can_run_analysis).toBe(false)
    })

    it('does not re-stamp verdictAtMs for a response that carried no verdict', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      const stampedByRealAnswer = useReadinessStore.getState().verdictAtMs
      expect(stampedByRealAnswer).not.toBeNull()

      vi.advanceTimersByTime(60_000)
      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      mutateCanvas('a')
      await vi.runAllTimersAsync()

      // The footer cites this timestamp as "showing the check from HH:MM".
      // Moving it forward for a response that answered nothing would make a
      // retained verdict look freshly confirmed.
      expect(useReadinessStore.getState().verdictAtMs).toBe(stampedByRealAnswer)
    })
  })

  // ── RED 3 — the copy ─────────────────────────────────────────────
  describe('the error names the failure honestly', () => {
    it('says the response could not be read, and never implies an assessment', async () => {
      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const error = useReadinessStore.getState().error ?? ''
      expect(error).toMatch(/could not read|could not check/i)
      expect(error.length).toBeGreaterThan(0)
    })
  })

  // ── The retry must not be sticky ─────────────────────────────────
  describe('a malformed 200 is recoverable', () => {
    it('re-requests the identical graph once the service answers properly', async () => {
      mockFetch.mockResolvedValue(mockMalformedOkResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().readiness).toBeNull()

      // Same graph, no mutation — only a manual refresh, which is the control
      // the outage surface offers.
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useReadinessStore.getState().refresh()
      await vi.runAllTimersAsync()

      const state = useReadinessStore.getState()
      expect(state.readiness?.can_run_analysis).toBe(true)
      expect(state.error).toBeNull()
    })
  })
})
