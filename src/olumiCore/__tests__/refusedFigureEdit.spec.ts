/**
 * A figure typed on the canvas that olumi-core REFUSES (a change is waiting for the person's answer, or the model moved)
 * comes back as a core-route error with `nothing_saved: true`. olumi-core saves a figure and its Run together or not at all, so
 * that is a proven refusal: the canvas takes the previous figure back and says why, in core's own words. A failure that does not
 * say nothing was saved (a timeout: core may have saved before the reply was lost) keeps the figure and says it could not confirm.
 * Same harness discipline as `useConversation.optimisticFactorEditConflict.spec.ts`: seams mocked, the V5 adapter and parser real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { __resetPendingFactorEditsForTest } from '../../canvas/conversation/pendingFactorEdit'
import { __resetPendingEdgeEditsForTest } from '../../canvas/conversation/pendingEdgeEdit'
import { useConversation } from '../../canvas/conversation/useConversation'
import { useCanvasStore } from '../../canvas/store'
import { OPTIMISTIC_FACTOR_EDIT_NOTICE, type OptimisticFactorEdit } from '../../canvas/conversation/optimisticFactorEdit'
import { settleSystemEventSend } from '../../canvas/conversation/settleSystemEventSend'
import { valueCommitSettlementWord, VALUE_COMMIT_SETTLEMENT_COPY } from '../../canvas/conversation/valueCommitSettlement'
import { errorTurn, CoreError, WriteKept } from '../../../scripts/olumi-core/lib/core.mjs'

vi.mock('../../canvas/conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(), streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../flags')>()), isOrchestratorV2Enabled: () => true }))
vi.mock('../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../v5/eligibility')>()), isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false,
}))

const SCENARIO_ID = '00000000-0000-4000-8000-437f3c107bdd'
const TARGET = 'per_specialist', BYSTANDER = 'existing_capacity'
const PREV = { value: 20, raw_value: 20, unit: 'ticket/week/specialist' }

const factor = (id: string, value: number): Node => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id, observedState: { value, raw_value: value, unit: 'ticket/week' }, display_value: `${value} ticket/week` } }) as unknown as Node
const snapshot = (): OptimisticFactorEdit => ({ nodeId: TARGET, sentValue: 30, prevObservedState: PREV, prevDisplayValue: '20 ticket/week/specialist' })

/** The turn answer the shim gives for a failure: a 200 CoreTurn carrying `error`. */
function stubShimAnswer(answer: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('/graph')
    ? new Response(JSON.stringify({ schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true, graph: { nodes: [{ id: TARGET, kind: 'factor', label: TARGET, observed_state: PREV, display_value: '20' }], edges: [] } }), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }))))
}

async function drive(answer: unknown) {
  const sends: Promise<unknown>[] = []
  stubShimAnswer(answer)
  useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, nodes: [factor(TARGET, 30), factor(BYSTANDER, 80)], edges: [], results: { status: 'idle' } as never, analysisFreshnessDirty: false, currentScenarioLastResultHash: null, selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  const { result } = renderHook(() => useConversation())
  const settled: string[] = []
  await act(async () => {
    const send = result.current.sendSystemEvent({ type: 'factor_value_edit', payload: { target_id: TARGET, value: 30, raw_value: 30, field: 'value' } } as never, { optimisticFactorEdit: snapshot() })
    settleSystemEventSend(send as never, (word, detail) => { settled.push(detail?.kept ? `${word}:kept` : word) })
    sends.push(send)
    await send.catch(() => undefined)
    await new Promise((r) => setTimeout(r, 0))
  })
  const nodes = useCanvasStore.getState().nodes
  const read = (id: string) => ((nodes.find((n) => n.id === id)?.data as Record<string, unknown>)?.observedState ?? {}) as Record<string, unknown>
  return { settled, target: read(TARGET).value, bystander: read(BYSTANDER).value, notices: result.current.messages.filter((m) => m.role === 'assistant' && m.synthetic === true).map((m) => m.content) }
}

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_OLUMI_CORE', '1'); __resetPendingFactorEditsForTest(); __resetPendingEdgeEditsForTest() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('a refused figure edit on the olumi-core lane (gap 1: nothing hangs, nothing lies)', () => {
  it('takes the figure back and says why in core\'s words, when core states nothing was saved', async () => {
    const out = await drive(errorTurn('t-1', new CoreError(409, 'approve or set aside the pending change first')))
    // ...and the card is told so ("Not saved. The model kept its previous value."), not "Could not confirm. It may not have reached the model."
    expect(out.settled).toEqual(['refused'])
    expect(out.target).toBe(20)
    expect(out.bystander).toBe(80)
    expect(out.notices).toEqual(['Approve or set aside the pending change first. Nothing was saved. Your figure is back as it was.'])
  })

  it('keeps the figure and says it could not confirm when a timeout leaves it unknown whether core saved it', async () => {
    const out = await drive(errorTurn('t-2', Object.assign(new CoreError(0, 'olumi-core is not reachable'), { op: 'TimeoutError' })))
    expect(out.settled).toEqual(['unverified'])
    expect(out.target).toBe(30)
    expect(out.notices).toEqual([OPTIMISTIC_FACTOR_EDIT_NOTICE.unconfirmed_server])
  })

  it('a refusal for something core cannot honour (nothing sent) also takes the figure back', async () => {
    const out = await drive(errorTurn('t-3', new CoreError(400, 'that is not a figure Olumi can use')))
    expect(out.target).toBe(20)
    expect(out.notices[0]).toMatch(/not a figure Olumi can use/)
  })

  it('a figure typed over a range is taken back, in words that name the range (the range is never replaced by one number)', async () => {
    const out = await drive(errorTurn('t-4', new CoreError(400, '‘per specialist’ is a range (between 10 and 30 ticket/week/specialist, most likely 20), and a typed figure would replace it with one number. Tell me the new range in the chat. Nothing was saved.')))
    expect(out.target).toBe(20)
    expect(out.notices[0]).toMatch(/between 10 and 30/)
    expect(out.notices[0]).toMatch(/Your figure is back as it was\.$/)
  })

  it('a figure core KEPT whose follow-up read failed stays on the canvas and is said to be SAVED, with the way to see it (not "may not have reached the model")', async () => {
    const out = await drive(errorTurn('t-5', new WriteKept(new CoreError(502, 'could not read'))))
    expect(out.settled).toEqual(['unverified:kept'])
    expect(out.target).toBe(30)
    expect(out.notices).toHaveLength(1)
    expect(out.notices[0]).toMatch(/was saved/)
    expect(out.notices[0]).toMatch(/Reload/)
    expect(out.notices[0]).toMatch(/Your figure is still on the canvas\.$/)
    expect(out.notices[0]).not.toMatch(/couldn't confirm|may not have reached/i)
  })
  it('the card says the same: saved, reload to see it', () => {
    const word = valueCommitSettlementWord('unverified', 20, 30, () => 30, { kept: true })
    expect(word).toBe('kept_unread')
    expect(VALUE_COMMIT_SETTLEMENT_COPY[word!].message).toBe('Saved. Olumi could not show the result just now: reload to see it.')
    // a timeout (nobody knows whether core saved it) is still "could not confirm"
    expect(valueCommitSettlementWord('unverified', 20, 30, () => 30, {})).toBe('unconfirmed')
  })
})
