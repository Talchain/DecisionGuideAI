/**
 * readinessStore — a verdict the model has outgrown is not a current verdict.
 *
 * ROADMAP 2.332. The 3 Aug walk's binding dead end: after add-option, the
 * `Analyse first pass` control stayed disabled through seven remedy paths,
 * INCLUDING the one that SUCCEEDED at the server (`opt_retention` → status
 * "ready"). The UI issued `graph-readiness` exactly twice all session — once on
 * the draft, once on the structural change — and never again. The rendered
 * verdict was eight turns / ~5 minutes stale, and a reload alone opened the
 * gate.
 *
 * The mechanism, derived at the bytes rather than argued:
 *
 *   · The refresh trigger was a canvas subscription that fired only on
 *     `nodes`/`edges` IDENTITY change, and then only when a hand-written
 *     `createGraphFingerprint` — node `id:type:data.value` plus edge
 *     `key:data.confidence` — differed. That fingerprint was a hand-maintained
 *     mirror of "what the payload depends on" (CLAUDE.md trap 12) and it had
 *     drifted BOTH ways: it hashed `edge.data.confidence`, a field the request
 *     payload never carries, and it did NOT hash `observedState`, node labels,
 *     edge weights, the brief, or `ceeAnalysisReady` — every one of which the
 *     payload DOES carry.
 *   · The walk's successful remedy landed in the UI as
 *     `mirrorAnalysisReady → setCeeAnalysisReady`, i.e. a write to
 *     `ceeAnalysisReady`. The subscription did not watch that root at all, so
 *     the one event that changed the answer could not trigger the question.
 *
 * The fix is derivation, not a wider hand-list: `buildReadinessPayload` is the
 * single truth about what the verdict is a function of, and both the change
 * detector and the request use it. `createGraphFingerprint` is deleted — the
 * payload hash cannot drift from the payload because it IS the payload.
 *
 * These tests pin:
 *   1. every payload input triggers a refetch when it changes (1, 2, 3);
 *   2. a payload-IDENTICAL canvas change issues no request and does not wipe
 *      the honest error state #564 installed (4) — the second, smaller defect
 *      on the same path: `{loading:true, error:null}` was set BEFORE the
 *      payload was built and compared, so any node drag erased "Could not
 *      reach the readiness service" with no request in flight;
 *   3. a verdict the model has outgrown is MARKED, never presented as current
 *      (5), including while the service is unreachable (6);
 *   4. an invalidation storm against an unreachable service stays bounded and
 *      honest — no retry loop, no flap-open (8);
 *   5. the watched-root list cannot silently fall short of what the payload
 *      builder reads (7) — trap 12d: the derived guard proves agreement, so it
 *      is paired with real mutations driving each root end to end.
 *
 * Scope note (CLAUDE.md trap 3): every assertion in this file is on store
 * state or on the request body. No claim here is a layout or visibility claim;
 * the user-visible surface is pinned in
 * `pre-analysis-v3/__tests__/readinessOutageVisibility.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useReadinessStore,
  buildReadinessPayload,
  WATCHED_ROOTS,
  __test__,
} from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/** A server answer that OPENS the gate. */
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

/** What `fetch()` does when the host is unreachable (undici, jsdom). */
function networkRejection() {
  return Promise.reject(new TypeError('Failed to fetch'))
}

function factorNode(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor', ...extra },
  }
}

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => factorNode(i))
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
  useCanvasStore.setState({
    nodes: nodes as any,
    edges: edges as any,
    ceeAnalysisReady: null,
    currentBriefText: null,
  })
}

/** The body of the Nth `fetch` call, parsed. */
function requestBody(callIndex: number): Record<string, any> {
  const init = mockFetch.mock.calls[callIndex]?.[1]
  return JSON.parse(String(init?.body ?? '{}'))
}

/** `ceeAnalysisReady` as a turn's `mirrorAnalysisReady` writes it. */
function analysisReady(optionStatus: string) {
  return {
    options: [{ id: 'opt_retention', label: 'Retention push', status: optionStatus }],
    goal_node_id: 'node-0',
    status: optionStatus,
  } as any
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

describe('readinessStore — invalidation on mutation (ROADMAP 2.332)', () => {
  // ── Positive control (CLAUDE.md trap 13) ─────────────────────────
  // Every assertion below counts requests or reads bodies. Prove first that
  // this harness SEES a request go out and a verdict come back; otherwise a
  // "refetched" assertion could pass against a harness that fetches by
  // accident, and a "did not refetch" assertion could pass against one that
  // never fetches at all.
  describe('positive control — the harness observes requests and verdicts', () => {
    it('issues exactly one request on first listen and stores the verdict', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
      expect(requestBody(0).graph.nodes).toHaveLength(3)
    })

    it('issues a second request when the graph structure changes', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      seedCanvasWithNodes(4)
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes).toHaveLength(4)
    })
  })

  // ── T-2332-1 — the walk's dead end, exactly ──────────────────────
  describe('a change to ceeAnalysisReady re-asks the question', () => {
    it('refetches with the updated analysis_ready when a turn changes an option status', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('needs_values') })
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // The walk's successful remedy: the turn's `mirrorAnalysisReady` writes
      // `ceeAnalysisReady` and nothing else. `nodes`/`edges` identity does not
      // change, so the pristine subscription never sees this at all.
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      // Bound to the BODY, not merely to the call count: this proves the
      // trigger is payload-derived, not a coincidence of some other watcher.
      expect(requestBody(1).analysis_ready.options[0].status).toBe('ready')
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
    })
  })

  // ── T-2332-2 — a payload field the old fingerprint never hashed ──
  describe('a change to a factor observed_state re-asks the question', () => {
    it('refetches when observedState.value changes on a node', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useCanvasStore.setState({
        nodes: [
          factorNode(0, { observedState: { value: 0.2, raw_value: 20 } }),
          factorNode(1),
          factorNode(2),
        ] as any,
        edges: [] as any,
        ceeAnalysisReady: null,
        currentBriefText: null,
      })
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).graph.nodes[0].observed_state.value).toBe(0.2)

      // New array + new node objects, same ids and same `data.value` — the
      // pristine fingerprint (id:type:data.value) is byte-identical, so it
      // returns early and no request is issued.
      useCanvasStore.setState({
        nodes: [
          factorNode(0, { observedState: { value: 0.9, raw_value: 90 } }),
          factorNode(1),
          factorNode(2),
        ] as any,
      })
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes[0].observed_state.value).toBe(0.9)
    })

    it('refetches when a node label changes', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(requestBody(0).graph.nodes[0].label).toBe('Factor 0')

      // `label` rides the payload and was never in the fingerprint — a rename
      // (by hand or by `graph_patch`) changed what CEE would be asked about,
      // and asked nothing.
      useCanvasStore.setState({
        nodes: [
          factorNode(0, { label: 'Customer retention rate' }),
          factorNode(1),
          factorNode(2),
        ] as any,
      })
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes[0].label).toBe('Customer retention rate')
    })

    it('refetches when an edge weight changes', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(requestBody(0).graph.edges[0].weight).toBe(0.5)

      useCanvasStore.setState({
        edges: [
          {
            id: 'edge-0-1',
            source: 'node-0',
            target: 'node-1',
            data: { weight: 0.95, direction: 'negative' },
          },
        ] as any,
      })
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.edges[0].weight).toBe(0.95)
      expect(requestBody(1).graph.edges[0].effect_direction).toBe('negative')
    })
  })

  // ── T-2332-3 — a payload input on no watched root at all ─────────
  describe('a change to the brief re-asks the question', () => {
    it('refetches when the brief text crosses the 20-character floor', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).brief).toBeUndefined()

      useCanvasStore.setState({
        currentBriefText: 'Should we move billing to edge computing this quarter?',
      })
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).brief).toMatch(/edge computing/)
    })
  })

  // ── T-2332-4 — the second defect: a no-op change wiped the error ─
  //
  // ⚠ THE DESIGN'S EXAMPLE FOR THIS TEST WAS WRONG, AND MEASUREMENT SAID SO.
  // Design 1 §1.2 named "any node drag" as the trigger: new node identities,
  // same payload, `{loading:true, error:null}` set before the payload is built,
  // so the honest error is erased with no request. A drag does NOT do this at
  // pristine — the fingerprint is `id:type:data.value`, which a position change
  // leaves byte-identical, so the subscription returns before `fetchReadiness`
  // is ever entered. That version of this test PASSED at pristine, i.e. it was
  // pinning nothing.
  //
  // The real trigger is the fingerprint's OTHER drift direction, the one the
  // design's own table records and its prose then forgot: the fingerprint
  // hashes `edge.data.confidence`, a field the request payload has NEVER
  // carried. Changing it passes the fingerprint gate, enters `fetchReadiness`,
  // sets `{loading:true, error:null}` — and then finds the payload identical
  // and returns. Error erased, no request issued, nothing re-checked. Same
  // defect, reachable only through the field the mirror invented.
  describe('a payload-identical canvas change asks nothing and erases nothing', () => {
    it('does not clear a transport error when a non-payload field changes', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const failed = useReadinessStore.getState()
      expect(failed.error).not.toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const errorBefore = failed.error

      // `data.confidence` on an edge: in the pristine fingerprint, absent from
      // the payload at every commit this endpoint has existed.
      useCanvasStore.setState({
        edges: [
          {
            id: 'edge-0-1',
            source: 'node-0',
            target: 'node-1',
            data: { weight: 0.5, direction: 'positive', confidence: 0.9 },
          },
        ] as any,
      })
      await vi.runAllTimersAsync()

      const after = useReadinessStore.getState()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(after.error).toBe(errorBefore)
      expect(after.loading).toBe(false)
    })

    it('does not issue a request when only node positions move', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(mockFetch).toHaveBeenCalledTimes(1)

      useCanvasStore.setState({
        nodes: [
          { ...factorNode(0), position: { x: 40, y: 90 } },
          { ...factorNode(1), position: { x: 41, y: 91 } },
          { ...factorNode(2), position: { x: 42, y: 92 } },
        ] as any,
      })
      await vi.runAllTimersAsync()

      // GREEN at pristine (the fingerprint ignores position) and it must stay
      // green: replacing a hand-written fingerprint with a payload hash must
      // not turn every drag into a request.
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(useReadinessStore.getState().stale).toBe(false)
    })

    // ⚠ THIS TEST EXISTS BECAUSE A MUTANT SURVIVED WITHOUT IT.
    //
    // Design 1 §1.4 step 3 moves `{loading: true, error: null}` BELOW the
    // payload-hash check, and §1.5 calls that reorder "what PREVENTS a
    // regression against #564". The first mutant sweep put the setState back
    // above the check and ALL 36 tests still passed — because the subscription's
    // own payload compare now filters payload-identical emissions before
    // `fetchReadiness` is ever entered, so nothing in the suite reached the
    // reordered lines. A fix whose reversal turns nothing red is theatre
    // (CLAUDE.md trap 11), and the honest options were to reach it or drop it.
    //
    // It IS reachable, by an ordinary sequence: edit something while the
    // service is down, then undo the edit. The edit schedules a fetch that
    // fails; the undo schedules another, and THAT one finds the payload
    // identical to the last SUCCESSFUL one. With the setState above the check,
    // the undo erases the honest error and leaves `loading` stuck true — a
    // permanent spinner over a wiped outage — with no request in flight.
    it('an undo back to the last answered model neither erases the error nor sticks loading', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useCanvasStore.setState({
        nodes: [factorNode(0, { value: 0.2 }), factorNode(1), factorNode(2)] as any,
        edges: [] as any,
        ceeAnalysisReady: null,
        currentBriefText: null,
      })
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)

      // The service drops, and the user edits a value.
      mockFetch.mockImplementation(() => networkRejection())
      clearInflightCache()
      useCanvasStore.setState({
        nodes: [factorNode(0, { value: 0.9 }), factorNode(1), factorNode(2)] as any,
      })
      await vi.runAllTimersAsync()
      const errored = useReadinessStore.getState()
      expect(errored.error).not.toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // …then undoes it. The model is now exactly the one the server last
      // answered about, so there is nothing to ask.
      useCanvasStore.setState({
        nodes: [factorNode(0, { value: 0.2 }), factorNode(1), factorNode(2)] as any,
      })
      await vi.runAllTimersAsync()

      const after = useReadinessStore.getState()
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(after.error).toBe(errored.error)
      expect(after.loading).toBe(false)
    })
  })

  // ── T-2332-5 — the verdict carries its own age ───────────────────
  describe('a verdict the model has outgrown is marked, not presented as current', () => {
    it('marks the verdict stale on mutation and clears the mark only on a fresh verdict', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const settled = useReadinessStore.getState()
      expect(settled.stale).toBe(false)
      expect(settled.verdictAtMs).toEqual(expect.any(Number))
      const firstVerdictAt = settled.verdictAtMs!

      // The mark lands SYNCHRONOUSLY with the mutation — before the debounce,
      // before the request. The window in which a surface could show an
      // outgrown verdict without saying so is what this closes.
      vi.setSystemTime(new Date(Date.now() + 60_000))
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      expect(useReadinessStore.getState().stale).toBe(true)

      await vi.runAllTimersAsync()

      const refreshed = useReadinessStore.getState()
      expect(refreshed.stale).toBe(false)
      expect(refreshed.verdictAtMs).toBeGreaterThan(firstVerdictAt)
    })
  })

  // ── A mutation that arrives DURING a fetch ───────────────────────
  //
  // ⚠ THIS SECTION EXISTS BECAUSE AN ADVERSARIAL REVIEW FALSIFIED A CLAIM I
  // MADE IN THIS FILE. The comment on `stale` said the mark is set "before the
  // debounce, before the request — so there is no window in which an outgrown
  // verdict looks current". That was FALSE, and the counterexample is the most
  // ordinary shape there is: a slow fetch.
  //
  // `fetchReadiness` opened with `if (fetchInFlight) return`. So when a
  // mutation landed while a request was in the air, its debounced refetch
  // fired at +500ms, hit that guard, and was DROPPED — silently, with no
  // retry, no timer and no record that anything had been discarded. The
  // in-flight request then completed and its success arm cleared `stale`
  // unconditionally. Net result: the mark was laundered off by an answer that
  // PREDATED the mutation, and no request was ever issued for the mutated
  // model — the 3 Aug walk's exact defect, resurrected inside its own fix,
  // reachable whenever readiness latency exceeds 500ms. That is the Render
  // cold-start shape, i.e. the same outage this PR's other half is about.
  //
  // Two independent repairs, because they close two different holes:
  //   1. queue-on-drop — a dropped call sets a pending flag and is re-invoked
  //      from `finally`, so the request is deferred rather than discarded;
  //   2. the success arm clears `stale` only when the completing answer still
  //      describes the model on the canvas — derived by rebuilding the payload
  //      at completion, so no answer can clear a mark raised after it was sent.
  // (1) alone still leaves `stale` false for the duration of the re-fetch; (2)
  // alone leaves the mark true but never asks the question. Both, or the state
  // is wrong in one direction or the other.
  describe('an answer that predates a mutation cannot clear that mutation’s mark', () => {
    it('issues the deferred request and keeps the mark until the mutated model is answered', async () => {
      // Fetch 1 is held open — the slow-service case.
      let releaseFirst: ((value: unknown) => void) | undefined
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve
          }),
      )
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // The model changes while that request is still in the air.
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      expect(useReadinessStore.getState().stale).toBe(true)

      // The debounce fires and finds a fetch in flight. At the reviewed head
      // this call was dropped on the floor and never rescheduled.
      await vi.advanceTimersByTimeAsync(600)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Now the ORIGINAL request answers — about the pre-mutation model.
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      releaseFirst!(mockBlockedServerResponse())
      await vi.runAllTimersAsync()

      // The deferred request went out, and it asked about the mutated model.
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).analysis_ready.options[0].status).toBe('ready')

      // Only now is the mark cleared — by an answer that describes this model.
      const after = useReadinessStore.getState()
      expect(after.stale).toBe(false)
      expect(after.readiness?.can_run_analysis).toBe(true)
    })

    it('does not clear the mark at the moment the pre-mutation answer lands', async () => {
      let releaseFirst: ((value: unknown) => void) | undefined
      let releaseSecond: ((value: unknown) => void) | undefined
      mockFetch
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseFirst = resolve
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseSecond = resolve
            }),
        )
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      await vi.advanceTimersByTimeAsync(600)

      // Release ONLY the first request and let the store settle it. The second
      // request is now in flight, so this is the exact instant the stale mark
      // would be laundered: a verdict is on screen, it predates the mutation,
      // and the honest answer has not arrived.
      releaseFirst!(mockBlockedServerResponse())
      await vi.advanceTimersByTimeAsync(10)

      const midFlight = useReadinessStore.getState()
      expect(midFlight.readiness?.can_run_analysis).toBe(false)
      expect(midFlight.stale).toBe(true)

      releaseSecond!(mockOpenServerResponse())
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().stale).toBe(false)
    })
  })

  // ── T-2332-6 — composition with #564 (2.319a) ────────────────────
  describe('an unreachable service keeps the served verdict AND says it is outgrown', () => {
    it('retains the server verdict by identity, sets the error, and keeps the stale mark', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()

      const served = useReadinessStore.getState().readiness
      expect(served?.can_run_analysis).toBe(false)

      mockFetch.mockImplementation(() => networkRejection())
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      await vi.runAllTimersAsync()

      const after = useReadinessStore.getState()
      // Identity, not field equality: no re-derived look-alike can satisfy it.
      expect(after.readiness).toBe(served)
      expect(after.error).not.toBeNull()
      expect(after.stale).toBe(true)
      // The gate never opens on local authority — #564's invariant, re-asserted
      // here as the composition witness.
      expect(after.readiness?.can_run_analysis).toBe(false)
    })
  })

  // ── T-2332-7 — the watched-root list cannot fall short ───────────
  //
  // CLAUDE.md trap 12d, stated honestly: this guard proves the watched roots
  // AGREE with what `buildReadinessPayload` reads. It cannot prove the payload
  // itself is complete — only a corpus can, and that corpus is tests 1/2/3
  // above, each driving a real store mutation through a real root.
  describe('the watched-root list is derived from the payload builder, not from memory', () => {
    it('reads nothing from canvas state that is not a watched root', () => {
      seedCanvasWithNodes(3)
      const reads = new Set<string>()
      const state = useCanvasStore.getState() as unknown as Record<string, unknown>
      const recorder = new Proxy(state, {
        get(target, prop, receiver) {
          if (typeof prop === 'string') reads.add(prop)
          return Reflect.get(target, prop, receiver)
        },
      })

      buildReadinessPayload(recorder as any)

      // Positive control first: a builder that read nothing would satisfy the
      // subset assertion vacuously.
      expect(reads.size).toBeGreaterThan(0)
      expect(reads.has('nodes')).toBe(true)

      const unwatched = [...reads].filter(
        (r) => !(WATCHED_ROOTS as readonly string[]).includes(r),
      )
      expect(unwatched).toEqual([])
    })

    it('names every root the subscription watches', () => {
      expect([...WATCHED_ROOTS].sort()).toEqual(
        ['ceeAnalysisReady', 'currentBriefText', 'edges', 'nodes'].sort(),
      )
    })
  })

  // ── Interaction guard — a storm against a dead service ───────────
  //
  // The composition #564 + 2.332 has an obvious failure mode: honest errors on
  // every edit could become a retry loop, or the retained verdict could flap.
  // Neither is acceptable, and neither is argued here — both are measured.
  describe('an invalidation storm against an unreachable service stays bounded', () => {
    it('coalesces a burst of mutations into one request and never loops', async () => {
      mockFetch.mockResolvedValue(mockBlockedServerResponse())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      const served = useReadinessStore.getState().readiness
      expect(mockFetch).toHaveBeenCalledTimes(1)

      mockFetch.mockImplementation(() => networkRejection())
      clearInflightCache()

      // Ten distinct payload-affecting mutations inside one debounce window.
      for (let i = 0; i < 10; i++) {
        useCanvasStore.setState({ ceeAnalysisReady: analysisReady(`pass-${i}`) })
        await vi.advanceTimersByTimeAsync(20)
      }
      await vi.runAllTimersAsync()

      expect(mockFetch).toHaveBeenCalledTimes(2)

      // …and then nothing. A failure schedules no retry of its own: the next
      // request comes from the next mutation or from the Retry control.
      await vi.advanceTimersByTimeAsync(120_000)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      const after = useReadinessStore.getState()
      expect(after.readiness).toBe(served)
      expect(after.readiness?.can_run_analysis).toBe(false)
      expect(after.error).not.toBeNull()
      expect(after.stale).toBe(true)
      expect(after.loading).toBe(false)
    })

    it('recovers on the next mutation once the service answers again', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      seedCanvasWithNodes(3)
      useReadinessStore.getState().startListening()
      await vi.runAllTimersAsync()
      expect(useReadinessStore.getState().error).not.toBeNull()

      clearInflightCache()
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useCanvasStore.setState({ ceeAnalysisReady: analysisReady('ready') })
      await vi.runAllTimersAsync()

      const after = useReadinessStore.getState()
      expect(after.error).toBeNull()
      expect(after.stale).toBe(false)
      expect(after.readiness?.can_run_analysis).toBe(true)
    })
  })

  // ── The fingerprint is gone, not merely bypassed ─────────────────
  describe('the hand-maintained fingerprint no longer exists', () => {
    it('exposes no createGraphFingerprint test helper', () => {
      expect((__test__ as Record<string, unknown>).createGraphFingerprint).toBeUndefined()
    })
  })
})
