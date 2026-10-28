/**
 * W8 run 4, H10 (DL, 28 Oct; capacity journey): after an approved edit the canvas still said "Today: 80" on the total and
 * "today 80" on the goal, while CEE's committed model (turn 05) had withheld both: the relation now subtracts staff
 * absence, given as a 5–15 range. A cold reopen showed "= —". The receipt was OVERLAID (`overlayNode` keeps every key the
 * wire omits), so the withheld `observed_state` stayed. A core turn's graph is the saved program's whole projection, so
 * it REPLACES the nodes it carries, as a version restore does (`restoreReplace`): hot = cold.
 *
 * Real path: the harness of `useConversation.programFigureEditSaved.spec.ts` (adapter, parser and router real, `fetch`
 * stubbed), the canvas built cold from run 4's saved read just before the edit, then turn 05's body as served. The
 * reconcile at the receipt is kind-agnostic, so the turn is driven as a system event.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { reconcileAppliedGraph } from '../../utils/mergeAppliedGraph'
import { readCoreTurn } from '../../../v5/applyCoreTurn'
import run4 from './fixtures/w8r4-capacity-approve-receipt-20261028.json'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(), streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error { status = 0; body: unknown = null },
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../flags')>()), isOrchestratorV2Enabled: () => true }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()), isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false,
}))

type Json = Record<string, any>
const before = run4.edit_before_read as Json
const SCENARIO_ID = before.scenario_id as string
const wireNode = (body: Json, id: string) => (body.model?.graph ?? body.graph).nodes.find((n: Json) => n.id === id)

async function drive(body: Json) {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).endsWith(`/scenarios/${SCENARIO_ID}/graph`)
    ? new Response(JSON.stringify(before), { status: 200, headers: { 'Content-Type': 'application/json' } })
    : ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response)))
  useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never, currentScenarioLastResultHash: null, selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
  await act(async () => { await hydrateCanvasFromServer(SCENARIO_ID) })
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current.sendSystemEvent({ type: 'factor_value_edit', payload: { target_id: 'staff_absence', value: 10, raw_value: 10, unit: 'ticket/week' } } as never,
      { debugSource: 'canvas_figure_edit' } as never).catch(() => undefined)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const node = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id) as Json | undefined

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); window.history.replaceState(null, '', '/') })

describe('a core turn’s committed model replaces the nodes it carries (hot = cold)', () => {
  it.each(['total_capacity', 'weekly_support_capacity_goal'])('%s: the withheld today level does not stay at 80', async (id) => {
    await drive(run4.turn05_body as Json)
    expect(node(id)).toBeTruthy()
    const data = node(id)!.data as Json
    expect(data.observedState?.value).toBeUndefined()
    expect(data.observed_state?.value).toBeUndefined()
    expect(data).toEqual(mapDraftNodeToCanvas(wireNode(run4.turn05_body as Json, id)).data)
  })

  it('PRECONDITION: the canvas before the receipt said 80', async () => {
    window.history.replaceState(null, '', '/?ai=core-route')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(before), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
    await act(async () => { await hydrateCanvasFromServer(SCENARIO_ID) })
    expect((node('total_capacity')!.data as Json).observedState?.value).toBe(80)
  })
})

describe('CONTRAST: a legacy receipt keeps the overlay', () => {
  it('no core turn: a key the receipt omits stays on the canvas, as before', async () => {
    window.history.replaceState(null, '', '/?ai=core-route')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(before), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
    await act(async () => { await hydrateCanvasFromServer(SCENARIO_ID) })
    // A legacy receipt: the committed graph and no `_core_turn` sidecar, so the call site passes false.
    const legacy = { graph: (run4.turn05_body as Json).model.graph }
    expect(readCoreTurn(legacy)).toBeNull()
    reconcileAppliedGraph(legacy as never, { restoreReplace: readCoreTurn(legacy) !== null })
    expect((node('total_capacity')!.data as Json).observedState?.value).toBe(80)
  })
})
