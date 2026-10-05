/**
 * THIN CLIENT — buddy round 1 (Codex, PR #2511). One row per finding fixed in this file's scope, each beside the
 * GUEST contrast row that shows the same call behaving as before, so a gate that never applied cannot pass.
 *
 *   P1-3  a restored layout still advances the layout generation (an older layout job cannot commit over CEE's graph)
 *   P2-5  saved limits come from CEE's read on a thin hydrate
 *   P2-6  a local "Save version" reports FAILURE in a thin session, never a save that did not happen
 *   P2-7  the scenario-list quota retry writes the stripped records, never the graphs the first write omitted
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import { __resetThinClientForTests, isThinClientSession, saveThinLayout } from '../thinClient'
import { saveScenarios, type Scenario } from '../../store/scenarios'
import { appendVersion, VERSIONS_STORAGE_KEY } from '../../versions/versionStorage'
import { captureModelVersion } from '../../versions/captureModelVersion'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

const SESSION_KEY = 'sb-testproject-auth-token'
const SCENARIOS_KEY = 'olumi-canvas-scenarios'
const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const LIMIT = { constraint_id: 'c1', node_id: 'n0', operator: '>=', value: 10 }

function signIn(): void {
  localStorage.setItem(SESSION_KEY, '{"access_token":"t","user":{"id":"u"}}')
  expect(isThinClientSession()).toBe(true)
}

function emptyCanvas(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    pendingLayout: false,
    goalConstraints: null,
    history: { past: [], future: [] },
  } as never)
}

function serverGraph(withLimits: boolean) {
  return {
    nodes: [
      { id: 'n0', kind: 'goal', label: 'Grow ARR' },
      { id: 'n1', kind: 'factor', label: 'Price point' },
      { id: 'n2', kind: 'factor', label: 'Churn rate' },
    ],
    edges: [],
    ...(withLimits ? { goal_constraints: [LIMIT] } : {}),
  }
}

beforeEach(() => {
  localStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  emptyCanvas()
})
afterEach(() => { vi.restoreAllMocks() })

describe('P1-3 — a restored layout still moves the layout generation', () => {
  it('CONTRAST — a guest hydrate asks for a layout and moves the generation', () => {
    const before = useCanvasStore.getState().layoutRequestId
    expect(mergeServerGraphOnHydrate(serverGraph(false)).accepted).toBe(true)
    expect(useCanvasStore.getState().pendingLayout).toBe(true)
    expect(useCanvasStore.getState().layoutRequestId).toBe(before + 1)
  })

  it('thin + saved layout ⇒ positions restored, NO layout asked for, and the generation still moves', () => {
    signIn()
    saveThinLayout(SCENARIO_ID, [
      { id: 'n0', position: { x: 700, y: 40 } },
      { id: 'n1', position: { x: 60, y: 420 } },
    ] as never)
    const before = useCanvasStore.getState().layoutRequestId
    expect(mergeServerGraphOnHydrate(serverGraph(false)).accepted).toBe(true)
    const state = useCanvasStore.getState()
    const n0 = (state.nodes as unknown as { id: string; position: { x: number; y: number } }[]).find((n) => n.id === 'n0')
    expect(n0?.position).toEqual({ x: 700, y: 40 })
    expect(state.pendingLayout).toBe(false)
    // An arrangement started for the previous scenario captured `before`; it must no longer be current.
    expect(state.layoutRequestId).toBe(before + 1)
  })
})

describe('P2-5 — saved limits come from CEE’s read on a thin hydrate', () => {
  it('CONTRAST — a guest hydrate leaves the store’s limits alone (unchanged behaviour)', () => {
    mergeServerGraphOnHydrate(serverGraph(true))
    expect(useCanvasStore.getState().goalConstraints).toBeNull()
  })

  it('thin ⇒ the read’s goal_constraints are on the canvas after the hydrate', () => {
    signIn()
    mergeServerGraphOnHydrate(serverGraph(true))
    const limits = useCanvasStore.getState().goalConstraints ?? []
    expect(limits.map((c) => c.constraint_id)).toEqual(['c1'])
  })

  it('thin ⇒ a read WITHOUT limits clears nothing (absence is not a clear)', () => {
    signIn()
    useCanvasStore.setState({ goalConstraints: [LIMIT] } as never)
    mergeServerGraphOnHydrate(serverGraph(false))
    expect((useCanvasStore.getState().goalConstraints ?? []).map((c) => c.constraint_id)).toEqual(['c1'])
  })
})

describe('P2-6 — a local version save never reports a save that did not happen', () => {
  const version = () =>
    captureModelVersion([{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hire two' } }] as never, [], {
      id: 'ver_1',
      name: 'Before pricing',
      origin: 'manual',
      createdAt: Date.now(),
    })

  it('CONTRAST — a guest save succeeds and is in the browser', () => {
    expect(appendVersion(version()).success).toBe(true)
    expect(localStorage.getItem(VERSIONS_STORAGE_KEY)).toContain('Hire two')
  })

  it('thin ⇒ the save reports failure and nothing is written', () => {
    signIn()
    expect(appendVersion(version()).success).toBe(false)
    expect(localStorage.getItem(VERSIONS_STORAGE_KEY)).toBeNull()
  })
})

describe('P2-7 — the scenario-list quota retry writes what the first write wrote', () => {
  const records = (): Scenario[] =>
    [
      {
        id: SCENARIO_ID,
        name: 'Pricing',
        createdAt: 1,
        updatedAt: 2,
        graph: { nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hire two' } }], edges: [] },
      },
    ] as unknown as Scenario[]

  function quotaOnFirstScenariosWrite(): void {
    const original = Storage.prototype.setItem
    let thrown = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SCENARIOS_KEY && !thrown) {
        thrown = true
        throw new DOMException('full', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    })
  }

  it('CONTRAST — a guest retry keeps the graph (unchanged behaviour), so the retry really ran', () => {
    quotaOnFirstScenariosWrite()
    saveScenarios(records())
    expect(localStorage.getItem(SCENARIOS_KEY)).toContain('Hire two')
  })

  it('thin ⇒ the retry stores the record without its graph', () => {
    signIn()
    quotaOnFirstScenariosWrite()
    saveScenarios(records())
    const stored = localStorage.getItem(SCENARIOS_KEY)
    expect(stored).toContain('Pricing')
    expect(stored).not.toContain('Hire two')
  })
})
