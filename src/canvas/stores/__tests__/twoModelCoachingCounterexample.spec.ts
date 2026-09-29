/**
 * ⭐ D1 — THE SERVED TWO-MODEL COUNTEREXAMPLE, pinned (DL #72 5894237381; R3-B 5894061171, served `6QzQPIIS`).
 *
 * A guest built one model (Customer success deployment → NPS change from today), pressed "Start new model", and the
 * NEW MRR model's Analysis showed the first model's phase-3 finding ("Check an assumption Olumi made … Source: Olumi model
 * review"), keyed under the NEW scenario in `strengthen.lifecycle.v1`, and a cold reload re-served it.
 *
 * Every layer the DL named is pinned against the real stores, installed exactly as the canvas mount installs them:
 *  1. the live guidance is cleared before the switch can feed Strengthen (`guidanceScenarioBoundary`);
 *  2. a phase-3 finding whose target the new graph does not hold is never recorded (`strengthenStore` write guard);
 *  3. such a record already persisted (the reload case) is cleaned once the new graph is on screen (`pruneForeignTargets`);
 * with the same-model controls: a finding about an element the graph DOES hold is recorded and kept, and nothing is
 * judged while the graph is still empty (booting).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { useGuidanceStore, setGuidancePersistenceContext } from '../guidanceStore'
import { useStrengthenStore, recordKey } from '../strengthenStore'
import { installGuidanceScenarioBoundary } from '../guidanceScenarioBoundary'
import { installStrengthenGraphGuard } from '../strengthenGraphGuard'
import { useBootGraphReadStore } from '../../hydrate/bootGraphRead'

const OLD = 'scn-previous-model'
const NEW = '782e46ca-new-mrr-model'
const FOREIGN_TARGET = 'customer_success_deployment→nps_change_from_today' // as served
const PHASE3_ID = 'strengthen:phase3:b4e36471'

const oldGraph = {
  nodes: [{ id: 'customer_success_deployment', data: {} }, { id: 'nps_change_from_today', data: {} }],
  edges: [{ id: 'e1', source: 'customer_success_deployment', target: 'nps_change_from_today', data: {} }],
}
const newGraph = {
  nodes: [{ id: 'mrr', data: {} }, { id: 'monthly_churn', data: {} }],
  edges: [{ id: 'e2', source: 'monthly_churn', target: 'mrr', data: {} }],
}

function phase3(id: string, targetId: string) {
  return { id, targetId, priority: 1, title: 'Check an assumption Olumi made' } as never
}

let uninstall: Array<() => void> = []

beforeEach(() => {
  sessionStorage.clear()
  useBootGraphReadStore.setState({ byScenario: {} } as never)
  useStrengthenStore.getState()._reset()
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null } as never)
  useCanvasStore.setState({ currentScenarioId: OLD, ...oldGraph } as never)
  setGuidancePersistenceContext(() => ({ scenarioId: useCanvasStore.getState().currentScenarioId, graphHash: null }))
  uninstall = [installGuidanceScenarioBoundary(), installStrengthenGraphGuard()]
})
afterEach(() => { uninstall.forEach((u) => u()); setGuidancePersistenceContext(null) })

describe('the served two-model switch + reload', () => {
  it('SAME-MODEL CONTROL: on the first model, its own phase-3 finding is recorded', () => {
    useStrengthenStore.getState().reconcile([phase3(PHASE3_ID, FOREIGN_TARGET)], 'h1', OLD)
    expect(useStrengthenStore.getState().records[recordKey(OLD, PHASE3_ID)]).toBeDefined()
  })

  it('1. "Start new model": the first model\'s live coaching is cleared', () => {
    useGuidanceStore.getState().setGuidanceItems([{ item_id: 'b4e36471', title: 'Check an assumption Olumi made' } as never])
    useCanvasStore.setState({ currentScenarioId: NEW, ...newGraph } as never)
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
  })

  it('2. on the new model, the first model\'s finding is never recorded', () => {
    useCanvasStore.setState({ currentScenarioId: NEW, ...newGraph } as never)
    useStrengthenStore.getState().reconcile([phase3(PHASE3_ID, FOREIGN_TARGET)], 'h2', NEW)
    expect(useStrengthenStore.getState().records[recordKey(NEW, PHASE3_ID)]).toBeUndefined()
    useStrengthenStore.getState().seedIfAbsent(phase3(PHASE3_ID, FOREIGN_TARGET), 'h2', NEW)
    expect(useStrengthenStore.getState().records[recordKey(NEW, PHASE3_ID)]).toBeUndefined()
  })

  it('3. RELOAD: a record already persisted under the new model for the old element is cleaned, blob included', () => {
    // As served: the record sits under the NEW scenario, as the reload's `loadPersisted` would hand it back.
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useCanvasStore.setState({ currentScenarioId: NEW, ...newGraph } as never) // the new graph arrives
    expect(useStrengthenStore.getState().records[key]).toBeUndefined()
    expect(useStrengthenStore.getState().priorityOrder).not.toContain(key)
    expect(sessionStorage.getItem('strengthen.lifecycle.v1') ?? '').not.toContain('b4e36471')
  })

  it('CONTROL: a finding about an element the new graph DOES hold is recorded and survives the prune', () => {
    useCanvasStore.setState({ currentScenarioId: NEW, ...newGraph } as never)
    useStrengthenStore.getState().reconcile([phase3('strengthen:phase3:mrr1', 'monthly_churn→mrr')], 'h3', NEW)
    useStrengthenStore.getState().pruneForeignTargets()
    expect(useStrengthenStore.getState().records[recordKey(NEW, 'strengthen:phase3:mrr1')]).toBeDefined()
  })

  // ── PR Review on #2317 (5894785604): the partial-overlap and ID-first counterexamples ──────────────────────────
  const sharesOneEndpoint = {
    nodes: [{ id: 'mrr', data: {} }, { id: 'nps_change_from_today', data: {} }],
    edges: [{ id: 'e3', source: 'nps_change_from_today', target: 'mrr', data: {} }],
  }

  it('PARTIAL OVERLAP, write: a new model sharing ONE endpoint does not make the old link "exist"', () => {
    useCanvasStore.setState({ currentScenarioId: NEW, ...sharesOneEndpoint } as never)
    useStrengthenStore.getState().reconcile([phase3(PHASE3_ID, FOREIGN_TARGET)], 'h4', NEW)
    expect(useStrengthenStore.getState().records[recordKey(NEW, PHASE3_ID)]).toBeUndefined()
  })

  it('PARTIAL OVERLAP, cold prune: a persisted record for the old link is cleaned though one endpoint remains', () => {
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useCanvasStore.setState({ currentScenarioId: NEW, ...sharesOneEndpoint } as never)
    expect(useStrengthenStore.getState().records[key]).toBeUndefined()
  })

  it('ID-FIRST: the new id with the OLD graph still on screen is not judged by the old graph; the new graph then cleans it', () => {
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useCanvasStore.setState({ currentScenarioId: NEW } as never) // id first: the old model's nodes are still here
    // The old graph must not stand in for the new decision's: the old link "exists" in it, and must not be judged kept.
    useStrengthenStore.getState().reconcile([phase3('strengthen:phase3:other', 'customer_success_deployment')], 'h5', NEW)
    expect(useStrengthenStore.getState().records[recordKey(NEW, 'strengthen:phase3:other')]).toBeDefined() // not judged, as before
    useCanvasStore.setState({ ...newGraph } as never) // the new decision's graph arrives
    expect(useStrengthenStore.getState().records[key]).toBeUndefined()
    expect(useStrengthenStore.getState().records[recordKey(NEW, 'strengthen:phase3:other')]).toBeUndefined()
  })

  it('ID-FIRST, the discriminating case: a VALID new-model finding is not destroyed by being judged against the old graph', () => {
    const key = recordKey(NEW, 'strengthen:phase3:mrr1')
    const record = { id: 'strengthen:phase3:mrr1', status: 'recommended', snapshot: phase3('strengthen:phase3:mrr1', 'monthly_churn\u2192mrr'), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useCanvasStore.setState({ currentScenarioId: NEW } as never) // id first: the OLD graph (no monthly_churn→mrr) is on screen
    expect(useStrengthenStore.getState().records[key]).toBeDefined()
    useCanvasStore.setState({ ...newGraph } as never) // the new graph holds the link: the finding stays
    expect(useStrengthenStore.getState().records[key]).toBeDefined()
  })

  it('ID-FIRST, read in flight: a graph that arrives while the boot read is still reading is not judged yet', () => {
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useBootGraphReadStore.setState({ byScenario: { [NEW]: { token: 1, state: 'reading' } } } as never)
    useCanvasStore.setState({ currentScenarioId: NEW, ...newGraph } as never)
    expect(useStrengthenStore.getState().records[key]).toBeDefined()
    useBootGraphReadStore.setState({ byScenario: { [NEW]: { token: 1, state: 'merged' } } } as never)
    expect(useStrengthenStore.getState().records[key]).toBeUndefined()
  })

  it('CONTROL: nothing is judged while the graph is still empty (booting)', () => {
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useCanvasStore.setState({ currentScenarioId: NEW, nodes: [], edges: [] } as never)
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useStrengthenStore.getState().pruneForeignTargets()
    expect(useStrengthenStore.getState().records[key]).toBeDefined()
  })
})
