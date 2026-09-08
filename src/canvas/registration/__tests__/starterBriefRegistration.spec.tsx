/** Real shipped example -> loader -> registration hook -> HTTP adapter.
 * Only identity and transport are doubled. No provider or live persistence.
 * Native loss: CDP scenario 6f37ea65-964e-4176-bcca-d68a5cc1bf06 registered
 * 19 nodes/39 edges on 2026-09-08, but sent only {graph}; CEE saw no brief.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { applyStarter, getStarter } from '../../starters/loadStarter'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { loadAutosave } from '../../store/scenarios'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'
import { buildRegistrationGraph } from '../buildRegistrationGraph'
import { resolveStarterRegistrationBrief } from '../../starters/registrationBrief'
import manifest from '../../starters/starters.manifest.json'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

const SCENARIO = '6f37ea65-964e-4176-bcca-d68a5cc1bf06'
const OTHER_SCENARIO = '15f41c42-59a1-42f4-b39d-ebc24bde141a'
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
const requests: Array<{ url: string; body: Record<string, unknown> }> = []

beforeEach(() => {
  localStorage.clear()
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  requests.length = 0
  fetchMock.mockImplementation(async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({
      schema: 'scenario_graph_registration.v1', registered: true,
      scenario_id: SCENARIO, node_count: 19, edge_count: 39,
    }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO,
    currentBriefText: null, draftComposerText: null, importPendingServerRegistration: false })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); __resetPersistenceSessionForTests() })

describe('saved-example brief registration', () => {
  it('sends the captured CDP brief verbatim with saved-example attribution, not composer text', async () => {
    const meta = getStarter('vendor-selection')
    if (!meta) throw new Error('Shipped CDP example missing')
    expect(meta.brief.length).toBe(385)
    const loaded = await applyStarter(meta.id)
    expect([loaded.nodeCount, loaded.edgeCount]).toEqual([19, 39])
    useCanvasStore.setState({ currentBriefText: 'Newer unsent user text', draftComposerText: 'Private unsent draft' })
    const snapshot = useCanvasStore.getState()
    const projected = buildRegistrationGraph(snapshot.nodes, snapshot.edges)
    if (!projected.ok) throw new Error('Shipped example cannot be projected')
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false))
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe(`/bff/cee/scenarios/${SCENARIO}/graph/register`)
    expect(requests[0].body.brief_text).toBe(
      `Saved example: ${meta.title} (${meta.id}; captured ${meta.provenance.capturedAt}). Original brief:\n\n${meta.brief}`,
    )
    expect(useCanvasStore.getState().currentBriefText).toBe('Newer unsent user text')
    expect(useCanvasStore.getState().draftComposerText).toBe('Private unsent draft')
    expect(requests[0].body).not.toHaveProperty('user_id')
    expect(requests[0].body.graph).toEqual(projected.graph)
  })

  it('reopens the actual autosaved example and recovers its own brief without a second context store', async () => {
    await applyStarter('vendor-selection')
    const saved = loadAutosave()
    if (!saved) throw new Error('Starter did not autosave')
    expect(saved.nodes).toHaveLength(19)
    useCanvasStore.getState().hydrateGraphSlice({ nodes: saved.nodes, edges: saved.edges, currentScenarioId: SCENARIO })
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].body.brief_text).toContain(getStarter('vendor-selection')?.brief)
    expect(requests[0].body.brief_text).toContain('Saved example:')
  })

  it.each(['absent', 'unknown', 'conflicting'] as const)('does not invent context for %s starter attribution', async (kind) => {
    await applyStarter('vendor-selection')
    const st = useCanvasStore.getState()
    useCanvasStore.setState({ nodes: st.nodes.map((n, i) => ({ ...n, data: {
      ...n.data, starterId: kind === 'absent' ? undefined : kind === 'unknown' ? 'not-a-shipped-example' : i === 0 ? 'pricing-model' : 'vendor-selection',
    } })) })
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].body).not.toHaveProperty('brief_text')
  })

  it('does not leak a previous example brief into an unrelated scenario', async () => {
    await applyStarter('vendor-selection')
    const st = useCanvasStore.getState()
    useCanvasStore.getState().hydrateGraphSlice({ currentScenarioId: OTHER_SCENARIO,
      nodes: st.nodes.map((n) => ({ ...n, data: { ...n.data, starterId: undefined, starterTitle: undefined } })),
      edges: st.edges,
    })
    useCanvasStore.setState({ importPendingServerRegistration: true })
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].url).toBe(`/bff/cee/scenarios/${OTHER_SCENARIO}/graph/register`)
    expect(requests[0].body).not.toHaveProperty('brief_text')
  })

  it.each(manifest.starters)('preserves $id original words and attribution even with new unstamped nodes', (starter) => {
    expect(starter.brief.trim().length).toBeGreaterThan(0)
    expect(resolveStarterRegistrationBrief([{ data: {} }, { data: { starterId: starter.id } }])).toBe(
      `Saved example: ${starter.title} (${starter.id}; captured ${starter.provenance.capturedAt}). Original brief:\n\n${starter.brief}`,
    )
  })

  it('does not fabricate a brief when the known example has no authored words', () => {
    const starter = manifest.starters[0]
    const original = starter.brief
    try {
      starter.brief = ' \n\t '
      expect(resolveStarterRegistrationBrief([{ data: { starterId: starter.id } }])).toBeUndefined()
    } finally { starter.brief = original }
  })
})
