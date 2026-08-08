/**
 * ROADMAP 2.932 (Codex R4 finding MF2) — guest persistence must round-trip the
 * user's hard constraints. Before this fix, the guest path stored ONLY
 * `{ nodes, edges }`, so a reload or a scenario save silently discarded the
 * constraints and the product then reported "No limits on record".
 *
 * Two guest vessels, both covered here:
 *   - the localStorage AUTOSAVE record (autosaveProjection → saveAutosave),
 *   - the localStorage SCENARIO record (saveCurrentScenario → loadScenario).
 *
 * Plus the migration guard: an OLD record with no constraints field must still
 * load without error (additive shape change, never breaking).
 *
 * Bindings are by IDENTITY (constraint_id + operator + value), never a value
 * predicate another constraint could satisfy (CLAUDE.md trap 19).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import * as scenarios from '../scenarios'
import { saveAutosave, loadAutosave, type AutosaveData } from '../scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../autosaveProjection'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const goalNode = (id: string) => ({
  id,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { kind: 'goal', label: id },
})
const factorNode = (id: string) => ({
  id,
  type: 'factor',
  position: { x: 0, y: 120 },
  data: { kind: 'factor', label: id },
})

const CONSTRAINTS: CEEGoalConstraint[] = [
  { constraint_id: 'c_spend_max', node_id: 'factor-1', operator: '<=', value: 5000, unit: '£' },
  { constraint_id: 'c_revenue_min', node_id: 'goal-1', operator: '>=', value: 20000, unit: '£' },
]

/** Assert the restored set matches CONSTRAINTS by identity. */
function expectRestored(restored: ReturnType<typeof useCanvasStore.getState>['goalConstraints']) {
  expect(restored).not.toBeNull()
  expect(restored).toHaveLength(2)
  const spend = restored!.find((c) => c.constraint_id === 'c_spend_max')
  expect(spend).toBeDefined()
  expect(spend!.operator).toBe('<=')
  expect(spend!.value).toBe(5000)
  const revenue = restored!.find((c) => c.constraint_id === 'c_revenue_min')
  expect(revenue).toBeDefined()
  expect(revenue!.operator).toBe('>=')
  expect(revenue!.value).toBe(20000)
}

beforeEach(() => {
  localStorage.clear()
  scenarios.clearAutosave() // resets the identical-payload dedupe cache too
  useCanvasStore.getState().reset()
})

describe('ROADMAP 2.932 — guest SCENARIO record round-trips constraints', () => {
  it('saveCurrentScenario persists constraints; loadScenario restores them by identity', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal-1'), factorNode('factor-1')], edges: [] } as never)
    useCanvasStore.getState().setGoalConstraints(CONSTRAINTS as never, { fromProducerSync: true })

    const id = useCanvasStore.getState().saveCurrentScenario('MF2 test')
    expect(id).toBeTruthy()

    // Simulate a fresh session: nothing in memory.
    useCanvasStore.getState().setGoalConstraints(null, { fromProducerSync: true })
    expect(useCanvasStore.getState().goalConstraints).toBeNull()

    const ok = useCanvasStore.getState().loadScenario(id!)
    expect(ok).toBe(true)

    // RED at pristine (named): saveCurrentScenario stored only { nodes, edges }
    // and loadScenario never restored constraints — `restored` stays null, so
    // `expect(restored).not.toBeNull()` fails.
    expectRestored(useCanvasStore.getState().goalConstraints)
  })

  it('loadScenario CLEARS a stale in-memory constraint when the loaded record has none (no cross-scenario leak on this path)', () => {
    // A constraint-free scenario A that DOES carry a valid ceeAnalysisReady.
    // This is the discriminating setup: the valid-readiness branch of
    // setCeeAnalysisReady does NOT run READINESS_CLEAR_FIELDS, so the ONLY thing
    // that can clear the stale constraint on this path is the 2.932 restore.
    const optionNode = { id: 'opt-1', type: 'option', position: { x: 0, y: 240 }, data: { kind: 'option', label: 'A' } }
    const recA = scenarios.createScenario({
      name: 'A',
      nodes: [goalNode('goal-1'), optionNode] as never,
      edges: [],
      ceeAnalysisReady: {
        goal_node_id: 'goal-1',
        options: [{ id: 'opt-1', label: 'A', status: 'ready', interventions: {} }],
      } as never,
      ceeAnalysisReadyNodeIds: null,
    })
    // Decision B's constraints are still in memory.
    useCanvasStore.getState().setGoalConstraints(CONSTRAINTS as never, { fromProducerSync: true })

    useCanvasStore.getState().loadScenario(recA.id)

    // Guard the discriminator's precondition IN-TEST (trap 13b): the readiness
    // must have restored valid, or this would test the READINESS_CLEAR path by
    // accident and pass for the wrong reason.
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
    // RED at pristine: loadScenario left decision B's constraint on scenario A.
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })
})

describe('ROADMAP 2.932 — guest AUTOSAVE record round-trips constraints', () => {
  it('projectAutosaveData persists constraints; a reload hydrate restores them by identity', () => {
    useCanvasStore.setState({ nodes: [goalNode('goal-1'), factorNode('factor-1')], edges: [] } as never)
    useCanvasStore.getState().setGoalConstraints(CONSTRAINTS as never, { fromProducerSync: true })

    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))

    const loaded = loadAutosave()
    expect(loaded).not.toBeNull()

    // Simulate a fresh session, then replay ReactFlowGraph's autosave-restore
    // wiring: hydrate with the loaded constraints.
    useCanvasStore.getState().setGoalConstraints(null, { fromProducerSync: true })
    useCanvasStore.getState().hydrateGraphSlice({
      nodes: loaded!.nodes as never,
      edges: loaded!.edges as never,
      goalConstraints:
        (loaded as { goalConstraints?: typeof CONSTRAINTS }).goalConstraints ?? null,
    })

    // RED at pristine (named): the projection never emitted `goalConstraints`,
    // so the loaded record has none, the hydrate resolves it to null, and
    // `expect(restored).not.toBeNull()` fails.
    expectRestored(useCanvasStore.getState().goalConstraints)
  })
})

describe('ROADMAP 2.932 — migration safety: old records with no constraints still load', () => {
  it('an OLD autosave with no goalConstraints key loads and hydrates without error', () => {
    // Old shape — written before this field existed. Compiles at pristine and
    // post-fix because `goalConstraints` is optional on AutosaveData.
    saveAutosave({ timestamp: Date.now(), nodes: [goalNode('goal-1')], edges: [] } as AutosaveData)

    const loaded = loadAutosave()
    expect(loaded).not.toBeNull()
    expect((loaded as { goalConstraints?: unknown }).goalConstraints).toBeUndefined()

    expect(() =>
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loaded!.nodes as never,
        edges: loaded!.edges as never,
        goalConstraints:
          (loaded as { goalConstraints?: typeof CONSTRAINTS }).goalConstraints ?? null,
      }),
    ).not.toThrow()
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })

  it('an OLD scenario record with a bare { nodes, edges } graph loads without error', () => {
    const rec = scenarios.createScenario({ name: 'old', nodes: [goalNode('goal-1')], edges: [] })
    // Old shape carries no constraints key on the graph.
    expect((rec.graph as { goal_constraints?: unknown }).goal_constraints).toBeUndefined()

    expect(() => useCanvasStore.getState().loadScenario(rec.id)).not.toThrow()
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })
})
