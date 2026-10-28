/**
 * Decision 8 A (Paul, 26 Oct 2026): a definition link carries + − × ÷ and a worked-out card's formula shows on hover,
 * read from the canonical relation that defines the figure. And a coefficient the effect relation ADDS to a base is a
 * change of that size, never "×": Paul's board (27 Oct) read "×0.5" for a +0.5 proportional pace change.
 *
 * The fixture is that board's saved read from staging (scenario bb169869, 27 Oct), as served.
 */
import { describe, it, expect } from 'vitest'
import board from './fixtures/ai-chat-launch-saved-20261027.json'
import marketing from '../../../runView/__tests__/fixtures/accept3-marketing-r1-read.json'
import words from './fixtures/q1-words-graph.hand-made.json'
import parallel from './fixtures/q1-parallel-links.hand-made.json'
import { programCoefficientOf, programFigureWords, programFormulaWords, programLinkDirectionUnsettled, programLinkOperator, programLinkWords, programNodeWithheldReason } from '../savedModelProgram'

describe('a definition link says how its part enters the figure', () => {
  it.each([
    ['current_delivery_rate', 'delivery_rate', '×'],
    ['delivery_multiplier', 'delivery_rate', '×'],
    ['completed_tasks_start', 'completed_tasks', '+'],
    ['delivery_rate', 'completed_tasks', '+'],
    ['baseline_pace_multiplier', 'delivery_multiplier', '+'],
  ] as const)('%s → %s: %s', (from, to, op) => {
    expect(programLinkOperator(board, from, to)).toBe(op)
  })

  it('CONTRAST: an effect’s driver has no operator (its size is the link’s figure)', () => {
    expect(programLinkOperator(board, 'specialist_enabled', 'delivery_multiplier')).toBeNull()
  })

  it('CONTRAST: off a program graph, nothing', () => {
    const { living_model: _dropped, ...notProgram } = board as Record<string, unknown>
    expect(programLinkOperator(notProgram, 'current_delivery_rate', 'delivery_rate')).toBeNull()
  })
})

describe('a worked-out figure’s formula, in its parts’ labels', () => {
  it('a product', () => {
    expect(programFormulaWords(board, 'delivery_rate')).toBe('Current team delivery pace × Delivery pace relative to the current approach')
  })
  it('a stock', () => {
    expect(programFormulaWords(board, 'completed_tasks')).toBe('Starts at Remaining-scope tasks completed at the start; each period, the last level + Tasks completed per month')
  })
  // Codex r1 on #3034: a sum or product does not depend on its parts' order, so the formula never opens on "÷" or "−".
  const withParts = (op: 'sum' | 'product', parts: Array<Record<string, unknown>>) => {
    const copy = structuredClone(board) as { living_model: { canonical: { relations: Array<Record<string, unknown>> } } }
    const r = copy.living_model.canonical.relations.find((x) => x.defines === 'delivery_rate')!
    r.op = op
    r.parts = parts
    return copy
  }
  it('a ratio listed denominator first reads "A ÷ B"', () => {
    expect(programFormulaWords(withParts('product', [{ id: 'delivery_multiplier', power: -1 }, { id: 'current_delivery_rate', power: 1 }]), 'delivery_rate'))
      .toBe('Current team delivery pace ÷ Delivery pace relative to the current approach')
  })
  it('a product of a denominator alone reads "1 ÷ B"', () => {
    expect(programFormulaWords(withParts('product', [{ id: 'delivery_multiplier', power: -1 }]), 'delivery_rate'))
      .toBe('1 ÷ Delivery pace relative to the current approach')
  })
  it('a difference listed subtrahend first reads "A − B"', () => {
    expect(programFormulaWords(withParts('sum', [{ id: 'delivery_multiplier', sign: -1 }, { id: 'current_delivery_rate', sign: 1 }]), 'delivery_rate'))
      .toBe('Current team delivery pace − Delivery pace relative to the current approach')
  })
  it('an effect', () => {
    expect(programFormulaWords(board, 'delivery_multiplier')).toBe(
      'Current pace multiplier + Proportional pace change from experienced AI support × Experienced AI support in place'
      + ' + Proportional pace change from a managed chat service × Managed chat service approach in use',
    )
  })
  it('CONTRAST: a figure no relation defines has none', () => {
    expect(programFormulaWords(board, 'current_delivery_rate')).toBeNull()
  })
})

describe('a coefficient added to a base reads as a change', () => {
  it('Paul’s board: "+0.5 (-0.2–1.5)", never "×0.5"', () => {
    const c = programCoefficientOf(board, 'specialist_enabled__delivery_multiplier')
    expect(c && programFigureWords(c)).toBe('+0.5 (-0.2–1.5)')
  })
  it('CONTRAST: a read with no relation keeps the multiplier reading (marketing, "×1.15 (0.5–2)")', () => {
    const c = programCoefficientOf(marketing.graph, 'baseline_conversion_rate__manager_conversion_rate')
    expect(c && programFigureWords(c)).toBe('×1.15 (0.5–2)')
  })
})

// CEE #3859 (DL, 27 Oct): the projection adds `direction_settled: false` on a link whose range crosses zero, and
// `effect_mode` on a risk's link. The board read predates #3859, so the fields are set here as CEE names them.
describe('CEE #3859 link fields', () => {
  type G = { edges: Array<Record<string, unknown>> }
  const withEdge = (id: string, patch: Record<string, unknown>) => {
    const copy = structuredClone(board) as unknown as G
    Object.assign(copy.edges.find((e) => e.id === id)!, patch)
    return copy
  }
  it('a range across zero: direction not settled', () => {
    const g = withEdge('specialist_enabled__delivery_multiplier', { direction_settled: false })
    expect(programLinkDirectionUnsettled(g, 'specialist_enabled', 'delivery_multiplier')).toBe(true)
  })
  it('CONTRAST: no flag, or another link, is settled', () => {
    expect(programLinkDirectionUnsettled(board, 'specialist_enabled', 'delivery_multiplier')).toBe(false)
    const g = withEdge('specialist_enabled__delivery_multiplier', { direction_settled: false })
    expect(programLinkDirectionUnsettled(g, 'managed_service_enabled', 'delivery_multiplier')).toBe(false)
  })
  it('a multiplying risk draws ×; an adding one draws no operator (its sign is the link\'s own)', () => {
    expect(programLinkOperator(withEdge('launch_rushed_testing__completed_tasks', { effect_mode: 'multiply' }), 'launch_rushed_testing', 'completed_tasks')).toBe('×')
    expect(programLinkOperator(withEdge('launch_rushed_testing__completed_tasks', { effect_mode: 'add' }), 'launch_rushed_testing', 'completed_tasks')).toBeNull()
  })
})

// Q1 readers (DL GO, 28 Oct): a link in words carries `link_words` and a card whose outcome is not calculable carries
// `withheld_reason`, read from the saved graph exactly as `direction_settled` is. Hand-made graph in the contract's shapes.
describe('Q1: the saved read\'s words for a link and a withheld card', () => {
  it('an influence link: its stated direction, confidence and basis, as recorded', () => {
    expect(programLinkWords(words, 'evening_classes__member_mood', 'evening_classes', 'member_mood'))
      .toEqual({ direction: 'conditional', confidence: 'likely', basis: 'Members asked for them in the spring survey' })
  })
  it('an unsized risk link: no confidence and no basis are recorded', () => {
    expect(programLinkWords(words, 'rent_rise__keep_members', 'rent_rise', 'keep_members')).toEqual({ direction: 'unknown', confidence: null, basis: null })
  })
  it('CONTRAST: a numerical link has none; off a program, none; an unrecognised value, none', () => {
    expect(programLinkWords(words, 'monthly_cost__keep_members', 'monthly_cost', 'keep_members')).toBeNull()
    const { living_model: _dropped, ...notProgram } = words as Record<string, unknown>
    expect(programLinkWords(notProgram, 'evening_classes__member_mood', 'evening_classes', 'member_mood')).toBeNull()
    for (const bad of [{ direction: 'sideways', confidence: 'likely', basis: null }, { direction: 'up', confidence: 'certain', basis: null }, { direction: 'up', confidence: null, basis: 3 }, 'up']) {
      const copy = structuredClone(words) as { edges: Array<Record<string, unknown>> }
      copy.edges.find((e) => e.id === 'evening_classes__member_mood')!.link_words = bad
      expect(programLinkWords(copy, 'evening_classes__member_mood', 'evening_classes', 'member_mood')).toBeNull()
    }
  })
  it('a goal and a limit card say why they are not calculated; other cards and non-programs say nothing', () => {
    expect(programNodeWithheldReason(words, 'keep_members')).toBe('It rests on the link “Run evening classes → How members feel”, which is in words with no figure.')
    expect(programNodeWithheldReason(words, 'mp:limit:budget')).toBe('Its figure is not given yet.')
    expect(programNodeWithheldReason(words, 'member_mood')).toBeNull()
    const { living_model: _dropped, ...notProgram } = words as Record<string, unknown>
    expect(programNodeWithheldReason(notProgram, 'keep_members')).toBeNull()
  })
})

// Q1 readers (PL BLOCK 1, 28 Oct): CEE gives parallel links distinct ids (`…__2`). Each is read by its own id, and the
// endpoints decide only when exactly one saved edge joins them: two claims are never folded into one.
describe('Q1: parallel links are read by their own id, never the first of the pair', () => {
  it.each([
    ['quality__members', 'quality', 'members', { direction: 'conditional', confidence: 'likely', basis: 'Only if the classes suit them' }],
    ['quality__members__2', 'quality', 'members', null],
    ['price__demand', 'price', 'demand', null],
    ['price__demand__2', 'price', 'demand', { direction: 'disputed', confidence: 'unsure', basis: 'Staff disagree' }],
  ] as const)('%s → its own words', (id, from, to, expected) => {
    expect(programLinkWords(parallel, id, from, to)).toEqual(expected)
  })
  it('each link\'s own "direction not settled", by id', () => {
    expect(programLinkDirectionUnsettled(parallel, 'quality', 'members', 'quality__members')).toBe(true)
    expect(programLinkDirectionUnsettled(parallel, 'quality', 'members', 'quality__members__2')).toBe(false)
    expect(programLinkDirectionUnsettled(parallel, 'price', 'demand', 'price__demand')).toBe(false)
  })
  it('an id the read lacks falls back to the endpoints only when exactly one edge joins them', () => {
    expect(programLinkWords(words, 'not-a-saved-id', 'evening_classes', 'member_mood')?.direction).toBe('conditional')
    expect(programLinkWords(parallel, 'not-a-saved-id', 'quality', 'members')).toBeNull()
    expect(programLinkDirectionUnsettled(parallel, 'quality', 'members')).toBe(false)
  })
})
