/**
 * The core route's action bar, on the REAL send path: a core turn (`x-olumi-ai-mode: core-route`) carrying CEE's
 * `action_bar` goes through fetch → `parseV5Response` → `coreTurnToClientBody` → `useConversation`, and the Reasoning
 * panel's bar (`ReasoningActionBar`) draws CEE's offer. Only `fetch` is stubbed (pattern:
 * `useConversation.coreRouteServedTurn.spec.ts`). The bar is the one core serves today (CEE #3703): Pre-mortem only.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import { ConversationProvider, useConversationContext } from '../../ConversationContext'
import { useCanvasStore } from '../../../store'
import { useActionBarStore } from '../actionBarStore'
import { useScenarioActionBar } from '../useScenarioActionBar'
import { ReasoningActionBar } from '../../../../components/results/analysisNew/sections/ReasoningActionBar'
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

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

/** The bar core serves (CEE #3703, LENSES inbox 09:43Z): one Pre-mortem offer, enabled. */
const CORE_BAR = {
  v: 1,
  state_key: '0123456789abcdef',
  revision: { graph_hash: 'fedcba9876543210', run_key: null },
  priority: [],
  standard: [{
    action_id: 'pre_mortem',
    label: 'Pre-mortem',
    icon: 'SearchX',
    group: 'method',
    press_id: 'agent-next-pre-mortem',
    user_line: 'Run a pre-mortem on this model.',
    enabled: true,
    why_now: 'Imagine this went badly and work back to why.',
    offer_key: 'aaaabbbbccccdddd',
  }],
  more: [],
}

let sendNow: ((text: string) => Promise<void>) | null = null
function Panel() {
  const c = useConversationContext()
  sendNow = c.sendMessage as (text: string) => Promise<void>
  const bar = useScenarioActionBar()
  return bar ? <ReasoningActionBar bar={bar} canRerun={false} /> : <p data-testid="no-bar">no bar</p>
}

function stubTurn(body: Record<string, unknown>) {
  const calls: { url: string; mode: string | null }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push({ url, mode: new Headers(init?.headers).get('x-olumi-ai-mode') })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  return calls
}

async function sendOneTurn() {
  render(<ConversationProvider><Panel /></ConversationProvider>)
  await act(async () => { await sendNow!('What could go wrong here?') })
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  sendNow = null
  useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] })
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [], results: { status: 'idle' } } as never)
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

describe('a core turn carrying `action_bar`, through the real send path', () => {
  it('⭐ the panel draws the bar CEE sent: the Pre-mortem control, by its id and label', async () => {
    const calls = stubTurn({ ...served.chat_edit_turn, action_bar: CORE_BAR })
    await sendOneTurn()
    expect(calls.filter((c) => /\/proxy\/v5\/turn$/.test(c.url)).map((c) => c.mode)).toEqual(['core-route'])
    expect(screen.getByTestId('reasoning-action-bar')).toHaveAttribute('data-state-key', '0123456789abcdef')
    const control = screen.getByTestId('reasoning-action-bar-icon-pre_mortem')
    expect(control).toHaveAttribute('aria-label', 'Pre-mortem — Imagine this went badly and work back to why.')
    expect(control).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByTestId('no-bar')).toBeNull()
  })

  it('⛔ CONTRAST: the same core turn without `action_bar` draws no bar', async () => {
    stubTurn({ ...served.chat_edit_turn })
    await sendOneTurn()
    expect(screen.getByTestId('no-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('reasoning-action-bar')).toBeNull()
  })

  it('⛔ CONTRAST: `action_bar: null` (core offers nothing) draws no bar', async () => {
    stubTurn({ ...served.chat_edit_turn, action_bar: null })
    await sendOneTurn()
    expect(screen.getByTestId('no-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('reasoning-action-bar')).toBeNull()
  })
})
