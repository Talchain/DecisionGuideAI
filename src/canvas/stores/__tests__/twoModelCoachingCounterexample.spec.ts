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

  it('CONTROL: nothing is judged while the graph is still empty (booting)', () => {
    const key = recordKey(NEW, PHASE3_ID)
    const record = { id: PHASE3_ID, status: 'recommended', snapshot: phase3(PHASE3_ID, FOREIGN_TARGET), analysisHash: 'h', isStale: false, scenarioId: NEW, history: [] }
    useCanvasStore.setState({ currentScenarioId: NEW, nodes: [], edges: [] } as never)
    useStrengthenStore.setState({ records: { [key]: record }, priorityOrder: [key] } as never)
    useStrengthenStore.getState().pruneForeignTargets()
    expect(useStrengthenStore.getState().records[key]).toBeDefined()
  })
})
