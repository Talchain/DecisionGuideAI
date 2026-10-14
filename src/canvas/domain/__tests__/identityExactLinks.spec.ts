/**
 * IDENTITY-EXACT (#2686 rebuild), bound to a SERVED capture: ph-w11 (8 Oct, UI 26cf0d86, CEE 774de42), the run-1 turn's
 * draft_graph plus the read-after-run's `analysis_identity_evaluated_node_ids`. The graph goes through the production
 * mappers, so `nonlinear_identity` reaches the rule exactly as the canvas holds it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import served from './fixtures/served-ph-w11-identity-exact.json'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'

const runCurrent = { value: true }
vi.mock('../../state/analysisStateSelector', () => ({ selectRunAffirmedCurrent: () => runCurrent.value }))

import {
  identityExactLinks,
  recordIdentityEvaluated,
  selectIdentityExactLinks,
  useIdentityEvaluatedStore,
} from '../identityExactLinks'

const nodes = served.draft_graph.nodes.map(mapDraftNodeToCanvas) as { id: string; data: unknown }[]
const edges = served.draft_graph.edges.map((e: unknown, i: number) => mapDraftEdgeToCanvas(e as never, i)) as { id: string; source: string; target: string }[]
const EVALUATED = served.analysis_identity_evaluated_node_ids
const MRR = 'starter_monthly_recurring_revenue'
const idOf = (source: string, target: string) => edges.find(e => e.source === source && e.target === target)!.id
const MRR_WORDS = 'Exact: ‘Starter monthly recurring revenue’ = ‘Starter subscribers’ × ‘Starter monthly price’'

describe('identityExactLinks: an operand link into an evaluated identity reads exact', () => {
  it('R1: both operand links into the evaluated MRR identity carry the exact words', () => {
    const exact = identityExactLinks(nodes, edges, EVALUATED)
    expect(exact.get(idOf('starter_subscribers', MRR))).toBe(MRR_WORDS)
    expect(exact.get(idOf('starter_monthly_price', MRR))).toBe(MRR_WORDS)
    expect(exact.get(idOf('support_cost_per_starter_subscriber', 'starter_support_cost')))
      .toBe('Exact: ‘Starter support cost’ = ‘Starter subscribers’ × ‘Support cost per starter subscriber’')
  })
  it('R2 (contrast, same graph): an identity the Run did NOT evaluate leaves its operands unsized', () => {
    const exact = identityExactLinks(nodes, edges, ['starter_support_cost'])
    expect(exact.has(idOf('starter_monthly_price', MRR))).toBe(false)
    expect(exact.has(idOf('support_cost_per_starter_subscriber', 'starter_support_cost'))).toBe(true)
  })
  it('R3: the identity\'s OUTBOUND link is not an operand and stays as it was', () => {
    const exact = identityExactLinks(nodes, edges, EVALUATED)
    expect(exact.has(idOf(MRR, 'monthly_recurring_revenue'))).toBe(false)
  })
})

describe('selectIdentityExactLinks: bound to the Run whose read carried the set', () => {
  const state = (hash: string) => ({ nodes, edges, results: { report: { model_card: { response_hash: hash } } } }) as never
  beforeEach(() => { runCurrent.value = true; recordIdentityEvaluated(null, null) })

  it('R4: the displayed report is the read\'s Run and it is current → exact', () => {
    recordIdentityEvaluated('hash-run-1', EVALUATED)
    const held = useIdentityEvaluatedStore.getState().held
    expect(selectIdentityExactLinks(state('hash-run-1'), held).get(idOf('starter_subscribers', MRR))).toBe(MRR_WORDS)
  })
  it('R5: another Run\'s report is displayed → nothing exact', () => {
    recordIdentityEvaluated('hash-run-1', EVALUATED)
    expect(selectIdentityExactLinks(state('hash-run-2'), useIdentityEvaluatedStore.getState().held).size).toBe(0)
  })
  it('R6: the same Run gone stale → nothing exact', () => {
    recordIdentityEvaluated('hash-run-1', EVALUATED)
    runCurrent.value = false
    expect(selectIdentityExactLinks(state('hash-run-1'), useIdentityEvaluatedStore.getState().held).size).toBe(0)
  })
  it('R7: a malformed carrier holds nothing', () => {
    recordIdentityEvaluated('hash-run-1', ['starter_monthly_recurring_revenue', 7])
    expect(useIdentityEvaluatedStore.getState().held.ids).toEqual([])
    expect(selectIdentityExactLinks(state('hash-run-1'), useIdentityEvaluatedStore.getState().held).size).toBe(0)
  })
})
