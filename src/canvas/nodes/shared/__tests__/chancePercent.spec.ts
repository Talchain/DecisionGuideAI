import { describe, it, expect } from 'vitest'
import { chancePercentText } from '../chancePercent'

describe('a risk\'s chance is shown as stated, never rounded to a different figure', () => {
  it.each([
    [0.004, '0.4%'], [0.0125, '1%'], [0.0051, '1%'], [0.0049, '0.49%'], [0.3, '30%'], [0.07, '7%'], [0.376, '38%'], [0.125, '13%'], [0.996, '99.6%'], [1, '100%'], [0, '0%'],
    [0.00001, 'under 0.01%'], [0.99999, 'over 99.99%'],
  ])('%s reads %s', (p, words) => {
    expect(chancePercentText(p)).toBe(words)
  })
  it('a small stated chance is never shown as 0% (which reads as impossible)', () => {
    expect(chancePercentText(0.004)).not.toBe('0%')
    expect(chancePercentText(0.00001)).not.toBe('0%')
  })
})
