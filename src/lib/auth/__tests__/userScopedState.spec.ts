import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUserScopedState, USER_SCOPED_STORAGE_KEYS, USER_SCOPED_STORAGE_PREFIXES } from '../userScopedState'
import { loadRuns, saveRuns, type StoredRun } from '../../../canvas/store/runHistory'
import { isGraphServerAcknowledged, markGraphServerAcknowledged } from '../../../canvas/store/importRegistrationMarker'
import { useServerConversationTurnsStore } from '../../../canvas/stores/serverConversationTurnsStore'

/** Browser tabs share localStorage, but each keeps its own sessionStorage across a reload. */
function tabSession(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

async function bootTab(session: Storage) {
  vi.stubGlobal('sessionStorage', session)
  vi.resetModules()
  const auth = await import('../userScopedState')
  const scenarios = await import('../../../canvas/store/scenarios')
  const success = await import('../../../components/results/modals/successMeasureStore')
  const strengthen = await import('../../../canvas/stores/strengthenStore')
  const guidance = await import('../../../canvas/stores/guidanceStore')
  const { useCanvasStore: canvas } = await import('../../../canvas/store')
  return { auth, scenarios, success, strengthen, guidance, canvas }
}

describe('user-scoped state identity boundary', () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals() })

  it.each(['shared-scenario', '__unscoped__'])('S-G2 joined A→B clears tab-local reasoning before reload (%s)', async scenarioKey => {
    localStorage.setItem('olumi-canvas-identity-epoch', 'era-A|owner:user-A')
    const sessionA = tabSession()
    const tabA = await bootTab(sessionA)
    expect(tabA.auth.adoptIdentityEpochAtSignIn('user-A')).toBe(true)
    tabA.success.useSuccessMeasureStore.getState().saveMeasure(scenarioKey, {
      metric: 'A private measure', direction: 'reach_at_least', threshold: 27, unit: '%',
      timeframe: 'A private timeframe', baseline: 'A private baseline', savedAt: 123,
    })
    tabA.strengthen.useStrengthenStore.getState().reconcile([{
      id: 'A-finding', helpType: 'clarify', title: 'A private finding', signal: 'A signal',
      whyNow: 'A reason', tryThis: 'A next step', sourceLine: 'Source: test.', targetId: null, priority: 1,
      action: { kind: 'ai-dialogue', label: 'Discuss', actionType: 'discuss', prompt: 'A words' },
    }], 'A-analysis', scenarioKey, 123)
    tabA.guidance.setGuidancePersistenceContext(() => ({ scenarioId: scenarioKey, graphHash: 'shared-graph' }))
    tabA.guidance.useGuidanceStore.getState().setGuidanceItems([{
      item_id: 'A-guidance', source: 'analysis', title: 'A private guidance', priority: 1,
      primary_action: { type: 'discuss', prompt: 'A private prompt' },
    }])
    tabA.canvas.getState().setCeeAnalysisReady({ status: 'ready', options: [], goal_node_id: 'A-goal' } as never)
    expect(tabA.canvas.getState().ceeAnalysisReady).not.toBeNull()
    expect(sessionA.getItem('olumi-cee-analysis-ready')).toContain('A-goal')
    sessionA.setItem('canvas.viewMode', 'device-preference')
    expect(sessionA.getItem('defineSuccess.measure.v1')).toContain('A private baseline')
    expect(sessionA.getItem('strengthen.lifecycle.v1')).toContain('A private finding')
    expect(sessionA.getItem('guidance.items.v1')).toContain('A private guidance')

    const sessionOther = tabSession()
    const other = await bootTab(sessionOther)
    expect(other.auth.adoptIdentityEpochAtSignIn('user-A')).toBe(true)
    expect(other.auth.clearUserScopedState('user-B')).toBe('fresh') // genuine A→B in another tab
    other.success.useSuccessMeasureStore.getState().saveMeasure('B-own-scenario', {
      metric: 'B own measure', direction: 'keep_below', threshold: 5, unit: '%',
      timeframe: 'B own timeframe', baseline: 'B own baseline', savedAt: 456,
    })
    localStorage.setItem('olumi-canvas-autosave', 'B own shared work')
    const sharedBeforeJoin = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))
    vi.stubGlobal('sessionStorage', sessionA)

    expect(tabA.auth.clearUserScopedState('user-B')).toBe('joined')
    expect(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
      'joining must preserve the current account\'s shared work').toEqual(sharedBeforeJoin)
    expect(tabA.success.useSuccessMeasureStore.getState().byScenario).toEqual({})
    expect(tabA.strengthen.useStrengthenStore.getState().records).toEqual({})
    expect(tabA.guidance.useGuidanceStore.getState().guidanceItems).toEqual([])
    expect(tabA.canvas.getState().ceeAnalysisReady).toBeNull()
    expect(tabA.canvas.getState().ceeAnalysisReadyNodeIds).toBeNull()
    expect(sessionA.getItem('canvas.viewMode')).toBe('device-preference')

    const reloadB = await bootTab(sessionA) // same-tab Reload keeps A's old sessionStorage if cleanup missed it
    expect(reloadB.auth.adoptIdentityEpochAtSignIn('user-B')).toBe(true)
    expect.soft(reloadB.success.selectSuccessMeasure(reloadB.success.useSuccessMeasureStore.getState(), scenarioKey),
      'B reopening Define success restored A\'s metric, timeframe and baseline').toBeNull()
    expect.soft(reloadB.success.selectSuccessMeasure(reloadB.success.useSuccessMeasureStore.getState(), '__unscoped__'),
      'B\'s empty canvas restored A\'s unscoped measure').toBeNull()
    expect.soft(reloadB.strengthen.useStrengthenStore.getState().records, 'B restored A\'s strengthen history').toEqual({})
    expect.soft(reloadB.guidance.useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: scenarioKey, currentAnalysisHash: 'A-analysis', currentGraphHash: 'shared-graph',
    }), 'B restored A\'s guidance blob').toBe(0)
    for (const key of ['defineSuccess.measure.v1', 'strengthen.lifecycle.v1', 'guidance.items.v1',
      'olumi-cee-analysis-ready', 'olumi-cee-analysis-ready-node-ids']) expect.soft(sessionA.getItem(key), key).toBeNull()
    expect(other.success.selectSuccessMeasure(other.success.useSuccessMeasureStore.getState(), 'B-own-scenario')?.metric).toBe('B own measure')
    expect(sessionOther.getItem('defineSuccess.measure.v1')).toContain('B own measure')
  })

  it('clears every registered persisted key and prefix while leaving device flags alone', () => {
    for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.setItem(key, 'user-a')
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) localStorage.setItem(`${prefix}scenario-a`, 'user-a')
    localStorage.setItem('feature.aiPanelV2', '1')
    clearUserScopedState()
    for (const key of USER_SCOPED_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull()
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) expect(localStorage.getItem(`${prefix}scenario-a`)).toBeNull()
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it("clears the previous account's run history, written and read through runHistory itself", () => {
    // Bound to the writer's own key, not the registry: a run A saved must not reach B's palette, ShareDrawer or restore.
    const runOfA = {
      id: 'run-of-a', ts: 1, seed: 7, adapter: 'httpv1', summary: "A's answer", graphHash: 'hash-a',
      report: { schema: 'report.v1' }, graph: { nodes: [{ id: 'a-private-factor' }], edges: [] },
    } as unknown as StoredRun
    saveRuns([runOfA])
    localStorage.setItem('feature.aiPanelV2', '1')
    expect(loadRuns().map(r => r.id)).toEqual(['run-of-a'])
    clearUserScopedState()
    expect(loadRuns()).toEqual([])
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it("clears the previous account's server acknowledgement, written and read through importRegistrationMarker", () => {
    // J1 ISO-1: after A -> B, `olumi.import.serverAcknowledged.v1` still named A's scenario. Bound to the marker's own
    // writer and reader, and to ISO-1's predicate: no stored value names A's scenario.
    const scenarioOfA = '9a9a9a9a-0000-4000-8000-a0a0a0a0a0a0'
    const nodes = [
      { id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow revenue' } },
      { id: 'opt', type: 'option', position: { x: 0, y: 100 }, data: { label: 'Raise prices' } },
    ]
    const edges = [{ id: 'e1', source: 'opt', target: 'goal', data: { weight: 0.5 } }]
    markGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never)
    expect(isGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never), 'precondition: A acknowledged').toBe(true)
    localStorage.setItem('feature.aiPanelV2', '1')
    clearUserScopedState()
    expect(isGraphServerAcknowledged(scenarioOfA, nodes as never, edges as never)).toBe(false)
    const naming = Object.keys(localStorage).filter(k => (localStorage.getItem(k) ?? '').includes(scenarioOfA))
    expect(naming, "a stored value still names A's scenario").toEqual([])
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it("clears the previous account's unconsumed server-turns offer; the next account's own offer is untouched", () => {
    // F3 (Codex #2501 r3): the offer is in memory and keyed by scenario only, so an offer read under A and not yet taken
    // would be handed to B's panel. Written and read through the store's own API.
    const offerFor = (scenarioId: string, words: string) => ({
      scenarioId,
      turns: [{ role: 'user', content: words }] as never,
      run: { runNotCurrent: false, currentRunComputedAt: null },
      heldProposalOffers: [],
    })
    useServerConversationTurnsStore.getState().offerServerConversationTurns(offerFor('scenario-of-a', "A's private brief"))
    expect(useServerConversationTurnsStore.getState().offer?.scenarioId, 'precondition: A has an unconsumed offer').toBe('scenario-of-a')
    clearUserScopedState()
    expect(useServerConversationTurnsStore.getState().offer, "A's offer survived the identity boundary").toBeNull()
    // Contrast: B's own offer, read after the boundary, stands until B's panel takes it.
    useServerConversationTurnsStore.getState().offerServerConversationTurns(offerFor('scenario-of-b', "B's own question"))
    expect(useServerConversationTurnsStore.getState().offer?.scenarioId).toBe('scenario-of-b')
    useServerConversationTurnsStore.getState().takeServerConversationTurns('scenario-of-b')
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })

  it('keeps the registry explicit so a new user-scoped persisted surface cannot hide in cleanup', () => {
    expect(new Set(USER_SCOPED_STORAGE_KEYS).size).toBe(USER_SCOPED_STORAGE_KEYS.length)
    expect(USER_SCOPED_STORAGE_PREFIXES.length).toBeGreaterThan(0)
  })
})
