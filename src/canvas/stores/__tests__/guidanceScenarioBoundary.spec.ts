/**
 * ⭐ COACHING BELONGS TO ONE DECISION (R3-B, #72 5894061171: the previous model's "Check an assumption Olumi made …"
 * card showed on a NEW model, and survived a cold reload).
 *
 * CLAIM TYPE: the real canvas store and the real guidance store, and the real sessionStorage blob `rehydrateGuidance`
 * adopts after a reload. The boundary is installed exactly as the canvas mount installs it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { useGuidanceStore, setGuidancePersistenceContext } from '../guidanceStore'
import { installGuidanceScenarioBoundary, leavesDecision } from '../guidanceScenarioBoundary'

const ITEM = {
  item_id: 'b4e36471',
  title: 'Check an assumption Olumi made',
  target_id: 'customer_success_deployment__nps_change_from_today',
} as never

let uninstall: () => void = () => {}

function setScenario(id: string | null) {
  useCanvasStore.setState({ currentScenarioId: id } as never)
}

beforeEach(() => {
  sessionStorage.clear()
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null } as never)
  setScenario('scn-old')
  setGuidancePersistenceContext(() => ({ scenarioId: useCanvasStore.getState().currentScenarioId, graphHash: null }))
  uninstall = installGuidanceScenarioBoundary()
  useGuidanceStore.getState().setGuidanceItems([ITEM])
})
afterEach(() => { uninstall(); setGuidancePersistenceContext(null) })

describe('leaving a decision clears its coaching', () => {
  it('a different scenario resets live precedence even when the live turn delivered zero cards', () => {
    useGuidanceStore.getState().setGuidanceItems([])
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(true)
    setScenario('scn-new')
    expect(useGuidanceStore.getState().liveGuidanceAuthored).toBe(false)
    expect(useGuidanceStore.getState().adoptDeliveredGuidance({ scenarioId: 'scn-new', runId: 'run-new', items: [ITEM] })).toBe(1)
    expect(useGuidanceStore.getState().guidanceItems).toEqual([ITEM])
  })

  it('a DIFFERENT scenario: the live items AND the persisted blob are gone', () => {
    expect(sessionStorage.getItem('guidance.items.v1')).not.toBeNull()
    setScenario('scn-new')
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
    // What a cold reload would adopt for the new model: nothing.
    expect(useGuidanceStore.getState().rehydrateGuidance({ scenarioId: 'scn-new', currentAnalysisHash: null, currentGraphHash: null })).toBe(0)
  })

  it('leaving to NO scenario clears it too', () => {
    setScenario(null)
    expect(useGuidanceStore.getState().guidanceItems).toEqual([])
  })
})

describe('CONTROLS: the same decision keeps its coaching', () => {
  it('null → an id (the first turn minting the model\'s id) keeps the items', () => {
    uninstall()
    useGuidanceStore.setState({ guidanceItems: [] } as never)
    setScenario(null)
    uninstall = installGuidanceScenarioBoundary()
    useGuidanceStore.getState().setGuidanceItems([ITEM])
    setScenario('scn-minted')
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('an unrelated store write on the same scenario keeps the items', () => {
    useCanvasStore.setState({ nodes: [] } as never)
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('leavesDecision: the rule itself', () => {
    expect(leavesDecision('a', 'b')).toBe(true)
    expect(leavesDecision('a', null)).toBe(true)
    expect(leavesDecision(null, 'a')).toBe(false)
    expect(leavesDecision('a', 'a')).toBe(false)
  })
})
