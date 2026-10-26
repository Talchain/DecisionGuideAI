/**
 * ⭐ A CORE TURN IS APPLIED FROM ITS OWN CONTRACT (U4; ALPHA-CODE-INVENTORY §1 U4, finding 2). Every core-route turn went
 * through `coreTurnToClientBody` → `applyV5State`, the legacy V2-envelope applier, whose steps a core turn never feeds
 * (stage, method pointing, enrichment, `analysis_ready`, results hydration, premortem, the leader claim). Now
 * `applyCoreTurnState` writes only what the turn carries: its note beside its card, the saved model's revision, and the
 * analysis verdict as CEE sent it.
 *
 * Real path (as `coreTurnActionBar.realPath.spec.tsx`): fetch → `parseV5Response` → `useConversation`, only `fetch`
 * stubbed. The turn is CEE's served chat edit (`core-turn-served-chat-edit.json`); its note on "price" is SYNTHETIC
 * (labelled: that turn sent none), in the contract's own shape.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

import { ConversationProvider, useConversationContext } from '../ConversationContext'
import { useCanvasStore } from '../../store'
import served from '../../../v5/__tests__/fixtures/core-turn-served-chat-edit.json'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  isSupabaseAvailable: () => false,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e5'
const TURN = served.chat_edit_turn
const NOTE = { element_id: 'price', text: 'Would a higher price lose more loaves than it gains?' }
let sendNow: ((text: string) => Promise<void>) | null = null
function Panel() { sendNow = useConversationContext().sendMessage as (text: string) => Promise<void>; return null }

function stubTurn(body: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const read = url.includes(`/scenarios/${SCENARIO}/graph`)
      ? { schema: 'scenario_graph.v1', scenario_id: SCENARIO, graph_present: true, graph_hash: useCanvasStore.getState().lastServerGraphHash, graph: TURN.model.graph }
      : body
    return new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
}
/** The board already holds the turn's cards (a chat edit on an existing model). */
const boardNodes = () => (TURN.model.graph.nodes as Array<{ id: string; label: string; kind: string }>)
  .map((n, i) => ({ id: n.id, type: n.kind, position: { x: 0, y: i * 100 }, data: { label: n.label, kind: n.kind } }))

async function sendOneTurn() {
  render(<ConversationProvider><Panel /></ConversationProvider>)
  await act(async () => { await sendNow!('What if the price went up?') })
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  sendNow = null
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: boardNodes(), edges: [], results: { status: 'idle' },
    olumiAttention: null, currentStage: 'analyse', lastServerGraphHash: 'before0000000000' } as never)
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals() })

describe('a core turn, applied from its own contract', () => {
  it('its note is held beside its card, bound to the saved model it was written against', async () => {
    stubTurn({ ...TURN, notes: [NOTE] })
    await sendOneTurn()
    const attention = useCanvasStore.getState().olumiAttention as { nodeIds: string[]; note: { body: string } | null; modelVersion: string | null } | null
    expect(attention?.nodeIds).toEqual(['price'])
    expect(attention?.note?.body).toBe(NOTE.text)
    expect(attention?.modelVersion).toBe(TURN.model.revision)
  })

  it('the revision is adopted and the verdict is CEE\'s; the legacy stage step does not run', async () => {
    stubTurn({ ...TURN })
    await sendOneTurn()
    const s = useCanvasStore.getState() as unknown as { lastServerGraphHash: string; analysisStateV1: { run_state: { kind: string } } | null; currentStage: string }
    expect(s.lastServerGraphHash).toBe(TURN.model.revision)
    expect(s.analysisStateV1?.run_state.kind).toBe('blocked')
    // `applyV5State` set the stage to the envelope's 'frame' on every core turn; a core turn carries no stage.
    expect(s.currentStage).toBe('analyse')
  })

  it('CONTRAST: a note on a card not on the canvas holds nothing (fail-closed, as before)', async () => {
    stubTurn({ ...TURN, notes: [{ ...NOTE, element_id: 'not_a_card' }] })
    await sendOneTurn()
    expect(useCanvasStore.getState().olumiAttention).toBeNull()
  })
})
