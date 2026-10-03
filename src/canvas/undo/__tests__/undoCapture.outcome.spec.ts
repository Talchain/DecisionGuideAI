/**
 * OUTCOME: a real turn through `useConversation` feeds the undo journal.
 *
 * The capture is one call inside `sendTurn`, and the gesture grouping rides one
 * forwarded option in `sendSystemEvent`. Both are "lines that must not be
 * forgotten" (see `useConversation.structuralAddOutcome.spec.ts`): delete either
 * and every unit test of the journal stays green. This file drives the REAL hook
 * with the network stubbed, using the schemas package's OWN receipt fixture so
 * the strict response parse admits it exactly as it admits CEE's bytes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { maximalModelVersionMutationReceiptCommittedMutation } from '@talchain/schemas/fixtures'

import { useConversation } from '../../conversation/useConversation'
import { useCanvasStore } from '../../store'
import type { StructuralAddIntent } from '../../mutations/structuralAdd'
import { useUndoJournalStore } from '../captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL, nextUndo } from '../undoJournal'

const mockCallTurn = vi.fn()
vi.mock('../../conversation/turnService', () => ({
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
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const NODE_ID = 'opt_raise_60'
const FACTOR_ID = 'fac_churn'
const LABEL = 'Raise to £60'
const BASE = 'cfded3af0aa14ebd'
const V0 = '00000000-0000-4000-8000-000000000000'
const V1 = '11111111-1111-4111-8111-111111111111'
const V2 = '22222222-2222-4222-8222-222222222222'

function receipt(versionId: string, undoVersionId: string, mutationId: string) {
  return {
    ...maximalModelVersionMutationReceiptCommittedMutation,
    mutation_id: mutationId,
    version_id: versionId,
    undo_version_id: undoVersionId,
    lineage: { ...(maximalModelVersionMutationReceiptCommittedMutation as { lineage: object }).lineage, parent_version_id: undoVersionId },
  }
}

function addIntent(): StructuralAddIntent {
  return { id: 'sa-1', nodeId: NODE_ID, nodeKind: 'option', label: LABEL, baseGraphHash: BASE }
}

function seed() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    structuralAddLifecycle: [{ intent: addIntent(), scenarioId: SCENARIO_ID, status: 'in_flight' }],
    pendingStructuralAdds: [],
    nodes: [
      { id: NODE_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: LABEL, kind: 'option' } },
      { id: FACTOR_ID, type: 'factor', position: { x: 200, y: 0 }, data: { label: 'Churn', kind: 'factor' } },
    ] as unknown as Node[],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

function stub200(withReceipt: ReturnType<typeof receipt> | null, graphHash: string) {
  const body: Record<string, unknown> = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: graphHash,
    draft_graph: {
      nodes: [
        { id: NODE_ID, kind: 'option', label: LABEL },
        { id: FACTOR_ID, kind: 'factor', label: 'Churn' },
      ],
      edges: [],
      node_count: 2,
      edge_count: 0,
    },
  }
  if (withReceipt) body.model_version_receipt = withReceipt
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response)),
  )
}

type Hook = ReturnType<typeof renderHook<ReturnType<typeof useConversation>, unknown>>['result']

async function send(result: Hook, event: unknown, opts: Record<string, unknown>) {
  await act(async () => {
    await result.current.sendSystemEvent(event as never, opts as never).catch(() => undefined)
  })
}

const addEvent = {
  type: 'structural_add',
  payload: { node_id: NODE_ID, node_kind: 'option', label: LABEL, base_graph_hash: BASE },
}
const linkEvent = {
  type: 'structural_add_edge',
  payload: { from: NODE_ID, to: FACTOR_ID, magnitude: 0.4, effect_direction: 'positive', base_graph_hash: 'bbbbbbbbbbbbbbbb' },
}

beforeEach(() => {
  vi.clearAllMocks()
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('a real canvas edit turn feeds the undo journal', () => {
  it('⭐ the committed add’s receipt becomes an undo step targeting its own pre-edit version', async () => {
    seed()
    const { result } = renderHook(() => useConversation())
    stub200(receipt(V1, V0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'bbbbbbbbbbbbbbbb')
    await send(result, addEvent, { structuralAdd: addIntent(), debugSource: 'canvas_add' })

    const next = nextUndo(useUndoJournalStore.getState().journal)
    expect(next.kind).toBe('restore')
    expect(next.kind === 'restore' && next.targetVersionId).toBe(V0)
    expect(useUndoJournalStore.getState().journal.scenarioId).toBe(SCENARIO_ID)
  })

  it('control: the same turn WITHOUT a receipt leaves the journal empty', async () => {
    seed()
    const { result } = renderHook(() => useConversation())
    stub200(null, 'bbbbbbbbbbbbbbbb')
    await send(result, addEvent, { structuralAdd: addIntent(), debugSource: 'canvas_add' })

    expect(nextUndo(useUndoJournalStore.getState().journal).kind).toBe('nothing')
  })

  it('⭐ "+ Add option" then its chained link is ONE step — sendSystemEvent forwards the gesture id', async () => {
    seed()
    const { result } = renderHook(() => useConversation())
    stub200(receipt(V1, V0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'bbbbbbbbbbbbbbbb')
    await send(result, addEvent, { structuralAdd: addIntent(), debugSource: 'canvas_add' })
    stub200(receipt(V2, V1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'cccccccccccccccc')
    await send(result, linkEvent, { debugSource: 'canvas_add_edge', undoGestureId: 'sa-1' })

    const journal = useUndoJournalStore.getState().journal
    expect(journal.undo).toHaveLength(1)
    const next = nextUndo(journal)
    expect(next.kind === 'restore' && next.targetVersionId).toBe(V0)
  })
})
