/**
 * Reload persistence — the analysis answer survives reload (journey step 8).
 *
 * The RED this pins: a conversation-driven analysis is DISPLAYED in-session
 * (store.resultsComplete) but was never written to the scenario row's analysis
 * columns, so on the next page load loadScenario found analysis_status !==
 * 'ready' and the user's answer was gone — while the graph (autosaved on its
 * own subscription) survived. The standalone Run path already persisted via
 * persistAnalysisSuccess → storeAnalysis; the conversation path (the actual
 * journey) did not.
 *
 * These tests exercise handleEnvelope through the real useConversation hook and
 * assert the WRITE half of the roundtrip: a successful conversation analysis
 * persists the same V2RunResponse through the same store_analysis_and_log RPC
 * the Run path uses (scenarioService.storeAnalysis). The READ half — that
 * hydrateAnalysisFromV2Response reads it back with honest seed provenance and
 * 'unknown' freshness — is pinned by receipts-persistence-roundtrip.spec.tsx
 * and analysisFreshness restore tests; together they close the loop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks (mirror envelopeAnalysisWiring.spec.ts so the two suites move together)
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))

vi.mock('../../../adapters/plot/v2', () => ({
  isSuccessfulAnalysis: (r: unknown) => {
    const res = r as Record<string, unknown>
    return res.analysis_status === 'computed' || res.analysis_status === 'partial'
  },
  isBlockedResponse: (r: unknown) => (r as any).analysis_status === 'blocked',
  isFailedAnalysis: (r: unknown) => (r as any).analysis_status === 'failed',
  validateV2RunResponseFull: () => ({ softWarnings: [] }),
  sanitizeV2RunResponse: (r: unknown) => r, // identity pass-through
  reconcileOptionsWithCanvasNodes: (analysisReady: any) =>
    Array.isArray(analysisReady?.options) ? analysisReady.options : [],
}))

vi.mock('../../../adapters/plot/v2/responseMapper', () => ({
  mapV2ResponseToReportV1: vi.fn(() => ({ id: 'mock-report', graph_quality: null })),
  createEnrichmentFromV2Response: () => null,
  synthesizeCeeReviewFromV2: () => null,
  synthesizeCeeTraceFromV2: () => null,
}))

// The unit under test: the conversation analysis path must persist through the
// SAME service call the Run path uses. Spy on it; identity for loadScenario so
// unrelated imports stay intact.
const { mockStoreAnalysis } = vi.hoisted(() => ({
  mockStoreAnalysis: vi.fn(async () => undefined),
}))
vi.mock('../../../services/scenarioService', () => ({
  storeAnalysis: (...args: unknown[]) => mockStoreAnalysis(...args),
  loadScenario: vi.fn(async () => null),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeV2Response(
  hash = 'hash-abc',
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [],
    critiques: [],
    response_hash: hash,
    ...extra,
  }
}

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Pin the V5-orchestrator flag OFF for this spec (see envelopeAnalysisWiring
  // .spec.ts / PR #460 for the full rationale). These tests exercise
  // `handleEnvelope` on the legacy V4 turn path (`callOrchestratorTurn`, mocked
  // above) to assert the analysis is persisted via `scenarioService.storeAnalysis`.
  // `sendTurn` branches FIRST on
  // `isV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR })`: when the
  // flag is 'true' every turn routes to the V5 exclusive path (`callV5Turn`)
  // which this spec does NOT mock — the real fetch throws, the turn is classed a
  // transport failure, and handleEnvelope never runs (storeAnalysis sees 0
  // calls, and the negative-assertion tests pass for the WRONG reason). CI
  // leaves the flag undefined (→ V4 → green); a fresh-clone lane that copies
  // `.env.local` (which sets VITE_ENABLE_V5_ORCHESTRATOR=true) gets the V5 path →
  // red. Pinning it here makes the intended V4 path deterministic; afterEach
  // restores via unstubAllEnvs so nothing leaks to siblings.
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'false')
  vi.useFakeTimers()
  mockCallTurn.mockReset()
  mockStoreAnalysis.mockClear()

  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [],
    edges: [],
    results: { status: 'idle', hash: undefined } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    resultsComplete: vi.fn(),
    resultsError: vi.fn(),
  } as any)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reload persistence — conversation analysis is written to the scenario row', () => {
  it('persists the analysis via storeAnalysis when the envelope carries a fresh analysis_response', async () => {
    const v2Response = makeV2Response('hash-journey', { meta: { seed_used: '1337' } })
    mockCallTurn.mockResolvedValue({
      client_turn_id: 'turn-42',
      assistant_text: 'Here is your answer.',
      analysis_response: v2Response,
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Which option should I pick?')
    })

    // WRITE half of the roundtrip: without this the answer is gone on reload.
    expect(mockStoreAnalysis).toHaveBeenCalledTimes(1)
    const [scenarioId, analysis, , seedUsed, responseHash] = mockStoreAnalysis.mock.calls[0]
    expect(scenarioId).toBe(SCENARIO_ID)
    expect((analysis as { response_hash?: string }).response_hash).toBe('hash-journey')
    expect(responseHash).toBe('hash-journey')
    // Honest seed provenance — the engine echo, parsed null-safe (never 0).
    expect(seedUsed).toBe(1337)
  })

  it('passes an HONEST null seed (never a fabricated 0) when the engine echoes no seed', async () => {
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Answer.',
      analysis_response: makeV2Response('hash-no-seed'), // no meta.seed_used
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run it')
    })

    expect(mockStoreAnalysis).toHaveBeenCalledTimes(1)
    const seedUsed = mockStoreAnalysis.mock.calls[0][3]
    expect(seedUsed).toBeNull()
    expect(seedUsed).not.toBe(0)
  })

  it('does NOT persist on a non-analysis turn (no analysis_response)', async () => {
    mockCallTurn.mockResolvedValue({ assistant_text: 'Sure, updating the graph.' })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Add a risk node')
    })

    expect(mockStoreAnalysis).not.toHaveBeenCalled()
  })

  it('does NOT persist a duplicate (response_hash already in the store)', async () => {
    useCanvasStore.setState({ results: { status: 'complete', hash: 'hash-dup' } as any })
    mockCallTurn.mockResolvedValue({
      assistant_text: 'Same answer.',
      analysis_response: makeV2Response('hash-dup'),
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('run again')
    })

    expect(mockStoreAnalysis).not.toHaveBeenCalled()
  })
})
