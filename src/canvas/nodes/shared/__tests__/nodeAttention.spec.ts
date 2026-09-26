/**
 * The "Worth reviewing" plan — pure rules (locked spec §2; ED 11:52Z point 7;
 * ED 02:31Z D1a/D1b; purpose audit on #1902).
 *
 * Every assertion binds by NODE ID and REASON KIND (identity), never by a
 * predicate another element could satisfy.
 */
import { describe, it, expect } from 'vitest'
import {
  ATTENTION_BUDGET,
  attentionSentence,
  deriveAttentionPlan,
  type AttentionInputs,
} from '../nodeAttention'

const node = (id: string, label = id, unconfirmedEstimate = false) => ({ id, label, unconfirmedEstimate })

const run = (over: Partial<NonNullable<AttentionInputs['run']>> = {}): NonNullable<AttentionInputs['run']> => ({
  ranks: new Map(),
  turningPoints: new Map(),
  fragileEdgeSources: new Set(),
  reviewBiasFindings: [],
  ...over,
})

const titles: Record<string, string> = { anchoring: 'Anchoring', status_quo_bias: 'Status quo bias' }
const base = (over: Partial<AttentionInputs>): AttentionInputs => ({
  nodes: [],
  run: null,
  ceeBiasFindings: [],
  resolveBiasTitle: (code) => (typeof code === 'string' ? titles[code] ?? null : null),
  ...over,
})

describe('what qualifies — existing producer signals only', () => {
  it('⛔ AI-GENERATED ALONE NEVER QUALIFIES: an unconfirmed Olumi estimate with no other signal gets no mark', () => {
    const plan = deriveAttentionPlan(base({ nodes: [node('f1', 'Price', true), node('f2', 'Churn', true)], run: run() }))
    expect(plan.reasonsByNode.size).toBe(0)
    expect(plan.marked.size).toBe(0)
  })

  it('a found turning point, a fragile link, a VoI top-3 gap, a determined rank and a grounded bias finding each qualify — by kind', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('tp'), node('fe'), node('voi'), node('rank'), node('bias')],
      run: run({
        turningPoints: new Map([['tp', { currentValue: 0.8, flipValue: 0.65, unit: '%', displayScale: true }]]),
        fragileEdgeSources: new Set(['fe']),
        ranks: new Map([
          ['voi', { sensitivityRank: null, voiRank: 1, influenceSetSize: 5, rankedSetSize: 3 }],
          ['rank', { sensitivityRank: 2, voiRank: null, influenceSetSize: 5, rankedSetSize: 3 }],
        ]),
      }),
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'bias' }],
    }), 10)
    expect(plan.reasonsByNode.get('tp')?.map(r => r.kind)).toEqual(['turning_point'])
    expect(plan.reasonsByNode.get('fe')?.map(r => r.kind)).toEqual(['fragile_link'])
    expect(plan.reasonsByNode.get('voi')?.map(r => r.kind)).toEqual(['evidence_gap'])
    expect(plan.reasonsByNode.get('rank')?.map(r => r.kind)).toEqual(['top_driver'])
    expect(plan.reasonsByNode.get('bias')?.map(r => r.kind)).toEqual(['behavioural'])
  })

  it('⛔ STALE HIDES THE RUN-DERIVED REASONS: with no current run, only the pre-run grounded finding remains', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('rank'), node('bias')],
      run: null,
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'bias' }],
    }))
    expect(plan.reasonsByNode.has('rank')).toBe(false)
    expect([...plan.marked]).toEqual(['bias'])
  })

  /*
   * ⭐ DESIGN INTEGRATION (23 Sep 2026): the "Driver N of M" reason reads the
   * rank licence's OWNER (`influenceRankReadout`) — the same licence the card's
   * driver line and reduced line read — instead of re-spelling one half of it
   * (`influenceSetSize >= 2`, flagged by `theUiRendersItDoesNotDecide`). The
   * re-spelling let a rank the owner refuses (beyond its own set) be stated as
   * "Driver 5 of 4".
   */
  it('⛔ a rank the licence OWNER refuses states no driver reason — beyond its set, or a set of one', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('beyond'), node('single'), node('ok')],
      run: run({
        ranks: new Map([
          ['beyond', { sensitivityRank: 5, voiRank: null, influenceSetSize: 4, rankedSetSize: 3 }],
          ['single', { sensitivityRank: 1, voiRank: null, influenceSetSize: 1, rankedSetSize: 1 }],
          ['ok', { sensitivityRank: 2, voiRank: null, influenceSetSize: 4, rankedSetSize: 3 }],
        ]),
      }),
    }), 10)
    expect(plan.reasonsByNode.has('beyond')).toBe(false)
    expect(plan.reasonsByNode.has('single')).toBe(false)
    // CONTROL: a licensed rank in the same run still qualifies, in the card's words.
    expect(plan.reasonsByNode.get('ok')?.map(r => r.kind)).toEqual(['top_driver'])
    // v3.1 pt 5 (#37): the card's words, M = the ranked count (3), not the analysed set (4).
    expect(plan.reasonsByNode.get('ok')?.[0].label).toMatch(/^Driver 2 of 3 ranked in this run: /)
  })

  it('⛔ UNGROUNDED behavioural findings never mark: no resolvable target, or an unknown code', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('f1')],
      ceeBiasFindings: [{ code: 'anchoring' }, { code: 'not_a_registered_bias', target_factor_id: 'f1' }, { code: 'anchoring', target_factor_id: 'ghost' }],
    }))
    expect(plan.reasonsByNode.size).toBe(0)
  })
})

describe('selective — a budget, with a slot a rank cannot take from a bias challenge', () => {
  it(`marks at most ${ATTENTION_BUDGET}`, () => {
    type Rank = { sensitivityRank: number | null; voiRank: number | null; influenceSetSize: number; rankedSetSize: number }
    const ranks = new Map<string, Rank>(['a', 'b', 'c', 'd'].map((id, i) => [id, { sensitivityRank: null, voiRank: i + 1 > 3 ? null : i + 1, influenceSetSize: 4, rankedSetSize: 3 }]))
    ranks.set('d', { sensitivityRank: 1, voiRank: null, influenceSetSize: 4, rankedSetSize: 3 })
    const plan = deriveAttentionPlan(base({ nodes: ['a', 'b', 'c', 'd'].map(id => node(id)), run: run({ ranks }) }))
    expect(plan.marked.size).toBe(ATTENTION_BUDGET)
    expect(plan.candidateCount).toBe(4)
  })

  it('⭐ RESERVED SLOT: three ranked drivers and one grounded bias finding → the bias finding is marked', () => {
    const ranks = new Map([
      ['d1', { sensitivityRank: 1, voiRank: null, influenceSetSize: 5, rankedSetSize: 3 }],
      ['d2', { sensitivityRank: 2, voiRank: null, influenceSetSize: 5, rankedSetSize: 3 }],
      ['d3', { sensitivityRank: 3, voiRank: null, influenceSetSize: 5, rankedSetSize: 3 }],
    ])
    const plan = deriveAttentionPlan(base({
      nodes: [node('d1'), node('d2'), node('d3'), node('b')],
      run: run({ ranks }),
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'b' }],
    }))
    expect(plan.marked.has('b')).toBe(true)
    expect(plan.marked.size).toBe(3)
  })
})

describe('how it reads — a question, model-scoped, one rank wording', () => {
  it('the rank reason uses "Driver N of M", never "#", and asks a question', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('d1')],
      run: run({ ranks: new Map([['d1', { sensitivityRank: 1, voiRank: null, influenceSetSize: 4, rankedSetSize: 3 }]]) }),
    }))
    const label = plan.reasonsByNode.get('d1')![0].label
    // Contract v3.1 pt 5 (#37): "Driver N of M ranked in this run", M =
    // rankedSetSize (3), never the analysed set (4) — reversing ED #63
    // 5806207128, named in `DRIVER_LINE_COPY.rank`.
    expect(label).toContain('Driver 1 of 3 ranked in this run')
    expect(label).not.toContain('of 4')
    expect(label).not.toContain('#')
    expect(label.trim().endsWith('?')).toBe(true)
  })

  it('the turning-point reason keeps its condition and never says "the decision"; a normalised row prints no number', () => {
    const display = deriveAttentionPlan(base({
      nodes: [node('tp', 'Trial conversion')],
      run: run({ turningPoints: new Map([['tp', { currentValue: 8, flipValue: 6.5, unit: '%', displayScale: true }]]) }),
    })).reasonsByNode.get('tp')![0].label
    expect(display).toContain('If Trial conversion falls below 6.5%')
    expect(display).toContain('the comparison is likely to change')
    expect(display).not.toMatch(/\bdecision\b/i)

    const internal = deriveAttentionPlan(base({
      nodes: [node('tp', 'Headcount')],
      run: run({ turningPoints: new Map([['tp', { currentValue: 0.6, flipValue: 0.5, unit: undefined, displayScale: false }]]) }),
    })).reasonsByNode.get('tp')![0].label
    expect(internal).not.toContain('0.5')
    expect(internal).toContain('a turning point Olumi found')
  })

  it('behavioural copy is reflective ("Worth checking"), never a diagnosis', () => {
    const label = deriveAttentionPlan(base({
      nodes: [node('b')],
      ceeBiasFindings: [{ code: 'anchoring', target_factor_id: 'b' }],
    })).reasonsByNode.get('b')![0].label
    expect(label.startsWith('Worth checking: anchoring')).toBe(true)
    expect(label).not.toMatch(/\byou (are|have)\b/i)
  })

  it('the sentence discloses the selection and names an Olumi estimate only as a strengthener', () => {
    const plan = deriveAttentionPlan(base({
      nodes: [node('d1')],
      run: run({ ranks: new Map([['d1', { sensitivityRank: 1, voiRank: null, influenceSetSize: 4, rankedSetSize: 3 }]]) }),
    }))
    const text = attentionSentence(plan.reasonsByNode.get('d1')!, { unconfirmedEstimate: true, marked: 3, candidates: 7 })
    expect(text.startsWith('Worth reviewing:')).toBe(true)
    expect(text).toContain('Olumi’s estimate')
    expect(text).toContain('3 of 7')
  })
})

describe('the turning-point reason never states a number the card withholds (reviewer blocker, Paul 23 Sep points 3/11)', () => {
  const tp = { currentValue: 8, flipValue: 6.5, unit: '%', displayScale: true }
  const reasonFor = (factorUnit: string | null | undefined) => {
    const plan = deriveAttentionPlan(base({
      nodes: [{ id: 'f1', label: 'Hiring speed', unconfirmedEstimate: false, factorUnit }],
      run: run({ turningPoints: new Map([['f1', tp]]) }),
    }))
    return plan.reasonsByNode.get('f1')?.find(r => r.kind === 'turning_point')?.label ?? '<none>'
  }

  it('incompatible units (row "%", card "seats") → the reason keeps its direction and drops the number', () => {
    const label = reasonFor('seats')
    expect(label).not.toBe('<none>')
    expect(label).not.toMatch(/6\.5/)
    expect(label).toContain('a turning point Olumi found')
  })

  it('CONTRAST — compatible units ("%" vs "percent") → the number prints', () => {
    expect(reasonFor('percent')).toMatch(/6\.5/)
  })

  it('CONTRAST — the card shows no value (undefined) → nothing to disagree with, the number prints', () => {
    expect(reasonFor(undefined)).toMatch(/6\.5/)
  })
})
