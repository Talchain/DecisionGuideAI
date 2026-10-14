/**
 * ⭐ A GUEST'S COMMITTED CANVAS EDIT IS ANALYSED (served witness 2026-10-14T174333Z, turn #3).
 *
 * A guest has no versions, so CEE's reply to a committed canvas edit carries no `model_version_receipt`. #2767's
 * auto-run was noted only from that receipt, so on the served build a guest's edit ("Additional specialists" 1 → 2,
 * CEE graph a1636315 → 9349dd99, `freshness: stale`) never started a Run: "Model changed since this analysis. Re-run
 * to update." stayed up for good.
 *
 * Real path: the REAL `useConversation` sends the witness's own edit event (its `request_body.event`), the network
 * answers with the witness's own `response_body` (fixture copied verbatim from the run folder), and the REAL
 * `useAnalyseAfterCommittedChange` decides whether to Run. Only the network, Supabase and the runner are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { maximalModelVersionMutationReceiptCommittedMutation } from '@talchain/schemas/fixtures'

import { useConversation } from '../../conversation/useConversation'
import { useCanvasStore } from '../../store'
import { useUndoJournalStore } from '../../undo/captureUndoReceipt'
import { EMPTY_UNDO_JOURNAL } from '../../undo/undoJournal'
import { noteCanvasLocalCommit, useAnalyseAfterCommittedChange } from '../useAnalyseAfterCommittedChange'
import type { CanonicalRunOptions, CanonicalRunOutcome } from '../canonicalRunRegistry'
import witness from './fixtures/witness-20261014T174333Z-turn03-guest-option-edit.json'

vi.mock('../useAnalyseAfterCommittedChange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useAnalyseAfterCommittedChange')>()
  return { ...actual, noteCanvasLocalCommit: vi.fn(actual.noteCanvasLocalCommit) }
})
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
// A guest: no user, no token.
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

const SCENARIO_ID = witness.request_body.scenario_id
const H1 = witness.request_body.event.base_graph_hash // a16363151f5c0a6d — the model the prior Run analysed
const H2 = witness.response_body.graph_hash // 9349dd99dcd9ca67 — the model the edit committed
const sent = witness.request_body.event
const editEvent = {
  type: sent.kind,
  payload: { option_id: sent.option_id, factor_id: sent.factor_id, value: sent.value, base_graph_hash: sent.base_graph_hash },
}

type Run = (opts?: CanonicalRunOptions) => Promise<CanonicalRunOutcome>
let run: ReturnType<typeof vi.fn<Parameters<Run>, ReturnType<Run>>>
/** The model CEE held (as the canvas knows it) at the moment each Run started. */
let hashAtRun: Array<string | null>

function stub200(body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => structuredClone(body),
    text: async () => JSON.stringify(body),
  } as unknown as Response)))
}

function mount() {
  return renderHook(({ idle }: { idle: boolean }) => {
    const conversation = useConversation()
    useAnalyseAfterCommittedChange({ run, idle, hasRunOnRecord: true })
    return conversation
  }, { initialProps: { idle: false } })
}

/** The edit turn goes out (busy), settles, then the dock is idle. */
async function commitEdit(body: Record<string, unknown>) {
  const view = mount()
  stub200(body)
  await act(async () => {
    await view.result.current.sendSystemEvent(editEvent as never, { debugSource: 'canvas_option_edit' } as never).catch(() => undefined)
  })
  await act(async () => { view.rerender({ idle: true }) })
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  useUndoJournalStore.setState({ journal: EMPTY_UNDO_JOURNAL })
  // The witness's state before the edit: one Run on record at H1, the canvas holding CEE's H1 as its write base.
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastServerGraphHash: H1,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    hasCompletedFirstRun: true,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  hashAtRun = []
  run = vi.fn<Parameters<Run>, ReturnType<Run>>(async () => {
    hashAtRun.push(useCanvasStore.getState().lastServerGraphHash)
    return { status: 'dispatched' }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a committed canvas edit starts exactly one automatic Run, with or without a version receipt', () => {
  it('⭐ GUEST (witness turn #3, no receipt): the edit moved CEE’s graph H1 → H2, so ONE Run starts, on H2', async () => {
    expect(witness.response_body).not.toHaveProperty('model_version_receipt')
    expect(witness.response_body.analysis_ready.freshness).toBe('stale')
    expect(H2).not.toBe(H1)

    await commitEdit(witness.response_body)

    expect(useCanvasStore.getState().lastServerGraphHash).toBe(H2)
    expect(run).toHaveBeenCalledTimes(1)
    expect(hashAtRun).toEqual([H2])
    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
  })

  it('SIGNED IN (the same edit WITH its receipt): still exactly one Run and one commit, never two', async () => {
    const receipt = {
      ...maximalModelVersionMutationReceiptCommittedMutation,
      mutation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      version_id: '11111111-1111-4111-8111-111111111111',
      undo_version_id: '00000000-0000-4000-8000-000000000000',
      lineage: {
        ...(maximalModelVersionMutationReceiptCommittedMutation as { lineage: object }).lineage,
        parent_version_id: '00000000-0000-4000-8000-000000000000',
      },
    }
    await commitEdit({ ...witness.response_body, model_version_receipt: receipt })

    expect(run).toHaveBeenCalledTimes(1)
    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(noteCanvasLocalCommit).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
  })

  it('NO GRAPH CHANGE (CEE answers at the base hash): no commit, no Run', async () => {
    await commitEdit({ ...witness.response_body, graph_hash: H1 })

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })
})
