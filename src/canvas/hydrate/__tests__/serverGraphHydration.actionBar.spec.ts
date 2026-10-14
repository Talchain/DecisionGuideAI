/**
 * S-B slice 1 — RELOAD: the scenario read carries the action bar CEE re-derives for the model as it is, and the
 * hydration hands it to the same reader a live turn uses. The bar is one CEE captured from its routes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { parseActionBar } from '../../conversation/actionBar/actionBarContract'
import { useActionBarStore } from '../../conversation/actionBar/actionBarStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'

const SID = '11111111-2222-4333-8444-555555555555'
const CAPTURED = JSON.parse(readFileSync(join(__dirname, '../../conversation/actionBar/__tests__/fixtures/action-bar-v1-withheld-run.json'), 'utf8')) as Record<string, unknown>
const LIVE = parseActionBar(JSON.parse(readFileSync(join(__dirname, '../../conversation/actionBar/__tests__/fixtures/action-bar-v1-pre-run.json'), 'utf8')))!
const body = (extra: Record<string, unknown>) => ({
  schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true,
  graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] }, conversation_turns: [], ...extra,
})
const fetchSpy = vi.fn()
const serve = (extra: Record<string, unknown>) => fetchSpy.mockResolvedValue(new Response(JSON.stringify(body(extra)), { status: 200 }))

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null })
  useServerConversationTurnsStore.setState({ offer: null })
  useActionBarStore.setState({ bar: null, scenarioId: null, dismissed: [] })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('the action bar on reload', () => {
  it('the adapter carries the read’s action_bar raw, and tolerates its absence', async () => {
    serve({ action_bar: CAPTURED })
    const withBar = await fetchScenarioGraph(SID, { includeConversationTurns: true })
    expect(withBar.status === 'graph' && withBar.actionBar).toEqual(CAPTURED)
    serve({})
    const without = await fetchScenarioGraph(SID, { includeConversationTurns: true })
    expect(without.status === 'graph' && 'actionBar' in without ? without.actionBar : 'absent').toBeUndefined()
  })

  it('the real adapter → hydrate → store: the bar on the read is the bar both surfaces draw, for that scenario', async () => {
    serve({ action_bar: CAPTURED })
    expect(await hydrateCanvasFromServer(SID, { includeConversationTurns: true })).toBe('merged')
    const state = useActionBarStore.getState()
    expect(state.scenarioId).toBe(SID)
    expect(state.bar).toEqual(parseActionBar(CAPTURED))
    expect(state.bar!.state_key).toBe(CAPTURED.state_key)
  })

  it('⛔ CONTRAST: a read that carries no bar leaves a live turn’s bar exactly where it was', async () => {
    useActionBarStore.getState().setBar(SID, LIVE)
    serve({})
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(useActionBarStore.getState().bar).toBe(LIVE)
  })

  it('a NEWER bar on the read replaces the one a turn set (an edit since: the read is the fresher state)', async () => {
    useActionBarStore.getState().setBar(SID, LIVE)
    serve({ action_bar: CAPTURED })
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(useActionBarStore.getState().bar!.state_key).toBe(CAPTURED.state_key)
    expect(CAPTURED.state_key).not.toBe(LIVE.state_key)
  })

  it('a bar this build cannot read draws nothing and is reported, never half-drawn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useActionBarStore.getState().setBar(SID, LIVE)
    serve({ action_bar: { ...CAPTURED, v: 2 } })
    await hydrateCanvasFromServer(SID, { includeConversationTurns: true })
    expect(useActionBarStore.getState().bar).toBeNull()
    expect(warn).toHaveBeenCalledWith('[action_bar]', 'unknown_version', { kind: 'unknown_version', v: 2 })
    warn.mockRestore()
  })
})
