/**
 * The option inspector's "add a factor change" list says a factor's value the
 * way the factor CARD says it (Paul's test, 28 Sep 2026: "Hiring cost GBP 0").
 * It read the deprecated `formatFactorValue`; it now reads `factorDisplayText`,
 * the card's own reader.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import { formatFactorValue } from '../../../utils/labelUtils'

const hiringCost = { kind: 'factor', label: 'Hiring cost', category: 'controllable', observedState: { value: 0, raw_value: 0, unit: 'GBP', source: 'cee_inference' } }
const toolCost = { kind: 'factor', label: 'Annual assistant-tool cost', category: 'controllable', observedState: { value: 0.1, raw_value: 10000, unit: 'USD/year', source: 'cee_inference' } }

describe('the add list reads a factor value as the card does', () => {
  it('money in the card\'s words: "£0" and "$10,000 / year"', () => {
    expect(factorDisplayText(hiringCost, 'Hiring cost')).toBe('£0')
    expect(factorDisplayText(toolCost, 'Annual assistant-tool cost')).toBe('$10,000 / year')
  })
  it('CONTRAST: the deprecated reader it replaced prints the code ("GBP 0")', () => {
    expect(formatFactorValue(hiringCost.observedState)).toBe('GBP 0')
  })
  it('SOURCE: OptionPanel\'s add list asks factorDisplayText, and no longer imports formatFactorValue', () => {
    const src = readFileSync(resolve(__dirname, '../panels/OptionPanel.tsx'), 'utf8')
    expect(src).toMatch(/const valueDisplay = factorDisplayText\(/)
    expect(src).not.toMatch(/import \{[^}]*\bformatFactorValue\b/)
  })
})
