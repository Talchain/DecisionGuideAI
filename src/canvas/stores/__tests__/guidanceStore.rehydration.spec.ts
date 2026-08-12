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

  /**
   * ── THE WRITE-SIDE HASH, which this file could not previously see ──────────
   *
   * Every case above installs a provider returning a CONSTANT `GRAPH_HASH`, so
   * the hash stamped at write time can never move between authorship and a
   * later persist. That made the corpus blind in exactly the direction the code
   * was blind: it moved the READ hash and never the WRITE hash (traps 22b/13d —
   * a corpus that shares the code's asymmetry cannot see the code's defect).
   *
   * These cases vary the PROVIDER's hash, which is the only shape that can
   * observe it, and they are the review's, not this lane's.
   */
  describe('a persist that happens AFTER the graph moved must not launder the stamp', () => {
    /** Install a provider whose graph hash this test can move, as the real one does. */
    function movableProvider(initial: string) {
      const box = { hash: initial }
      setGuidancePersistenceContext(() => ({ scenarioId: SCENARIO, graphHash: box.hash }))
      return box
    }

    it('CASE 1 — accepting an assistant patch does not re-stamp the survivors', () => {
      const box = movableProvider('H1')
      // A turn authors two items against H1; one is pinned to the graph.
      useGuidanceStore.getState().setGuidanceItems([
        item('targeted', { graph_hash: 'cee-aag-v1' }),
        item('untargeted', { graph_hash: 'cee-aag-v1' }),
      ])

      // The user accepts an assistant patch. The graph moves H1 -> H2, and
      // ConversationPanel calls clearItemsByTargetIds for the patched elements.
      // That runs under beginExternalGraphMutation('patch_apply'), which
      // SUPPRESSES the clearGuidanceItems() a normal edit would fire — so the
      // untargeted item legitimately survives, and gets persisted again.
      box.hash = 'H2'
      useGuidanceStore.setState({
        guidanceItems: useGuidanceStore.getState().guidanceItems.map((i) =>
          i.item_id === 'targeted' ? { ...i, target_object: { type: 'node', id: 'n1' } } : i,
        ),
      })
      useGuidanceStore.getState().clearItemsByTargetIds(['n1'])
      expect(
        useGuidanceStore.getState().guidanceItems.map((i) => i.item_id),
        'precondition: the untargeted item must survive the patch, or this measures nothing',
      ).toEqual(['untargeted'])

      simulateReload()
      const adopted = useGuidanceStore.getState().rehydrateGuidance({
        scenarioId: SCENARIO,
        currentAnalysisHash: ANALYSIS_HASH,
        currentGraphHash: 'H2',
      })

      expect(
        adopted,
        'coaching authored against the PRE-patch model was adopted onto the post-patch graph: the persist that ' +
          'followed the patch re-stamped it at the new hash, so the gate compared H2 against H2 and let it through',
      ).toBe(0)
    })

    it('CASE 2 — dismissing an item does not re-stamp the rest', () => {
      const box = movableProvider('H1')
      useGuidanceStore.getState().setGuidanceItems([
        item('a', { graph_hash: 'cee-aag-v1' }),
        item('b', { graph_hash: 'cee-aag-v1' }),
      ])

      box.hash = 'H2' // the user edited the model
      useGuidanceStore.getState().dismissItem('a') // ...then dismissed a card

      simulateReload()
      expect(
        useGuidanceStore.getState().rehydrateGuidance({
          scenarioId: SCENARIO,
          currentAnalysisHash: ANALYSIS_HASH,
          currentGraphHash: 'H2',
        }),
        'a dismissal laundered the remaining item onto the edited graph',
      ).toBe(0)
    })

    it('CONTROL — with no intervening graph change, the survivors are still adopted', () => {
      // The discriminator. Without this, a fix that simply refused to adopt
      // anything after a non-authoring persist would satisfy both cases above
      // while destroying the feature.
      const box = movableProvider('H1')
      useGuidanceStore.getState().setGuidanceItems([
        item('a', { graph_hash: 'cee-aag-v1' }),
        item('b', { graph_hash: 'cee-aag-v1' }),
      ])
      useGuidanceStore.getState().dismissItem('a') // same persist path, graph unmoved
      expect(box.hash).toBe('H1')

      simulateReload()
      expect(
        useGuidanceStore.getState().rehydrateGuidance({
          scenarioId: SCENARIO,
          currentAnalysisHash: ANALYSIS_HASH,
          currentGraphHash: 'H1',
        }),
        'the fix threw away guidance that was still perfectly valid',
      ).toBe(1)
      expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toEqual(['b'])
    })

    it('a NEW turn after a graph change mints a fresh stamp and is adopted at the new hash', () => {
      // The other direction: authorship must still mint. A fix that inherited
      // the stamp everywhere would make new guidance un-adoptable.
      const box = movableProvider('H1')
      useGuidanceStore.getState().setGuidanceItems([item('old', { graph_hash: 'cee-aag-v1' })])
      box.hash = 'H2'
      useGuidanceStore.getState().setGuidanceItems([item('fresh', { graph_hash: 'cee-aag-v1' })])

      simulateReload()
      expect(
        useGuidanceStore.getState().rehydrateGuidance({
          scenarioId: SCENARIO,
          currentAnalysisHash: ANALYSIS_HASH,
          currentGraphHash: 'H2',
        }),
        'guidance authored against the CURRENT graph was refused — authorship must still mint a stamp',
      ).toBe(1)
      expect(useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)).toEqual(['fresh'])
    })
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
