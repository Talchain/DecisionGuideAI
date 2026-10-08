/**
 * IDENTITY-EXACT (DL 8 Oct): an operand link of an identity THIS Run evaluated is exact, never "strength not set".
 * Served capture ph-w11 (UI 26cf0d86, CEE 774de42): the canvas marked e-12/13/17/18/19 as placeholders while the Run
 * had evaluated `starter_monthly_recurring_revenue` (= subscribers × price) and `starter_support_cost`
 * (= subscribers × support cost per subscriber). Mirrors CEE goal-certainty `exact`. Bound by edge id and node ids.
 */
import { describe, expect, it, vi } from 'vitest'
import served from './fixtures/served-ph-w11-identity-exact.json'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { isStrengthPlaceholder } from '../strengthPlaceholder'
import { identityExactLinks, identityExactWords, isUnsizedLink, selectIdentityExactLinks } from '../identityExactLinks'
import { identityEvaluatedFromResponse, readIdentityEvaluated } from '../../state/storedIdentityEvaluated'
import { describeEdgeForSpeech } from '../edgeAccessibleName'
import { buildEdgeInspectorSentence } from '../../ui/inspector-v2/edgeInspectorSentence'
import { resolveEdgeSignedStrengthDisplay } from '../edgeValueProvenance'

const current = vi.hoisted(() => ({ value: true }))
vi.mock('../../state/analysisStateSelector', () => ({ selectRunAffirmedCurrent: () => current.value }))

const nodes = served.draft_graph.nodes.map((n) => mapDraftNodeToCanvas({ ...n }))
const edges = served.draft_graph.edges.map((e, i) => mapDraftEdgeToCanvas({ ...e }, i))
const EVALUATED = served.analysis_identity_evaluated_node_ids
const edgeOf = (from: string, to: string) => edges.find((e) => e.source === from && e.target === to)!
const PRICE_TO_STARTER_MRR = edgeOf('starter_monthly_price', 'starter_monthly_recurring_revenue')
const COST_TO_SUPPORT = edgeOf('support_cost_per_starter_subscriber', 'starter_support_cost')
const EXISTING_TO_MRR = edgeOf('existing_customers', 'monthly_recurring_revenue')
const SUPPORT_TO_STRAIN = edgeOf('starter_support_cost', 'support_capacity_strain')

describe('the served capture is what the rows say it is', () => {
  it('all four links are canvas placeholders today', () => {
    for (const e of [PRICE_TO_STARTER_MRR, COST_TO_SUPPORT, EXISTING_TO_MRR, SUPPORT_TO_STRAIN]) {
      expect(isStrengthPlaceholder(e.data as Record<string, unknown>), e.id).toBe(true)
    }
    expect(EVALUATED).toEqual(['starter_monthly_recurring_revenue', 'starter_support_cost'])
  })
})

describe('identityExactLinks — CEE\'s exact rule over the canvas graph', () => {
  const exact = identityExactLinks(nodes, edges, EVALUATED)
  it('R1: an operand INTO an evaluated identity is exact, with the ruled words; it is no longer unsized', () => {
    expect(exact.get(PRICE_TO_STARTER_MRR.id)).toBe('Exact: ‘Starter monthly recurring revenue’ = ‘Starter subscribers’ × ‘Starter monthly price’')
    expect(exact.get(COST_TO_SUPPORT.id)).toBe('Exact: ‘Starter support cost’ = ‘Starter subscribers’ × ‘Support cost per starter subscriber’')
    expect(isUnsizedLink(PRICE_TO_STARTER_MRR.id, true, exact)).toBe(false)
    expect([...exact.keys()].sort()).toEqual(
      edges.filter((e) => ['starter_monthly_recurring_revenue', 'starter_support_cost'].includes(e.target)).map((e) => e.id).sort())
  })
  it('R2: the same graph with the identity NOT evaluated (or not attested) → nothing exact; still unsized', () => {
    expect(identityExactLinks(nodes, edges, ['starter_support_cost']).has(PRICE_TO_STARTER_MRR.id)).toBe(false)
    expect(identityExactLinks(nodes, edges, []).size).toBe(0)
    expect(identityExactLinks(nodes, edges, null).size).toBe(0)
    expect(isUnsizedLink(PRICE_TO_STARTER_MRR.id, true, identityExactLinks(nodes, edges, null))).toBe(true)
  })
  it('R3 CONTROL: a non-identity placeholder (existing customers → MRR) stays unsized', () => {
    expect(exact.has(EXISTING_TO_MRR.id)).toBe(false)
    expect(isUnsizedLink(EXISTING_TO_MRR.id, true, exact)).toBe(true)
  })
  it('R4 CONTROL: the identity\'s OWN outbound link (support cost → strain) is not an operand link; stays unsized', () => {
    expect(exact.has(SUPPORT_TO_STRAIN.id)).toBe(false)
  })
  it('R4b: a NON-operand link INTO an evaluated identity (existing customers → support cost, added) is not exact', () => {
    const extra = { id: 'e-extra', source: 'existing_customers', target: 'starter_support_cost', data: {} }
    expect(identityExactLinks(nodes, [...edges, extra], EVALUATED).has('e-extra')).toBe(false)
  })
  it('an identity with an unreadable operation says nothing (no false "Exact")', () => {
    const n = nodes.find((x) => x.id === 'starter_support_cost')!
    expect(identityExactWords({ ...n, data: { ...(n.data as object), nonlinear_identity: { operation: 'ratio', factor_ids: ['a', 'b'] } } }, nodes)).toBeNull()
  })
})

describe('selectIdentityExactLinks — bound to the CURRENT Run', () => {
  const state = (ids: readonly string[] | undefined) => ({ nodes, edges, results: { report: ids === undefined ? {} : { identity_evaluated_node_ids: ids } } }) as never
  it('R5: current Run → exact; the same Run stale → nothing exact (fail toward today\'s marking)', () => {
    current.value = true
    expect(selectIdentityExactLinks(state(EVALUATED)).has(PRICE_TO_STARTER_MRR.id)).toBe(true)
    current.value = false
    expect(selectIdentityExactLinks(state(EVALUATED)).size).toBe(0)
    current.value = true
  })
  it('not attested on the report → nothing exact', () => {
    expect(selectIdentityExactLinks(state(undefined)).size).toBe(0)
  })
})

describe('storedIdentityEvaluated — two legs, one reader', () => {
  it('R6: the turn key (top level, then the additive sidecar) and the read value parse to the same sorted ids', () => {
    const ids = ['starter_support_cost', 'starter_monthly_recurring_revenue']
    expect(readIdentityEvaluated(identityEvaluatedFromResponse({ identity_evaluated_node_ids: ids }))).toEqual([...ids].sort())
    expect(readIdentityEvaluated(identityEvaluatedFromResponse({ __additive__: { identity_evaluated_node_ids: ids } }))).toEqual([...ids].sort())
    expect(readIdentityEvaluated(served.analysis_identity_evaluated_node_ids)).toEqual([...ids].sort())
  })
  it('malformed → not attested; [] → attested, none', () => {
    expect(readIdentityEvaluated([1, ''])).toBeNull()
    expect(readIdentityEvaluated(undefined)).toBeNull()
    expect(readIdentityEvaluated([])).toEqual([])
  })
})

describe('the readers say the ruled words for an exact link (name + inspector); controls keep "not sized"', () => {
  const exact = identityExactLinks(nodes, edges, EVALUATED)
  const words = exact.get(PRICE_TO_STARTER_MRR.id)!
  const data = PRICE_TO_STARTER_MRR.data as Record<string, unknown>
  it('accessible name: the exact words; without them, "strength not set"', () => {
    expect(describeEdgeForSpeech(data, 'human', { identityExact: words })).toBe(words)
    expect(describeEdgeForSpeech(data, 'human', { identityExact: null })).toMatch(/strength not set/)
  })
  it('inspector sentence: the exact words, no size ask; without them, the size ask', () => {
    const base = { sourceLabel: 'Starter monthly price', targetLabel: 'Starter monthly recurring revenue', data, strengthDisplay: resolveEdgeSignedStrengthDisplay(data), linkKind: 'causal' as const }
    const s1 = buildEdgeInspectorSentence({ ...base, identityExact: words })
    expect(s1.sentence).toBe(`${words}.`)
    expect(s1.sentence).not.toMatch(/sized|How strong/)
    expect(buildEdgeInspectorSentence(base).sentence).toMatch(/isn't sized in the model yet/)
  })
})
