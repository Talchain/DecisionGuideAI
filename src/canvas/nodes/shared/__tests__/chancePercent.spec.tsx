import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { chancePercentText } from '../chancePercent'
import { percent } from '../../../../../scripts/olumi-core/lib/words.mjs'

afterEach(cleanup)

describe('a risk\'s chance is shown as stated, never rounded to a different figure', () => {
  it.each([
    [0.004, '0.4%'], [0.0125, '1%'], [0.0051, '1%'], [0.0049, '0.49%'], [0.3, '30%'], [0.07, '7%'], [0.376, '38%'], [0.125, '13%'], [0.996, '99.6%'], [1, '100%'], [0, '0%'],
    [0.00001, 'under 0.01%'], [0.99999, 'over 99.99%'],
  ])('%s reads %s', (p, words) => {
    expect(chancePercentText(p)).toBe(words)
  })
  it('the shim\'s description words are exact; the card agrees with them wherever rounding would otherwise say something else', () => {
    for (const p of [0, 0.00001, 0.004, 0.0049, 0.07, 0.3, 0.996, 0.99999, 1]) expect(percent(p), String(p)).toBe(chancePercentText(p))
    expect(percent(0.125)).toBe('12.5%')
    expect(percent(0.376)).toBe('37.6%')
    expect(percent(0.0125)).toBe('1.25%')
  })
  it('a small stated chance is never shown as 0% (which reads as impossible)', () => {
    expect(chancePercentText(0.004)).not.toBe('0%')
    expect(chancePercentText(0.00001)).not.toBe('0%')
  })
})
