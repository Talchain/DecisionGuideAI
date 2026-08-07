import { describe, expect, it } from 'vitest'
import { shouldShowEdgeLabel, type EdgeLabelVisibilityInput } from '../edgeLabelVisibility'

const base: EdgeLabelVisibilityInput = {
  viewMode: 'standard',
  isResultsMode: true,
  isStructuralEdge: false,
  isTopStrengthEdge: false,
  selected: false,
  isHovered: false,
  hasSuggestion: false,
  isFirstEdge: false,
  showEdgeHint: false,
}

describe('shouldShowEdgeLabel — E2 top-strength labels in the default view', () => {
  it('E2: a top-strength edge shows its label in the standard view once results exist', () => {
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'standard', isTopStrengthEdge: true })).toBe(true)
  })

  it('a non-top-strength edge stays unlabelled in the standard view (no clutter)', () => {
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'standard', selected: true, isHovered: true })).toBe(false)
  })

  it('requires a completed run — no labels before results, even for top-strength', () => {
    expect(shouldShowEdgeLabel({ ...base, isResultsMode: false, isTopStrengthEdge: true })).toBe(false)
  })

  it('structural edges never show a causal label', () => {
    expect(shouldShowEdgeLabel({ ...base, isStructuralEdge: true, isTopStrengthEdge: true })).toBe(false)
  })

  it('Detailed view keeps the interaction-driven triggers (unchanged)', () => {
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert', selected: true })).toBe(true)
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert', isHovered: true })).toBe(true)
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert', hasSuggestion: true })).toBe(true)
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert', isFirstEdge: true, showEdgeHint: true })).toBe(true)
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert' })).toBe(false)
  })

  it('Detailed view still shows top-strength labels too', () => {
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'expert', isTopStrengthEdge: true })).toBe(true)
  })
})
