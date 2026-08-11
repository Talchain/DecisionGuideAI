/**
 * Guidance must survive a reload — and stale guidance must NOT.
 *
 * THE DEFECT. `guidanceItems` was written only from a live turn. The graph and
 * the transcript both rehydrate from localStorage; the user's coaching did not,
 * so a refresh silently emptied the strip, the on-canvas node coaching markers
 * and every inspector coaching section, and nothing said so.
 *
 * THE HARDER HALF, which is what most of this file tests. Guidance carries
 * `valid_while`, and advice about a model the user has since changed is worse
 * than no advice: it is confidently wrong on a surface whose job is to be
 * trusted. So every adoption gate here fails CLOSED, and each has a case
 * pointing in BOTH directions — one proving the item is adopted when it should
 * be, one proving it is dropped when it should be (CLAUDE.md trap 22b: a corpus
 * that tests one direction is a guard watching one door).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  useGuidanceStore,
  setGuidancePersistenceContext,
  type GuidanceItem,
} from '../guidanceStore'

const SCENARIO = 'scenario-aaa'
const OTHER_SCENARIO = 'scenario-bbb'
const GRAPH_HASH = 'ui-graph-hash-1'
const ANALYSIS_HASH = 'response-hash-1'

function item(id: string, validWhile?: GuidanceItem['valid_while']): GuidanceItem {
  return {
    item_id: id,
    source: 'analysis',
    title: `Coaching ${id}`,
    primary_action: { type: 'discuss', prompt: 'tell me more' },
    priority: 50,
    ...(validWhile ? { valid_while: validWhile } : {}),
  }
}

/** Simulate a reload: the module keeps running, so clear the in-memory state by hand. */
function simulateReload(): void {
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
}

describe('guidanceStore — rehydration across a reload', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
    setGuidancePersistenceContext(() => ({ scenarioId: SCENARIO, graphHash: GRAPH_HASH }))
  })
  afterEach(() => setGuidancePersistenceContext(null))

  it('an unconstrained item written by a live turn comes back after a reload', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1')])
    simulateReload()
    expect(useGuidanceStore.getState().guidanceItems, 'precondition: the reload emptied the store').toHaveLength(0)

    const adopted = useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: ANALYSIS_HASH,
      currentGraphHash: GRAPH_HASH,
    })

    expect(adopted, 'the user’s coaching vanished on refresh while the graph and transcript came back').toBe(1)
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toEqual(['g1'])
  })

  it('an item pinned to an analysis hash comes back when that analysis is still the live one', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1', { analysis_hash: ANALYSIS_HASH })])
    simulateReload()
    const adopted = useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: ANALYSIS_HASH,
      currentGraphHash: GRAPH_HASH,
    })
    expect(adopted).toBe(1)
  })

  it('DOES NOT come back when the live analysis is a different run — the twin of the case above', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1', { analysis_hash: ANALYSIS_HASH })])
    simulateReload()
    const adopted = useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: 'a-completely-different-run',
      currentGraphHash: GRAPH_HASH,
    })
    expect(adopted, 'coaching about a superseded analysis was restored onto the current one').toBe(0)
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('DOES NOT come back when the analysis hash cannot be verified at all — unverifiable is stale', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1', { analysis_hash: ANALYSIS_HASH })])
    simulateReload()
    expect(
      useGuidanceStore.getState().rehydrateGuidance({
        scenarioId: SCENARIO,
        currentAnalysisHash: null,
        currentGraphHash: GRAPH_HASH,
      }),
      'an item whose freshness could not be checked was kept on the grounds that it is probably fine',
    ).toBe(0)
  })

  it('an item pinned to the graph comes back only while the graph is byte-identical', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1', { graph_hash: 'cee-aag-v1-hash' })])
    simulateReload()

    // Same graph → adopted.
    expect(
      useGuidanceStore.getState().rehydrateGuidance({
        scenarioId: SCENARIO,
        currentAnalysisHash: ANALYSIS_HASH,
        currentGraphHash: GRAPH_HASH,
      }),
    ).toBe(1)
  })

  it('DOES NOT come back when the graph has moved — the twin, and note WHICH hash is compared', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1', { graph_hash: 'cee-aag-v1-hash' })])
    simulateReload()

    // The stored item's `valid_while.graph_hash` is CEE's aag_v1 and is NEVER
    // compared against a UI hash — that would be the category error
    // `compare-tab/types.ts` warns about. What moves here is the UI-side hash,
    // stamped at write time and re-derived at read time: same algorithm, both ends.
    const adopted = useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: ANALYSIS_HASH,
      currentGraphHash: 'ui-graph-hash-AFTER-AN-EDIT',
    })
    expect(adopted, 'coaching about the pre-edit model was restored onto an edited graph').toBe(0)
  })

  it('is never adopted by a DIFFERENT decision, and the blob is dropped rather than left to be found later', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1')])
    simulateReload()

    expect(
      useGuidanceStore.getState().rehydrateGuidance({
        scenarioId: OTHER_SCENARIO,
        currentAnalysisHash: ANALYSIS_HASH,
        currentGraphHash: GRAPH_HASH,
      }),
      'one decision’s coaching was adopted by another',
    ).toBe(0)

    // And it must not be lurking for a later boot of the original scenario either.
    expect(sessionStorage.getItem('guidance.items.v1')).toBeNull()
  })

  it('a structural edit that cleared guidance on screen also clears it on disk', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1')])
    useGuidanceStore.getState().clearGuidanceItems() // what useGraphEditEvents does
    simulateReload()

    expect(
      useGuidanceStore.getState().rehydrateGuidance({
        scenarioId: SCENARIO,
        currentAnalysisHash: ANALYSIS_HASH,
        currentGraphHash: GRAPH_HASH,
      }),
      'guidance the user’s own edit cleared came back on the next reload',
    ).toBe(0)
  })

  it('a dismissal survives the reload — the dismissed item does not come back', () => {
    useGuidanceStore.getState().setGuidanceItems([item('g1'), item('g2')])
    useGuidanceStore.getState().dismissItem('g1')
    simulateReload()

    useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: ANALYSIS_HASH,
      currentGraphHash: GRAPH_HASH,
    })
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toEqual(['g2'])
  })

  it('never overwrites guidance a live turn has already produced', () => {
    useGuidanceStore.getState().setGuidanceItems([item('old')])
    simulateReload()
    useGuidanceStore.getState().setGuidanceItems([item('fresh-from-this-turn')])

    const adopted = useGuidanceStore.getState().rehydrateGuidance({
      scenarioId: SCENARIO,
      currentAnalysisHash: ANALYSIS_HASH,
      currentGraphHash: GRAPH_HASH,
    })
    expect(adopted, 'a late rehydration clobbered the guidance the current turn had just delivered').toBe(0)
    expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toEqual(['fresh-from-this-turn'])
  })

  it('writes nothing at all when no decision identity is installed', () => {
    setGuidancePersistenceContext(() => ({ scenarioId: null, graphHash: null }))
    useGuidanceStore.getState().setGuidanceItems([item('g1')])
    expect(
      sessionStorage.getItem('guidance.items.v1'),
      'guidance was persisted under no decision identity — a blob no boot can safely adopt',
    ).toBeNull()
  })
})
