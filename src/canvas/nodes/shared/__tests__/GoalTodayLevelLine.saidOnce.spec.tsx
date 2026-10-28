/**
 * UI-SURGICAL 5 (Paul's screenshots, 28 Oct): the goal's today line is said once. The sentence is the wrapper's
 * accessible name, never a second text node beside the visible "today <figure>", so page text does not read it twice.
 * And an Olumi reading with no quote is still Olumi's, never "you said".
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GoalTodayLevelText } from '../GoalTodayLevelLine'
import { goalTodayLevelCopy } from '../goalTodayLevelCopy'
import type { GoalTodayLevel } from '../../../domain/goalTarget'

afterEach(cleanup)

const level: GoalTodayLevel = { level: 400, unit: 'customers', basis: 'from_brief', quote: null }

describe('the today line is said once', () => {
  it('page text holds the visible words only; the sentence is the accessible name', () => {
    const sentence = goalTodayLevelCopy(level)
    const { container } = render(<GoalTodayLevelText level={level} sentence={sentence} testId="t" />)
    expect(container.textContent).toBe('today 400 customers')
    expect(screen.getByRole('group', { name: sentence })).toBeTruthy()
  })
})

describe('an Olumi reading is said as Olumi’s', () => {
  it('with no quote: "Olumi\'s reading", never "you said"', () => {
    expect(goalTodayLevelCopy({ ...level, basis: 'olumi_reading' })).toBe("Today: 400 customers — Olumi's reading")
  })
  it('CONTRAST: with a quote, it names the words read', () => {
    expect(goalTodayLevelCopy({ ...level, basis: 'olumi_reading', quote: 'about 400 a week' })).toBe("Today: 400 customers — Olumi's reading of ‘about 400 a week’")
  })
  it('CONTRAST: the person’s own level still says "you said"', () => {
    expect(goalTodayLevelCopy({ ...level, basis: 'user_stated' })).toBe('Today: 400 customers — you said')
  })
})
