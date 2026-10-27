/**
 * A CORE TURN KEEPS THE MODEL'S LIMITS ON THE CANVAS (graph workstream, Paul's manual test 27 Oct 2026: hiring, scenario
 * 6bd4201f, CEE 4f0a93d4). The saved graph carries the £200,000 budget as a goal constraint, which the goal card draws.
 * The core translator built the client's `draft_graph` from nodes and edges alone, so the draft apply read no
 * constraints and cleared the canvas's (`applyDraftResult`): the live board showed no budget.
 *
 * Real path: a core turn whose `model.graph` is Paul's saved graph as stored (the graph a core turn carries is the saved
 * one; fixture trimmed to nodes, edges, goal_constraints and the program marker) → the real `parseV5Response` (core
 * route) → the hook's own `attachAnalysisReadyToInlineDraftGraph` → the real `applyDraftResult` → the store slice the
 * goal card reads. Expected values are spelled inline.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { parseV5Response } from '../responseParser'
import { attachAnalysisReadyToInlineDraftGraph } from '../../canvas/conversation/useConversation'
import { applyDraftResult } from '../../canvas/utils/applyDraftResult'
import { useCanvasStore } from '../../canvas/store'
import saved from './fixtures/hiring-paul-1027-saved-graph.json'

const coreTurn = (graph: Record<string, unknown>) => ({
  turn_id: 't-hiring', assistant_text: 'Here is the model.', cards: [], notes: [], receipts: [], error: null, run: null,
  model: { graph, revision: '48e2a1babc59ccfd', scenario_revision: 'c57ba8f34f877fa3' },
})
const respond = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/** The core turn through the client exactly as the hook applies a first draft; the goal card's limits, after. */
async function applyCoreTurn(graph: Record<string, unknown>) {
  const parsed = await parseV5Response(respond(coreTurn(graph)), { coreRoute: true })
  expect(parsed.kind).toBe('response')
  if (parsed.kind !== 'response') throw new Error('not a response')
  const inline = attachAnalysisReadyToInlineDraftGraph(parsed.response.draft_graph, parsed.response)
  expect((inline?.nodes as unknown[]).length).toBe(23)
  applyDraftResult(inline as never, { skipHistory: true, skipAutosave: true })
  return useCanvasStore.getState().goalConstraints
}

afterEach(() => { useCanvasStore.setState({ goalConstraints: null, nodes: [], edges: [] } as never) })

describe('a core turn keeps the saved limits on the canvas', () => {
  it('Paul\'s hiring model: the £200,000 budget is the goal card\'s limit after the turn', async () => {
    const limits = await applyCoreTurn(saved as Record<string, unknown>)
    expect((limits ?? []).map((c) => [c.constraint_id, c.node_id, c.operator, c.value, c.unit, c.label])).toEqual([
      ['stay_within_budget', 'total_spend', '<=', 200000, 'GBP', 'Our budget is £200,000'],
    ])
  })

  it('CONTRAST: the same model with no limits saved leaves the canvas with none, as before', async () => {
    const { goal_constraints: _limits, ...withoutLimits } = saved as Record<string, unknown>
    useCanvasStore.setState({ goalConstraints: [{ constraint_id: 'stale', node_id: 'x', operator: '<=', value: 1, label: 'stale' }] } as never)
    expect(await applyCoreTurn(withoutLimits)).toBeNull()
  })
})
