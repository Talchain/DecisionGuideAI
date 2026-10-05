import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { buildRestoredThread } from '../../conversation/serverConversationTurns'

const SID = '11111111-2222-4333-8444-555555555555'
const PID = 'prop_' + 'a'.repeat(32)
const actions = [
  { id: `agent-approve-proposal:${PID}`, label: 'Record this link', message: 'Yes, record that.', detail: 'The offered detail' },
  { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
]
const offers = [{ turn_id: 'held-turn', proposal_id: PID, suggested_actions: actions }]
const body = (withOffer: boolean) => ({ schema: 'scenario_graph.v1', scenario_id: SID,
  graph_present: true, graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] },
  conversation_turns: [{ turn_id: 'held-turn', created_at: '2026-10-05T09:00:00Z', user_message: null, assistant_message: 'Approve this change?' }],
  ...(withOffer ? { held_proposal_offers: offers } : {}), future_unknown_key: 'tolerated',
})
const fetchSpy = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null })
  useServerConversationTurnsStore.setState({ offer: null })
})
afterEach(() => { vi.unstubAllGlobals() })
describe('R2 /graph reader compatibility and the hydration handoff', () => {
  it('the existing parser accepts the additive envelope and carries the exact offers without changing the graph read', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(true)), { status: 200 }))
    const result = await fetchScenarioGraph(SID, { includeConversationTurns: true })
    expect(result.status).toBe('graph')
    if (result.status !== 'graph') throw new Error('unusable graph read')
    expect(result.heldProposalOffers).toEqual(offers)
    expect(result.graph).toEqual(body(true).graph)
    expect(JSON.parse(fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][1].body).include_conversation_turns).toBe(true)
  })
  it('the real adapter → hydrate → handoff → restored server thread carries both original controls', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(true)), { status: 200 }))
    expect(await hydrateCanvasFromServer(SID, { includeConversationTurns: true })).toBe('merged')
    const offer = useServerConversationTurnsStore.getState().offer!
    expect(offer.heldProposalOffers).toEqual(offers)
    const reply = buildRestoredThread(offer.turns, offer.run, offer.heldProposalOffers).find(m => m.id === 'restored-assistant-held-turn')!
    expect(reply.actionChips?.map(c => c.id)).toEqual(actions.map(c => c.id))
    expect(reply.actionChips?.[0].detail).toBe('The offered detail')
  })
  it('an absent held field still crosses the opt-in handoff, including an empty conversation, to withhold controls', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ...body(false), conversation_turns: [] }), { status: 200 }))
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(useServerConversationTurnsStore.getState().offer).toMatchObject({ scenarioId: SID, turns: [] })
    expect(useServerConversationTurnsStore.getState().offer?.heldProposalOffers).toBeUndefined()
  })
})
