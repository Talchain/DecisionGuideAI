/**
 * ACCOUNTS viewer mode: ONE flag from `scenario_access`, plus the belt that keeps
 * a viewer's state-changing CEE requests from leaving the browser.
 *
 * The rows that matter most:
 * - the flag is ON only for an exact 'viewer' answer for THIS route (an owner
 *   whose read failed keeps their composer);
 * - a stale route's answer never sets it;
 * - the belt refuses every route on the owner's writer list and passes the graph
 *   read, which is a POST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const access = vi.hoisted(() => ({ getScenarioAccess: vi.fn() }))
vi.mock('../../services/scenarioSharingService', () => access)

import {
  __resetViewerModeForTests,
  isStateChangingCeeRequest,
  isViewerSession,
  useIsViewer,
  viewerScenario,
} from '../viewerMode'
import { useScenarioViewerAccess } from '../useScenarioViewerAccess'

const A = '3b241101-e2bb-4255-8caf-4136c566a962'
const B = '9f0c2a55-1d3e-4b7a-8c61-2a4e5f6d7b80'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

let network: ReturnType<typeof vi.fn<unknown[], Promise<Response>>>

beforeEach(() => {
  __resetViewerModeForTests()
  access.getScenarioAccess.mockReset()
  network = vi.fn<unknown[], Promise<Response>>(async () => new Response('{}', { status: 200 }))
  globalThis.fetch = network as unknown as typeof fetch
})

describe('the flag', () => {
  it.each([
    ['owner', false],
    ['none', false],
  ])('a %s answer leaves it OFF', async (answer, expected) => {
    access.getScenarioAccess.mockResolvedValue(answer)
    renderHook(() => useScenarioViewerAccess(A, true))
    await waitFor(() => expect(access.getScenarioAccess).toHaveBeenCalledWith(A))
    await act(async () => {})
    expect(isViewerSession()).toBe(expected)
  })

  it('a viewer answer turns it ON for THIS route, and useIsViewer re-renders', async () => {
    access.getScenarioAccess.mockResolvedValue('viewer')
    renderHook(() => useScenarioViewerAccess(A, true))
    const seen = renderHook(() => useIsViewer())
    await waitFor(() => expect(seen.result.current).toBe(true))
    expect(viewerScenario()).toBe(A)
  })

  it('a guest (no persistence session) never asks and is never a viewer', async () => {
    renderHook(() => useScenarioViewerAccess(A, false))
    await act(async () => {})
    expect(access.getScenarioAccess).not.toHaveBeenCalled()
    expect(isViewerSession()).toBe(false)
  })

  it('A→B: A answering "viewer" after the route moved to B never sets the flag', async () => {
    const a = deferred<string>()
    const b = deferred<string>()
    access.getScenarioAccess.mockImplementation((id: string) => (id === A ? a.promise : b.promise))
    const hook = renderHook(({ id }) => useScenarioViewerAccess(id, true), { initialProps: { id: A } })
    hook.rerender({ id: B })
    await act(async () => { a.resolve('viewer') })
    expect(isViewerSession()).toBe(false)
    await act(async () => { b.resolve('owner') })
    expect(isViewerSession()).toBe(false)
  })

  it('leaving the canvas clears it', async () => {
    access.getScenarioAccess.mockResolvedValue('viewer')
    const hook = renderHook(() => useScenarioViewerAccess(A, true))
    await waitFor(() => expect(isViewerSession()).toBe(true))
    hook.unmount()
    expect(isViewerSession()).toBe(false)
  })
})

describe('the belt', () => {
  const CEE = 'https://cee-staging.onrender.com'
  const REFUSED = [
    `${CEE}/proxy/v5/turn`,
    `${CEE}/proxy/v5/turn/stream`,
    `${CEE}/proxy/v5/turn/stop`,
    '/bff/orchestrate/v2/turn',
    '/bff/collab/panels',
    '/bff/cee/turn',
    '/bff/cee/draft-graph',
    `/bff/cee/scenarios/${A}/graph/register`,
    `/bff/cee/scenarios/${A}/versions/save`,
    `/bff/cee/scenarios/${A}/versions/restore`,
    `/bff/cee/scenarios/${A}/copy`,
    '/bff/cee/decision-records/commit',
    '/bff/cee/decision-records/r1/outcome',
  ]
  const PASSED = [
    `/bff/cee/scenarios/${A}/graph`,
    `/bff/cee/scenarios/${A}/versions`,
    `/bff/cee/scenarios/${A}/versions/compare`,
    '/bff/cee/graph-readiness',
    '/bff/cee/health',
    `${CEE}/proxy/v5/turning`,
  ]

  it.each(REFUSED)('classifies %s as state-changing', (url) => {
    expect(isStateChangingCeeRequest(url)).toBe(true)
  })

  it.each(PASSED)('classifies %s as a read', (url) => {
    expect(isStateChangingCeeRequest(url)).toBe(false)
  })

  async function becomeViewer() {
    access.getScenarioAccess.mockResolvedValue('viewer')
    const hook = renderHook(() => useScenarioViewerAccess(A, true))
    await waitFor(() => expect(isViewerSession()).toBe(true))
    return hook
  }

  it('while a viewer: every writer gets a LOCAL 403 viewer_read_only and NOTHING leaves the browser', async () => {
    await becomeViewer()
    for (const url of REFUSED) {
      const res = await fetch(url, { method: 'POST', body: '{}' })
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toEqual({ code: 'viewer_read_only' })
    }
    const req = new Request(`http://localhost/bff/cee/scenarios/${A}/graph/register`, { method: 'POST' })
    expect((await fetch(req)).status).toBe(403)
    expect(network).not.toHaveBeenCalled()
  })

  it('while a viewer: the graph read (a POST) and other reads still go out', async () => {
    await becomeViewer()
    for (const url of PASSED) await fetch(url, { method: 'POST' })
    expect(network).toHaveBeenCalledTimes(PASSED.length)
  })

  it('once the viewer leaves the canvas, writers go out again (the belt is a pass-through when off)', async () => {
    const hook = await becomeViewer()
    hook.unmount()
    await fetch(`/bff/cee/scenarios/${A}/graph/register`, { method: 'POST' })
    expect(network).toHaveBeenCalledTimes(1)
  })
})
