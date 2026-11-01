/**
 * A chat turn olumi-core fails is said in olumi-core's own words, not DGAI's generic "Something went wrong on our side": the
 * server writes them for the person (open your private link; wait this long; what moved; that nothing was saved), and a resend
 * is offered only where core says it is safe (a 401 offers none: opening the link is the way on; a 429 offers it, for after the wait).
 * Real useConversation and V5 adapter/parser; only the seams are mocked (as `refusedFigureEdit.spec.ts`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import { useConversation } from '../../canvas/conversation/useConversation'
import { useCanvasStore } from '../../canvas/store'
import { errorTurn, CoreError } from '../../../scripts/olumi-core/lib/core.mjs'

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

async function say(answer: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('/graph')
    ? new Response(JSON.stringify({ schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: false, graph: null }), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }))))
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
  const { result } = renderHook(() => useConversation())
  await act(async () => { await result.current.sendMessage('What matters most here?') })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  const reply = [...result.current.messages].reverse().find((m) => m.role === 'assistant')
  return { content: reply?.content ?? '', chips: (reply?.actionChips ?? []).map((c) => c.id) }
}

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('a failed chat turn, in olumi-core\'s own words (gap 6)', () => {
  it('401: sends the person to their private link, and offers no resend', async () => {
    const out = await say(errorTurn('t-1', new CoreError(401, 'open your private link first')))
    expect(out.content).toMatch(/^Open your private link to continue\./)
    expect(out.chips).not.toContain('retry')
  })
  it('429: says when to come back, in core\'s own wait, and offers the resend for after it', async () => {
    const out = await say(errorTurn('t-2', new CoreError(429, 'Olumi has had 10 requests from you in the last 5 minutes, the most it takes. Try again in about 2 minutes.', { retryAfter: '95' })))
    expect(out.content).toBe('Olumi has had 10 requests from you in the last 5 minutes, the most it takes. Try again in about 2 minutes.')
    expect(out.chips).toContain('retry')
  })
  it('409: says what moved, and that nothing was saved', async () => {
    const out = await say(errorTurn('t-3', new CoreError(409, 'the model changed while Olumi was working; send your message again')))
    expect(out.content).toBe('The model changed while Olumi was working; send your message again. Nothing was saved.')
  })
  it('502: says Olumi could not finish and nothing was saved, never "something went wrong on our side"', async () => {
    const out = await say(errorTurn('t-4', new CoreError(502, 'Olumi could not finish: update call failed')))
    expect(out.content).toBe('Olumi could not finish that this time, and nothing was saved. Please try again in a moment.')
    expect(out.chips).toContain('retry')
  })
  it('a reply core could not finish (a chat row with a problem) is said as it is', async () => {
    const out = await say({ turn_id: 't-5', assistant_text: '', model: null, cards: [], notes: [], run: null, receipts: [], error: { code: 'olumi_could_not_finish', message: 'Olumi could not finish that. Olumi could not check that against the model. Nothing was saved.', retry_safe: true, nothing_saved: true } })
    expect(out.content).toBe('Olumi could not finish that. Olumi could not check that against the model. Nothing was saved.')
  })
})
