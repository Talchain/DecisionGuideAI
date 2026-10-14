/**
 * P48 (audit #27): the conversation graph read's `changed_since_run` crosses the REAL adapter and hydration into the ONE
 * store the "Since the last run" cue reads. Bound by id: the node and the link (by its two ends) CEE named.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useCanvasStore } from '../../store'
import { isLinkChangedSinceRun, isNodeChangedSinceRun, useChangedSinceRunStore } from '../../changes/changedSinceRun'

const SID = '11111111-2222-4333-8444-555555555555'
const changed = {
  version: 1,
  since_run_id: 'run_b',
  node_ids: ['f'],
  links: [{ from: 'f', to: 'o' }],
  unattributed_changes: 0,
  complete: true,
}
const body = (withBlock: boolean) => ({
  schema: 'scenario_graph.v1',
  scenario_id: SID,
  graph_present: true,
  graph: {
    nodes: [{ id: 'f', kind: 'factor', label: 'Price' }, { id: 'o', kind: 'outcome', label: 'Revenue' }, { id: 'g', kind: 'factor', label: 'Cost' }],
    edges: [{ id: 'e1', from: 'f', to: 'o' }],
  },
  conversation_turns: [],
  ...(withBlock ? { changed_since_run: changed } : {}),
})
const fetchSpy = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null })
  useChangedSinceRunStore.setState({ scenarioId: null, value: null })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('P48 changed_since_run: graph read → hydration → the changed-since-run store', () => {
  it('the conversation read holds exactly the node and link CEE named, and not an unnamed one', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(true)), { status: 200 }))
    expect(await hydrateCanvasFromServer(SID, { includeConversationTurns: true })).toBe('merged')
    const s = useChangedSinceRunStore.getState()
    expect(s.scenarioId).toBe(SID)
    expect(isNodeChangedSinceRun(s, SID, 'f')).toBe(true)
    expect(isLinkChangedSinceRun(s, SID, 'f', 'o')).toBe(true)
    // Contrast: a node CEE did not name stays unmarked; the reversed link is a different link.
    expect(isNodeChangedSinceRun(s, SID, 'g')).toBe(false)
    expect(isLinkChangedSinceRun(s, SID, 'o', 'f')).toBe(false)
  })
  it('a read WITHOUT the conversation opt-in adopts nothing (the key is opt-in)', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(true)), { status: 200 }))
    await hydrateCanvasFromServer(SID)
    expect(useChangedSinceRunStore.getState()).toEqual({ scenarioId: null, value: null })
  })
  it('an absent block on a later conversation read clears what was held, never keeps stale marks', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(true)), { status: 200 }))
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(isNodeChangedSinceRun(useChangedSinceRunStore.getState(), SID, 'f')).toBe(true)
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(false)), { status: 200 }))
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(useChangedSinceRunStore.getState()).toEqual({ scenarioId: SID, value: null })
  })
})
