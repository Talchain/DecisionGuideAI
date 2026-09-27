/** A saved example's stated limit reaches CEE with its graph (#70 5851812259).
 * Served before the fix (UI c3d7873e, CEE f99d0a5): the pricing example's register
 * body was `{nodes, edges}` only, so CEE never held "NRR >= 110%". The Run could not
 * name it, and every reload declined the Run as unconfirmed:
 * `boot_run_currency_declined … unproven: goal:goal_constraints:count canvas=1 read=0`.
 * Real shipped example -> loader -> registration hook -> HTTP adapter; only identity
 * and transport are doubled (as `starterBriefRegistration.spec.tsx`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { applyStarter, getStarter } from '../../starters/loadStarter'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'
import { buildRegistrationGraph } from '../buildRegistrationGraph'
import pricing from '../../starters/data/pricing-model.draft.json'
import headcount from '../../starters/data/headcount-allocation.draft.json'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

const SCENARIO = '3c7d78a3-8ccd-45e2-a21c-dc2055a17e22'
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
const requests: Array<{ url: string; body: { graph: Record<string, unknown> } }> = []

beforeEach(() => {
  localStorage.clear()
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  requests.length = 0
  fetchMock.mockImplementation(async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({
      schema: 'scenario_graph_registration.v1', registered: true, scenario_id: SCENARIO, node_count: 1, edge_count: 1,
    }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO, goalConstraints: null,
    currentBriefText: null, draftComposerText: null, importPendingServerRegistration: false })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); __resetPersistenceSessionForTests() })

async function registerStarter(id: string): Promise<{ graph: Record<string, unknown>; projected: Record<string, unknown> }> {
  const meta = getStarter(id)
  if (!meta) throw new Error(`shipped example ${id} missing`)
  await applyStarter(meta.id)
  const st = useCanvasStore.getState()
  const projected = buildRegistrationGraph(st.nodes, st.edges)
  if (!projected.ok) throw new Error(`${id} cannot be projected`)
  renderHook(() => useImportRegistration())
  await waitFor(() => expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false))
  expect(requests).toHaveLength(1)
  expect(requests[0].url).toBe(`/bff/cee/scenarios/${SCENARIO}/graph/register`)
  return { graph: requests[0].body.graph, projected: projected.graph as unknown as Record<string, unknown> }
}

describe('a saved example registers its stated limits with its graph', () => {
  it('pricing: CEE is sent the NRR floor exactly as the example states it (id, value, unit, audit)', async () => {
    const { graph, projected } = await registerStarter('pricing-model')
    expect(graph.nodes).toEqual(projected.nodes)
    expect(graph.edges).toEqual(projected.edges)
    expect(graph.goal_constraints).toEqual(pricing.goal_constraints)
    const [nrr] = graph.goal_constraints as Array<Record<string, unknown>>
    expect(nrr).toMatchObject({
      constraint_id: 'constraint_out_nrr_min', node_id: 'out_nrr', operator: '>=', value: 1.1, unit: 'fraction',
      provenance_unit_normalised: { rule: 'percent_to_fraction', original_value: 110, original_unit: '%' },
    })
  })

  it('headcount: its one stated limit is sent too', async () => {
    const { graph } = await registerStarter('headcount-allocation')
    expect(graph.goal_constraints).toEqual(headcount.goal_constraints)
    expect((graph.goal_constraints as Array<{ constraint_id: string }>).map((c) => c.constraint_id)).toEqual(['constraint_goal_arr_max'])
  })

  it('the limit sent is the canvas snapshot, not the shipped file: an edit before registration is what CEE receives', async () => {
    const meta = getStarter('pricing-model')
    if (!meta) throw new Error('pricing example missing')
    await applyStarter(meta.id)
    const [nrr] = useCanvasStore.getState().goalConstraints ?? []
    if (!nrr) throw new Error('the loader put no limit on the canvas')
    useCanvasStore.setState({ goalConstraints: [{ ...nrr, value: 1.2 }] })
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false))
    expect((requests[0].body.graph.goal_constraints as Array<{ value: number }>).map((c) => c.value)).toEqual([1.2])
  })

  it('contrast: an example that states no limit sends no goal_constraints key (the wire is unchanged)', async () => {
    const vendor = (await import('../../starters/data/vendor-selection.draft.json')).default as { goal_constraints?: unknown[] }
    expect(vendor.goal_constraints ?? []).toEqual([])
    const { graph, projected } = await registerStarter('vendor-selection')
    expect(graph).not.toHaveProperty('goal_constraints')
    expect(graph).toEqual(projected)
  })
})
