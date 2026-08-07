/**
 * T2b — the WRITE-PATH CALL SITE pin. This file exists because the lane's
 * other specs did not pin the thing the lane exists to fix.
 *
 * WHY THIS FILE EXISTS (read before deleting or weakening it):
 * PR #326 shipped as "receipts fail closed — no fabricated Seed values" and
 * was TRUE of the read path and FALSE on reload, because the write path still
 * fabricated. Its tests passed anyway. T2b then fixed the write path — and
 * repeated the same mistake: `useV2Run.seedPersistence.spec.ts` imports
 * `resolveSeedUsed` and exercises it as a PURE FUNCTION, while
 * `receipts-persistence-roundtrip.spec.tsx` RE-IMPLEMENTS the write leg by
 * hand. Neither invokes `useV2Run`. An adversarial audit proved the
 * consequence: re-introducing the exact fabricated `0` at the call site left
 * **595/595 tests green**.
 *
 * A fix whose own tests pass when you re-break it is not fixed — it is
 * unpinned. So these pins do the one thing the others don't: they MOUNT THE
 * REAL HOOK, drive a real successful run, and assert on what
 * `persistAnalysisSuccess` actually receives.
 *
 * MUTATION-CHECKED (the bar this lane is held to): reverting
 * `useV2Run.ts`'s call site to the pre-fix expression
 *
 *   const seedUsed = successResult.meta?.seed_used
 *     ? (parseInt(successResult.meta.seed_used, 10) || 0)
 *     : (seed ?? 0)
 *
 * turns tests 1, 2 and 3 below RED. Verify that before trusting them.
 *
 * The two sinks answer DIFFERENT questions and are pinned separately:
 *  - `seedUsed`   = the RECEIPT ("what did the engine say it used?") — must be
 *                   null when unknown; a real engine 0 must stay 0.
 *  - `seedForHash`= a RUN IDENTITY for the graph hash — falls back to the seed
 *                   we actually SENT. Ruled KEEP+LEDGER by the orchestrator on
 *                   the evidence that the persisted hash has ZERO readers, so
 *                   this leg is inert today; it is pinned so it stays
 *                   deliberate rather than becoming accidental.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useV2Run, type V2RunPersistence } from '../useV2Run'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'

vi.mock('../../../adapters/plot/v2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters/plot/v2')>()
  return { ...actual, executeV2RunWithAnalysisReady: vi.fn() }
})
vi.mock('../../../lib/resultsInstrumentation', () => ({
  trackRunCompleted: vi.fn(),
  trackRunFailed: vi.fn(),
  trackEmptyComputedResults: vi.fn(),
}))
vi.mock('../../../lib/telemetry', () => ({ trackTypedError: vi.fn() }))
vi.mock('../../../lib/gate-state', () => ({
  useGateStore: { getState: () => ({ setGate: vi.fn() }) },
  updateRobustnessGate: vi.fn(),
  updateRobustnessGateFromV2: vi.fn(),
}))

import { executeV2RunWithAnalysisReady } from '../../../adapters/plot/v2'
const mockExecute = executeV2RunWithAnalysisReady as Mock

/** A successful V2 run. `meta` is caller-controlled: that is the whole point. */
function successResponse(meta?: Record<string, unknown>) {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    option_comparison: [],
    response_hash: 'resp-hash-t2b',
    request_id: 'req-t2b',
    outcome: { mean: 100, p10: 80, p50: 100, p90: 120 },
    ...(meta ? { meta } : {}),
  }
}

function seedCanvas() {
  const baseResults = useCanvasStore.getState().results
  const nodes: any[] = [
    { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
    { id: 'fac-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    { id: 'opt-1', type: 'option', data: { label: 'Option A', kind: 'option', interventions: { 'fac-1': 0.5 } }, position: { x: 200, y: 0 } },
  ]
  useCanvasStore.setState({
    nodes,
    edges: [{ id: 'e1', source: 'goal-1', target: 'fac-1' }],
    outcomeNodeId: 'goal-1',
    ceeAnalysisReady: {
      goal_node_id: 'goal-1',
      status: 'ready',
      options: [{ id: 'opt-1', label: 'Option A', status: 'ready', interventions: { 'fac-1': 0.5 } }],
    },
    ceeAnalysisReadyNodeIds: nodes.map((n) => n.id),
    goalConstraints: null,
    goalThreshold: null,
    currentScenarioFraming: null,
    results: { ...baseResults, status: 'idle' },
  } as any)
  useDraftStore.getState().setLastDraftDescription('')
}

/**
 * A COMPLETE V2RunPersistence double, typed as the real interface rather
 * than cast through `unknown`.
 *
 * What that buys, stated honestly: a missing required member surfaces under
 * `tsc -p tsconfig.app.json` and in an editor. As of 2026-07-25 that IS the CI
 * gate — `pnpm run typecheck` compiles all of src (it previously used
 * tsconfig.ci.json, whose hand-written include list did not cover
 * src/canvas/hooks at all, so the type was a tripwire and not a guarantee).
 *
 * The REAL protection is the runtime guard inside seedPersistedFor: every test
 * routes through it, and it asserts persistAnalysisSuccess was actually called.
 * An incomplete double sends the hook down its error path => zero calls => the
 * guard fails loudly. That matters because it already happened: this double's
 * first draft omitted setAnalysisRunning and every pin passed vacuously.
 */
function makePersistence() {
  const persistAnalysisSuccess = vi.fn().mockResolvedValue(undefined)
  const persistence: V2RunPersistence = {
    setAnalysisRunning: vi.fn().mockResolvedValue(undefined),
    persistAnalysisSuccess,
    persistAnalysisFailure: vi.fn().mockResolvedValue(undefined),
    resetAnalysisStatus: vi.fn().mockResolvedValue(undefined),
  }
  return { persistence, persistAnalysisSuccess }
}

/** The seed argument as the REAL call site passed it (3rd positional arg). */
async function seedPersistedFor(meta?: Record<string, unknown>) {
  const { persistence, persistAnalysisSuccess } = makePersistence()
  mockExecute.mockResolvedValueOnce(successResponse(meta))
  const { result } = renderHook(() => useV2Run(persistence))
  await act(async () => {
    await result.current.runV2Analysis()
  })
  expect(persistAnalysisSuccess, 'the run must reach the persist call site').toHaveBeenCalledTimes(1)
  const [, graphHash, seedUsed] = persistAnalysisSuccess.mock.calls[0]
  return { seedUsed, graphHash }
}

beforeEach(() => {
  vi.clearAllMocks()
  seedCanvas()
})

describe('T2b — useV2Run persists an HONEST seed receipt (real call site)', () => {
  it('1. engine echoes NO seed → persists null, never a fabricated 0', async () => {
    // Pre-fix this took the `: (seed ?? 0)` branch and persisted a number the
    // engine never confirmed — which hydrateAnalysis then PREFERS, resurrecting
    // "Seed 0" on reload: #326's claim, false on its own target surface.
    const { seedUsed } = await seedPersistedFor(undefined)
    expect(seedUsed).toBeNull()
  })

  it('2. engine echoes a MALFORMED seed → persists null, never a fabricated 0', async () => {
    // Pre-fix: parseInt('abc', 10) → NaN → `|| 0` → 0. A lie with no author.
    const { seedUsed } = await seedPersistedFor({ seed_used: 'abc' })
    expect(seedUsed).toBeNull()
  })

  it('3. engine echoes a REAL 0 → persists 0, distinguishable from unknown', async () => {
    // The other half of the honesty claim, and the one a naive "just use ??"
    // fix breaks: pre-fix, the truthiness gate made a numeric 0 fall through to
    // the REQUESTED seed. 0 is a legitimate seed; unknown is not 0.
    const { seedUsed } = await seedPersistedFor({ seed_used: 0 })
    expect(seedUsed).toBe(0)
  })

  it('4. engine echoes a real seed → persists it verbatim', async () => {
    const { seedUsed } = await seedPersistedFor({ seed_used: '424242' })
    expect(seedUsed).toBe(424242)
  })

  it('5. the graph hash is still computed and persisted when the seed is unknown', async () => {
    // seedForHash falls back to the requested seed, so a hash is always
    // produced. Pinned as an identity (a non-empty string), NOT as a value:
    // asserting the digits would freeze a hash whose input this lane
    // deliberately changed, and which the orchestrator ruled KEEP+LEDGER
    // precisely because nothing reads it.
    const { graphHash, seedUsed } = await seedPersistedFor(undefined)
    expect(seedUsed).toBeNull()
    expect(typeof graphHash).toBe('string')
    expect(graphHash.length).toBeGreaterThan(0)
  })

  it('6. receipt and hash are INDEPENDENT — an unknown receipt does not suppress the hash', async () => {
    // The two sinks answer different questions; a regression that collapsed
    // them (e.g. persisting the hash's fallback seed as the receipt) would
    // reintroduce exactly the fabrication this lane removes.
    const unknown = await seedPersistedFor(undefined)
    const known = await seedPersistedFor({ seed_used: '424242' })
    expect(unknown.seedUsed).toBeNull()
    expect(known.seedUsed).toBe(424242)
    expect(typeof unknown.graphHash).toBe('string')
    expect(unknown.graphHash.length).toBeGreaterThan(0)
  })
})
