/**
 * THE JOURNEY #1893 OPENS — a fresh example with NO chat turn: register ack →
 * write base seeded from CEE's read → the first option edit is dispatched on
 * that base → its APPLIED receipt acknowledges the model, so NO post-settle
 * whole-graph registration follows (#1895 composed with #1893).
 *
 * Before #1893 no base existed on this path (the ack carries no `graph_hash` and
 * no turn had stamped one), so the first edit was refused for want of a base.
 * This pins the composed journey through the REAL dispatcher (`useConversation`)
 * and the REAL registration hook; only the transports are doubles:
 * `registerScenarioGraph` and `fetchScenarioGraph` are spies, `callV5Turn` replays
 * a scripted receipt. Harness from `oneWriterRegistration.spec.tsx`; adopted from
 * the Panel reviewer's probe on #1893.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { __resetCeeHeldModelLatchForTest } from '../ceeHeldModel'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { analysisHeldOn } from '../../utils/analysisHeldOnInjectedModel'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import type { WireSystemEvent } from '../../conversation/types'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

// ── The hold's run-path conjunct is FALSE by default under test (trap 13b) ──
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => true }
})

// ── The registration and read seams: spies, so every call is observable by identity ──
const registerSpy = vi.fn()
vi.mock('../../../adapters/cee/registerScenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/registerScenarioGraph')>()),
  registerScenarioGraph: (...args: unknown[]) => registerSpy(...args),
}))
const readSpy = vi.fn()
vi.mock('../../../adapters/cee/scenarioGraph', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../adapters/cee/scenarioGraph')>()),
  fetchScenarioGraph: (...args: unknown[]) => readSpy(...args),
}))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
// Same factory as `oneWriterRegistration.spec` — the real module throws at
// import without Supabase env, which the dispatcher pulls in.
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

// ── The edit seam: the TRANSPORT is mocked, the dispatcher is REAL ──────────
const dispatched: Array<Record<string, unknown>> = []
const replies: unknown[] = []
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      return replies.shift() ?? { ok: true, response: { assistant_text: 'ok', blocks: [] } }
    }),
  }
})
// Deterministic buffered fallback (see useConversation.deferredSystemSends.spec).
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useImportRegistration } from '../useImportRegistration'
import { useConversation } from '../../conversation/useConversation'

// ── Fixtures — the witnessed board's shape (pricing starter, guest) ─────────
const SCENARIO = '9fc5c6bf-0d04-4dd4-89db-bb6470a98fc5'
const TARGET = 'fac_adoption_friction'
const BYSTANDER = 'fac_seat_price'
/** What the server holds at open: Olumi's own estimate. */
const SERVER_VALUE = 0.8
function starterFactor(id: string, label: string, value: number, display: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'controllable',
      starterId: 'pricing-model',
      provenance: 'ai_inferred',
      display_value: display,
      observedState: {
        value,
        source: 'cee_inference',
        extractionType: 'inferred',
        factor_type: 'other',
      },
    },
  } as unknown as Node
}

const STARTER_NODES: Node[] = [
  starterFactor(TARGET, 'Bottom-Up Adoption Friction', SERVER_VALUE, 'Very high (0.8)'),
  starterFactor(BYSTANDER, 'Seat Price', 0.4, 'Moderate (0.4)'),
]
const STARTER_EDGES: Edge[] = [
  {
    id: `e_${TARGET}_${BYSTANDER}`,
    source: TARGET,
    target: BYSTANDER,
    data: { weight: 0.6, direction: 'negative' },
  } as unknown as Edge,
]

const ACK = {
  status: 'registered' as const,
  identity: { value: 'id_abc', projectionVersion: 'identity.v1' },
  nodeCount: 2,
  edgeCount: 1,
  requestId: 'req_register',
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  registerSpy.mockReset()
  registerSpy.mockResolvedValue(ACK)
  readSpy.mockReset()
  dispatched.length = 0
  replies.length = 0
  clearImportRegistrationMarkers()
  // OW-1: the one-writer latch is page-life state keyed by scenario; each case is a fresh page.
  __resetCeeHeldModelLatchForTest()
  __resetPendingFactorEditsForTest()
  __resetPersistenceSessionForTests()
  useCanvasStore.setState({
    nodes: [] as never,
    edges: [] as never,
    currentScenarioId: null,
    importPendingServerRegistration: false,
    pendingStructuralRenames: [],
  } as never)
})

afterEach(async () => {
  await flush()
  vi.unstubAllEnvs()
  __resetPersistenceSessionForTests()
})

const OPTION = 'opt_hybrid'
function starterOption(): Node {
  return {
    id: OPTION, type: 'option', position: { x: 0, y: 200 },
    data: {
      label: 'Hybrid Platform Fee Plus Usage', kind: 'option', starterId: 'pricing-model', provenance: 'ai_inferred', is_baseline: false,
      interventions: { [TARGET]: { value: 0.4, source: 'brief_extraction', display_value: 'Moderate (0.4)' } },
      interventionKeys: [TARGET],
    },
  } as unknown as Node
}
const APPLIED_OPTION = (value: number) => ({
  ok: true,
  response: {
    assistant_text: `Set Hybrid Platform Fee Plus Usage's Bottom-Up Adoption Friction to ${value}.`,
    blocks: [], graph_hash: 'aag_after_option_edit',
    draft_graph: {
      nodes: [
        { id: TARGET, kind: 'factor', label: 'Bottom-Up Adoption Friction', category: 'controllable', observed_state: { value: SERVER_VALUE, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' } },
        { id: BYSTANDER, kind: 'factor', label: 'Seat Price', category: 'controllable', observed_state: { value: 0.4, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' } },
        { id: OPTION, kind: 'option', label: 'Hybrid Platform Fee Plus Usage', is_baseline: false,
          interventions: { [TARGET]: { value, source: 'user_specified', target_match: { node_id: TARGET, confidence: 'high', match_type: 'exact_id' } } } },
      ],
      edges: [{ id: `${TARGET}::${BYSTANDER}::0`, from: TARGET, to: BYSTANDER, strength: { mean: -0.6 } }],
    },
  },
})
const SEEDED = 'aag_seeded_by_read'

describe('JOURNEY #1893 x #1895 — fresh example, NO chat turn: register ack -> seed -> first option edit applied -> no post-settle registration', { timeout: 30_000 }, () => {
  it('the first option edit carries the SEEDED base, and its applied receipt acknowledges (registerSpy stays at 1)', async () => {
    readSpy.mockResolvedValue({
      status: 'graph', graph: { nodes: [], edges: [] }, briefText: null, notModelled: null,
      identity: ACK.identity, graphHash: SEEDED, layoutPresent: false, analysisState: null, analysisResult: null, requestId: 'req_read',
    })
    useCanvasStore.setState({
      currentScenarioId: SCENARIO,
      nodes: [...STARTER_NODES, starterOption()] as never,
      edges: STARTER_EDGES as never,
      importPendingServerRegistration: true,
      results: { status: 'idle' } as never,
      analysisFreshnessDirty: false,
      pendingEmittedEdits: 0,
      lastServerGraphHash: null,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
    const hook = renderHook(() => { useImportRegistration(); return useConversation() })
    await act(async () => { await flush() })
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(readSpy.mock.calls[0]![0]).toBe(SCENARIO)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(SEEDED)
    expect(analysisHeldOn(useCanvasStore.getState() as never)).toBeNull()

    const base = useCanvasStore.getState().lastServerGraphHash!
    replies.push(APPLIED_OPTION(0.25))
    await act(async () => {
      await hook.result.current.sendSystemEvent({
        type: 'option_intervention_edit',
        payload: { option_id: OPTION, factor_id: TARGET, value: 0.25, base_graph_hash: base },
      } as WireSystemEvent).catch(() => undefined)
      await flush()
    })
    const turn = dispatched.find((d) => JSON.stringify(d).includes('option_intervention_edit'))
    expect(turn, 'the option edit was dispatched').toBeDefined()
    expect(JSON.stringify(turn)).toContain(SEEDED)
    expect(registerSpy, 'no post-settle whole-graph registration').toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe('aag_after_option_edit')
  })
})
