/**
 * P0 (5 Oct 2026, staging, proven on the wire): scenario A2's model was registered INTO scenario A1.
 *
 * `POST /assist/v1/scenarios/<A1>/graph/register` (request af95a22f, 10:14:33Z) carried A2's graph:
 * incoming identity 489b0525 = A2's, CAS expected = current = A1's own read. The browser had bound A2's bytes to
 * A1's id at boot:
 *   1. a signed-in switch A1 → A2 (`useScenario.loadScenario`) moved the store and the autosave stamp to A2, but
 *      left the pointer on A1;
 *   2. a cold boot with no local record took the autosave slot (`resolveBootLoadSource`);
 *   3. `resolveRestoredScenarioId` bound the bytes to the POINTER (A1) instead of their own stamp (A2).
 *
 * These rows drive the REAL cold-load gate and boot functions in the PROD boot's order, from that exact state.
 * The rule they pin: restored bytes are only ever bound to the scenario that wrote them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import {
  MAIN_AUTOSAVE_SLOT,
  planColdLoadDeepLink,
  keyedAutosaveSlot,
  claimColdLoadDeepLink,
  settleKeyedAutosaveCopy,
  coldLoadBlocksBootRestore,
  __resetColdLoadDeepLinkForTests,
} from '../coldLoadDeepLink'
import { resolveBootLoadSource, bindRestoredScenarioId } from '../../ReactFlowGraph'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'

/** The wire case's two scenarios (the real ids from the 5 Oct trace). */
const A1 = '0265d61c-5ebe-4aa7-9cdd-96edcabee340'
const A2 = '4a492d04-1111-4111-8111-111111111111'

const PRISTINE = useCanvasStore.getState()
const node = (id: string, label: string): Node =>
  ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label, kind: 'option' } }) as unknown as Node
const GRAPH: Record<string, Node[]> = {
  [A1]: [node('a1_goal', 'G3-A1 goal'), node('a1_option', 'G3-A1 option')],
  [A2]: [node('a2_goal', 'G3-A2 goal'), node('a2_option', 'G3-A2 option')],
}
const ids = (id: string) => GRAPH[id].map((n) => n.id).sort()

let clock = 1_000_000
function autosaveFromStore(): void {
  scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState()), (clock += 1000)))
}
function newPage(): void {
  __resetColdLoadDeepLinkForTests()
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
}
/** The earlier page: A1 opened (pointer A1), then a signed-in switch to A2 that moves the store, not the pointer. */
function earlierPageSwitchedA1toA2WithoutPointer(): void {
  scenarios.setCurrentScenarioId(A1)
  useCanvasStore.setState({ currentScenarioId: A2, nodes: GRAPH[A2], edges: [] })
  autosaveFromStore()
  expect(JSON.parse(localStorage.getItem(MAIN_AUTOSAVE_SLOT) as string).scenarioId).toBe(A2)
  expect(scenarios.getCurrentScenarioId()).toBe(A1)
  newPage()
}
/** The canvas route's gate, as `useColdLoadDeepLinkGate` runs it at the first committed mount. */
function coldLoadGate(route: string | null): void {
  claimColdLoadDeepLink(route, planColdLoadDeepLink(route) !== null)
}
/** `ReactFlowGraph`'s PROD boot, autosave branch, in its own order. */
function bootRestore(): string | null | 'not_autosave' {
  const currentId = scenarios.getCurrentScenarioId()
  const autosave = coldLoadBlocksBootRestore() ? null : scenarios.loadAutosave()
  const scenario = currentId ? scenarios.getScenario(currentId) : null
  const loadSource = resolveBootLoadSource(currentId, autosave, scenario)
  if (loadSource !== 'autosave' || !autosave) return 'not_autosave'
  useCanvasStore.getState().hydrateGraphSlice({ nodes: autosave.nodes, edges: autosave.edges as never, goalConstraints: autosave.goalConstraints ?? null })
  const bound = bindRestoredScenarioId(currentId, autosave)
  settleKeyedAutosaveCopy(bound)
  return bound
}
const onCanvas = () => useCanvasStore.getState().nodes.map((n) => n.id).sort()
/** The bytes on the canvas and the id they are bound to: what any whole-graph writer would send, and where. */
const boundPair = () => ({ scenarioId: useCanvasStore.getState().currentScenarioId, nodes: onCanvas() })

beforeEach(() => {
  localStorage.clear()
  newPage()
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('P0 — restored bytes are bound to the scenario that wrote them (stamp, not pointer)', () => {
  it('⭐ THE WIRE CASE: a cold deep link to A1 never puts A2\'s model on the canvas as A1', () => {
    earlierPageSwitchedA1toA2WithoutPointer()
    coldLoadGate(A1)
    bootRestore()
    const pair = boundPair()
    // The defect: { scenarioId: A1, nodes: A2's }, which the next /graph/register writes into A1.
    if (pair.scenarioId === A1) expect(pair.nodes).not.toEqual(ids(A2))
    expect(pair.nodes.some((id) => id.startsWith('a2_')) && pair.scenarioId !== A2).toBe(false)
    // A2's work is not lost: its bytes are kept under its own keyed copy, stamped A2.
    const kept = localStorage.getItem(keyedAutosaveSlot(A2))
    expect(kept).not.toBeNull()
    expect(JSON.parse(kept as string).scenarioId).toBe(A2)
    expect((JSON.parse(kept as string).nodes as Array<{ id: string }>).map((n) => n.id).sort()).toEqual(ids(A2))
  })

  it('⭐ a routeless boot binds the restored bytes to their own stamp (display and identity agree)', () => {
    earlierPageSwitchedA1toA2WithoutPointer()
    coldLoadGate(null)
    const bound = bootRestore()
    expect(bound).toBe(A2)
    expect(boundPair()).toEqual({ scenarioId: A2, nodes: ids(A2) })
    // The pointer is reconverged to the bytes' owner, so the next reload agrees too.
    expect(scenarios.getCurrentScenarioId()).toBe(A2)
  })

  it('CONTRAST: pointer and stamp agree (A1/A1) — a deep link to A1 restores A1 exactly as before', () => {
    scenarios.setCurrentScenarioId(A1)
    useCanvasStore.setState({ currentScenarioId: A1, nodes: GRAPH[A1], edges: [] })
    autosaveFromStore()
    newPage()
    coldLoadGate(A1)
    expect(bootRestore()).toBe(A1)
    expect(boundPair()).toEqual({ scenarioId: A1, nodes: ids(A1) })
  })

  it('CONTRAST: a stamp that is not a UUID (a guest\'s local id) still yields to a well-formed pointer, as before', () => {
    scenarios.setCurrentScenarioId(A1)
    useCanvasStore.setState({ currentScenarioId: 'scenario-local-legacy', nodes: GRAPH[A1], edges: [] })
    autosaveFromStore()
    newPage()
    coldLoadGate(null)
    expect(bootRestore()).toBe(A1)
  })
})
