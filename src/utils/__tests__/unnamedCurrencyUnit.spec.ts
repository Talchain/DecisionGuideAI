/**
 * An unnamed currency is said in words, never printed raw and never given a currency it lacks (MG ruling #85
 * 5943427770; served D1 "More currency/quarter →", R3 dock-scan 5943368038).
 *
 * The predicate corpus is CEE's OWN documented examples (`orchestrator-v5/agent-lane/unnamed-currency.ts`
 * `isUnnamedCurrencyUnit` doc), not a list written here, so the UI mirror is bound to the producer's reading.
 */
import { describe, expect, it } from 'vitest'
import { isUnnamedCurrencyUnit, PLACEHOLDER_HEAD, TEMPLATE_FORM, unnamedCurrencyWords } from '../unnamedCurrencyUnit'
import { formatGoalTarget } from '../../components/results/utils/formatGoalTarget'
import { deriveOutcomeUnit } from '../../components/results/useResultsSectionData'

describe('isUnnamedCurrencyUnit mirrors CEE', () => {
  it('⛔ the literals are CEE\'s, character for character (unnamed-currency.ts:18/24 @ 0ec3f0b4): drift goes RED', () => {
    // The producer's source text: `const PLACEHOLDER_HEAD = /^<?currency>?$/i;` and
    // `const TEMPLATE_FORM = /^(<currency>|currency)\/([^\s/]+)$/i;`.
    expect(String(PLACEHOLDER_HEAD)).toBe(String.raw`/^<?currency>?$/i`)
    expect(String(TEMPLATE_FORM)).toBe(String.raw`/^(<currency>|currency)\/([^\s/]+)$/i`)
  })

  it.each(['currency/quarter', 'Currency per month', '<currency>/<period>', 'currency'])('%s → unnamed', (u) => {
    expect(isUnnamedCurrencyUnit(u)).toBe(true)
  })
  it.each(['GBP per quarter', '£/quarter', 'cryptocurrency', 'currencies', 'users', '', null, 42])('%s → not unnamed', (u) => {
    expect(isUnnamedCurrencyUnit(u)).toBe(false)
  })
})

describe('the words, and the readers that use them', () => {
  it('the exact template with a plain period → "per <period> (currency not given)"; any other unnamed form → "(currency not given)"', () => {
    expect(unnamedCurrencyWords('currency/quarter')).toBe('per quarter (currency not given)')
    expect(unnamedCurrencyWords('<currency>/month')).toBe('per month (currency not given)')
    expect(unnamedCurrencyWords('Currency per month')).toBe('(currency not given)')
    expect(unnamedCurrencyWords('<currency>/<period>')).toBe('(currency not given)')
    expect(unnamedCurrencyWords('£/quarter')).toBeNull()
  })

  it('⛔ a goal target never prints the placeholder and never names a currency', () => {
    const said = formatGoalTarget(500000, 'currency/quarter')
    expect(said).toBe('500,000 per quarter (currency not given)')
    expect(said).not.toMatch(/[£$€]|currency\//)
    // CONTRAST: a named currency is still said as money.
    expect(formatGoalTarget(500000, '£/quarter')).toMatch(/£/)
  })

  it('⛔ the outcome axis: an unnamed currency carries no symbol (→ "Stronger →"), never "More currency/quarter →"', () => {
    expect(deriveOutcomeUnit('currency/quarter')).toEqual({ outcomeUnit: undefined, outcomeUnitSymbol: undefined })
    // CONTRASTS: a count unit and a named currency are unchanged.
    expect(deriveOutcomeUnit('users')).toEqual({ outcomeUnit: 'count', outcomeUnitSymbol: 'users' })
    expect(deriveOutcomeUnit('£/quarter')).toEqual({ outcomeUnit: 'currency', outcomeUnitSymbol: '£' })
  })
})
