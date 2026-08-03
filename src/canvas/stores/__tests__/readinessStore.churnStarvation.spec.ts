/**
 * readinessStore — a trailing debounce must not be starved by the churn it is
 * watching (ROADMAP 2.345).
 *
 * THE DEFECT THIS FILE PINS WAS INTRODUCED BY #566, the fix for 2.332. That
 * PR replaced a hand-written fingerprint with a payload-derived change
 * detector — the right move, and its honesty machinery (outage arm, retained
 * verdict, staleness copy, Retry) was witnessed working live. But the payload
 * marker it compares against, `lastObservedPayload`, is recorded only when a
 * request ATTEMPT runs, and the cold-load zero-node arm returns before that
 * line. So on every real session the marker was `null`, and `null` equals no
 * payload at all.
 *
 * What that collided with is not hypothetical and not ours: React Flow's
 * ResizeObserver drives a permanent ~100–120 Hz storm of `nodes`-identity
 * commits into the canvas store for the life of a drafted graph (measured on
 * deployed staging: 1,564 watched-root commits in 16 s, max inter-commit gap
 * 44 ms over 60 s, stack `ResizeObserver → updateNodeInternals →
 * triggerNodeChanges → onNodesChange → set`). Every one of those commits
 * rebuilds a payload IDENTICAL to the last. Against a null marker each read as
 * a change, cleared the 500 ms trailing timer and re-armed it — about a
 * hundred times a second, forever. The deadline moved faster than time passed.
 *
 * The consequence measured by four witness walks: `graph-readiness` requested
 * ZERO times in three of four guest sessions (complete request manifests), and
 * once in the fourth, ~19 s AFTER the run was triggered. The gate a tester saw
 * on the first screen — `Analyse first pass` disabled, "Not ready for analysis
 * yet" — was the cold-load LOCAL zero-node verdict retained all session, while
 * the same turn's `analysis_ready.status` was "ready". And #566's outage
 * surface was unreachable, because nothing had ever failed: no request had
 * ever been made.
 *
 * ⚠ WHY THE EXISTING STORM COVERAGE DID NOT SEE THIS, stated because it is the
 * whole methodological point. `invalidation.spec.ts:663` drives ten mutations
 * that each CHANGE the payload, and every other spec in this directory seeds
 * nodes BEFORE `startListening` (so the zero-node arm is never taken) and lets
 * the canvas fall silent before asserting. Both halves of the deployed
 * condition were missing. The churn here keeps RUNNING ACROSS THE ASSERTION
 * WINDOW in every test that uses it — a churn loop that stops before the
 * assertion goes green on the broken code.
 *
 * Precisely which tests assert payload IDENTITY, because "asserted in every
 * test" would be false and this file is about not asserting more than was
 * measured: the five where the model is meant to STAND STILL — the churn
 * positive control, RED-1, RED-3, and both no-op guards — each assert
 * `currentPayload()` is byte-identical to the payload captured before the
 * churn started. The two where the model deliberately MOVES under the churn
 * (RED-2's added node, and the rate-limit test's added node) assert the
 * REQUEST BODY instead, which is the stronger claim available there: they
 * prove the mutated model is what got asked about. No test assumes identity
 * it has not either asserted or deliberately broken.
 *
 * Scope note (CLAUDE.md trap 3): every assertion below is on store state, on
 * module state, or on the request count/body. Nothing here is a visibility
 * claim; that is the browser witness's job and it cannot be made from jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore, buildReadinessPayload, __test__ } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

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

/** What `fetch()` does when the host is unreachable (undici, jsdom). */
function networkRejection() {
  return Promise.reject(new TypeError('Failed to fetch'))
}

function factorNode(i: number) {
  return {
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }
}

/** The cold canvas a guest lands on: no nodes, no brief, nothing. */
function emptyCanvas() {
  useCanvasStore.setState({
    nodes: [] as any,
    edges: [] as any,
    ceeAnalysisReady: null,
    currentBriefText: null,
  })
}

/** A draft landing as ONE nodes+edges commit, which is how CEE's draft lands. */
function draftLands(nodeCount: number) {
  useCanvasStore.setState({
    nodes: Array.from({ length: nodeCount }, (_, i) => factorNode(i)) as any,
    edges: [
      { id: 'edge-0-1', source: 'node-0', target: 'node-1', data: { weight: 0.5, direction: 'positive' } },
    ] as any,
  })
}

function currentPayload(): string {
  return buildReadinessPayload(useCanvasStore.getState() as any)
}

function requestBody(callIndex: number): Record<string, any> {
  const init = mockFetch.mock.calls[callIndex]?.[1]
  return JSON.parse(String(init?.body ?? '{}'))
}

// ── The storm, reproduced ──────────────────────────────────────────
//
// Faithful to what was measured on the deployed canvas rather than to a
// convenient abstraction: a new `nodes` ARRAY of new node OBJECTS on every
// tick, with the React Flow `measured` dimension field oscillating — the field
// probe C found churning. `measured` is not read by `buildReadinessPayload`,
// so the payload is byte-identical across every tick. That identity is
// asserted in each test rather than trusted; a churn helper that accidentally
// moved the payload would turn these into the payload-CHANGING storm tests
// that already exist and already pass on the broken code.

let churnHandle: ReturnType<typeof setInterval> | null = null
let churnTicks = 0
/** Watched-root commits the readiness subscription actually saw. */
let observedCommits = 0
let unsubCommitCounter: (() => void) | null = null

function startChurn(intervalMs = 100) {
  churnTicks = 0
  churnHandle = setInterval(() => {
    churnTicks++
    const { nodes } = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: nodes.map((n: any) => ({
        ...n,
        measured: { width: 180 + (churnTicks % 2), height: 44 },
      })) as any,
    })
  }, intervalMs)
}

function stopChurn() {
  if (churnHandle) clearInterval(churnHandle)
  churnHandle = null
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
  observedCommits = 0
  unsubCommitCounter = useCanvasStore.subscribe((state, prev) => {
    if (state.nodes !== prev.nodes) observedCommits++
  })
})

afterEach(() => {
  stopChurn()
  unsubCommitCounter?.()
  unsubCommitCounter = null
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('readinessStore — the first fetch is not starved by canvas churn (ROADMAP 2.345)', () => {
  // ── Positive controls (CLAUDE.md trap 13) ────────────────────────
  //
  // Three of the tests below assert that a request DOES go out. Two assert one
  // does NOT. Neither claim is worth anything until the harness is shown to be
  // capable of both — and, specifically for this file, until the churn helper
  // is shown to actually emit commits. A silent churn helper would make every
  // starvation test pass for the wrong reason.
  describe('positive controls — the harness sees requests, and the churn is real', () => {
    it('issues the first request once the draft lands on a quiet canvas', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).not.toHaveBeenCalled() // the zero-node arm answers locally

      draftLands(16)
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).graph.nodes).toHaveLength(16)
    })

    it('emits payload-identical watched-root commits at the measured cadence', async () => {
      emptyCanvas()
      draftLands(16)
      const before = currentPayload()

      const commitsBefore = observedCommits
      startChurn(100)
      await vi.advanceTimersByTimeAsync(5000)
      stopChurn()

      // The storm is present …
      expect(churnTicks).toBeGreaterThanOrEqual(45)
      expect(observedCommits - commitsBefore).toBeGreaterThanOrEqual(45)
      // … the node identities really do change on every tick …
      expect(useCanvasStore.getState().nodes[0]).not.toBe(null)
      expect((useCanvasStore.getState().nodes[0] as any).measured).toBeDefined()
      // … and it changes NOTHING the server would see.
      expect(currentPayload()).toBe(before)
    })
  })

  // ── RED-1 — the walk's zero, at store level ──────────────────────
  describe('a draft on a cold canvas is asked about, even while the canvas churns', () => {
    it('issues exactly one request for the drafted model with the storm still running', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).not.toHaveBeenCalled()

      draftLands(16)
      const payloadAtDraft = currentPayload()
      startChurn(100)

      // Assertions are taken WITH THE CHURN STILL RUNNING. This is the whole
      // test: 5 s of virtual time in which the debounce must reach its
      // deadline despite ~50 intervening watched-root commits.
      await vi.advanceTimersByTimeAsync(5000)

      expect(churnTicks).toBeGreaterThanOrEqual(45)
      expect(currentPayload()).toBe(payloadAtDraft)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).graph.nodes).toHaveLength(16)
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
    })
  })

  // ── RED-2 — invalidation still works under the storm ─────────────
  describe('a mutation after the first answer is asked about, even while the canvas churns', () => {
    it('refetches with the mutated model', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      startChurn(100)
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // A turn adds an option, mid-storm.
      clearInflightCache()
      useCanvasStore.setState({
        nodes: [...useCanvasStore.getState().nodes, factorNode(99)] as any,
      })
      await vi.advanceTimersByTimeAsync(2000)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes).toHaveLength(17)
    })
  })

  // ── RED-3 — #566's honesty surface becomes reachable ─────────────
  describe('an unreachable service is reported, even while the canvas churns', () => {
    it('publishes the transport error for the drafted model', async () => {
      mockFetch.mockImplementation(() => networkRejection())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      const payloadAtDraft = currentPayload()
      startChurn(100)
      await vi.advanceTimersByTimeAsync(3000)

      expect(currentPayload()).toBe(payloadAtDraft)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      // #566's outage arm — unreachable in the field only because no request
      // was ever made for it to fail.
      expect(useReadinessStore.getState().error).toBe('Could not reach the readiness service')
      expect(useReadinessStore.getState().loading).toBe(false)
    })
  })

  // ── The bound #566 promised, extended to sustained churn ─────────
  //
  // The fix must not be bought by asking more often. A payload the store has
  // already asked about is asked about once, and the storm neither re-requests
  // it nor disturbs the state the surfaces render.
  describe('sustained churn after the question is answered asks nothing further', () => {
    it('issues no further request and never marks the answered verdict stale', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      draftLands(16)
      await vi.advanceTimersByTimeAsync(600)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(useReadinessStore.getState().stale).toBe(false)

      const answered = useReadinessStore.getState().readiness
      const flips: Array<{ loading: boolean; error: string | null; stale: boolean }> = []
      const unsub = useReadinessStore.subscribe((s) =>
        flips.push({ loading: s.loading, error: s.error, stale: s.stale }),
      )

      const payloadAtAnswer = currentPayload()
      startChurn(100)
      await vi.advanceTimersByTimeAsync(10_000)
      unsub()

      expect(churnTicks).toBeGreaterThanOrEqual(95)
      expect(currentPayload()).toBe(payloadAtAnswer)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      // Not merely "no request": no store churn either. A hundred `stale: true`
      // writes a second would re-render every readiness consumer.
      expect(flips).toEqual([])
      const after = useReadinessStore.getState()
      expect(after.readiness).toBe(answered)
      expect(after.stale).toBe(false)
      expect(after.error).toBeNull()
      expect(after.loading).toBe(false)
    })

    it('never marks the empty-canvas verdict outgrown while the payload stands still', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(useReadinessStore.getState().stale).toBe(false)

      // The zero-node arm answers locally, and its answer is a function of
      // exactly this payload — so the arm must record the payload as observed,
      // the same as a request attempt does. Unrecorded, the marker is null,
      // null equals no payload, and every emission below reads as a change.
      //
      // Typing a brief below the 20-character floor is that shape without any
      // React Flow involved: real watched-root commits that leave the payload
      // byte-identical. The end state alone cannot see the defect (the
      // debounce lands back in the same arm and clears the mark again), so
      // this watches EVERY emission — one flap per typing pause, about a
      // verdict that never changed.
      const payloadWhileEmpty = currentPayload()
      const emissions: boolean[] = []
      const unsub = useReadinessStore.subscribe((s) => emissions.push(s.stale))

      for (const text of ['A', 'A d', 'A dec', 'A decis']) {
        useCanvasStore.setState({ currentBriefText: text })
        await vi.advanceTimersByTimeAsync(700)
      }
      unsub()

      expect(currentPayload()).toBe(payloadWhileEmpty)
      expect(mockFetch).not.toHaveBeenCalled()
      expect(emissions.filter(Boolean)).toEqual([])
      expect(useReadinessStore.getState().stale).toBe(false)
    })
  })

  // ── The scheduled-payload record is a claim, and claims expire ───
  //
  // Tracking "what the armed timer will ask" is what makes starvation
  // impossible, and it is also the thing most likely to be got wrong in the
  // other direction: a claim that outlives its timer suppresses a question
  // that was never asked. These two pin the release.
  describe('a scheduled question is released the moment it is asked', () => {
    it('holds no scheduled claim once the timer has fired', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      // Armed, and claiming.
      expect(__test__.getModuleState().hasDebounceTimer).toBe(true)
      expect(__test__.getModuleState().hasPendingScheduledPayload).toBe(true)

      await vi.advanceTimersByTimeAsync(600)

      // Fired: the claim must go with the timer. The invariant is that these
      // two agree — a claim without a timer is an unaskable payload.
      expect(__test__.getModuleState().hasDebounceTimer).toBe(false)
      expect(__test__.getModuleState().hasPendingScheduledPayload).toBe(false)
    })

    it('re-schedules a model that was scheduled, abandoned by an undo, and then made again', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      draftLands(16)
      await vi.advanceTimersByTimeAsync(600)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const answeredNodes = useCanvasStore.getState().nodes

      // Edit → schedules the 17-node model …
      useCanvasStore.setState({
        nodes: [...answeredNodes, factorNode(99)] as any,
      })
      await vi.advanceTimersByTimeAsync(100)
      // … undo inside the debounce window. The payload is back to the model
      // already answered, so the change detector early-returns and the armed
      // timer is left holding a claim on a question nobody will now ask.
      useCanvasStore.setState({ nodes: answeredNodes as any })
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Redo. The claim must have been released, or this model can never be
      // asked about again.
      clearInflightCache()
      useCanvasStore.setState({
        nodes: [...answeredNodes, factorNode(99)] as any,
      })
      await vi.advanceTimersByTimeAsync(1000)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes).toHaveLength(17)
    })
  })

  // ── Teardown releases the claim too ──────────────────────────────
  //
  // ⚠ THIS SECTION EXISTS BECAUSE AN ADVERSARIAL REVIEW FOUND A LINE OF MY FIX
  // THAT NOTHING EXECUTED. The claim is released in two places — when the timer
  // fires, and in `stopListening`. Only the first was pinned: deleting
  // `pendingScheduledPayload = null` from `stopListening` passed the entire
  // 294-test scope. That is my own M3 story one layer up, and it is worth
  // saying plainly: the mutant I did not write is the one that would have
  // shipped an unexecuted guarantee.
  //
  // The claim is module-level and `stopListening` is what `reset()` calls, so a
  // leaked claim survives even a full store reset — there is no path back to a
  // clean state short of the timer that was just cancelled. And the failure is
  // SILENT: the early return sits above the `stale` mark, so the payload is
  // neither asked about nor flagged as unasked. Ported from the reviewer's
  // probe 3.
  describe('the last consumer unmounting releases the scheduled claim', () => {
    it('leaks no claim when teardown races an armed timer, and a remount asks', async () => {
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      const release = useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      await vi.advanceTimersByTimeAsync(100) // mid-debounce: armed and claiming
      expect(__test__.getModuleState().hasDebounceTimer).toBe(true)
      expect(__test__.getModuleState().hasPendingScheduledPayload).toBe(true)

      release() // the last consumer unmounts while the timer is still armed
      expect(__test__.getModuleState().hasDebounceTimer).toBe(false)
      expect(__test__.getModuleState().hasPendingScheduledPayload).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()

      // Remount: the first-listen immediate fetch asks about the same model.
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).graph.nodes).toHaveLength(16)
    })

    it('asks about a model the canvas returns to after an unmount, and never goes silent', async () => {
      // The harm the module-state assertion above only stands proxy for. A
      // module-state pin proves the mechanism; this proves the damage, and the
      // two are not the same test.
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      emptyCanvas()
      const release = useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      await vi.advanceTimersByTimeAsync(100)
      release() // claim on the 16-node model, released here or leaked forever

      // The canvas keeps moving while nothing is listening — the panel is shut.
      useCanvasStore.setState({
        nodes: [...useCanvasStore.getState().nodes, factorNode(99)] as any,
      })

      // Reopen. First listen asks about the 17-node model it finds.
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(requestBody(0).graph.nodes).toHaveLength(17)

      // Now undo, back to exactly the payload the released claim named. A
      // leaked claim swallows this: no request, and — because the early return
      // sits above the mark — no `stale` either. The gate would sit on a
      // verdict for a model the canvas no longer holds, saying nothing.
      clearInflightCache()
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.slice(0, 16) as any,
      })
      expect(useReadinessStore.getState().stale).toBe(true)
      await vi.advanceTimersByTimeAsync(1000)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes).toHaveLength(16)
    })
  })

  // ── The pre-#566 defect stays dead ───────────────────────────────
  //
  // The obvious way to kill the starvation is to record the payload as
  // OBSERVED at schedule time, which is exactly what the code before #566 did.
  // It works, and it re-opens the hole #566 closed: a payload that was
  // scheduled but never actually asked about looks answered forever. The
  // reachable shape is a scheduled attempt that returns without a request —
  // the rate-limit backoff arm. Under the deployed storm the recovery is the
  // churn itself, which is why this test keeps churning.
  describe('a scheduled attempt that never issued a request does not look answered', () => {
    it('asks again once a rate-limit backoff has expired', async () => {
      mockFetch.mockResolvedValue(mock429Response())
      emptyCanvas()
      useReadinessStore.getState().startListening()
      await vi.advanceTimersByTimeAsync(0)

      draftLands(16)
      startChurn(100)
      await vi.advanceTimersByTimeAsync(600)
      // The draft was asked about and rate-limited: backoff is armed for 1 s.
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // A turn adds an option while the backoff is still running. Its debounce
      // fires INSIDE the backoff window, so `fetchReadiness` returns with no
      // request and no record of an attempt.
      clearInflightCache()
      mockFetch.mockResolvedValue(mockOpenServerResponse())
      useCanvasStore.setState({
        nodes: [...useCanvasStore.getState().nodes, factorNode(99)] as any,
      })
      await vi.advanceTimersByTimeAsync(300)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Past the backoff, still churning. The mutated model must be asked
      // about; a payload recorded as observed at schedule time never would be.
      await vi.advanceTimersByTimeAsync(3000)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(requestBody(1).graph.nodes).toHaveLength(17)
      expect(useReadinessStore.getState().readiness?.can_run_analysis).toBe(true)
    })
  })
})
