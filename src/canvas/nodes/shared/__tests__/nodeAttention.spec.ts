import { describe, it, expect } from 'vitest'
import { deriveAttentionPlan, ATTENTION_BUDGET, type AttentionInputs } from '../nodeAttention'
import { resolveBiasSignal } from '../../../shared/biasSignalTitles'

const base = (over: Partial<AttentionInputs> = {}): AttentionInputs => ({
  nodeIds: new Set(['fac_a', 'fac_b', 'fac_c', 'fac_d', 'fac_e', 'out_x']),
  factorRanks: new Map(),
  resolveBiasTitle: (code) => resolveBiasSignal(code)?.title ?? null,
  ...over,
})
const kinds = (plan: ReadonlyMap<string, readonly { kind: string }[]>, id: string) =>
  (plan.get(id) ?? []).map((r) => r.kind)

describe('deriveAttentionPlan — existing producer signals only', () => {
  it('a published top-3 rank is a reason; an unranked factor is not', () => {
    const plan = deriveAttentionPlan(base({
      factorRanks: new Map([['fac_a', { sensitivityRank: 1, voiRank: null }], ['fac_b', { sensitivityRank: null, voiRank: null }]]),
    }))
    expect(kinds(plan, 'fac_a')).toEqual(['top_driver'])
    expect(plan.has('fac_b')).toBe(false)
    expect(plan.get('fac_a')![0]!.label).toBe('Driver #1 in this analysis')
  })

  it('a top-3 VoI factor is an evidence reason', () => {
    const plan = deriveAttentionPlan(base({ factorRanks: new Map([['fac_b', { sensitivityRank: null, voiRank: 2 }]]) }))
    expect(kinds(plan, 'fac_b')).toEqual(['evidence_gap'])
  })

  it('a factor whose card shows a turning point is the most consequential reason; an id not on the canvas is dropped', () => {
    const plan = deriveAttentionPlan(base({ turningPointNodeIds: new Set(['fac_c', 'not_on_canvas']) }))
    expect(kinds(plan, 'fac_c')).toEqual(['decision_flip'])
    expect(plan.has('not_on_canvas')).toBe(false)
  })

  it('a fragile edge marks the node it runs FROM (either id spelling)', () => {
    const plan = deriveAttentionPlan(base({
      fragileEdges: [{ from_id: 'fac_a', to_id: 'out_x', switch_probability: 0.3 }, { source: 'fac_e', target: 'out_x' }],
    }))
    expect(kinds(plan, 'fac_a')).toEqual(['fragile_link'])
    expect(kinds(plan, 'fac_e')).toEqual(['fragile_link'])
    expect(plan.has('out_x')).toBe(false)
  })

  it('a bias finding the PRODUCER maps to a node is a reflective behavioural reason — named when the code resolves', () => {
    const plan = deriveAttentionPlan(base({
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'fac_a', description: 'Estimate may be tied to the first number.' }],
      runBiasFindings: [{ type: 'ANCHORING_RISK', affected_elements: ['fac_b'], description: 'Price estimate anchored to current price.' }],
    }))
    expect(plan.get('fac_a')![0]!.label).toBe('Worth checking: anchoring')
    // An unresolved code falls back to the producer's own words, never an invented name.
    expect(plan.get('fac_b')![0]!.label).toBe('Worth checking: Price estimate anchored to current price.')
    for (const list of plan.values()) for (const r of list) expect(r.label).not.toMatch(/you are|you have|biased/i)
  })

  it('a finding with no node mapping, or no name and no description, adds nothing', () => {
    const plan = deriveAttentionPlan(base({
      ceeBiasFindings: [{ code: 'anchoring' }, { target_factor_id: 'fac_a' }],
      runBiasFindings: [{ type: 'X', affected_elements: [] }],
    }))
    expect(plan.size).toBe(0)
  })

  it('NOTHING about provenance, "Not set" or AI generation is an input — a model with no producer signals has no marker', () => {
    expect(deriveAttentionPlan(base()).size).toBe(0)
  })

  it(`UI-SEM-098 budget: at most ${ATTENTION_BUDGET} nodes, the most consequential first, then the most reasons`, () => {
    const plan = deriveAttentionPlan(base({
      factorRanks: new Map([
        ['fac_a', { sensitivityRank: 1, voiRank: 1 }], // 2 reasons, best priority 2
        ['fac_b', { sensitivityRank: 2, voiRank: null }], // 1 reason, priority 3
        ['fac_c', { sensitivityRank: 3, voiRank: null }], // 1 reason, priority 3
        ['fac_d', { sensitivityRank: null, voiRank: 2 }], // 1 reason, priority 2
      ]),
      turningPointNodeIds: new Set(['fac_e']), // priority 1
    }))
    expect([...plan.keys()]).toEqual(['fac_e', 'fac_a', 'fac_d'])
  })

  it('each node\'s reasons are listed most consequential first, with no duplicate kinds', () => {
    const plan = deriveAttentionPlan(base({
      factorRanks: new Map([['fac_a', { sensitivityRank: 1, voiRank: 3 }]]),
      fragileEdges: [{ from_id: 'fac_a' }, { from_id: 'fac_a' }],
    }))
    expect(kinds(plan, 'fac_a')).toEqual(['fragile_link', 'evidence_gap', 'top_driver'])
  })

  it('STALE: run-derived reasons are scoped `Last run · `; a pre-analysis CEE finding is not', () => {
    const plan = deriveAttentionPlan(base({
      runIsStale: true,
      factorRanks: new Map([['fac_a', { sensitivityRank: 1, voiRank: null }]]),
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'fac_b' }],
    }))
    expect(plan.get('fac_a')![0]!.label).toBe('Last run · Driver #1 in this analysis')
    expect(plan.get('fac_b')![0]!.label).toBe('Worth checking: anchoring')
  })
})
