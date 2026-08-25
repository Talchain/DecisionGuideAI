/**
 * The STALENESS pin — Core System A exit A3.
 *
 * `mergeServerGraphOnHydrate` changes canvas values on reload and, before this
 * spec, never marked the analysis stale. The user-visible consequence: the
 * canvas shows the merged (edited) graph while the Analysis panel shows the
 * PRE-EDIT result labelled current, and the only signal is a ~2s pulse.
 *
 * ⭐ WHY NOTHING ELSE CATCHES IT — each of these is real, and each is blind here:
 *   · `analysisFreshness.ts` compares `graph_hash_at_run` to
 *     `current_graph_hash`, and both are fields of the SAME stored blob — the
 *     check compares a value against itself, so it cannot see a canvas that
 *     moved after the blob was restored.
 *   · `validateCeeAnalysisReady` (`ceeAnalysisReadyValidation.ts:31`) compares
 *     NODE IDS ONLY, so a VALUE-ONLY edit passes and a stale result is upgraded
 *     to `fresh`.
 *   · `resultsLoadHistorical` (`store.ts:4142`) sets `graphEditedSinceLastRun:
 *     false`, and the server merge runs AFTER that, never flipping it back.
 *
 * ⚠ THE PREDICATE IS `changed`, NOT `overwroteExistingValues` — AND THAT
 * DIVERGENCE FROM THE PULSE/HISTORY GATES BESIDE IT IS DELIBERATE. Three
 * different questions share this commit block, and aligning them would be the
 * defect, not the tidy-up:
 *   · `pushHistory()`        — "is the user's work about to be destroyed?"
 *                              Only an OVERWRITE destroys. Additions do not.
 *   · `pulseAppliedTargets()`— "did a number move under the user's eyes?"
 *                              Only an OVERWRITE moves one. Additions do not.
 *   · `markGraphStructurallyEdited()`
 *                            — "is the canvas graph now different from the
 *                              graph the CURRENT FRESHNESS VERDICT was
 *                              established against?" ANY change makes the
 *                              verdict unsupported — an addition just as much
 *                              as an overwrite.
 * The ADDITION case is pinned below precisely so a later "make these three
 * consistent" pass goes RED instead of silently re-opening the lie.
 *
 * ⚠ AND IT IS NOT UNCONDITIONAL — marking every boot stale would be its own
 * defect (a false stale on the most common boot of all, the idempotent one).
 * The `if (!changed) return result` early return above the mark is what buys
 * that, and the no-op case below is what pins it.
 *
 * ⚠ jsdom/dev-branch note: this spec calls `mergeServerGraphOnHydrate`
 * DIRECTLY. The reload restore path in `ReactFlowGraph.tsx:1504-1691` sits
 * inside `if (import.meta.env.PROD)`, so no dev-mode *reload* observation would
 * be evidence about the shipped path. The merge function itself carries ZERO
 * `import.meta.env` references (derived at this tip), so it has no dev/prod
 * branch to take — the unit under test is byte-identical in both modes.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'

const SCENARIO = '11111111-2222-4333-8444-555555555555'

/**
 * Seed the exact post-restore posture the defect lives in: a graph on the
 * canvas and an analysis the store believes is CURRENT.
 */
function seedRestoredWithCurrentAnalysis(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 300, y: 400 },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
    // The "analysis reflects the current model" posture, as
    // `resultsLoadHistorical` + the freshness upgrade leave it.
    graphEditedSinceLastRun: false,
    analysisStateReady: true,
    analysisFreshnessDirty: false,
  } as never)
}

/**
 * PIN THE PRECONDITION IN-TEST. Without this, every assertion below could pass
 * on a store that was already dirty for some unrelated reason, and the spec
 * would be a tautology with no red anywhere.
 */
function assertAnalysisReadsCurrent(): void {
  const s = useCanvasStore.getState()
  expect(s.graphEditedSinceLastRun).toBe(false)
  expect(s.analysisStateReady).toBe(true)
  expect(s.analysisFreshnessDirty).toBe(false)
}

beforeEach(() => {
  seedRestoredWithCurrentAnalysis()
})

describe('mergeServerGraphOnHydrate — a merge that moves the model marks the analysis STALE', () => {
  it('marks stale when the server merge CHANGES AN EXISTING NODE VALUE', () => {
    assertAnalysisReadsCurrent()

    const result = mergeServerGraphOnHydrate({
      nodes: [
        // The overwrite: the canvas shows 100, the server holds 250.
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
      ],
      edges: [],
    })

    // Bind by IDENTITY, not by a value predicate another node could satisfy:
    // it is factor-1 specifically whose value the merge moved.
    expect(result.updatedNodeCount).toBe(1)
    const factor1 = useCanvasStore.getState().nodes.find((n: any) => n.id === 'factor-1') as any
    expect(factor1?.data?.value).toBe(250)

    // …and the analysis must no longer claim to be current, on ALL THREE flags.
    // The legacy pair and the freshness overlay have DISJOINT readers; setting
    // one and missing the other is how #344 shipped a false "current".
    const s = useCanvasStore.getState()
    expect(s.graphEditedSinceLastRun).toBe(true)
    expect(s.analysisStateReady).toBe(false)
    expect(s.analysisFreshnessDirty).toBe(true)
  })

  it('marks stale when the server merge only ADDS a node the canvas never had', () => {
    assertAnalysisReadsCurrent()

    const result = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
        { id: 'factor-2', kind: 'factor', label: 'Headcount' },
      ],
      edges: [],
    })

    // Nothing was OVERWRITTEN — this is the case the pulse and the history
    // snapshot deliberately sit out …
    expect(result.updatedNodeCount).toBe(0)
    expect(result.updatedEdgeCount).toBe(0)
    expect(result.addedNodeCount).toBe(1)
    expect(useCanvasStore.getState().nodes).toHaveLength(3)

    // … and yet the freshness verdict was established against a TWO-node graph
    // that is no longer on the canvas, so it is unsupported and must say so.
    const s = useCanvasStore.getState()
    expect(s.graphEditedSinceLastRun).toBe(true)
    expect(s.analysisStateReady).toBe(false)
    expect(s.analysisFreshnessDirty).toBe(true)
  })

  it('does NOT mark stale on a NO-OP merge — the idempotent boot stays current', () => {
    assertAnalysisReadsCurrent()

    const result = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
      ],
      edges: [],
    })

    // The server was READ and it already matched — accepted, not changed.
    expect(result.accepted).toBe(true)
    expect(result.refusedReason).toBeNull()
    expect(result.changed).toBe(false)

    // A one-sided guard here would convert an under-report into an
    // over-report: every idempotent boot would falsely read stale.
    const s = useCanvasStore.getState()
    expect(s.graphEditedSinceLastRun).toBe(false)
    expect(s.analysisStateReady).toBe(true)
    expect(s.analysisFreshnessDirty).toBe(false)
  })

  it('does NOT mark stale when the merge is REFUSED — nothing was observed', () => {
    assertAnalysisReadsCurrent()

    // Zero node-id overlap with a non-empty canvas — two unrelated graphs.
    const result = mergeServerGraphOnHydrate({
      nodes: [{ id: 'unrelated-99', kind: 'factor', label: 'Elsewhere', value: 7 }],
      edges: [],
    })

    expect(result.accepted).toBe(false)
    expect(result.refusedReason).toBe('zeroOverlap')

    const s = useCanvasStore.getState()
    expect(s.graphEditedSinceLastRun).toBe(false)
    expect(s.analysisStateReady).toBe(true)
    expect(s.analysisFreshnessDirty).toBe(false)
  })
})
