/**
 * readinessStore × canRunAnalysis — a failed re-check does not keep a LOCAL
 * verdict alive as if a server had given it.
 *
 * ── The witnessed defect (served-browser evidence) ─────────────────────────
 * `e2e/ai-conversation/evidence/08-readiness-outage-chip-vs-dock.png` on
 * `witness/ai-conversation-local`:
 *
 *   1. On an EMPTY canvas the store's zero-node arm publishes a verdict it
 *      composes itself — `can_run_analysis: false`, "Add some nodes to get
 *      started" — with `verdictAtMs: null`, because no request was made.
 *   2. A model lands. The store marks that verdict `stale` and asks
 *      `/bff/cee/graph-readiness`, which answers HTTP 503.
 *   3. Every failure arm leaves `readiness` "EXACTLY as it was", on the stated
 *      premise that it is "null on first load … otherwise the last answer the
 *      server actually gave". Here it is neither: it is the zero-node
 *      composition, about a graph that no longer exists.
 *   4. The gate therefore refuses the run on that verdict and, because it is
 *      stale, says "Your model changed since the last check. Olumi is checking
 *      again, which takes a moment." — while the dock on the same screen says
 *      "Could not re-check readiness … (HTTP 503)" with a Retry button. The
 *      gate claims a check is running; the check has failed.
 *
 * ── The rule relied on (canRunAnalysis.ts, `readinessObjectsToRun` header) ─
 *   "A `null` verdict is UNKNOWN, and unknown does not object. The run gate
 *    stays open and the outage is DISCLOSED … A truthful 'we could not check,
 *    you can still run' is not a dead end; a false 'you cannot run' is."
 *
 * The staleness rule beside it — "a stale verdict that blocks still blocks
 * (its refusal is the last real answer we have)" — does not reach this state:
 * a verdict no server produced is not a real answer. The store now publishes
 * the unknown state it describes (no verdict + a truthful error), and the gate
 * applies its own rule to it unchanged. CEE's `may_run` admission still decides
 * at run time.
 *
 * ── Controls ───────────────────────────────────────────────────────────────
 *   · a genuine CEE `can_run_analysis: false` (fresh, no error) still blocks,
 *     with CEE's own sentence;
 *   · a re-check genuinely in flight (no error yet) keeps "checking again";
 *   · a stale verdict with no error is unchanged (local AND server);
 *   · a SERVER verdict is still retained by identity on a failed re-check —
 *     the fix drops only what no server said.
 *
 * NO MODEL OR PROVIDER CALLS: `fetch` is a stub, and the afterEach guard
 * asserts every request this file makes is the same-origin readiness seam.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { canRunAnalysis, type CanRunAnalysisResult } from '../../utils/canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../../utils/composeBlockedReason'
import {
  deriveReadinessCheck,
  deriveReadinessDisplay,
  readinessNothingHasAnswered,
  RESTING_AVAILABLE,
} from '../../components/pre-analysis-v3/footer/readinessDisplay'
import { FOOTER_COPY } from '../../components/pre-analysis-v3/constants'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

const READINESS_SEAM = '/bff/cee/graph-readiness'

// ── Wire shapes, as `deduplicatedFetch` sees them ─────────────────────────

function statusResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve('<html><body>upstream unavailable</body></html>'),
    headers: new Headers(),
  }
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

/** CEE's own written refusal — the sentence a genuine refusal must keep. */
const CEE_REFUSAL = 'This model can’t be analysed yet. Choose the missing effect value for Price on Revenue.'

function ceeBlockedResponse() {
  return okResponse({
    readiness_score: 62,
    readiness_level: 'fair',
    can_run_analysis: false,
    confidence_explanation: 'V3 analysis not ready',
    blocker_reason: CEE_REFUSAL,
    improvements: [],
  })
}

/** Every failure arm the store has, each as the fetch stub that reaches it. */
const FAILURE_ARMS: ReadonlyArray<[string, () => unknown, RegExp]> = [
  ['HTTP 503 (the witnessed arm)', () => Promise.resolve(statusResponse(503, 'Service Unavailable')), /HTTP 503/],
  ['transport rejection', () => Promise.reject(new TypeError('Failed to fetch')), /could not reach/i],
  ['HTTP 429', () => Promise.resolve(statusResponse(429, 'Too Many Requests')), /rate limited/i],
  ['HTTP 404', () => Promise.resolve(statusResponse(404, 'Not Found')), /could not find/i],
  ['a 200 with no can_run_analysis', () => Promise.resolve(okResponse({ readiness_score: 50 })), /could not read/i],
]

// ── Canvas states ──────────────────────────────────────────────────────────

function emptyCanvas() {
  useCanvasStore.setState({
    nodes: [] as any,
    edges: [] as any,
    ceeAnalysisReady: null,
    currentBriefText: null,
  })
}

function modelLands(count: number) {
  useCanvasStore.setState({
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `Factor ${i}`, kind: 'factor' },
    })) as any,
    edges: [
      { id: 'edge-0-1', source: 'node-0', target: 'node-1', data: { weight: 0.5, direction: 'positive' } },
    ] as any,
  })
}

/** Steps 1 and 2 of the witness: the local verdict, then a model on the canvas. */
async function localVerdictThenModel(nodeCount = 3) {
  emptyCanvas()
  useReadinessStore.getState().startListening()
  await vi.advanceTimersByTimeAsync(0)
  // Proves the harness really reaches the local arm (trap 13): without it
  // every assertion below could pass on a store that never held the verdict.
  const local = useReadinessStore.getState()
  expect(local.readiness?.can_run_analysis).toBe(false)
  expect(local.readiness?.confidence_explanation).toBe('Add some nodes to get started')
  expect(local.verdictAtMs).toBeNull()
  expect(mockFetch).not.toHaveBeenCalled()
  modelLands(nodeCount)
  return nodeCount
}

// ── The two surfaces, read off the store the way their mounts read it ──────

/** The gate, as `OutputsDock` / `ConversationPanel` call it (side-car only). */
function gateFromStore(nodeCount: number): CanRunAnalysisResult {
  const s = useReadinessStore.getState()
  return canRunAnalysis({
    graphHealth: null,
    readiness: s.readiness,
    analysisReadiness: null,
    hasBlockers: false,
    nodeCount,
    readinessStale: s.stale,
  })
}

/** The dock's readiness line, through its one owner (`readinessDisplay.ts`). */
function dockFromStore(gate: CanRunAnalysisResult) {
  const s = useReadinessStore.getState()
  return deriveReadinessDisplay({
    readinessCheck: deriveReadinessCheck({
      error: s.error,
      verdictRetained: s.readiness != null,
      stale: s.stale,
      verdictAtMs: s.verdictAtMs,
      retry: null,
    }),
    isAnalysing: false,
    canRun: gate.allowed,
    blockedReason: gate.reason,
    blockedListing: gate.blockedListing,
    nothingHasAnswered: readinessNothingHasAnswered(s.readiness, null),
    resting: RESTING_AVAILABLE,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  // No provider host, ever: the only request this file may make is the
  // same-origin readiness seam, served by the stub above.
  for (const call of mockFetch.mock.calls) {
    expect(String(call[0])).toBe(READINESS_SEAM)
  }
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('a failed re-check over a LOCAL verdict follows the unknown-verdict rule', () => {
  describe('the witnessed state: local verdict, model lands, re-check answers 503', () => {
    it('publishes no verdict — the local composition is not retained as if a server gave it', async () => {
      mockFetch.mockImplementation(() => Promise.resolve(statusResponse(503, 'Service Unavailable')))
      await localVerdictThenModel()
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const s = useReadinessStore.getState()
      expect(s.error).toBe('The readiness service could not answer (HTTP 503)')
      expect(s.loading).toBe(false)
      expect(s.readiness).toBeNull()
      expect(s.verdictAtMs).toBeNull()
    })

    it('the gate is OPEN and makes no claim that a check is in progress', async () => {
      mockFetch.mockImplementation(() => Promise.resolve(statusResponse(503, 'Service Unavailable')))
      const nodeCount = await localVerdictThenModel()
      await vi.advanceTimersByTimeAsync(600)

      const gate = gateFromStore(nodeCount)
      expect(gate.allowed).toBe(true)
      expect(gate.reason).toBeUndefined()
      expect(gate.blockingReasons ?? []).not.toContain(BLOCKED_REASON_COPY.staleRecheck)
    })

    it('the dock discloses the outage with its existing copy, beside an enabled run', async () => {
      mockFetch.mockImplementation(() => Promise.resolve(statusResponse(503, 'Service Unavailable')))
      const nodeCount = await localVerdictThenModel()
      await vi.advanceTimersByTimeAsync(600)

      const gate = gateFromStore(nodeCount)
      const dock = dockFromStore(gate)
      expect(dock.headline).toBe(FOOTER_COPY.readinessUnchecked)
      expect(dock.subline).toBe('The readiness service could not answer (HTTP 503).')
      // One screen, one story: nothing on it says a check is running.
      expect([dock.headline, dock.subline, gate.reason ?? '']).not.toContain(
        BLOCKED_REASON_COPY.staleRecheck,
      )
    })
  })

  describe('every failure arm, not only the one witnessed', () => {
    it.each(FAILURE_ARMS)('%s: no local verdict survives and the gate is open', async (_label, reply, error) => {
      mockFetch.mockImplementation(reply)
      const nodeCount = await localVerdictThenModel()
      await vi.advanceTimersByTimeAsync(600)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const s = useReadinessStore.getState()
      expect(s.error).toMatch(error)
      expect(s.readiness).toBeNull()
      expect(gateFromStore(nodeCount).allowed).toBe(true)
    })
  })
})

describe('controls — what the fix must NOT change', () => {
  it('a genuine CEE can_run_analysis:false (fresh, no error) still blocks, in CEE’s own words', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(ceeBlockedResponse()))
    const nodeCount = await localVerdictThenModel()
    await vi.advanceTimersByTimeAsync(600)

    const s = useReadinessStore.getState()
    expect(s.error).toBeNull()
    expect(s.stale).toBe(false)
    expect(s.verdictAtMs).toEqual(expect.any(Number))
    const gate = gateFromStore(nodeCount)
    expect(gate.allowed).toBe(false)
    expect(gate.reason).toBe(CEE_REFUSAL)
  })

  it('a re-check genuinely IN FLIGHT (no error yet) keeps "checking again", then opens when it fails', async () => {
    let answer: (value: unknown) => void = () => {}
    mockFetch.mockImplementation(() => new Promise((resolve) => { answer = resolve }))
    const nodeCount = await localVerdictThenModel()
    await vi.advanceTimersByTimeAsync(600)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const inFlight = useReadinessStore.getState()
    expect(inFlight.loading).toBe(true)
    expect(inFlight.error).toBeNull()
    expect(inFlight.stale).toBe(true)
    const whileChecking = gateFromStore(nodeCount)
    expect(whileChecking.allowed).toBe(false)
    expect(whileChecking.reason).toBe(BLOCKED_REASON_COPY.staleRecheck)

    answer(statusResponse(503, 'Service Unavailable'))
    await vi.advanceTimersByTimeAsync(0)

    expect(useReadinessStore.getState().error).toMatch(/HTTP 503/)
    expect(gateFromStore(nodeCount).allowed).toBe(true)
  })

  it('a stale LOCAL verdict with no error is unchanged (the debounce window, before any request)', async () => {
    const nodeCount = await localVerdictThenModel()

    const s = useReadinessStore.getState()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(s.stale).toBe(true)
    expect(s.error).toBeNull()
    expect(s.readiness?.confidence_explanation).toBe('Add some nodes to get started')
    const gate = gateFromStore(nodeCount)
    expect(gate.allowed).toBe(false)
    expect(gate.reason).toBe(BLOCKED_REASON_COPY.staleRecheck)
  })

  it('a stale SERVER verdict with no error is unchanged', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(ceeBlockedResponse()))
    await localVerdictThenModel()
    await vi.advanceTimersByTimeAsync(600)
    const served = useReadinessStore.getState().readiness

    modelLands(4)
    const s = useReadinessStore.getState()
    expect(s.stale).toBe(true)
    expect(s.error).toBeNull()
    expect(s.readiness).toBe(served)
    const gate = gateFromStore(4)
    expect(gate.allowed).toBe(false)
    expect(gate.reason).toBe(BLOCKED_REASON_COPY.staleRecheck)
  })

  it('a SERVER verdict is still retained BY IDENTITY when its re-check fails — only a local one is dropped', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(ceeBlockedResponse()))
    await localVerdictThenModel()
    await vi.advanceTimersByTimeAsync(600)
    const served = useReadinessStore.getState().readiness
    const stamped = useReadinessStore.getState().verdictAtMs
    expect(served?.can_run_analysis).toBe(false)

    clearInflightCache()
    mockFetch.mockImplementation(() => Promise.resolve(statusResponse(503, 'Service Unavailable')))
    modelLands(4)
    await vi.advanceTimersByTimeAsync(600)

    const s = useReadinessStore.getState()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(s.error).toMatch(/HTTP 503/)
    expect(s.readiness).toBe(served)
    expect(s.verdictAtMs).toBe(stamped)
    // Still marked outgrown: a failure must not launder it into a current one.
    expect(s.stale).toBe(true)
    // "a stale verdict that blocks still blocks (its refusal is the last real
    // answer we have)" — the staleness rule, untouched for a real answer.
    expect(gateFromStore(4).allowed).toBe(false)
  })
})
