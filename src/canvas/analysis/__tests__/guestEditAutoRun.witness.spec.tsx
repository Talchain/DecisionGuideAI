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
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
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

function stubStatus(status: number, body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => structuredClone(body),
    text: async () => JSON.stringify(body),
  } as unknown as Response)))
}
const stub200 = (body: Record<string, unknown>) => stubStatus(200, body)

function mount() {
  return renderHook(({ idle }: { idle: boolean }) => {
    const conversation = useConversation()
    useAnalyseAfterCommittedChange({ run, idle, hasRunOnRecord: true })
    return conversation
  }, { initialProps: { idle: false } })
}

type View = ReturnType<typeof mount>

/** One edit turn on a mounted canvas: the dock is busy while it is out, then idle once it settles. */
async function sendEdit(view: View, event: typeof editEvent = editEvent) {
  await act(async () => { view.rerender({ idle: false }) })
  await act(async () => {
    await view.result.current.sendSystemEvent(event as never, { debugSource: 'canvas_option_edit' } as never).catch(() => undefined)
  })
  await act(async () => { view.rerender({ idle: true }) })
}

/** The edit turn goes out (busy), settles, then the dock is idle. */
async function commitEdit(body: Record<string, unknown>) {
  const view = mount()
  stub200(body)
  await sendEdit(view)
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

/**
 * ⛔ PL RULE (14 Oct, #94 6135017311): the guest auto-run fires ONLY on a SUCCESSFULLY APPLIED guest model revision.
 * Each row below is the witness above with only the field that defines its case changed, and asserts no Run.
 */
describe('CONTRAST — nothing but an applied guest edit starts the automatic Run', () => {
  it('(b) REFUSED at 200 (prose, no blocks, no graph_hash, no analysis_ready): no commit, no Run', async () => {
    const rest: Record<string, unknown> = structuredClone(witness.response_body)
    delete rest.graph_hash
    delete rest.analysis_ready
    await commitEdit({
      ...rest,
      assistant_text: 'Value 25 exceeds the factor\'s cap of 10. I haven\'t changed anything.',
      blocks: [],
    })

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('(b) REFUSED with 422 `system_event_refused_no_write`: no commit, no Run', async () => {
    const view = mount()
    stubStatus(422, {
      error: 'INGRESS_CONTRACT_VIOLATION', boundary: 'B1', direction: 'egress', validator: 'turn_commit',
      details: { retryable: false, reason: 'system_event_refused_no_write', event_kind: sent.kind, stage: 'analyse' },
      request_id: 'req_guest_422', retryable: false,
    })
    await sendEdit(view)

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('(b) FAILED at 200 (a fatal error block) even though graph_hash differs from the base: no commit, no Run', async () => {
    await commitEdit({
      ...witness.response_body,
      blocks: [{ type: 'error', error_code: 'INTERNAL_ERROR', severity: 'error' }],
    })

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('(c) CONFLICT — 409 GRAPH_DIVERGED `stale_base_graph_hash`: no commit, no Run', async () => {
    const view = mount()
    stubStatus(409, {
      error: 'GRAPH_DIVERGED', boundary: 'B1', direction: 'egress', validator: 'turn_commit',
      details: {
        retryable: false, reason: 'graph_write_conflict', conflict_category: 'stale_base_graph_hash',
        recovery_action: 'refresh_and_reconfirm', expected_base_graph_hash: H2, event_kind: sent.kind,
      },
      request_id: 'req_guest_409', retryable: false,
    })
    await sendEdit(view)

    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('(d) DUPLICATE RESEND after the first reply was applied (same event bytes, CEE replays H1 → H2): still ONE Run', async () => {
    const view = await commitEdit(witness.response_body)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(H2)
    expect(run).toHaveBeenCalledTimes(1)

    await sendEdit(view)

    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('(d) RETRY after the first reply was applied, on the applied base (base H2, CEE answers H2): still ONE Run', async () => {
    const view = await commitEdit(witness.response_body)
    expect(run).toHaveBeenCalledTimes(1)

    await sendEdit(view, { ...editEvent, payload: { ...editEvent.payload, base_graph_hash: H2 } })

    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  // "Failed to fetch" does not say whether CEE got the send. This row is the send CEE never got: nothing was written,
  // so the retry on H1 is the write (200, H2). When the lost reply HAD committed, served CEE 8e9132fc refuses the retry
  // with 409 `stale_base_graph_hash` (capture 2026-10-18T034045Z turn 04, row (c) above), and the Run comes from the
  // card's read-back: `optionTargetRefusalSettles.wire.spec.ts`, "a saved edit confirmed by read-back…".
  it('(d) POSITIVE CONTRAST — the first send never reached CEE (canvas still at H1), the retry lands H2: exactly ONE Run, on H2', async () => {
    const view = mount()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await sendEdit(view)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(H1)
    expect(run).not.toHaveBeenCalled()

    stub200(witness.response_body)
    await sendEdit(view)

    expect(noteCanvasLocalCommit).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(1)
    expect(hashAtRun).toEqual([H2])
  })

  it('(e) an AI PROPOSAL turn (held for approval, chat lane) whose reply carries a moved graph_hash: no commit, no Run', async () => {
    const view = mount()
    const proposalId = `prop_${'a'.repeat(32)}`
    stub200({
      ...witness.response_body,
      assistant_text: 'I could set "Additional specialists" to 2 for "Add one specialist". Shall I?',
      suggested_actions: [
        { id: `agent-approve-proposal:${proposalId}`, label: 'Apply it', message: 'Yes, apply that.' },
        { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
      ],
    })
    await act(async () => { view.rerender({ idle: false }) })
    await act(async () => { await view.result.current.sendMessage('Make it two specialists').catch(() => undefined) })
    await act(async () => { view.rerender({ idle: true }) })

    // Positive control: the proposal turn really settled on this canvas.
    expect(view.result.current.messages.some((m) => m.role === 'assistant' && /Shall I\?/.test(m.content))).toBe(true)
    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('(f) COLD REOPEN of the guest scenario (CEE read lands H2; an earlier session had noted a commit): no Run', async () => {
    // A commit noted before the canvas mounts (the previous session's edit) is not this session's change.
    noteCanvasLocalCommit(H2)
    vi.mocked(noteCanvasLocalCommit).mockClear()
    const view = mount()
    stub200({
      schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true,
      graph: witness.response_body.draft_graph, graph_hash: H2,
      conversation_turns: [{ turn_id: witness.request_body.turn_id, created_at: new Date(0).toISOString(),
        user_message: '', assistant_message: witness.response_body.assistant_text }],
    })
    let outcome: unknown
    await act(async () => { outcome = await hydrateCanvasFromServer(SCENARIO_ID, { includeConversationTurns: true }) })
    await act(async () => { view.rerender({ idle: true }) })

    // Positive control: the reopen read really landed CEE's model on this canvas.
    expect(outcome).not.toBe('skipped')
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(H2)
    expect(noteCanvasLocalCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })
})
