/**
 * Refusal fixture: CEE src/orchestrator-v5/system-events/structural-rename.ts:239-257
 * refuse() returns assistant_text, blocks: [], and NO draft_graph;
 * dispatch.ts:3916-3917 returns it (CODEX-BRIEF.md, staging rebuild of #1884).
 * The real turn adapter/parser/router and scenario-graph reader are exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useStructuralRenameEvents } from '../useStructuralRenameEvents'
import { __resetHeldCanvasNoticesForTests, takeHeldCanvasNotices } from '../../utils/heldCanvasNotices'
import { useCanvasStore } from '../../store'
import {
  STRUCTURAL_RENAME_NOTICE,
  type StructuralRenameIntent,
} from '../../mutations/structuralRename'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(msg: string, status: number, body: unknown) {
      super(msg)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

// `importOriginal`-spread rather than a hand-listed factory: a `vi.mock` factory
// REPLACES the module, so every flag not listed would silently vanish (trap 12).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})


const SID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const OTHER_SID = 'b0b0b0b0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const ID = 'opt_hybrid'
const SIBLING = 'opt_sibling'
const OLD = 'Hybrid platform fee plus usage'
const NEW = 'Hybrid Platform Fee Plus Usage RT'
const HASH = 'cfded3af0aa14ebd'
const REFUSAL = 'That kind of change does not come through this conversation route. Nothing has been changed.'
const intent: StructuralRenameIntent = {
  id: 'readback-rename', nodeId: ID, label: NEW, expectedLabel: OLD, baseGraphHash: HASH,
  restore: { label: OLD, provenanceWasPresent: true, provenance: 'ai_inferred' },
}

function seed(scenarioId = SID) {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    structuralRenameLifecycle: [{ intent, scenarioId: SID, status: 'in_flight' }],
    pendingStructuralRenames: [],
    nodes: [ID, SIBLING].map((id, index) => ({
      id, type: 'option', position: { x: index * 200, y: 0 },
      data: { label: NEW, kind: 'option', provenance: 'ai_inferred' },
    })) as Node[],
    edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
}
function json(body: unknown, status = 200): Response {
  return {
    ok: status === 200, status, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body),
  } as Response
}
function graph(label: string | null) {
  return { nodes: [
    { id: SIBLING, kind: 'option', label: NEW },
    ...(label === null ? [] : [{ id: ID, kind: 'option', label }]),
  ], edges: [] }
}
function graphResponse(label: string | null, scenarioId = SID) {
  return json({ schema: 'scenario_graph.v1', scenario_id: scenarioId,
    graph_present: true, graph: graph(label), graph_hash: HASH })
}
let read: Mock<[RequestInit], Response | Promise<Response>>
function wire(reader: (init: RequestInit) => Response | Promise<Response>, draft?: unknown) {
  read = vi.fn(reader)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/graph')) return read(init)
    return json({ response_version: 2, assistant_text: REFUSAL, blocks: [],
      suggested_actions: [], insights: [], stage_indicator: 'frame', graph_hash: HASH,
      ...(draft === undefined ? {} : { draft_graph: draft }),
    })
  }))
}
async function drive(advanceDeadline = false) {
  const hook = renderHook(() => useConversation())
  await act(async () => {
    const sending = hook.result.current.sendSystemEvent({ type: 'structural_rename', payload: {
      node_id: ID, label: NEW, expected_label: OLD, base_graph_hash: HASH,
    } } as never, { structuralRename: intent, debugSource: 'canvas_rename' })
    if (advanceDeadline) await vi.advanceTimersByTimeAsync(8001)
    await sending
  })
  return hook
}
function label(id = ID) { return useCanvasStore.getState().nodes.find(n => n.id === id)?.data.label }
function verdict() { return useCanvasStore.getState().structuralRenameLifecycle.find(r => r.intent.id === intent.id)?.status }
function notices(hook: Awaited<ReturnType<typeof drive>>) {
  return hook.result.current.messages.filter(m => m.role === 'assistant' && m.synthetic).map(m => m.content)
}
function unchanged(hook: Awaited<ReturnType<typeof drive>>) {
  expect(label(ID)).toBe(NEW)
  expect(label(SIBLING)).toBe(NEW)
  expect(verdict()).toBe('unconfirmed')
  expect(notices(hook)).toContain(STRUCTURAL_RENAME_NOTICE.unconfirmed_server)
  expect(read).toHaveBeenCalledTimes(1)
}
beforeEach(() => { seed(); vi.clearAllMocks(); __resetHeldCanvasNoticesForTests() })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('graphless rename reply settles against one persisted graph read', () => {
  it('row 1: OLD label restores only the named node, retains CEE words and adds no notice', async () => {
    wire(() => graphResponse(OLD))
    const hook = await drive()
    expect(label(ID)).toBe(OLD)
    expect(label(SIBLING)).toBe(NEW)
    expect(verdict()).toBe('refused')
    expect(hook.result.current.messages.filter(m => m.role === 'assistant' && !m.synthetic).map(m => m.content)).toContain(REFUSAL)
    expect(notices(hook)).toEqual([])
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('row 2: NEW label is committed, without an unconfirmed notice', async () => {
    wire(() => graphResponse(NEW))
    const hook = await drive()
    expect(label(ID)).toBe(NEW)
    expect(label(SIBLING)).toBe(NEW)
    expect(verdict()).toBe('committed')
    expect(notices(hook)).toEqual([])
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('row 3: a rejected read keeps the name and the existing unconfirmed notice', async () => {
    wire(() => Promise.reject(new Error('offline')))
    unchanged(await drive())
  })
  it('row 3: a timed-out read keeps the name and the existing unconfirmed notice', async () => {
    // A real transport listens to AbortSignal; no test implementation of settlement.
    wire(init => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError')), { once: true })
    }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    unchanged(await drive(true))
  })
  it('row 3: stalled response parsing is also bounded, even after fetch resolves', async () => {
    wire(() => ({ ...graphResponse(OLD), json: () => new Promise(() => {}) } as Response))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    unchanged(await drive(true))
  })
  it('row 3: a 503 is read ONCE, never retried', async () => {
    wire(() => json({}, 503))
    unchanged(await drive())
  })
  it('row 4: an absent node is unconfirmed; no node is deleted or renamed', async () => {
    wire(() => graphResponse(null))
    const hook = await drive()
    unchanged(hook)
    expect(useCanvasStore.getState().nodes.map(n => n.id)).toEqual([ID, SIBLING])
  })
  it('row 5: switching scenarios during the read does not write either scenario', async () => {
    const apply = vi.spyOn(useCanvasStore.getState(), 'applyStructuralRenameRevert')
    const settle = vi.spyOn(useCanvasStore.getState(), 'settleStructuralRename')
    wire(() => { seed(OTHER_SID); return graphResponse(OLD) })
    const hook = await drive()
    expect(read).toHaveBeenCalledTimes(1)
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER_SID)
    expect(label(ID)).toBe(NEW)
    expect(label(SIBLING)).toBe(NEW)
    expect(apply).not.toHaveBeenCalled()
    expect(settle).not.toHaveBeenCalled()
    expect(notices(hook)).toEqual([])
  })
  it('row 6: a draft_graph reply uses the existing receipt path and NEVER reads back', async () => {
    wire(() => graphResponse(OLD), { ...graph(NEW), node_count: 2, edge_count: 0 })
    const hook = await drive()
    expect(label(ID)).toBe(NEW)
    expect(label(SIBLING)).toBe(NEW)
    expect(verdict()).toBe('committed')
    expect(notices(hook)).toEqual([])
    expect(read).toHaveBeenCalledTimes(0)
  })
  it('a malformed inline graph stays on the existing unproven path, without a readback', async () => {
    wire(() => graphResponse(OLD), { nodes: 'malformed', edges: [], node_count: 0, edge_count: 0 })
    // The parser may reject this malformed receipt before settlement. Neither path reads back.
    await drive().catch(() => undefined)
    expect(label(ID)).toBe(NEW)
    expect(read).not.toHaveBeenCalled()
  })
  it.each([OLD, NEW])('the real queued emitter awaits a readback at %s before its fallback notice', async savedLabel => {
    wire(() => graphResponse(savedLabel))
    useCanvasStore.setState({ lastServerGraphHash: HASH, structuralRenameLifecycle: [] })
    const hook = renderHook(() => {
      const conversation = useConversation()
      useStructuralRenameEvents(conversation.sendSystemEvent)
      return conversation
    })
    act(() => { useCanvasStore.setState({ pendingStructuralRenames: [intent] }) })
    await waitFor(() => expect(verdict()).toBe(savedLabel === NEW ? 'committed' : 'refused'))
    await act(async () => { await Promise.resolve() })
    expect(label(ID)).toBe(savedLabel)
    expect(label(SIBLING)).toBe(NEW)
    expect(read).toHaveBeenCalledTimes(1)
    expect(notices(hook)).toEqual([])
    expect(takeHeldCanvasNotices()).toEqual([])
  })
  it('a third persisted label is restored exactly, rather than guessing the captured old label', async () => {
    wire(() => graphResponse('Hybrid (renamed elsewhere)'))
    const hook = await drive()
    expect(label(ID)).toBe('Hybrid (renamed elsewhere)')
    expect(label(SIBLING)).toBe(NEW)
    expect(verdict()).toBe('refused')
    expect(notices(hook)).toEqual([])
  })
  it('a newer local rename during the read is preserved', async () => {
    wire(() => {
      useCanvasStore.setState(s => ({ nodes: s.nodes.map(n => n.id === ID ? { ...n, data: { ...n.data, label: 'Later typing' } } : n) }))
      return graphResponse(OLD)
    })
    await drive()
    expect(label(ID)).toBe('Later typing')
    expect(label(SIBLING)).toBe(NEW)
  })
  it('a read naming another scenario is unusable, even with the same node id', async () => {
    wire(() => graphResponse(OLD, OTHER_SID))
    unchanged(await drive())
  })
})
