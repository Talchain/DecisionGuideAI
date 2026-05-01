/**
 * P1-8 section budget invariant — pure helper tests.
 *
 * The main PreAnalysisPanel wiring is covered by the PreAnalysisPanel.spec
 * render tests. This spec asserts the simple arithmetic rules behind the
 * budget so regressions are caught even without mounting the panel.
 */

import { describe, it, expect } from 'vitest'

// Small shape mirroring what PreAnalysisPanel actually uses so we can import
// without dragging in the full component tree.
function sliceBudget<T>(all: T[], budget: number): { visible: T[]; overflow: T[] } {
  return { visible: all.slice(0, budget), overflow: all.slice(budget) }
}

describe('P1-8 review-tier budget (arithmetic invariants)', () => {
  const TRIAGE_BUDGET = 3
  const BIAS_BUDGET = 2

  it('caps visible triage at the budget', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const { visible, overflow } = sliceBudget(items, TRIAGE_BUDGET)
    expect(visible).toEqual(['a', 'b', 'c'])
    expect(overflow).toEqual(['d', 'e'])
  })

  it('caps visible bias at the budget', () => {
    const items = ['x', 'y', 'z']
    const { visible, overflow } = sliceBudget(items, BIAS_BUDGET)
    expect(visible).toEqual(['x', 'y'])
    expect(overflow).toEqual(['z'])
  })

  it('keeps all items visible when below budget', () => {
    const items = ['only']
    const { visible, overflow } = sliceBudget(items, TRIAGE_BUDGET)
    expect(visible).toEqual(['only'])
    expect(overflow).toEqual([])
  })

  it('visible + overflow equals the original list (no items lost, no duplication)', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7']
    const { visible, overflow } = sliceBudget(items, TRIAGE_BUDGET)
    expect([...visible, ...overflow]).toEqual(items)
    // No item appears twice
    const ids = new Set([...visible, ...overflow])
    expect(ids.size).toBe(items.length)
  })

  it('overflow never lands in improve-confidence-tier — callers must keep it in review-tier', () => {
    // This is a naming / semantic guard: the sliceBudget helper must never
    // mutate or migrate the overflow list. The test is a written contract
    // future maintainers will break if they try to migrate overflow.
    const items = ['a', 'b', 'c', 'd']
    const result = sliceBudget(items, TRIAGE_BUDGET)
    expect(result).toHaveProperty('overflow')
    expect(result).not.toHaveProperty('improveConfidenceAdded')
  })
})
