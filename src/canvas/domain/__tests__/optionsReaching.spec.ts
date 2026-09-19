/**
 * ⭐⭐ "3 options move this" — the count, the de-duplication, the silence and
 * the singular.
 *
 * ⛔⛔ DECLARED UNRUN. This lane was instructed not to execute a test suite of
 * any kind, so nothing below has been observed passing or failing. CI at the
 * head is the authority. Every case was reasoned against the implementation
 * line by line; that is a weaker instrument than running it and is named as
 * such rather than implied to be more (CLAUDE.md: never write a verification
 * result before the measurement returns).
 *
 * ⚠ WHY A PURE SPEC CARRIES THE LOAD AND THE RENDER SPEC IS THE SMALLER HALF.
 * Every claim here is about a graph, and a graph is exactly what a React render
 * adds nothing to. The render spec beside this one pins the ONE thing this file
 * cannot: that the sentence reaches the card face rather than a hover popover.
 *
 * ⚠ THE TOPOLOGY IS THE PRODUCT'S OWN, NOT ONE CONVENIENT TO THE ASSERTION. In
 * all five committed starter captures an option reaches an outcome through
 * factors and never directly — `option→factor` 58, `option→outcome` 0. A
 * fixture wiring an option straight into the outcome would be testing a shape
 * the producer does not emit, which is how a green suite certifies a dark
 * feature (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not
 * evidence about the wire).
 */
import { describe, it, expect } from 'vitest'
import { countOptionsReaching, optionsReachingLine } from '../optionsReaching'

const OUTCOME = { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } }

/** The product's shape: decision → options → factors → outcome. */
const THREE_OPTIONS_TWO_REACHING = {
  nodes: [
    { id: 'decision-1', type: 'decision', data: { type: 'decision', label: 'Billing approach' } },
    { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
    { id: 'option-2', type: 'option', data: { type: 'option', label: 'Buy' } },
    { id: 'option-3', type: 'option', data: { type: 'option', label: 'Partner' } },
    { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
    { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'Licence cost' } },
    { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'Partner appetite' } },
    OUTCOME,
    { id: 'outcome-2', type: 'outcome', data: { type: 'outcome', label: 'Brand reach' } },
  ],
  edges: [
    { id: 'd1', source: 'decision-1', target: 'option-1' },
    { id: 'd2', source: 'decision-1', target: 'option-2' },
    { id: 'd3', source: 'decision-1', target: 'option-3' },
    { id: 'o1f1', source: 'option-1', target: 'factor-1' },
    { id: 'o2f2', source: 'option-2', target: 'factor-2' },
    // option-3 acts, but on a factor that lands on the OTHER outcome.
    { id: 'o3f3', source: 'option-3', target: 'factor-3' },
    { id: 'f1o', source: 'factor-1', target: 'outcome-1' },
    { id: 'f2o', source: 'factor-2', target: 'outcome-1' },
    { id: 'f3o', source: 'factor-3', target: 'outcome-2' },
  ],
}

describe('countOptionsReaching', () => {
  it('counts the options with a path to this outcome, and not the ones without', () => {
    const { nodes, edges } = THREE_OPTIONS_TWO_REACHING
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(2)
  })

  /**
   * ⭐ THE SAME BOARD, THE OTHER OUTCOME — the discriminating half.
   *
   * A count that returned 2 for every card would satisfy the case above and be
   * useless. This asserts the number is bound to the card it is asked about
   * (CLAUDE.md trap 20: when a per-item query returns the same answer for every
   * item, suspect the query).
   */
  it('gives a different answer for a different outcome on the same board', () => {
    const { nodes, edges } = THREE_OPTIONS_TWO_REACHING
    expect(countOptionsReaching(nodes, edges, 'outcome-2')).toBe(1)
  })

  it('counts an option once when it reaches the outcome down two different paths', () => {
    const nodes = [
      { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'Support load' } },
      OUTCOME,
    ]
    const edges = [
      { id: 'a', source: 'option-1', target: 'factor-1' },
      { id: 'b', source: 'option-1', target: 'factor-2' },
      { id: 'c', source: 'factor-1', target: 'outcome-1' },
      { id: 'd', source: 'factor-2', target: 'outcome-1' },
    ]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(1)
  })

  /**
   * ⚠ REACHABLE, NOT THEORETICAL. `store.addEdge` refuses duplicates, but the
   * CEE patch path appends supplied edges with no duplicate check — the same
   * state `DecisionNode`'s option tally de-duplicates for, and `useModelHealth`
   * reports as a "Duplicate edge" warning. A duplicated edge is a modelling
   * defect; it is not a second option and must not be counted as one.
   */
  it('counts an option once when a parallel edge duplicates its path', () => {
    const nodes = [
      { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
      OUTCOME,
    ]
    const edges = [
      { id: 'a', source: 'option-1', target: 'factor-1' },
      { id: 'a-again', source: 'option-1', target: 'factor-1' },
      { id: 'c', source: 'factor-1', target: 'outcome-1' },
    ]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(1)
  })

  /**
   * ⭐ THE KIND IS DERIVED THROUGH THE DOMAIN'S OWN CHAIN, WHICH IS WIDER THAN
   * THE PRE-ANALYSIS ONE. `graphFacts.kindOf` reads `data.kind ?? node.type`
   * and would score this node a factor; `resolveNodeTypeLiteral` reads
   * `node.type ?? data.kind ?? data.type` and scores it an option. This case
   * fails if anyone re-types the predicate as the narrower spelling.
   */
  it('recognises an option seeded only at data.type', () => {
    const nodes = [
      { id: 'option-1', data: { type: 'option', label: 'Build' } },
      { id: 'factor-1', data: { type: 'factor', label: 'Engineering time' } },
      OUTCOME,
    ]
    const edges = [
      { id: 'a', source: 'option-1', target: 'factor-1' },
      { id: 'c', source: 'factor-1', target: 'outcome-1' },
    ]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(1)
  })

  it('counts the baseline option like any other', () => {
    const nodes = [
      { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
      { id: 'option-status-quo', type: 'option', data: { type: 'option', label: 'Carry on', is_baseline: true } },
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
      OUTCOME,
    ]
    const edges = [
      { id: 'a', source: 'option-1', target: 'factor-1' },
      { id: 'b', source: 'option-status-quo', target: 'factor-1' },
      { id: 'c', source: 'factor-1', target: 'outcome-1' },
    ]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(2)
  })

  /**
   * ⭐ THE WALK IS UPSTREAM, NOT UNDIRECTED. Without direction every option on a
   * connected board would "reach" every outcome and the number would be the
   * option total on every card.
   */
  it('does not count an option the outcome feeds', () => {
    const nodes = [
      { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
      OUTCOME,
    ]
    const edges = [{ id: 'a', source: 'outcome-1', target: 'option-1' }]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(0)
  })

  it('returns zero when options exist but none of them acts on this outcome', () => {
    const nodes = [
      { id: 'option-1', type: 'option', data: { type: 'option', label: 'Build' } },
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
      OUTCOME,
    ]
    const edges = [{ id: 'a', source: 'option-1', target: 'factor-1' }]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(0)
  })

  it('returns zero on a board with no options at all', () => {
    const nodes = [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Engineering time' } },
      OUTCOME,
    ]
    const edges = [{ id: 'c', source: 'factor-1', target: 'outcome-1' }]
    expect(countOptionsReaching(nodes, edges, 'outcome-1')).toBe(0)
  })
})

describe('optionsReachingLine', () => {
  it('says nothing at all when nothing reaches the card', () => {
    expect(optionsReachingLine(0)).toBeNull()
  })

  /**
   * ⛔ THE POINT IS THAT THERE IS NO SENTENCE TO INSPECT.
   * `0 options move this` is a counted claim about a model that may simply not
   * be wired yet. The card's answer to "how many" is silence, not nought — so
   * the assertion is `null`, not a string that happens to omit a digit.
   * (`toMatch` is deliberately not used: it errors on a non-string received
   * value even under `.not`, which would make a passing case read as a defect.)
   */
  it.each([0, -1])('has no sentence at all for a count of %s', (count) => {
    expect(optionsReachingLine(count)).toBeNull()
  })

  it('uses the singular for one', () => {
    expect(optionsReachingLine(1)).toBe('1 option moves this')
  })

  it('uses the plural for more than one', () => {
    expect(optionsReachingLine(2)).toBe('2 options move this')
    expect(optionsReachingLine(7)).toBe('7 options move this')
  })
})

/**
 * ⛔⛔ REGRESSION, FOUND ON THE FOUNDER'S OWN BOARD — and introduced by the PR
 * that added this module.
 *
 * On his 19 Sep staging run the outcome card read "4 options move this" while an
 * option card three inches away read "Not in this analysis". Reachability alone
 * counted an option whose `interventions` map is EMPTY.
 *
 * At the bytes that option carried `interventions: {}`, `interventionKeys: []`,
 * and four option→factor edges with `strength_mean: 1, weight: 1,
 * exists_probability: 1` — BYTE-IDENTICAL to the option→factor edges of the
 * three options that were analysed. So nothing in the graph SHAPE distinguished
 * it, which is precisely why a structural walk got it wrong: reachability is a
 * structural question and "moves this" is a causal one.
 *
 * ⚠ These tests must NOT be read as re-deriving CEE's admission decision. "Not
 * connected", "no values set" and "excluded from this calculation" are three
 * different facts and CEE owns the third. What is asserted here is the first:
 * does the option carry any effect value at all.
 */
describe('an option with no effect value does not move anything', () => {
  const outcome = { id: 'out', type: 'outcome' as const, data: {} }
  const factor = { id: 'fac', type: 'factor' as const, data: {} }
  const withValues = { id: 'opt-a', type: 'option' as const, data: { interventions: { fac: 0.5 } } }
  const noValues = { id: 'opt-b', type: 'option' as const, data: { interventions: {} } }
  const edges = [
    { source: 'opt-a', target: 'fac' },
    { source: 'opt-b', target: 'fac' },
    { source: 'fac', target: 'out' },
  ]

  it('POSITIVE CONTROL: both options genuinely REACH the outcome', () => {
    // Without this the test below could pass because the walk is broken rather
    // than because the filter works — the two options must be structurally
    // indistinguishable for the assertion to mean anything.
    const bothCounted = countOptionsReaching(
      [outcome, factor, withValues, { ...noValues, data: { interventions: { fac: 0.1 } } }],
      edges,
      'out',
    )
    expect(bothCounted, 'the walk cannot see both options — this fixture proves nothing').toBe(2)
  })

  it('⭐ counts only the option that carries an effect value', () => {
    expect(
      countOptionsReaching([outcome, factor, withValues, noValues], edges, 'out'),
      'an option with an empty interventions map was counted as moving this outcome — the same board then says it is not in the analysis',
    ).toBe(1)
  })

  it('an absent interventions key counts as no value, never as unknown', () => {
    const absent = { id: 'opt-c', type: 'option' as const, data: {} }
    expect(
      countOptionsReaching(
        [outcome, factor, absent],
        [{ source: 'opt-c', target: 'fac' }, { source: 'fac', target: 'out' }],
        'out',
      ),
    ).toBe(0)
  })

  it('CONTRAST: a valued option two hops away still counts', () => {
    // The filter must not become a proximity rule — the module's whole point is
    // that options act on outcomes THROUGH factors.
    const mid = { id: 'mid', type: 'factor' as const, data: {} }
    expect(
      countOptionsReaching(
        [outcome, factor, mid, withValues],
        [{ source: 'opt-a', target: 'mid' }, { source: 'mid', target: 'fac' }, { source: 'fac', target: 'out' }],
        'out',
      ),
    ).toBe(1)
  })
})
