import { describe, expect, it } from 'vitest'
import { shouldShowEdgeLabel, viewShowsStrengthLabels, type EdgeLabelVisibilityInput } from '../edgeLabelVisibility'

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

describe('shouldShowEdgeLabel — the default view pins no strength label (contract v3.1 U10)', () => {
  // contract v3.1 (U10; pts 4, 12) supersedes E2 (graph-visuals 2026-07-11),
  // which pinned top-strength labels in the standard view. Strength is the
  // stroke width; the words live in the hover and the relationship inspector.
  it('v3.1 U10: a top-strength edge shows NO label in the standard view, even once results exist', () => {
    expect(shouldShowEdgeLabel({ ...base, viewMode: 'standard', isTopStrengthEdge: true })).toBe(false)
  })

  it('v3.1 U10: no standard-view state paints a strength label', () => {
    expect(shouldShowEdgeLabel({
      ...base, viewMode: 'standard', isTopStrengthEdge: true, selected: true, isHovered: true,
      hasSuggestion: true, isFirstEdge: true, showEdgeHint: true,
    })).toBe(false)
  })

  it('viewShowsStrengthLabels: false for the default view, true for Detailed', () => {
    expect(viewShowsStrengthLabels('standard')).toBe(false)
    expect(viewShowsStrengthLabels('expert')).toBe(true)
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
