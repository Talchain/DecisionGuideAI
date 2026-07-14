/**
 * Lane 5 (Codex P0-2 + P1) — decision-context isolation across full-context
 * replacements, and the shared active-goal-node resolver.
 *
 * Codex's adversarial store test showed graph hydration for a NEW scenario
 * RETAINED the old goalThreshold, outcomeNodeId and ceeAnalysisReady, so the
 * canonical default-attach could send the previous decision's target on the
 * next decision's run. Every full-context entry point — hydrateGraphSlice
 * (the production Supabase loader), importCanvas, and resetCanvas (incl. the
 * empty-graph early return) — must clear the decision context.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { resolveActiveGoalNodeId, resolveChipGoalThreshold } from '../../hooks/useV2Run'
import { applyDraftResult } from '../../utils/applyDraftResult'

function seedForeignContext() {
  useCanvasStore.setState({
    goalThreshold: 60,
    goalThresholdRepresentation: 'raw',
    ceeAnalysisReady: { goal_node_id: 'old_goal', options: [] } as never,
    ceeAnalysisReadyNodeIds: ['old_goal'],
    outcomeNodeId: 'old_goal',
    nodes: [{ id: 'old_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Old' } }] as never,
  } as never)
}

function expectContextCleared(expectedOutcome: string | null) {
  const s = useCanvasStore.getState()
  expect(s.goalThreshold).toBeNull()
  expect(s.goalThresholdRepresentation).toBeNull()
  expect(s.ceeAnalysisReady).toBeNull()
  // Review fold: outcomeNodeId is RE-DERIVED to the new graph's goal node
  // (not cleared to null, not left stale) — assert the derived id explicitly.
  expect(s.outcomeNodeId).toBe(expectedOutcome)
}

describe('decision-context clear on full-context replacement (Codex P0-2)', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('hydrateGraphSlice (production scenario load) clears the target + re-derives the outcome to the loaded goal', () => {
    seedForeignContext()
    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [{ id: 'new_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'New' } }] as never,
      edges: [],
      currentScenarioId: 'scn_new',
    })
    expectContextCleared('new_goal') // re-derived, not the stale 'old_goal' nor null
  })

  it('importCanvas clears the target/readiness and never leaves the stale outcome id', () => {
    // importCanvas routes nodes through importSnapshot (v1→v2 migration), so
    // the exact re-derived id is transform-dependent; the contract that
    // matters is: the previous decision's target/readiness are gone and the
    // stale outcome id does not survive.
    seedForeignContext()
    useCanvasStore.getState().importCanvas(
      JSON.stringify({ nodes: [{ id: 'imp_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Imported' } }], edges: [] }),
    )
    const s = useCanvasStore.getState()
    expect(s.goalThreshold).toBeNull()
    expect(s.goalThresholdRepresentation).toBeNull()
    expect(s.ceeAnalysisReady).toBeNull()
    expect(s.outcomeNodeId).not.toBe('old_goal')
  })

  it('resetCanvas clears the decision context EVEN when the graph is already empty (early-return leak)', () => {
    useCanvasStore.setState({
      nodes: [] as never,
      edges: [] as never,
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      ceeAnalysisReady: { goal_node_id: 'old_goal', options: [] } as never,
      outcomeNodeId: 'old_goal',
    } as never)
    useCanvasStore.getState().resetCanvas()
    expectContextCleared(null) // empty graph has no goal node
  })

  it('applyDraftResult clears the stale target so the NEW draft goal_threshold syncs (Codex P0-2 review fold)', () => {
    // A stale non-null threshold made setCeeAnalysisReady drop the draft's own
    // goal_threshold (sync gates on store == null) AND ride the new graph.
    useCanvasStore.setState({ goalThreshold: 99, goalThresholdRepresentation: 'raw' } as never)
    applyDraftResult({
      nodes: [{ id: 'd_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Drafted' } }],
      edges: [],
      analysis_ready: {
        goal_node_id: 'd_goal',
        options: [{ id: 'opt', label: 'A', status: 'ready', interventions: {} }],
        goal_threshold: 0.4,
      },
    } as never)
    const s = useCanvasStore.getState()
    // The draft's own threshold synced (0.4, tagged normalised) — not the stale 99.
    expect(s.goalThreshold).toBe(0.4)
    expect(s.goalThresholdRepresentation).toBe('normalised')
    // The single goal node is auto-selected.
    expect(s.outcomeNodeId).toBe('d_goal')
  })

  it('undoDraft reverts to the pre-draft graph and clears the drafted target', () => {
    useCanvasStore.setState({
      goalThreshold: 60,
      goalThresholdRepresentation: 'raw',
      draftChatPreDraftSnapshot: {
        nodes: [{ id: 'pre_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Pre' } }],
        edges: [],
      },
    } as never)
    useCanvasStore.getState().undoDraft()
    const s = useCanvasStore.getState()
    expect(s.goalThreshold).toBeNull()
    expect(s.goalThresholdRepresentation).toBeNull()
    expect(s.outcomeNodeId).toBe('pre_goal')
  })
})

describe('resolveActiveGoalNodeId — one validated resolution (Codex P1)', () => {
  const nodes = [
    { id: 'g_ready', type: 'goal', data: {} },
    { id: 'g_outcome', type: 'goal', data: {} },
    { id: 'g_first', type: 'goal', data: {} },
  ]

  it('prefers analysis_ready.goal_node_id when it exists', () => {
    expect(
      resolveActiveGoalNodeId({ ceeAnalysisReady: { goal_node_id: 'g_ready' }, outcomeNodeId: 'g_outcome', nodes }),
    ).toBe('g_ready')
  })

  it('SKIPS a stale analysis_ready id that is not in the graph, falls to outcomeNodeId', () => {
    expect(
      resolveActiveGoalNodeId({ ceeAnalysisReady: { goal_node_id: 'gone' }, outcomeNodeId: 'g_outcome', nodes }),
    ).toBe('g_outcome')
  })

  it('SKIPS a stale outcomeNodeId (reseeded away), falls to the FIRST goal node in the graph', () => {
    expect(
      resolveActiveGoalNodeId({ ceeAnalysisReady: null, outcomeNodeId: 'gone', nodes }),
    ).toBe('g_ready') // g_ready is nodes[0] — the first goal node
  })

  it('returns null when no goal node exists', () => {
    expect(
      resolveActiveGoalNodeId({ ceeAnalysisReady: null, outcomeNodeId: null, nodes: [{ id: 'f', type: 'factor', data: {} }] }),
    ).toBeNull()
  })
})

describe('end-to-end: the live 0.006 corruption is fixed through the store', () => {
  beforeEach(() => useCanvasStore.getState().reset())

  it('bare-synced 0.6 + a goal node with cap 100 resolves to 0.6 on the wire, not 0.006', () => {
    // Reproduce the captured live state: goal node carries raw 60 / cap 100;
    // analysis_ready carries bare normalised 0.6 (no raw, no cap).
    useCanvasStore.setState({
      nodes: [
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { success_threshold: 60, scale_max: 100 } },
      ] as never,
      goalThreshold: null,
    } as never)
    useCanvasStore.getState().setCeeAnalysisReady({
      goal_node_id: 'goal_1',
      options: [],
      goal_threshold: 0.6,
    } as never)

    const s = useCanvasStore.getState()
    // The bare-sync stored 0.6 tagged normalised.
    expect(s.goalThreshold).toBe(0.6)
    expect(s.goalThresholdRepresentation).toBe('normalised')

    // The canonical default-attach resolution (same call OutputsDock makes).
    const wire = resolveChipGoalThreshold(s.goalThreshold, {
      analysisReady: s.ceeAnalysisReady,
      nodes: s.nodes,
      goalNodeId: resolveActiveGoalNodeId(s),
      representation: s.goalThresholdRepresentation,
    })
    expect(wire).toBe(0.6)
  })
})
