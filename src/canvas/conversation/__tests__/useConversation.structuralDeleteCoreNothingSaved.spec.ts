/**
 * ⭐ A CORE REFUSAL THAT SAVED NOTHING PUTS THE CANVAS BACK (U-W5 PR 2, 27 Oct). Served on staging (UI 8f2bdd65, CEE
 * 591a073b, board 5651fd74): a canvas `structural_delete` on a program model is answered 409 `CANVAS_EDIT_REFUSED` with
 * `nothing_saved: true` (core-turn.ts:376-405, before any AI call). The UI read only the GRAPH_DIVERGED conflict
 * categories as a no-write guarantee, so this one fell to the cannot-confirm line: "It's still gone from the canvas,
 * but it may come back when you reload", and the card did come back on reload. The core route's own guarantee now
 * restores the canvas, whatever refused, with CEE's words for why.
 *
 * Real path: the same harness as `useConversation.structuralDeleteConflictCategory.spec.ts` (the V5 adapter, parser and
 * router stay real; `fetch` stubbed), on the core route (`?ai=core-route`, staging's default), with the 409 body as served
 * in step 0 (`outbox/vision-ab/uw5-program-delete/STEP0.md`; `model.graph` and `analysis_state` dropped, the rest
 * verbatim). The contrasts: the same body with `nothing_saved: false`, and a non-core lane.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import {
  STRUCTURAL_DELETE_NOTICE,
  type StructuralDeleteIntent,
} from '../../mutations/structuralDelete'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// (Same harness discipline as useConversation.fence409Honesty.spec.ts.)
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

// `sendSystemEvent` short-circuits to SEND_BLOCKED unless orchestrator V2 is on
// (`useConversation.ts:6403`), and the flag has no default in `flags.ts`.
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const DELETED_NODE_ID = 'option-expand-eu'
const BASE_GRAPH_HASH = 'cfded3af0aa14ebd'

/** The element the user deleted, verbatim, as the intent's revert evidence. */
const DELETED_NODE = {
  id: DELETED_NODE_ID,
  type: 'option',
  position: { x: 120, y: 240 },
  data: { label: 'Expand into the EU' },
} as unknown as Node

const SURVIVING_NODE = {
  id: 'goal-revenue',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Grow revenue' },
} as unknown as Node

function deleteIntent(): StructuralDeleteIntent {
  return {
    id: 'sd-1',
    removedNodeIds: [DELETED_NODE_ID],
    removedEdges: [],
    baseGraphHash: BASE_GRAPH_HASH,
    claimedNodeIds: [DELETED_NODE_ID],
    claimedEdgeIds: [],
    restore: { nodes: [DELETED_NODE], edges: [] as readonly Edge[] },
  } as StructuralDeleteIntent
}

/** The served 409 body (step 0, 27 Oct), `model.graph` and `analysis_state` dropped. */
const REFUSAL_WORDS = "Only a figure on a card or a goal's target can be edited here on this model; ask Olumi in the chat for other changes."
function served409(nothingSaved = true) {
  return {
    turn_id: '72095148-a70c-495c-9103-ae4438fddd66',
    durability: 'not_recorded',
    assistant_text: '',
    model: { revision: BASE_GRAPH_HASH, scenario_revision: '3531490bd3317fe51d5c4a95d3677617331f26ade675a4c07dd3afd70c91e085' },
    cards: [], notes: [], run: null,
    model_program: { turn: 'card_edit', saved: false },
    receipts: [], paused: null,
    error: { code: 'CANVAS_EDIT_REFUSED', message: REFUSAL_WORDS, retry_safe: false, nothing_saved: nothingSaved },
    action_bar: null,
    _agent: { forwarded_kind: 'system_event', program: true },
  }
}

async function driveDelete(body: unknown, href: string) {
  window.history.replaceState(null, '', href)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith(`/scenarios/${SCENARIO_ID}/graph`) ? ({
    ok: true, status: 200, json: async () => ({ schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true,
      graph: { nodes: [{ id: DELETED_NODE_ID, kind: 'option', label: 'Expand into the EU' }, { id: SURVIVING_NODE.id, kind: 'goal', label: 'Grow revenue' }], edges: [] } }),
  } as Response) : ({
    ok: false, status: 409, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body, text: async () => JSON.stringify(body),
  } as unknown as Response)))
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    // Post-optimistic-delete state: the option is gone, the goal remains.
    nodes: [SURVIVING_NODE], edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current.sendSystemEvent(
      { type: 'structural_delete', payload: { summary: 'Deleted 1 element', base_graph_hash: BASE_GRAPH_HASH, removed_node_ids: [DELETED_NODE_ID], removed_edges: [] } } as never,
      { structuralDelete: deleteIntent(), debugSource: 'canvas_delete' },
    ).catch(() => undefined)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return {
    nodeIds: useCanvasStore.getState().nodes.map((n) => n.id),
    notices: result.current.messages.filter((m) => m.role === 'assistant' && m.synthetic === true).map((m) => m.content),
  }
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); window.history.replaceState(null, '', '/') })

describe('a core refusal with nothing saved restores the canvas', () => {
  it('the served program refusal (409 CANVAS_EDIT_REFUSED, nothing_saved): the option is back, and the notice says so in CEE\'s words', async () => {
    const { nodeIds, notices } = await driveDelete(served409(), '/?ai=core-route')
    expect(nodeIds).toContain(DELETED_NODE_ID)
    expect(nodeIds).toContain(SURVIVING_NODE.id)
    expect(notices).toEqual([`${STRUCTURAL_DELETE_NOTICE.refused_nothing_saved} ${REFUSAL_WORDS}`])
  })
})

describe('CONTRAST: without that guarantee the deletion stays an honest unknown', () => {
  it('the same refusal with nothing_saved: false: still gone, the cannot-confirm line', async () => {
    const { nodeIds, notices } = await driveDelete(served409(false), '/?ai=core-route')
    expect(nodeIds).not.toContain(DELETED_NODE_ID)
    expect(notices).toEqual([STRUCTURAL_DELETE_NOTICE.unconfirmed_server])
  })

  it('off the core lane, a body that is not the core contract is not read as one', async () => {
    const { nodeIds, notices } = await driveDelete({ error: 'SOMETHING', nothing_saved: true }, '/?ai=conventional')
    expect(nodeIds).not.toContain(DELETED_NODE_ID)
    expect(notices).toEqual([STRUCTURAL_DELETE_NOTICE.unconfirmed_server])
  })
})
