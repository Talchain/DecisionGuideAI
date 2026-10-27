/**
 * Decision 8 A (Paul, 26 Oct 2026): a definition link carries + − × ÷ and a worked-out card's formula shows on hover,
 * read from the canonical relation that defines the figure. And a coefficient the effect relation ADDS to a base is a
 * change of that size, never "×": Paul's board (27 Oct) read "about ×0.5" for a +0.5 proportional pace change.
 *
 * The fixture is that board's saved read from staging (scenario bb169869, 27 Oct), as served.
 */
import { describe, it, expect } from 'vitest'
import board from './fixtures/ai-chat-launch-saved-20261027.json'
import marketing from '../../../runView/__tests__/fixtures/accept3-marketing-r1-read.json'
import { programCoefficientOf, programFigureWords, programFormulaWords, programLinkOperator } from '../savedModelProgram'

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
    expect(programFormulaWords(board, 'completed_tasks')).toBe('Remaining-scope tasks completed at the start + Tasks completed per month, each period')
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
  it('Paul’s board: "about +0.5 (-0.2–1.5)", never "×0.5"', () => {
    const c = programCoefficientOf(board, 'specialist_enabled__delivery_multiplier')
    expect(c && programFigureWords(c)).toBe('about +0.5 (-0.2–1.5)')
  })
  it('CONTRAST: a read with no relation keeps the multiplier reading (marketing, "about ×1.15 (0.5–2)")', () => {
    const c = programCoefficientOf(marketing.graph, 'baseline_conversion_rate__manager_conversion_rate')
    expect(c && programFigureWords(c)).toBe('about ×1.15 (0.5–2)')
  })
})
