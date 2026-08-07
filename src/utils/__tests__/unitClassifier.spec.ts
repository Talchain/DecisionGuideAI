import { describe, it, expect } from 'vitest'
import { isCountUnit } from '../unitClassifier'

describe('isCountUnit', () => {
  it('recognises count/headcount units (case- and whitespace-insensitive)', () => {
    for (const u of ['developers', 'Developer', ' engineers ', 'people', 'headcount', 'hires', 'users', 'teams']) {
      expect(isCountUnit(u)).toBe(true)
    }
  })

  it('excludes fractional, currency, percent, placeholder, and non-count units', () => {
    // FTE is fractional by design (0.5, 1.5) — must NOT round to whole numbers.
    for (const u of ['FTE', 'fte', 'ftes', '£', '$', '%', 'months', 'hours', 'scale', 'index', '', '  ', null, undefined]) {
      expect(isCountUnit(u)).toBe(false)
    }
  })
})
