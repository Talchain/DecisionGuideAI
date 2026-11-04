/**
 * Canvas A, slice S1 (canvas-A-gaps.md B1b, B1c, A16): on the olumi-core lane nothing reads or writes the adapter's saved graph,
 * whatever the canvas store holds. The board is a program board for every reader (B1b), the saved-graph read never starts (B1c: inert
 * by gate, not because no hash happens to be set), and an import never registers a graph over /bff (A16). Off the lane each is as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { useCanvasStore } from '../../canvas/store'
import { useSavedGraphRead } from '../../canvas/nodes/shared/savedGraph'
import { useSavedModelIsProgram } from '../../canvas/nodes/shared/savedModelProgram'
import { useImportRegistration } from '../../canvas/registration/useImportRegistration'
import { applyStarter, getStarter } from '../../canvas/starters/loadStarter'
import { clearImportRegistrationMarkers } from '../../canvas/store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../lib/persistenceSession'

const SCENARIO = '6f37ea65-964e-4176-bcca-d68a5cc1bf06'
const urls: string[] = []

beforeEach(() => {
  localStorage.clear()
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  urls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    urls.push(String(url))
    return new Response(JSON.stringify({ schema: 'scenario_graph_registration.v1', registered: true, scenario_id: SCENARIO, node_count: 19, edge_count: 39 }), { status: 200 })
  }))
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO, lastServerGraphHash: null, importPendingServerRegistration: false })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); lane.on = true; window.history.replaceState(null, '', '/') })

describe('B1b the board is a program board for every reader on the lane', () => {
  it('useSavedModelIsProgram is true on the lane with no saved graph read, and false off it', () => {
    lane.on = true
    expect(renderHook(() => useSavedModelIsProgram()).result.current).toBe(true)
    lane.on = false
    expect(renderHook(() => useSavedModelIsProgram()).result.current).toBe(false)
  })
})

describe('B1c the saved-graph read never starts on the lane', () => {
  it('a saved scenario with a saved hash reads nothing on the lane, and reads off it', async () => {
    useCanvasStore.setState({ lastServerGraphHash: 'abcdef0123456789' })
    lane.on = true
    expect(renderHook(() => useSavedGraphRead()).result.current).toEqual({ status: 'none' })
    await new Promise((r) => setTimeout(r, 20))
    expect(urls).toEqual([])
    lane.on = false
    window.history.replaceState(null, '', '/?ai=openai') // off the lane the read applies on the OpenAI lane only
    expect(renderHook(() => useSavedGraphRead()).result.current.status).toBe('pending')
    await waitFor(() => expect(urls.some((u) => u.includes(`/scenarios/${SCENARIO}/graph`))).toBe(true))
  })
})

describe('A16 an import never registers a graph over /bff on the lane', () => {
  const load = async () => {
    const meta = getStarter('vendor-selection')
    if (!meta) throw new Error('Shipped example missing')
    await applyStarter(meta.id)
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  }

  it('on the lane: no register request', async () => {
    lane.on = true
    await load()
    renderHook(() => useImportRegistration())
    await new Promise((r) => setTimeout(r, 50))
    expect(urls.filter((u) => u.includes('/graph/register'))).toEqual([])
  })

  it('off the lane: the import registers, as before', async () => {
    lane.on = false
    await load()
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(urls.filter((u) => u.includes('/graph/register'))).toHaveLength(1))
  })
})
