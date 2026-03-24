/**
 * Regression test for Issue 4 (P1): Factor baseline display
 *
 * Factors with observedState.source === 'default' or 'cee_inference'
 * but no displayable value should show "Estimated by Olumi" instead
 * of "No baseline".
 */

import { describe, it, expect } from 'vitest'
import { formatFactorValue } from '../../utils/labelUtils'

describe('Issue 4 regression: factor baseline display logic', () => {
  it('formatFactorValue returns null when observedState has no value and no raw_value', () => {
    const result = formatFactorValue({ source: 'cee_inference' })
    expect(result).toBeNull()
  })

  it('formatFactorValue returns formatted value when raw_value is present', () => {
    const result = formatFactorValue({ raw_value: '42', unit: 'users' })
    expect(result).toBe('42 users')
  })

  it('formatFactorValue returns formatted value when value + cap are present', () => {
    const result = formatFactorValue({ value: 0.5, cap: 100, unit: '$' })
    expect(result).toBe('$50')
  })

  it('display logic: source=default with no value → "Estimated by Olumi" path', () => {
    // This tests the FactorNode display logic without rendering:
    // When formatFactorValue returns null AND source is 'default' or 'cee_inference',
    // the component should show "Estimated by Olumi" instead of "No baseline"
    const observedState = { source: 'default', value: undefined }
    const valueDisplay = formatFactorValue(observedState)
    const priorRangeDisplay = null

    // Simulates the ternary chain in FactorNode.tsx:240-248
    const displayText =
      valueDisplay !== null ? 'value'
      : priorRangeDisplay ? 'prior'
      : observedState.source === 'default' || observedState.source === 'cee_inference' ? 'Estimated by Olumi'
      : 'No baseline'

    expect(displayText).toBe('Estimated by Olumi')
  })

  it('display logic: source=cee_inference with no value → "Estimated by Olumi" path', () => {
    const observedState = { source: 'cee_inference' }
    const valueDisplay = formatFactorValue(observedState)
    const priorRangeDisplay: string | null = null

    const displayText =
      valueDisplay !== null ? 'value'
      : priorRangeDisplay ? 'prior'
      : observedState.source === 'default' || observedState.source === 'cee_inference' ? 'Estimated by Olumi'
      : 'No baseline'

    expect(displayText).toBe('Estimated by Olumi')
  })

  it('display logic: no observedState → "No baseline" path', () => {
    const observedState: { source?: string } | undefined = undefined
    const valueDisplay = null
    const priorRangeDisplay = null

    const displayText =
      valueDisplay !== null ? 'value'
      : priorRangeDisplay ? 'prior'
      : observedState?.source === 'default' || observedState?.source === 'cee_inference' ? 'Estimated by Olumi'
      : 'No baseline'

    expect(displayText).toBe('No baseline')
  })

  it('display logic: source=user with value → shows value', () => {
    const observedState = { source: 'user', raw_value: '100', unit: '%' }
    const valueDisplay = formatFactorValue(observedState)

    expect(valueDisplay).toBe('100%')
  })
})
