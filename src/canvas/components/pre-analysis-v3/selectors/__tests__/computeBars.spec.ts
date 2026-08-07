import { describe, it, expect } from 'vitest'
import { computeBars } from '../computeBars'
import { BAR_STATE_WORDS, barStateFor } from '../../constants'
import type { BarsInput } from '../../types'

function input(overrides: Partial<BarsInput> = {}): BarsInput {
  return {
    decisionPresent: true,
    goalPresent: true,
    successSet: false,
    optionCount: 2,
    riskCount: 2,
    estimates: { coverage: 0, checkedCount: 0, checkableCount: 6, needsValueCount: 0 },
    ...overrides,
  }
}

describe('computeBars — honest fill', () => {
  it('frame counts only its three live components (thirds)', () => {
    expect(computeBars(input({ successSet: false })).frame.fill).toBeCloseTo(2 / 3, 10)
    expect(computeBars(input({ successSet: true })).frame.fill).toBe(1)
    expect(computeBars(input({ goalPresent: false })).frame.fill).toBeCloseTo(1 / 3, 10)
    expect(
      computeBars(input({ decisionPresent: false, goalPresent: false })).frame.fill,
    ).toBe(0)
  })

  it('frame tooltip names what is missing', () => {
    const bars = computeBars(input({ successSet: false }))
    expect(bars.frame.tooltip).toContain('success measure')
    expect(computeBars(input({ successSet: true })).frame.tooltip).toBe(
      'Decision, goal and success measure set',
    )
  })

  it('options and risks saturate at three, never exceed 1', () => {
    expect(computeBars(input({ optionCount: 0 })).options.fill).toBe(0)
    expect(computeBars(input({ optionCount: 2 })).options.fill).toBeCloseTo(2 / 3, 10)
    expect(computeBars(input({ optionCount: 7 })).options.fill).toBe(1)
    expect(computeBars(input({ riskCount: 1 })).risks.fill).toBeCloseTo(1 / 3, 10)
    expect(computeBars(input({ riskCount: 5 })).risks.fill).toBe(1)
  })

  it('estimates bar is the influence-weighted coverage', () => {
    const bars = computeBars(
      input({ estimates: { coverage: 0.34, checkedCount: 1, checkableCount: 6, needsValueCount: 0 } }),
    )
    expect(bars.estimates.fill).toBeCloseTo(0.34, 10)
    expect(bars.estimates.tooltip).toBe('1 of 6 checked')
  })

  it('tooltip appends the needs-values count when rows lack values', () => {
    const bars = computeBars(
      input({ estimates: { coverage: 0.2, checkedCount: 1, checkableCount: 2, needsValueCount: 1 } }),
    )
    expect(bars.estimates.tooltip).toBe('1 of 2 checked · 1 needs a value')
    const barsPlural = computeBars(
      input({ estimates: { coverage: 0.2, checkedCount: 1, checkableCount: 2, needsValueCount: 3 } }),
    )
    expect(barsPlural.estimates.tooltip).toBe('1 of 2 checked · 3 need values')
  })

  it('zero denominators yield 0 fill, never NaN', () => {
    const bars = computeBars(
      input({ optionCount: 0, riskCount: 0, estimates: { coverage: NaN, checkedCount: 0, checkableCount: 0, needsValueCount: 0 } }),
    )
    expect(bars.options.fill).toBe(0)
    expect(bars.risks.fill).toBe(0)
    expect(bars.estimates.fill).toBe(0)
    expect(Number.isNaN(bars.estimates.fill)).toBe(false)
  })

  it('no estimates is neutral building, not warning — and carries no cue word', () => {
    const bars = computeBars(input({ estimates: { coverage: 0, checkedCount: 0, checkableCount: 0, needsValueCount: 0 } }))
    expect(bars.estimates.state).toBe('building')
    expect(bars.estimates.tooltip).toBe('No estimates yet')
    // An empty bar captioned "medium" would contradict its own tooltip.
    expect(bars.estimates.cue).toBeNull()
  })

  it('every populated bar carries the cue word matching its state', () => {
    const bars = computeBars(input())
    for (const bar of [bars.frame, bars.options, bars.risks, bars.estimates]) {
      expect(bar.cue).toBe(BAR_STATE_WORDS[bar.state])
    }
  })

  it('state cue words align exactly with the UI-SEM-051 thresholds (word and colour share one state)', () => {
    expect(BAR_STATE_WORDS[barStateFor(0.39)]).toBe('low')
    expect(BAR_STATE_WORDS[barStateFor(0.4)]).toBe('medium')
    expect(BAR_STATE_WORDS[barStateFor(0.74)]).toBe('medium')
    expect(BAR_STATE_WORDS[barStateFor(0.75)]).toBe('good')
    expect(BAR_STATE_WORDS[barStateFor(0)]).toBe('low')
    expect(BAR_STATE_WORDS[barStateFor(1)]).toBe('good')
    // "strong" is deliberately not used (pre-analysis setup signal, not a judgement).
    expect(Object.values(BAR_STATE_WORDS)).toEqual(['low', 'medium', 'good'])
  })

  it('state thresholds: warning below 0.40, success at or above 0.75 (UI-SEM-051)', () => {
    expect(computeBars(input({ optionCount: 1 })).options.state).toBe('warning') // 1/3
    expect(computeBars(input({ optionCount: 2 })).options.state).toBe('building') // 2/3
    expect(computeBars(input({ optionCount: 3 })).options.state).toBe('success')
  })

  it('affordances never inflate fill: identical inputs give identical fills regardless of coaching presence', () => {
    // Bars take only live counts/coverage — there is no coaching input at all.
    const a = computeBars(input())
    const b = computeBars(input())
    expect(a).toEqual(b)
  })
})
