/**
 * Canvas A S6 D6 (DL 2 Nov): on the olumi-core lane there is one chat, the dock's Olumi tab (ViewChat). The first-use composer, its
 * starters, the floating Olumi panel and DraftChat are not mounted (they send to /bff), and nothing the lane mounts sends a request to
 * /bff: measured at the network seam, below every caller (each request recorded as it reaches the page's fetch, before the /bff guard
 * answers it), while a person types a brief and sends it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
vi.mock('../../flags', async (real) => ({ ...(await real<object>()), isAiPanelV2Enabled: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { RightEdgeChat, MaybeConversationProvider } from '../../canvas/ReactFlowGraph'
import { guardBff } from '../../olumiCore/bffGuard'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
let seen: { method: string; path: string }[] = []

beforeEach(() => {
  seen = []
  const network = vi.fn(async () => {
    return new Response(JSON.stringify({ scenario: 's_00000000000a' }), { status: 201 })
  })
  const win = { fetch: network as unknown as typeof fetch, location: window.location }
  guardBff(win)
  // Record every request as the page makes it, then let the guard answer /bff exactly as on the lane.
  const guarded = win.fetch
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ method: init?.method ?? 'GET', path: new URL(String(input), window.location.href).pathname })
    return guarded(input, init)
  })
  setTeamFetch(globalThis.fetch)
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: UUID })
  useViewStore.setState({ uuid: UUID, sid: null, view: null, error: null, status: 'none' })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); setTeamFetch(null); lane.on = true; useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null }) })

const lanePage = () => render(
  <MemoryRouter>
    <MaybeConversationProvider>
      <RightEdgeChat showStarters />
      <ViewChat />
      <ViewComposer />
    </MaybeConversationProvider>
  </MemoryRouter>,
)

describe('D6 one chat on the lane, and nothing sent to /bff', () => {
  it('no first-use composer, starters or floating panel; the brief box is the one composer, and it has focus', async () => {
    lanePage()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(screen.queryByTestId('first-use-composer')).toBeNull()
    expect(document.querySelectorAll('textarea')).toHaveLength(1)
    expect(document.activeElement?.id).toBe('view-chat-text')
  })

  it("typing a brief and sending it posts to core alone: no request to /bff or any path but core's /api, from any caller", async () => {
    lanePage()
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    // The person types into the brief box the page puts in front of them (one in a dialog over the page first), and sends it the
    // way that box sends.
    const box = (document.querySelector('[role="dialog"] textarea') ?? document.querySelector('textarea')) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Should we raise the price?' } })
    await act(async () => {
      if (box.id === 'view-chat-text') [...document.querySelectorAll('button')].find((b) => b.textContent === 'Send')!.click()
      else fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' })
      await new Promise((r) => setTimeout(r, 100))
    })
    await waitFor(() => expect(seen.some((r) => r.method === 'POST')).toBe(true))
    expect(seen.filter((r) => r.path.startsWith('/bff/'))).toEqual([])
    // Nor any other old-backend path (the turn endpoint is the build's: /bff on the lane build, /proxy here): only core's /api.
    expect(seen.filter((r) => !r.path.startsWith('/api/'))).toEqual([])
    expect(seen.filter((r) => r.method === 'POST').map((r) => r.path)).toEqual(['/api/scenarios'])
  })
})
