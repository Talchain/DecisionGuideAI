import { describe, it, expect } from 'vitest'
import { groupActionItems, type GroupActionItemsInput } from '../utils/groupActionItems'
import type { UncertaintyItem, EvidenceGapItem } from '../types'
import type { ConstraintAnalysis } from '../../../types/constraints'

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

  // ── Multi-constraint integration ────────────────────────────────────────

  describe('constraint_analysis integration', () => {
    const makeConstraintAnalysis = (overrides?: Partial<ConstraintAnalysis>): ConstraintAnalysis => ({
      joint_probability: 0.52,
      constraints: [
        {
          node_id: 'churn',
          operator: '<=',
          threshold: 0.04,
          label: 'Churn rate',
          prob_satisfied: 0.85,
          failure_margin_median: 0.01,
          near_miss_fraction: 0.1,
          binding: false,
        },
        {
          node_id: 'budget',
          operator: '<=',
          threshold: 20000,
          label: 'Budget',
          prob_satisfied: 0.78,
          failure_margin_median: 2000,
          near_miss_fraction: 0.15,
          binding: true,
        },
      ],
      ...overrides,
    })

    it('adds binding constraint to Group 1 (validate)', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: [],
        constraintAnalysis: makeConstraintAnalysis(),
      })

      const bindingItems = groups[0].items.filter(i => i.id.startsWith('binding-'))
      expect(bindingItems).toHaveLength(1)
      expect(bindingItems[0].title).toBe('Budget is the binding constraint')
      expect(bindingItems[0].subtitle).toBe('Most likely to prevent you from meeting all your targets.')
      expect(bindingItems[0].targetId).toBe('budget')
      expect(bindingItems[0].source).toBe('model')
    })

    it('adds near-miss constraint to Group 2 (investigate) when near_miss_fraction > 0.3', () => {
      const analysis = makeConstraintAnalysis({
        constraints: [
          {
            node_id: 'timeline',
            operator: '<=',
            threshold: 6,
            label: 'Timeline',
            prob_satisfied: 0.61,
            failure_margin_median: 0.5,
            near_miss_fraction: 0.42,
            binding: false,
          },
        ],
      })

      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: [],
        constraintAnalysis: analysis,
      })

      const nearMissItems = groups[1].items.filter(i => i.id.startsWith('near-miss-'))
      expect(nearMissItems).toHaveLength(1)
      expect(nearMissItems[0].title).toBe('Timeline is close to failing')
      expect(nearMissItems[0].subtitle).toContain('42%')
      expect(nearMissItems[0].targetId).toBe('timeline')
      expect(nearMissItems[0].targetType).toBe('node')
      expect(nearMissItems[0].confidenceLevel).toBe('medium')
    })

    it('does not add near-miss item when near_miss_fraction <= 0.3', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: [],
        constraintAnalysis: makeConstraintAnalysis(), // both constraints have fraction <= 0.3
      })

      const nearMissItems = groups[1].items.filter(i => i.id.startsWith('near-miss-'))
      expect(nearMissItems).toHaveLength(0)
    })

    it('no constraint items when constraintAnalysis is undefined', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: [],
      })

      const bindingItems = groups[0].items.filter(i => i.id.startsWith('binding-'))
      const nearMissItems = groups[1].items.filter(i => i.id.startsWith('near-miss-'))
      expect(bindingItems).toHaveLength(0)
      expect(nearMissItems).toHaveLength(0)
    })

    it('binding constraint coexists with fragile edges in Group 1', () => {
      const edge = makeEdge()
      const groups = groupActionItems({
        fragileEdges: [edge],
        evidenceGaps: [],
        constraintAnalysis: makeConstraintAnalysis(),
      })

      // 1 fragile edge + 1 binding constraint
      expect(groups[0].items).toHaveLength(2)
      expect(groups[0].items[0].id).toBe('factor-a→outcome-b')
      expect(groups[0].items[1].id).toBe('binding-budget')
    })
  })

  // ── V11 Phase E: Hinge de-duplication ─────────────────────────────────────

  describe('V11: excludeFactorIds (hinge de-duplication)', () => {
    it('removes fragile edge from Group 1 when its from-node matches excludeFactorIds', () => {
      const edge1 = makeEdge({ affectedNodes: ['factor-hinge', 'outcome-b'] })
      const edge2 = makeEdge({
        message: 'If "Factor C → Outcome D" changes',
        affectedNodes: ['factor-c', 'outcome-d'],
      })

      const groups = groupActionItems({
        fragileEdges: [edge1, edge2],
        evidenceGaps: [],
        excludeFactorIds: ['factor-hinge'],
      })

      expect(groups[0].items).toHaveLength(1)
      expect(groups[0].items[0].targetId).toBe('factor-c')
    })

    it('removes evidence gap from Group 2 when factorId matches excludeFactorIds', () => {
      const gap1 = makeGap({ factorId: 'factor-hinge', factorLabel: 'Hinge Factor' })
      const gap2 = makeGap({ factorId: 'factor-other', factorLabel: 'Other Factor' })

      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: [gap1, gap2],
        excludeFactorIds: ['factor-hinge'],
      })

      expect(groups[1].items).toHaveLength(1)
      expect(groups[1].items[0].id).toBe('factor-other')
    })

    it('excluded fragile edge still prevents same factor from appearing in Group 2', () => {
      // Edge has single affectedNode matching gap factorId
      const edge = makeEdge({
        message: 'factor-shared changes',
        affectedNodes: ['factor-shared'],
      })
      const gap = makeGap({ factorId: 'factor-shared', factorLabel: 'Shared' })

      const groups = groupActionItems({
        fragileEdges: [edge],
        evidenceGaps: [gap],
        excludeFactorIds: ['factor-shared'],
      })

      // Excluded from Group 1 display
      expect(groups[0].items).toHaveLength(0)
      // Still excluded from Group 2 (dedup key preserved)
      expect(groups[1].items).toHaveLength(0)
    })

    it('does not affect other groups when excludeFactorIds is empty', () => {
      const edge = makeEdge()
      const gap = makeGap()

      const groups = groupActionItems({
        fragileEdges: [edge],
        evidenceGaps: [gap],
        excludeFactorIds: [],
      })

      expect(groups[0].items).toHaveLength(1)
      expect(groups[1].items).toHaveLength(1)
    })
  })
})
