/**
 * Regression test for ROADMAP 1.22 residual (filed alongside UI PR #250):
 *
 * applyDraftResult only ever reads `goal_constraints` from the object it is
 * given. On the inline-draft-graph turn path (useConversation.ts sendTurn),
 * that object is `attachAnalysisReadyToInlineDraftGraph(response.draft_graph,
 * response)` — i.e. the `draft_graph` sub-object, NOT the true V5 response
 * root. CEE places `goal_constraints` at the response root as a SIBLING of
 * `draft_graph`, never nested inside it, so the inline object never carries
 * its own `goal_constraints` key.
 *
 * Net effect (pre-fix): applyDraftResult's `isCEEv3Response(draftData)` check
 * passes (analysis_ready + nodes/edges are present via the existing
 * attachment), but `draftData.goal_constraints` is always undefined on this
 * path — so the "no constraints" branch fires on EVERY inline-draft turn and
 * clears `goalConstraints` back to null, even when the true response root
 * carries real constraints.
 *
 * Fix: `attachAnalysisReadyToInlineDraftGraph` also attaches the response
 * root's `goal_constraints` onto the inline object (mirroring exactly how it
 * already attaches `analysis_ready`), so applyDraftResult's existing read
 * sees the true root value.
 */

import { describe, expect, it } from 'vitest'

import { attachAnalysisReadyToInlineDraftGraph } from '../useConversation'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

describe('ROADMAP 1.22 residual: inline-draft goal_constraints from response root', () => {
  const constraints: CEEGoalConstraint[] = [
    { id: 'c1', label: 'Churn ≤ 5%', operator: '<=', value: 0.05 },
  ]

  it('attaches response-root goal_constraints onto an inline draft graph that lacks its own', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, {
      analysis_ready: { status: 'ready', goal_node_id: 'goal_1', options: [] },
      goal_constraints: constraints,
    })

    expect(result).toMatchObject({ goal_constraints: constraints })
  })

  it('leaves goal_constraints absent when the response root has none (no fabrication)', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, {})

    expect(result).not.toHaveProperty('goal_constraints')
  })

  it('leaves goal_constraints absent when the response root sends an empty array (genuine no-constraint draft)', () => {
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
    }

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, { goal_constraints: [] })

    expect(result).not.toHaveProperty('goal_constraints')
  })

  it('preserves an inline graph that already carries its own goal_constraints (does not override with root)', () => {
    const ownConstraints: CEEGoalConstraint[] = [
      { id: 'c-inline', label: 'Own constraint', operator: '>=', value: 1 },
    ]
    const draftGraph = {
      nodes: [{ id: 'goal_1' }, { id: 'opt_a' }],
      edges: [],
      goal_constraints: ownConstraints,
    }

    const rootConstraints: CEEGoalConstraint[] = [
      { id: 'c-root', label: 'Root constraint', operator: '<=', value: 2 },
    ]

    const result = attachAnalysisReadyToInlineDraftGraph(draftGraph, { goal_constraints: rootConstraints })

    expect((result as { goal_constraints?: unknown }).goal_constraints).toBe(ownConstraints)
  })
})
