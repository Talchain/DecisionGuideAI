/**
 * ⭐ A PROGRAM BOARD'S SAVED FIGURE EDIT IS NEVER "COULDN'T GENERATE A RESPONSE" (Paul's manual test, 28 Oct, scenario
 * d85bff9f, CEE 6908a644 · UI 6e2a6b4c). He gave a figure on a card; CEE saved it (`/graph/register`, then core-turn 200 in
 * 4.6 s with no AI call) and answered as `core-turn.ts:347-390` answers every program canvas figure edit: `durability:
 * 'recorded'`, the person's receipt, the saved model, blank text and `analysis_state: null`. The #2873 quiet acknowledgement
 * required a legacy analysis state, which a program never carries, so the chat said "I received your message but couldn't
 * generate a response. Try rephrasing." about a figure that was saved. A core turn's own save receipt is now its proof (C8).
 *
 * Real path: the harness of `useConversation.structuralDeleteCoreNothingSaved.spec.ts` (adapter, parser and router real,
 * `fetch` stubbed) on the core route. Contrast: the same body with no receipt keeps the empty-reply failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'

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

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

const SCENARIO_ID = 'd85bff9f-4200-4cbf-99ff-42cd4e4431c1'
const EDITED = 'current_engineering_time'
const SAVED_HASH = 'aa3a8fa8e58c5e5aa42c218d7528a689'
const FIGURE_NODE = { id: EDITED, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Remaining implementation time with the current team' } } as unknown as Node

/** CEE's 200 for a saved program figure edit (`core-turn.ts:374-385`): blank text, the person's receipt, no analysis state. */
function savedEdit(receipts: readonly Record<string, unknown>[]) {
  return {
    turn_id: 'f50c2f09-301f-422b-9279-de41254dddc3',
    durability: receipts.length > 0 ? 'recorded' : 'unknown',
    assistant_text: '',
    model: {
      revision: SAVED_HASH,
      scenario_revision: 'ea146ebb2e8919f2a845ae0f84ec9bd97e733163d50d9bb85afee117a1474104',
      graph: { nodes: [{ id: EDITED, kind: 'factor', label: 'Remaining implementation time with the current team', display_value: '2 month' }], edges: [] },
    },
    cards: [], notes: [], run: null, analysis_state: null,
    model_program: { turn: 'card_edit', saved: receipts.length > 0 },
    receipts, paused: null, error: null, action_bar: null,
    _agent: { forwarded_kind: 'system_event', program: true },
  }
}
const PERSON_RECEIPT = { version: 4, version_id: '0f6f3c51-5d0b-4cf6-8a2c-6d1c3c1f9b10', mutation_id: 'aa3a8fa8-e58c-5e5a-a42c-218d7528a689',
  source_turn_id: 'graph_registration:009ab64c-1530-445a-a0a8-f886d7aaccaa', authorised_by: 'person' }
const EMPTY_REPLY = "I received your message but couldn't generate a response. Try rephrasing."

async function driveEdit(body: unknown) {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith(`/scenarios/${SCENARIO_ID}/graph`) ? ({
    ok: true, status: 200, json: async () => ({ schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true,
      graph: { nodes: [{ id: EDITED, kind: 'factor', label: 'Remaining implementation time with the current team' }], edges: [] } }),
  } as Response) : ({
    ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body),
  } as unknown as Response)))
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [FIGURE_NODE], edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current.sendSystemEvent(
      { type: 'factor_value_edit', payload: { target_id: EDITED, value: 2, raw_value: 2, unit: 'month' } } as never,
      { debugSource: 'canvas_figure_edit' } as never,
    ).catch(() => undefined)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return { contents: result.current.messages.filter((m) => m.role === 'assistant').map((m) => m.content) }
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); window.history.replaceState(null, '', '/') })

describe('a saved program figure edit is not reported as a failure', () => {
  it('CEE\'s 200 with the person\'s receipt and blank text: no "couldn\'t generate a response"', async () => {
    const { contents } = await driveEdit(savedEdit([PERSON_RECEIPT]))
    expect(contents).not.toContain(EMPTY_REPLY)
  })
})

describe('CONTRAST: a blank reply with no save receipt keeps its failure', () => {
  it('the same body with no receipt still says the reply did not come', async () => {
    const { contents } = await driveEdit(savedEdit([]))
    expect(contents).toContain(EMPTY_REPLY)
  })
})
