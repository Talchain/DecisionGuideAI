import { describe, it, expect } from 'vitest'
import { buildTriageNarrative } from '../buildTriageNarrative'
import type { TriageCardCategory } from '@/components/shared/TriageCard'

function item(category: TriageCardCategory) {
  return { category }
}

describe('buildTriageNarrative', () => {
  it('returns null when loading', () => {
    expect(buildTriageNarrative([item('fix')], true, null, true)).toBeNull()
  })

  it('prefers computed narrative over coachingSummary when items exist', () => {
    const result = buildTriageNarrative([item('fix')], true, 'CEE says hello', false)
    expect(result).toContain('1 factor has no data')
    expect(result).not.toBe('CEE says hello')
  })

  it('falls back to coachingSummary when items is empty', () => {
    expect(buildTriageNarrative([], true, 'CEE says hello', false)).toBe('CEE says hello')
  })

  it('prepends goal-target warning to coachingSummary fallback', () => {
    const result = buildTriageNarrative([], false, 'CEE says hello', false)
    expect(result).toBe("No target set. CEE says hello")
  })

  it('returns null when items is empty and no coachingSummary', () => {
    expect(buildTriageNarrative([], true, null, false)).toBeNull()
  })

  it('describes all-fix items', () => {
    const result = buildTriageNarrative([item('fix'), item('fix'), item('fix')], true, null, false)
    expect(result).toBe('Top 3 by impact: 3 factors have no data')
  })

  it('describes all-verify items', () => {
    const result = buildTriageNarrative([item('verify'), item('verify')], true, null, false)
    expect(result).toBe('Top 2 by impact: 2 unverified estimates')
  })

  it('describes all-edge items', () => {
    const result = buildTriageNarrative([item('add_evidence')], true, null, false)
    expect(result).toBe('Top 1 by impact: 1 relationship worth reviewing')
  })

  it('joins mixed categories with "and"', () => {
    const items = [item('fix'), item('fix'), item('verify'), item('add_evidence'), item('add_evidence')]
    const result = buildTriageNarrative(items, true, null, false)
    expect(result).toBe('Top 3 by impact: 2 factors have no data, 1 unverified estimate, 2 relationships worth reviewing')
  })

  it('returns well-prepared when all items are strengthen', () => {
    const result = buildTriageNarrative([item('strengthen')], true, null, false)
    expect(result).toBe('Your model looks well-prepared for analysis.')
  })

  it('prepends goal-target warning when no target set', () => {
    const result = buildTriageNarrative([item('fix')], false, null, false)
    expect(result).toContain("No target set.")
    expect(result).toContain('1 factor has no data')
  })

  it('caps topN at 3 even with more items', () => {
    const items = [item('fix'), item('fix'), item('fix'), item('fix'), item('fix')]
    const result = buildTriageNarrative(items, true, null, false)
    expect(result).toContain('Top 3 by impact:')
  })

  it('uses singular forms correctly', () => {
    const result = buildTriageNarrative([item('fix')], true, null, false)
    expect(result).toContain('1 factor has no data')
    expect(result).toContain('Top 1 by impact:')
  })
})
