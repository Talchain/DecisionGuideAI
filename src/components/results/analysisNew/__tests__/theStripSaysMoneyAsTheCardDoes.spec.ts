/**
 * Served b8906035 (Panel's staging check of the ONE money-figure rule, DL #72 5870353946): after a price
 * edit (49 → 58.8, `unit: "GBP per month"`) the Reasoning tab's model-strip detail read "58.8 GBP per month"
 * while the factor card beside it read "£58.80 / month". The strip printed the formatter's raw string; it now
 * prints the card's visible text (`factorCardVisibleText`), and is null exactly when it was before.
 */
import { describe, expect, it } from 'vitest'
import { buildModelStrip } from '../buildModelStrip'

const factor = (id: string, observedState: Record<string, unknown>) => ({
  id,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: id, kind: 'factor', observedState },
})
const valueTextOf = (observedState: Record<string, unknown>) =>
  buildModelStrip([factor('f', observedState) as never]).rows[0].nodes[0].valueText

describe('the model strip says money the way the card does', () => {
  it('⭐ the served edit: "£58.80 / month", no raw GBP', () => {
    expect(valueTextOf({ value: 0.588, raw_value: 58.8, unit: 'GBP per month' })).toBe('£58.80 / month')
  })

  it('⭐ a bare currency: "£39,000", not "GBP 39,000"', () => {
    expect(valueTextOf({ value: 0.39, raw_value: 39000, unit: 'GBP' })).toBe('£39,000')
  })

  it('CONTROL: a count keeps its text', () => {
    expect(valueTextOf({ value: 0.5, raw_value: 1500, unit: 'subscribers' })).toBe('1,500 subscribers')
  })

  it('CONTROL: a value the formatter declines is still null (the counts do not move)', () => {
    expect(valueTextOf({ value: 0.42, unit: 'index' })).toBeNull()
  })
})
