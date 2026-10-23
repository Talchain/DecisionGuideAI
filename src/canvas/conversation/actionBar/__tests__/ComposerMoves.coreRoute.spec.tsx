/**
 * #2938 Codex: the composer's reasoning moves, proved ON THE WIRE. The real strip composer (`AIInputBar`) inside the real
 * conversation (`ConversationProvider` → `useConversation`), registered as the Olumi tab registers it
 * (`ConversationPanel` → `registerConversationCallbacks`), with `fetch` stubbed (pattern:
 * `useConversation.coreRouteServedTurn.spec.ts`). Each icon makes ONE POST to `/proxy/v5/turn` with
 * `x-olumi-ai-mode: core-route` and its own chip id, and nothing reaches `/agent/v1`; with a turn in flight every icon
 * says why and nothing is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'

import { ConversationProvider, useConversationContext } from '../../ConversationContext'
import { AIInputBar } from '../../../components/AIInputBar'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useActionBarStore } from '../actionBarStore'
import type { DispatchActionOpts } from '../../useConversation'
import served from '../../../../v5/__tests__/fixtures/core-turn-served-chat-edit.json'

vi.mock('../../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  isSupabaseAvailable: () => false,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
}))
vi.mock('../../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))

/** The Olumi tab's registration (`ConversationPanel.tsx`), with the conversation's own busy flag. */
function Registrar() {
  const c = useConversationContext()
  const busy = c.isThinking
  useEffect(() => useGuidanceStore.getState().registerConversationCallbacks(
    c.sendMessage, () => undefined, undefined, undefined, undefined, (opts) => { void c.dispatchAction(opts as DispatchActionOpts) }, () => busy,
  ), [c.sendMessage, c.dispatchAction, busy])
  return null
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const nodes = [
  { id: 'cap', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capacity' } },
  { id: 'goal', type: 'goal', position: { x: 1, y: 1 }, data: { label: 'Delivery' } },
]
type Call = { url: string; method: string; mode: string | null; chip: string | null }
let calls: Call[]
let hold: boolean

function stubFetch() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(init?.headers)
    let chip: string | null = null
    try { chip = (JSON.parse(String(init?.body ?? 'null')) as { chip?: { id?: string } } | null)?.chip?.id ?? null } catch { /* not JSON */ }
    calls.push({ url, method: (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase(), mode: headers.get('x-olumi-ai-mode'), chip })
    if (hold && /\/proxy\/v5\/turn/.test(url)) return new Promise<Response>(() => {})
    return new Response(JSON.stringify(served.chat_edit_turn), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
}
const turns = () => calls.filter((c) => /\/proxy\/v5\/turn|\/agent\/v1/.test(c.url))
const icon = (id: string) => screen.getAllByTestId('strip-composer-tool').find((b) => b.getAttribute('data-move') === id)!

function mount() {
  render(
    <ConversationProvider>
      <Registrar />
      <AIInputBar variant="strip" testId="strip" />
    </ConversationProvider>,
  )
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  hold = false
  useActionBarStore.setState({ bar: null, scenarioId: null })
  useCanvasStore.setState({
    currentScenarioId: SCENARIO, nodes, edges: [], results: { status: 'idle' },
    selection: { nodeIds: new Set(['cap']), edgeIds: new Set(), anchorPosition: null },
  } as never)
  stubFetch()
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

describe('the composer reasoning moves, on the core route', () => {
  it.each([
    ['challenge', 'ask:challenge'],
    ['opposite', 'ask:method-opposite'],
    ['evidence_against', 'ask:falsify'],
    ['outside_view', 'ask:method-outside-view'],
  ])('%s: one POST to /proxy/v5/turn on core-route with chip %s, none to /agent/v1', async (move, chipId) => {
    mount()
    await act(async () => { fireEvent.click(icon(move)); await new Promise((r) => setTimeout(r, 50)) })
    expect(turns()).toEqual([{ url: expect.stringMatching(/\/proxy\/v5\/turn$/), method: 'POST', mode: 'core-route', chip: chipId }])
    expect(calls.filter((c) => /\/agent\/v1/.test(c.url))).toHaveLength(0)
  })

  it('with a turn in flight, every icon says why and pressing sends nothing', async () => {
    hold = true
    mount()
    await act(async () => { fireEvent.click(icon('opposite')); await new Promise((r) => setTimeout(r, 50)) })
    expect(turns()).toHaveLength(1) // the turn now in flight
    for (const id of ['challenge', 'opposite', 'evidence_against', 'outside_view']) {
      expect(icon(id).getAttribute('aria-disabled')).toBe('true')
      expect(icon(id).getAttribute('aria-label')).toMatch(/: Olumi is still answering — try again in a moment$/)
      await act(async () => { fireEvent.click(icon(id)); await new Promise((r) => setTimeout(r, 20)) })
    }
    expect(turns()).toHaveLength(1)
  })
})
