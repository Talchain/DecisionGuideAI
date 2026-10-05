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

  /**
   * THE LEGACY STATE + IN-APP NAVIGATION (Acceptance's 11:49Z reproduction: CEE registered D2's bytes into D1 0.5 s
   * after an in-app navigation from the list). A browser that used the pre-fix build already holds a stale pointer (D1)
   * and a slot stamped D2. The page has mounted a canvas before, so the cold-load gate is SETTLED ('not_first') and the
   * remounted canvas's boot restore is the only binder. It must never pair D2's bytes with D1: that pair is exactly what
   * the whole-graph register then writes into D1.
   */
  it('⭐ LEGACY STATE + IN-APP NAVIGATION: with the gate already settled, a stale pointer D1 never receives the D2-stamped slot', () => {
    earlierPageSwitchedA1toA2WithoutPointer() // pointer A1 (stale), slot stamped A2 holding A2's bytes: the legacy state
    claimColdLoadDeepLink(null, false) // an earlier canvas mount in this page settled the gate without applying anything
    expect(claimColdLoadDeepLink(A1)).toBe('not_first') // the in-app navigation to A1 gets no plan
    expect(scenarios.getCurrentScenarioId()).toBe(A1) // still the legacy pointer when the remounted canvas boots
    bootRestore()
    const pair = boundPair()
    expect(pair.scenarioId === A1 && pair.nodes.some((id) => id.startsWith('a2_'))).toBe(false)
    expect(pair).toEqual({ scenarioId: A2, nodes: ids(A2) }) // the bytes keep their own identity
  })

  it('CONTRAST (legacy in-app navigation): pointer and stamp agree on A1 — the remount restores A1 under A1, as before', () => {
    scenarios.setCurrentScenarioId(A1)
    useCanvasStore.setState({ currentScenarioId: A1, nodes: GRAPH[A1], edges: [] })
    autosaveFromStore()
    newPage()
    claimColdLoadDeepLink(null, false)
    expect(claimColdLoadDeepLink(A1)).toBe('not_first')
    bootRestore()
    expect(boundPair()).toEqual({ scenarioId: A1, nodes: ids(A1) })
  })

  it('⭐ a routeless boot binds the restored bytes to their own stamp (display and identity agree)', () => {
    earlierPageSwitchedA1toA2WithoutPointer()
    coldLoadGate(null)
    // The store already names the slot's owner before the body's first render (no first-commit effect runs on A1).
    expect(useCanvasStore.getState().currentScenarioId).toBe(A2)
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

  it('CONTRAST (guest): a switch A→B that wrote the pointer, reloaded before the slot caught up, still lands on B\'s own record; A\'s lagging slot is kept under A', () => {
    scenarios.createScenario({ id: A1, name: 'A', nodes: GRAPH[A1] as never, edges: [] } as never)
    scenarios.createScenario({ id: A2, name: 'B', nodes: GRAPH[A2] as never, edges: [] } as never)
    useCanvasStore.setState({ currentScenarioId: A1, nodes: GRAPH[A1], edges: [] })
    autosaveFromStore() // the slot still holds A (stamped A1)
    scenarios.setCurrentScenarioId(A2) // the guest switch wrote the pointer first
    newPage()
    coldLoadGate(null)
    expect(scenarios.getCurrentScenarioId()).toBe(A2)
    expect(useCanvasStore.getState().currentScenarioId).toBe(A2)
    expect(bootRestore()).toBe('not_autosave') // the boot loads B's own record, never A's slot as B
    const kept = localStorage.getItem(keyedAutosaveSlot(A1))
    expect(kept).not.toBeNull()
    expect(JSON.parse(kept as string).scenarioId).toBe(A1)
  })

  it('⭐ (Codex r1) a legacy non-UUID stamp is never bound to a pointer that names another scenario: draft mode instead', () => {
    // A legacy local scenario X's bytes, stamped with its non-UUID id; the pointer then moved to A1 (no local record).
    scenarios.setCurrentScenarioId(A1)
    useCanvasStore.setState({ currentScenarioId: 'scenario-1712345678-ab12', nodes: GRAPH[A2], edges: [] })
    autosaveFromStore()
    newPage()
    coldLoadGate(null)
    expect(bootRestore()).toBeNull()
    const pair = boundPair()
    expect(pair.scenarioId).toBeNull()
    expect(pair.scenarioId === A1 && pair.nodes.some((id) => id.startsWith('a2_'))).toBe(false)
  })
})
