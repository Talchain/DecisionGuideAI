/**
 * ⭐ S10 (CEE #3190, 15 Oct 2026): a client re-register over a SAVED model is refused with 409 MODEL_ALREADY_SAVED and
 * nothing is written. The hook then re-reads CEE's model (it is the authority) instead of holding "can't confirm" for the
 * life of the page. Real shipped starter → loader → registration hook → HTTP adapter; only identity, transport and the
 * cold read are doubled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { applyStarter, getStarter } from '../../starters/loadStarter'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'
import { useImportRegistration } from '../useImportRegistration'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
const hydrateCanvasFromServer = vi.fn(async () => 'merged')
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hydrateCanvasFromServer: (...args: unknown[]) => hydrateCanvasFromServer(...(args as [])),
}))

const SCENARIO = '6f37ea65-964e-4176-bcca-d68a5cc1bf06'
const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
let registerAnswer: { status: number; body: unknown } = { status: 409, body: {} }

beforeEach(() => {
  localStorage.clear()
  clearImportRegistrationMarkers()
  __resetPersistenceSessionForTests()
  hydrateCanvasFromServer.mockClear()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(registerAnswer.body), { status: registerAnswer.status }))
  vi.stubGlobal('fetch', fetchMock)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO,
    currentBriefText: null, draftComposerText: null, importPendingServerRegistration: false })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); __resetPersistenceSessionForTests() })

const loadCdpOver = async () => {
  const meta = getStarter('vendor-selection')
  if (!meta) throw new Error('Shipped CDP example missing')
  await applyStarter(meta.id)
}

describe('a re-register over a saved model re-reads CEE’s model', () => {
  it('MODEL_ALREADY_SAVED → the import hold is released and CEE’s model is read once (no “can’t confirm”)', async () => {
    registerAnswer = { status: 409, body: { schema: 'error.v1', details: { code: 'MODEL_ALREADY_SAVED' } } }
    await loadCdpOver()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(hydrateCanvasFromServer).toHaveBeenCalledTimes(1))
    expect(hydrateCanvasFromServer).toHaveBeenCalledWith(SCENARIO, { userId: null, accessToken: null })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
  })

  it('CONTRAST: a plain 409 conflict keeps the hold (still unknown) and reads nothing', async () => {
    registerAnswer = { status: 409, body: { details: { code: 'GRAPH_MOVED' } } }
    await loadCdpOver()
    renderHook(() => useImportRegistration())
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(hydrateCanvasFromServer).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(true)
  })
})
