import { describe, it, expect } from 'vitest'
import { buildTriageNarrative } from '../buildTriageNarrative'
import type { TriageCardCategory } from '@/components/shared/TriageCard'

function item(category: TriageCardCategory, title?: string) {
  return { category, title }
}

describe('buildTriageNarrative', () => {
  it('returns null when loading', () => {
    expect(buildTriageNarrative([item('fix')], true, null, true)).toBeNull()
  })

  it('returns coaching line when items exist and target set', () => {
    const result = buildTriageNarrative([item('fix')], true, null, false)
    expect(result).toBe('Review these to improve your analysis quality')
  })

  it('returns target-setting coaching when no target', () => {
    const result = buildTriageNarrative([item('fix')], false, null, false)
    expect(result).toBe('Set a target and review these items before running analysis')
  })

  it('appends top factor name when available', () => {
    const result = buildTriageNarrative([item('fix')], true, 'Hiring Cost', false)
    expect(result).toBe('Review these to improve your analysis quality. Your highest-impact item is Hiring Cost')
  })

  it('returns well-prepared when no items and target set', () => {
    const result = buildTriageNarrative([], true, null, false)
    expect(result).toBe('Your model looks well-prepared for analysis')
  })

  it('returns target prompt when no items and no target', () => {
    const result = buildTriageNarrative([], false, null, false)
    expect(result).toBe('Set a target and review these items before running analysis')
  })

  it('appends top factor name even with no target', () => {
    const result = buildTriageNarrative([item('fix')], false, 'Market Size', false)
    expect(result).toBe('Set a target and review these items before running analysis. Your highest-impact item is Market Size')
  })
})
