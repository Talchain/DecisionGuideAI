/**
 * ⚠⚠ P0-A / P0-B — A PRODUCER WRITE MUST NOT LOOK LIKE A USER EDIT.
 *
 * THE DEFECT THIS PINS, and it is the inverse of the one the hook was built to
 * close. `useGuidanceInvalidationOnEdit` clears ALL guidance on a structural
 * graph change that is not inside a `beginExternalGraphMutation` window. Four
 * PRODUCER writers had no such window, so mounting the hook on the live posture
 * destroyed coaching on the two most important journeys in the product — and
 * because `clearGuidanceItems()` also clears the persisted blob
 * (`guidanceStore.ts:608-613`), THE LOSS SURVIVED A RELOAD.
 *
 *   P0-A  an assistant turn WIPES THE COACHING IT JUST DELIVERED.
 *         `useConversation.ts:5076` mints guidance, `:5127` calls
 *         `applyDraftResult`, whose bare `setState` (`applyDraftResult.ts:225`)
 *         was unguarded. The repo's own `cee-orchestrator-response.json` fixture
 *         carries BOTH `guidance_items` and `draft_graph`, so this is the
 *         ordinary path, not a corner. ⭐ The V4 path sets guidance AFTER
 *         auto-apply ON PURPOSE (`:3909`); V5 mints first.
 *
 *   P0-B  THE PATCH-ACCEPT TAIL escaped the window. `ConversationPanel.tsx`
 *         :307 begin → :330 END → :335 `mirrorAnalysisReadyAfterAccept()` →
 *         :347 `clearItemsByTargetIds(allIds)`. The tail's node-`data` writes
 *         landed unsuppressed twelve lines before a DELIBERATE TARGETED prune,
 *         which then no-opped on an empty store. The existence of that targeted
 *         prune is itself proof the codebase expects guidance to be present and
 *         selectively preserved at that moment.
 *
 * ⚠ THIS FALSIFIED A LOAD-BEARING COMMENT THE HOOK SHIPPED WITH — "a blanket
 * clear here would destroy the untargeted items that are legitimately still
 * valid". That is TRUE OF THE GUARDED WINDOW and FALSE OF THE TAIL. Both the
 * hook's note and `guidanceStore.ts`'s have been corrected; this file is the
 * executable half of that correction.
 *
 * ⭐ WRITTEN FROM THE PRODUCER'S CALL ORDER, NOT FROM A MODEL OF IT. Every case
 * drives the REAL exported producer function — `applyDraftResult`,
 * `applyAnalysisReadyPatch`, `backfillGoalThresholdOntoGoalNode`,
 * `reconcileAppliedGraph` — never a hand-written reproduction of its `setState`.
 * A fixture the author wrote is not evidence about the producer (trap 16).
 *
 * BREADTH (trap 22b — the previous corpus was four USER-GESTURE framings and
 * could not see any of this): assistant turn carrying coaching + graph · the
 * post-guard patch-accept tail · boot hydration · applied-edit reconcile.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { useGuidanceInvalidationOnEdit } from '../useGraphEditEvents'
import {
  useGuidanceStore,
  setGuidancePersistenceContext,
  type GuidanceItem,
} from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import {
  applyDraftResult,
  backfillGoalThresholdOntoGoalNode,
} from '../../utils/applyDraftResult'
import { applyAnalysisReadyPatch } from '../utils/mirrorAnalysisReady'
import { reconcileAppliedGraph } from '../../utils/mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'

const SCENARIO = 'scenario-p0'
const ITEM_ID = 'guidance-delivered-by-this-turn'
const GOAL_ID = 'goal-1'
const OPTION_ID = 'opt-1'

function item(id: string): GuidanceItem {
  return {
    item_id: id,
    source: 'analysis',
    title: `Coaching ${id}`,
    primary_action: { type: 'discuss', prompt: 'tell me more' },
    priority: 50,
  }
}

function node(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

function guidanceIds(): string[] {
  return useGuidanceStore.getState().guidanceItems.map((i) => i.item_id)
}

/** What a reload would adopt — the blob, not just the in-memory store. */
function persistedIds(): string[] {
  try {
    const raw = sessionStorage.getItem('guidance.items.v1')
    if (!raw) return []
    const parsed = JSON.parse(raw) as { items?: Array<{ item_id: string }> }
    return (parsed.items ?? []).map((i) => i.item_id)
  } catch {
    return []
  }
}

beforeEach(() => {
  sessionStorage.clear()
  // The persistence provider is installed by the canvas boot path
  // (`ReactFlowGraph.tsx:1779`); without it `persistCurrent` returns early and
  // NOTHING is ever written — so the two blob assertions below would pass
  // vacuously against an empty store. Installing it here is what makes them
  // real evidence about a reload.
  setGuidancePersistenceContext(() => ({
    scenarioId: useCanvasStore.getState().currentScenarioId,
    graphHash: 'ui-hash-fixed',
  }))
  useCanvasStore.setState({
    nodes: [
      node(GOAL_ID, 'Profit'),
      node('n2', 'Cost'),
      // An OPTION node, so `backfillInterventionsOntoOptionNodes` has something
      // to write. Without it that writer no-ops and the guard covering it is
      // untested — which is exactly how mutant G1 first SURVIVED.
      { id: OPTION_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A', kind: 'option' } } as Node,
    ],
    edges: [] as Edge[],
    currentScenarioId: SCENARIO,
    _externalMutationActive: 0,
  } as never)
  useGuidanceStore.setState({ guidanceItems: [item(ITEM_ID)], activeGuidanceItemId: null })
})

afterEach(() => {
  setGuidancePersistenceContext(null)
  useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null })
  vi.restoreAllMocks()
})

describe('P0 — producer writes must not clear the user coaching', () => {
  it('CONTROL: the REAL store implements the guard the writers optional-chain', () => {
    // ⚠ THE GUARDS ARE WRITTEN `beginExternalGraphMutation?.(…)`, because several
    // existing specs pass PARTIAL STORE DOUBLES and a bare call throws in them
    // (the precedent is `mirrorAnalysisReady.ts`'s own `setAnalysisFreshness?.()`,
    // whose comment says exactly this). But an optional-chained GUARD is one
    // rename away from silently becoming a no-op, and a guard that cannot fire is
    // the P0 back again with nothing red. So the REAL store is pinned here: if
    // either method is ever removed or renamed, this REDs instead of the
    // suppression quietly evaporating.
    const st = useCanvasStore.getState() as unknown as Record<string, unknown>
    expect(typeof st.beginExternalGraphMutation).toBe('function')
    expect(typeof st.endExternalGraphMutation).toBe('function')
  })

  it('CONTROL: the fixture seeds the item and the hook is genuinely sensitive', () => {
    // Trap 13 — every "survived" assertion below is vacuous unless the hook can
    // actually clear. This is the POSITIVE control: a real user edit still wipes.
    expect(guidanceIds()).toContain(ITEM_ID)
    renderHook(() => useGuidanceInvalidationOnEdit())
    useCanvasStore.setState({
      nodes: [...(useCanvasStore.getState().nodes as Node[]), node('user-added', 'User node')],
    } as never)
    expect(guidanceIds(), 'the hook must still clear on a real local edit').not.toContain(ITEM_ID)
  })

  it('P0-B: the REAL patch-accept tail (applyAnalysisReadyPatch) must not clear guidance', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())

    // The producer function ConversationPanel calls at :335 and :393, driven
    // end-to-end. Its two backfills write node `data`.
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: {
          goal_node_id: GOAL_ID,
          goal_threshold_raw: 0.78,
          goal_threshold_unit: 'ratio',
          goal_threshold_cap: null,
        } as never,
      },
      { patchId: 'patch-1', scenarioId: SCENARIO },
    )

    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('P0-B leaf: backfillGoalThresholdOntoGoalNode alone must not clear guidance', () => {
    // The exact function the review drove to prove the defect.
    renderHook(() => useGuidanceInvalidationOnEdit())
    backfillGoalThresholdOntoGoalNode({
      goal_node_id: GOAL_ID,
      goal_threshold_raw: 0.42,
      goal_threshold_unit: 'ratio',
      goal_threshold_cap: null,
    })
    // Precondition: the write actually landed, or this asserts nothing.
    const goal = (useCanvasStore.getState().nodes as any[]).find((n) => n.id === GOAL_ID)
    expect(goal?.data?.goal_threshold_raw, 'precondition: the backfill wrote').toBe(0.42)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('P0-B: the INTERVENTIONS backfill (batchUpdateNodes, not setState) must not clear guidance', () => {
    // ⚠ THIS CASE EXISTS BECAUSE A MUTANT SURVIVED. Reverting the guard on
    // `applyAnalysisReadyPatch` left the suite 6/6 GREEN, because the only
    // writer the other cases reached was the goal-threshold backfill, which
    // carries its OWN guard. The interventions writer goes through
    // `batchUpdateNodes` — a store ACTION, a different write path entirely —
    // and nothing exercised it. An equivalent mutant must be DEMONSTRATED, not
    // assumed; this is the fixture that shows it was never equivalent.
    renderHook(() => useGuidanceInvalidationOnEdit())

    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: {
          options: [{ id: OPTION_ID, interventions: { price: 0.1 }, is_baseline: false }],
        } as never,
      },
      { patchId: 'patch-2', scenarioId: SCENARIO },
    )

    // Precondition: the write actually landed, or this asserts nothing.
    const opt = (useCanvasStore.getState().nodes as any[]).find((n) => n.id === OPTION_ID)
    expect(opt?.data?.interventions, 'precondition: the backfill wrote').toBeTruthy()
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('P0-A: a turn that mints guidance and then applies its draft graph keeps the guidance', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())

    // The producer's order, verbatim: mint (useConversation.ts:5076) …
    useGuidanceStore.getState().setGuidanceItems([item(ITEM_ID)])
    expect(guidanceIds(), 'precondition: the turn minted its coaching').toContain(ITEM_ID)

    // … then apply the draft graph (:5127 → applyDraftResult.ts:225).
    const applied = applyDraftResult(
      {
        nodes: [
          { id: 'd1', label: 'Demand', type: 'factor' },
          { id: 'd2', label: 'Price', type: 'factor' },
        ],
        edges: [{ from: 'd1', to: 'd2' }],
      } as never,
      { skipHistory: true },
    )

    // Precondition: the graph genuinely changed, or this test proves nothing.
    expect(applied.nodeCount, 'precondition: the draft actually applied').toBeGreaterThan(0)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('P0-A: the persisted blob survives too, so a reload does not inherit the loss', () => {
    renderHook(() => useGuidanceInvalidationOnEdit())
    useGuidanceStore.getState().setGuidanceItems([item(ITEM_ID)])
    expect(persistedIds(), 'precondition: the mint persisted').toContain(ITEM_ID)

    applyDraftResult(
      { nodes: [{ id: 'd1', label: 'Demand', type: 'factor' }], edges: [] } as never,
      { skipHistory: true },
    )

    expect(persistedIds()).toContain(ITEM_ID)
  })

  it('the APPLIED-EDIT RECEIPT (reconcileAppliedGraph) must not clear guidance', () => {
    // ⚠ ADDED BECAUSE THE MUTANT SURVIVED. Unguarding `reconcileAppliedGraph`
    // left the corpus 8/8 GREEN — not because the guard is equivalent, but
    // because nothing reached that writer. A survivor is a claim in both
    // directions and has to be settled with a discriminating fixture.
    renderHook(() => useGuidanceInvalidationOnEdit())

    const before = (useCanvasStore.getState().nodes as Node[]).length
    reconcileAppliedGraph({
      nodes: [
        { id: GOAL_ID, label: 'Profit', type: 'factor' },
        { id: 'recon-new', label: 'Reconciled arrival', type: 'factor' },
      ],
      edges: [],
    } as never)

    // Precondition: the reconcile genuinely moved the graph.
    const after = useCanvasStore.getState().nodes as Node[]
    expect(after.some((n) => n.id === 'recon-new'), 'precondition: reconcile wrote').toBe(true)
    expect(after.length).not.toBe(before)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('BOOT HYDRATION (mergeServerGraphOnHydrate) must not clear guidance', () => {
    // ⚠ ALSO ADDED FROM A SURVIVOR. This is the third concern the review raised
    // but could not verify — server-graph hydration landing on top of
    // `rehydrateGuidance`, whose own header promises "the user's coaching must
    // survive a refresh". Guarding the WRITER settles it WITHOUT depending on
    // effect ordering, which is the part the review had to leave inferred.
    renderHook(() => useGuidanceInvalidationOnEdit())

    const result = mergeServerGraphOnHydrate({
      nodes: [
        { id: GOAL_ID, label: 'Profit from server', type: 'factor' },
        { id: 'srv-new', label: 'Server arrival', type: 'factor' },
      ],
      edges: [],
    })

    // Precondition: the merge was not refused, or this asserts nothing.
    expect(
      (useCanvasStore.getState().nodes as Node[]).some((n) => n.id === 'srv-new'),
      `precondition: hydration wrote (result: ${JSON.stringify(result)})`,
    ).toBe(true)
    expect(guidanceIds()).toContain(ITEM_ID)
  })

  it('TWIN: after the producer write completes, the NEXT real user edit still clears', () => {
    // The guard must be a SKIP, not permanent deafness. Without the re-baseline
    // the hook would diff against a pre-producer graph forever.
    renderHook(() => useGuidanceInvalidationOnEdit())
    applyDraftResult(
      { nodes: [{ id: 'd1', label: 'Demand', type: 'factor' }], edges: [] } as never,
      { skipHistory: true },
    )
    useGuidanceStore.setState({ guidanceItems: [item(ITEM_ID)], activeGuidanceItemId: null })

    useCanvasStore.setState({
      nodes: [...(useCanvasStore.getState().nodes as Node[]), node('user-added', 'User node')],
    } as never)

    expect(guidanceIds()).not.toContain(ITEM_ID)
  })
})
