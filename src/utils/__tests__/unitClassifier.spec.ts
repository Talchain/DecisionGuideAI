import { describe, it, expect } from 'vitest'
import { isCountUnit } from '../unitClassifier'

describe('isCountUnit', () => {
  it('recognises count/headcount units (case- and whitespace-insensitive)', () => {
    for (const u of ['developers', 'Developer', ' engineers ', 'people', 'FTE', 'headcount', 'hires', 'users', 'teams']) {
      expect(isCountUnit(u)).toBe(true)
    }
  })

  it('returns false for currency, percent, placeholder, and non-count units', () => {
    for (const u of ['£', '$', '%', 'months', 'hours', 'scale', 'index', '', '  ', null, undefined]) {
      expect(isCountUnit(u)).toBe(false)
    }
  })
})
