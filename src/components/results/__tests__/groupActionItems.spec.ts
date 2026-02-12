import { describe, it, expect } from 'vitest'
import { groupActionItems, type GroupActionItemsInput } from '../utils/groupActionItems'
import type { UncertaintyItem, EvidenceGapItem } from '../types'

function makeEdge(overrides: Partial<UncertaintyItem> = {}): UncertaintyItem {
  return {
    code: 'SENSITIVE_ASSUMPTION',
    message: 'If "Factor A → Outcome B" changes, the recommendation shifts',
    affectedNodes: ['factor-a', 'outcome-b'],
    severity: 'critical',
    ...overrides,
  }
}

function makeGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'factor-x',
    factorLabel: 'Factor X',
    confidence: 40,
    voi: 0.6,
    suggestion: 'Investigate further',
    ...overrides,
  }
}

describe('groupActionItems', () => {
  it('places fragile edges in Group 1 (validate)', () => {
    const edge = makeEdge()
    const groups = groupActionItems({
      fragileEdges: [edge],
      evidenceGaps: [],
    })

    expect(groups[0].key).toBe('validate')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].title).toBe('Factor A → Outcome B')
    expect(groups[0].items[0].id).toBe('factor-a→outcome-b')
  })

  it('places evidence gaps in Group 2 (investigate)', () => {
    const gap = makeGap()
    const groups = groupActionItems({
      fragileEdges: [],
      evidenceGaps: [gap],
    })

    expect(groups[1].key).toBe('investigate')
    expect(groups[1].items).toHaveLength(1)
    expect(groups[1].items[0].title).toBe('Factor X')
    expect(groups[1].items[0].id).toBe('factor-x')
  })

  it('excludes evidence gap from Group 2 when its factorId matches a Group 1 dedup key exactly', () => {
    // Edge with single affectedNode whose key === factorId of a gap
    const edge = makeEdge({
      message: 'factor-shared changes outcome',
      affectedNodes: ['factor-shared'],
    })
    const gap = makeGap({ factorId: 'factor-shared', factorLabel: 'Shared Factor' })

    const groups = groupActionItems({
      fragileEdges: [edge],
      evidenceGaps: [gap],
    })

    expect(groups[0].items).toHaveLength(1)
    // Gap should be excluded from Group 2 (exact key match)
    expect(groups[1].items).toHaveLength(0)
  })

  it('does NOT suppress evidence gap when factorId only partially matches a fragile edge from_id', () => {
    // Edge key is "factor-a→outcome-b", gap key is "factor-a"
    // These are different keys — gap should NOT be suppressed
    const edge = makeEdge({
      affectedNodes: ['factor-a', 'outcome-b'],
    })
    const gap = makeGap({ factorId: 'factor-a', factorLabel: 'Factor A' })

    const groups = groupActionItems({
      fragileEdges: [edge],
      evidenceGaps: [gap],
    })

    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].id).toBe('factor-a→outcome-b')
    // Gap stays in Group 2 — partial match does not suppress
    expect(groups[1].items).toHaveLength(1)
    expect(groups[1].items[0].id).toBe('factor-a')
  })

  it('returns empty Group 1 when no fragile edges, and all evidence gaps in Group 2', () => {
    const gaps = [
      makeGap({ factorId: 'f1', factorLabel: 'Factor 1', voi: 0.8 }),
      makeGap({ factorId: 'f2', factorLabel: 'Factor 2', voi: 0.3 }),
    ]

    const groups = groupActionItems({
      fragileEdges: [],
      evidenceGaps: gaps,
    })

    expect(groups[0].items).toHaveLength(0)
    expect(groups[1].items).toHaveLength(2)
    // Sorted by VOI descending
    expect(groups[1].items[0].id).toBe('f1')
    expect(groups[1].items[1].id).toBe('f2')
  })

  it('returns empty Group 2 when no evidence gaps', () => {
    const groups = groupActionItems({
      fragileEdges: [makeEdge()],
      evidenceGaps: [],
    })

    expect(groups[0].items).toHaveLength(1)
    expect(groups[1].items).toHaveLength(0)
  })

  it('Groups 3 and 4 are empty when no M2 data', () => {
    const groups = groupActionItems({
      fragileEdges: [makeEdge()],
      evidenceGaps: [makeGap()],
    })

    expect(groups[2].key).toBe('reflect')
    expect(groups[2].items).toHaveLength(0)
    expect(groups[3].key).toBe('premortem')
    expect(groups[3].items).toHaveLength(0)
  })

  it('populates Groups 3 and 4 when M2 data is present', () => {
    const groups = groupActionItems({
      fragileEdges: [],
      evidenceGaps: [],
      biasFindings: ['Anchoring bias detected', 'Confirmation bias risk'],
      preMortem: ['What if the market shrinks?'],
    })

    expect(groups[2].items).toHaveLength(2)
    expect(groups[2].items[0].title).toBe('Anchoring bias detected')
    expect(groups[3].items).toHaveLength(1)
    expect(groups[3].items[0].title).toBe('What if the market shrinks?')
  })

  it('maps confidence level correctly from factorConfidence', () => {
    const edge = makeEdge({ factorConfidence: 0.3 })
    const groups = groupActionItems({
      fragileEdges: [edge],
      evidenceGaps: [],
    })

    expect(groups[0].items[0].confidenceLevel).toBe('low')
  })

  it('maps evidence gap confidence (0-100 scale) to level correctly', () => {
    const gap = makeGap({ confidence: 40 }) // 40/100 = 0.4 → low
    const groups = groupActionItems({
      fragileEdges: [],
      evidenceGaps: [gap],
    })

    expect(groups[1].items[0].confidenceLevel).toBe('low')
  })

  it('extracts subtitle from fragile edge alternativeOption', () => {
    const edge = makeEdge({
      threshold: {
        variable: 'Cost',
        direction: 'positive',
        value: 100,
        alternativeOption: 'Option B',
      },
    })
    const groups = groupActionItems({
      fragileEdges: [edge],
      evidenceGaps: [],
    })

    expect(groups[0].items[0].subtitle).toBe('Option B becomes the better choice')
  })

  it('returns all four groups in correct order', () => {
    const groups = groupActionItems({
      fragileEdges: [],
      evidenceGaps: [],
    })

    expect(groups).toHaveLength(4)
    expect(groups[0].key).toBe('validate')
    expect(groups[1].key).toBe('investigate')
    expect(groups[2].key).toBe('reflect')
    expect(groups[3].key).toBe('premortem')
  })
})
