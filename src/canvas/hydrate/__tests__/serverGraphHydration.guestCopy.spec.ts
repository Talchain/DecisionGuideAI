/**
 * S-G slice 2: the REAL adapter → hydrate → hand-off carries the copy time of a decision copied from a guest at
 * sign-in, so the restored thread puts the copied turns under "From before you signed in", and the Analysis/Model
 * surfaces learn that a copied reply quotes an analysis this decision does not have.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { selectGuestCopyRunAgain, useGuestCopyOriginStore } from '../../stores/guestCopyOriginStore'
import { RESTORED_GUEST_COPY_DIVIDER, buildRestoredThread } from '../../conversation/serverConversationTurns'

const SID = 'fa02a890-0000-4000-8000-000000000001'
const COPIED_AT = '2026-10-07T08:40:58.000Z'
const body = {
  schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true,
  graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] },
  conversation_turns: [
    { turn_id: 'g-2', created_at: '2026-09-28T13:07:30Z', user_message: 'Run it', assistant_message: '‘Launch Starter Tier’: about 51% chance of meeting your goal, in this model.' },
  ],
}
const fetchSpy = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null })
  useServerConversationTurnsStore.setState({ offer: null })
  useGuestCopyOriginStore.getState().reset()
})
afterEach(() => { vi.unstubAllGlobals() })

describe('the hand-off for a guest copy', () => {
  it('⭐ the owner load recorded the copy → the offer carries its time, and Run-again becomes due', async () => {
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: SID, source_scenario_id: '657e63ef-f220-4fd5-9b4b-25e04334b3e4', created_at: COPIED_AT })
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })

    const offer = useServerConversationTurnsStore.getState().offer!
    expect(offer.run.copiedBefore).toBe(COPIED_AT)
    expect(buildRestoredThread(offer.turns, offer.run)[0].sessionDivider).toBe(RESTORED_GUEST_COPY_DIVIDER)
    expect(selectGuestCopyRunAgain(useGuestCopyOriginStore.getState(), SID)).toBe(true)
  })

  it('CONTRAST: not a copy → no copy time, no Run-again', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })

    expect(useServerConversationTurnsStore.getState().offer!.run).not.toHaveProperty('copiedBefore')
    expect(selectGuestCopyRunAgain(useGuestCopyOriginStore.getState(), SID)).toBe(false)
  })
})
