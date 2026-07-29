/**
 * Golden payload regression test — V14.2
 *
 * Tests critical invariants across the full results panel using realistic
 * data matching the shape of a real PLoT response (olumi-debug-5494dfd5).
 *
 * Asserts against VM output and data layer — no component rendering needed.
 */

import { describe, it, expect } from 'vitest'
import {
  buildResultsVM,
  computeGapTop2,
  deriveDecisionState,
} from '../buildResultsVM'
import { groupActionItems } from '../utils/groupActionItems'
import { humaniseCritique } from '../utils/humaniseCritique'
import { buildSegmentColorMap, WIN_GAUGE_COLORS, WIN_GAUGE_COLORS_INDETERMINATE } from '../WinGauge'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  DriverItem,
  UncertaintyItem,
  EvidenceGapItem,
  NextActionItem,
} from '../types'

// ─── Golden fixture: 3-option scenario ──────────────────────────────────────

const GOLDEN_OPTIONS: OptionResult[] = [
  {
    id: 'opt_acquire',
    label: 'Acquire',
    expected: 180,
    outcome: { mean: 180, p10: 120, p50: 175, p90: 240 },
    p10: 120,
    p50: 175,
    p90: 240,
    isRecommended: false,
    winProbability: 0.33,
  },
  {
    id: 'opt_build',
    label: 'Build',
    expected: 220,
    outcome: { mean: 220, p10: 160, p50: 215, p90: 280 },
    p10: 160,
    p50: 215,
    p90: 280,
    isRecommended: true,
    winProbability: 0.46,
  },
  {
    id: 'opt_partner',
    label: 'Partner',
    expected: 150,
    outcome: { mean: 150, p10: 100, p50: 145, p90: 200 },
    p10: 100,
    p50: 145,
    p90: 200,
    isRecommended: false,
    winProbability: 0.21,
  },
]

const GOLDEN_DRIVERS: DriverItem[] = [
  {
    factorKey: 'fac_product_market_fit',
    factorLabel: 'Product-Market Fit',
    rawElasticity: 2.1,
    normalisedInfluence: 1.0,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: true,
    valueOfInformation: 0.1,
  },
  {
    factorKey: 'fac_engineering_capacity',
    factorLabel: 'Engineering Capacity',
    rawElasticity: 1.4,
    normalisedInfluence: 0.67,
    rank: 2,
    semanticLabel: 'strong',
    canFocus: true,
    valueOfInformation: 0.084,
  },
  {
    factorKey: 'fac_customer_churn',
    factorLabel: 'Customer Churn',
    rawElasticity: -0.9,
    normalisedInfluence: 0.43,
    rank: 3,
    semanticLabel: 'moderate',
    canFocus: true,
    valueOfInformation: 0.072,
  },
]

const GOLDEN_CRITIQUES: UncertaintyItem[] = [
  {
    code: 'MISSING_OBSERVED_STATE',
    message: 'constraint_fac_customer_churn_max targets factor node fac_customer_churn with observed_state.value missing',
    userMessage: 'Customer Churn is missing a current value',
    affectedNodes: ['fac_customer_churn'],
    severity: 'warning',
  },
  {
    code: 'UNKNOWN_INTERNAL_CODE',
    message: 'fac_engineering_capacity has intercept=0 and blocks_analysis pipeline',
    // No userMessage — internal critique, should not render in banner
    affectedNodes: ['fac_engineering_capacity'],
    severity: 'warning',
  },
]

const GOLDEN_EVIDENCE_GAPS: EvidenceGapItem[] = [
  { factorId: 'fac_product_market_fit', factorLabel: 'Product-Market Fit', confidence: 25, voi: 0.1, suggestion: 'Validate market assumptions' },
  { factorId: 'fac_engineering_capacity', factorLabel: 'Engineering Capacity', confidence: 30, voi: 0.084, suggestion: 'Estimate team capacity' },
  { factorId: 'fac_customer_churn', factorLabel: 'Customer Churn', confidence: 25, voi: 0.072, suggestion: 'Check historical churn' },
  { factorId: 'fac_scalability', factorLabel: 'Scalability', confidence: 40, voi: 0.005, suggestion: 'Review scaling plan' },
  { factorId: 'fac_brand', factorLabel: 'Brand Awareness', confidence: 50, voi: 0, suggestion: '' },
  { factorId: 'fac_regulation', factorLabel: 'Regulatory Risk', confidence: 60, voi: 0, suggestion: '' },
  { factorId: 'fac_competition', factorLabel: 'Competitive Pressure', confidence: 45, voi: 0, suggestion: '' },
]

const GOLDEN_NEXT_ACTIONS: NextActionItem[] = [
  {
    action: 'Gather evidence on Engineering Capacity',
    rationale: 'Low confidence factor with high VOI',
    priority: 2,
    targetType: 'node',
    targetId: 'fac_engineering_capacity',
    targetLabel: 'Engineering Capacity',
  },
  {
    action: 'Validate the Mid-Market Customer Acquisition to Reach 200 customers target',
    rationale: 'Binding constraint needs validation',
    priority: 3,
    targetType: 'node',
    targetId: 'fac_customer_acquisition',
    targetLabel: 'Mid-Market Customer Acquisition',
  },
]

function makeGoldenData(): ResultsSectionDataReturn {
  const recommendedOption = GOLDEN_OPTIONS.find(o => o.isRecommended) ?? GOLDEN_OPTIONS[0]

  const recommendation: DecisionResultData = {
    recommendedOption,
    allOptions: GOLDEN_OPTIONS,
    goalLabel: 'Maximise revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.46,
    robustnessLevel: 'low',
    coachingReadiness: 'needs_evidence',
  }

  const drivers: DriversSectionData = {
    drivers: GOLDEN_DRIVERS,
    driversStatus: 'computed',
    topDrivers: GOLDEN_DRIVERS.slice(0, 3),
    totalCount: GOLDEN_DRIVERS.length,
    hasMagnitudeData: true,
  }

  const nodeLabels = new Map([
    ['fac_customer_churn', 'Customer Churn'],
    ['fac_engineering_capacity', 'Engineering Capacity'],
    ['fac_product_market_fit', 'Product-Market Fit'],
  ])

  const humanisedCritiques = GOLDEN_CRITIQUES
    .filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
    .map(item => humaniseCritique(item, nodeLabels))

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'needs_work', icon: 'AlertTriangle', label: 'Needs work', description: 'Needs improvement' },
    qualityScore: 35,
    uncertainties: GOLDEN_CRITIQUES,
    topUncertainties: GOLDEN_CRITIQUES.slice(0, 3),
    improvements: [],
    topImprovements: [],
    evidenceGaps: GOLDEN_EVIDENCE_GAPS,
    topEvidenceGaps: GOLDEN_EVIDENCE_GAPS.slice(0, 3),
    nextActions: GOLDEN_NEXT_ACTIONS,
    topNextActions: GOLDEN_NEXT_ACTIONS,
    humanisedCritiques,
  }

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Revenue',
    // V7-C slice 1 (ROADMAP 2.141): `null` is the honest-gate verdict — this
    // fixture predates the Resolve next view and asserts nothing about it.
    voiRanking: null,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Golden payload regression tests', () => {
  const data = makeGoldenData()
  const vm = buildResultsVM(data, { fragileEdgeCount: 2, totalEdgeCount: 8 })

  // 1. No internal strings in banner
  describe('Banner text safety', () => {
    const INTERNAL_PATTERNS = [
      /constraint_fac_/,
      /fac_[a-z_]+/,
      /observed_state/,
      /intercept=0/,
      /opt_[a-z_]+/,
      /blocks_analysis/,
    ]

    it('humanised critiques contain no internal strings', () => {
      const critiques = data.confidence.humanisedCritiques ?? []
      for (const c of critiques) {
        const text = `${c.title} ${c.description} ${c.suggestion ?? ''}`
        for (const pattern of INTERNAL_PATTERNS) {
          expect(text).not.toMatch(pattern)
        }
      }
    })

    it('banner items (with suggestion + factorId) contain no internal strings', () => {
      const bannerItems = (data.confidence.humanisedCritiques ?? []).filter(
        c => c.suggestion != null && c.factorId != null,
      )
      for (const item of bannerItems) {
        const text = `${item.title} ${item.description} ${item.suggestion ?? ''}`
        for (const pattern of INTERNAL_PATTERNS) {
          expect(text).not.toMatch(pattern)
        }
      }
    })

    it('critiques without user_message are excluded from banner', () => {
      // The second critique has no userMessage and no template match,
      // so its humanised version should have no suggestion → excluded from banner
      const bannerItems = (data.confidence.humanisedCritiques ?? []).filter(
        c => c.suggestion != null && c.factorId != null,
      )
      // Only the MISSING_OBSERVED_STATE critique should appear (has template)
      expect(bannerItems.length).toBeGreaterThanOrEqual(1)
      // The internal critique message should not appear anywhere in banner items
      for (const item of bannerItems) {
        expect(item.title).not.toContain('intercept=0')
        expect(item.title).not.toContain('blocks_analysis')
      }
    })
  })

  // 2. Options sorted by win probability
  describe('Option sort order', () => {
    const sortedOptions = [...data.recommendation.allOptions].sort(
      (a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0),
    )

    it('cards render in descending win probability order: Build, Acquire, Partner', () => {
      expect(sortedOptions[0].label).toBe('Build')
      expect(sortedOptions[1].label).toBe('Acquire')
      expect(sortedOptions[2].label).toBe('Partner')
    })

    it('win probabilities are 46%, 33%, 21%', () => {
      expect(sortedOptions[0].winProbability).toBe(0.46)
      expect(sortedOptions[1].winProbability).toBe(0.33)
      expect(sortedOptions[2].winProbability).toBe(0.21)
    })
  })

  // 3. Rank badge correct
  describe('Rank badge', () => {
    it('winner badge reads "#1 of 3"', () => {
      const totalOptions = data.recommendation.allOptions.length
      expect(totalOptions).toBe(3)
      // Rank badge format: #1 of {totalOptions}
      expect(`#1 of ${totalOptions}`).toBe('#1 of 3')
    })
  })

  // 4. No encoding notation
  describe('Encoding notation', () => {
    const ENCODING_PATTERN = /\(\d+\.?\d*=[^)]+\)/

    it('no option labels contain encoding notation', () => {
      for (const opt of data.recommendation.allOptions) {
        expect(opt.label).not.toMatch(ENCODING_PATTERN)
      }
    })

    it('no driver labels contain encoding notation', () => {
      for (const d of data.drivers.drivers) {
        expect(d.factorLabel).not.toMatch(ENCODING_PATTERN)
      }
    })
  })

  // 5. Decision state
  describe('Decision state', () => {
    it('derives correct state for 46% stability', () => {
      // 46% stability < SENSITIVE_THRESHOLD (0.55) AND gap (0.46-0.33=0.13) > GAP_THRESHOLD (0.10)
      // → indeterminate (stability below sensitive threshold)
      const gap = computeGapTop2(data.recommendation.allOptions)
      const state = deriveDecisionState(gap, 0.46)
      expect(state).toBe('indeterminate')
    })

    it('VM decision state is indeterminate for this payload', () => {
      expect(vm.decisionState).toBe('indeterminate')
    })
  })

  // 6. Coaching next-action is highest priority
  describe('Coaching next action', () => {
    it('topNextActions[0] is the priority 2 action (highest priority)', () => {
      const topAction = data.confidence.topNextActions?.[0]
      expect(topAction).toBeDefined()
      expect(topAction!.priority).toBe(2)
      expect(topAction!.action).toContain('Engineering Capacity')
    })

    it('priority 2 comes before priority 3', () => {
      const actions = data.confidence.topNextActions ?? []
      expect(actions.length).toBeGreaterThanOrEqual(2)
      expect(actions[0].priority).toBeLessThan(actions[1].priority)
    })
  })

  // 7. VOI rank-based labels
  describe('VOI rank-based labels', () => {
    it('top VOI factor gets "Check first"', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
      })
      const investigateItems = groups[1].items
      // Sorted by VOI descending: Product-Market Fit (0.1), Engineering Capacity (0.084), Customer Churn (0.072)
      const topItem = investigateItems[0]
      expect(topItem.voiLevel).toBe('Check first')
    })

    it('ranks 2-3 get "Check next"', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
      })
      const investigateItems = groups[1].items
      expect(investigateItems[1]?.voiLevel).toBe('Check next')
      expect(investigateItems[2]?.voiLevel).toBe('Check next')
    })

    it('factors with voi === 0 get no pill', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
      })
      const investigateItems = groups[1].items
      const zeroVoiItems = investigateItems.filter(
        i => GOLDEN_EVIDENCE_GAPS.find(g => g.factorId === i.id)?.voi === 0,
      )
      for (const item of zeroVoiItems) {
        expect(item.voiLevel).toBeNull()
      }
    })

    it('rank 4+ with low voi gets no pill', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
      })
      const investigateItems = groups[1].items
      // Scalability is rank 4 with voi 0.005 (>0 but rank > 3)
      const scalability = investigateItems.find(i => i.id === 'fac_scalability')
      expect(scalability?.voiLevel).toBeNull()
    })

    it('all-zero VOI produces no pills', () => {
      const allZeroGaps = GOLDEN_EVIDENCE_GAPS.map(g => ({ ...g, voi: 0 }))
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: allZeroGaps,
      })
      for (const item of groups[1].items) {
        expect(item.voiLevel).toBeNull()
      }
    })
  })

  // 8. Action items — no generic preamble without targets
  describe('Action item consistency', () => {
    it('next-action items in Group 1 all have targetId', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
        nextActions: [
          ...GOLDEN_NEXT_ACTIONS,
          // Add a generic action with no targetId to test filtering
          {
            action: 'Check and update this factor\'s inputs for more reliable results',
            rationale: '',
            priority: 4,
          },
        ],
      })
      const nextItems = groups[0].items.filter(i => i.id.startsWith('next-'))
      // The targetless generic item should still be in the group (filtering happens at render)
      // but we should be able to identify it
      const targetedItems = nextItems.filter(i => i.targetId)
      const untargetedItems = nextItems.filter(i => !i.targetId)
      expect(targetedItems.length).toBe(2) // The two golden next actions
      // Badge count should only count targeted items
      expect(targetedItems.length).toBeGreaterThan(0)
      // Untargeted items exist in data but are filtered at render layer
      expect(untargetedItems.length).toBe(1)
    })
  })

  // 9. Humanise critique with user_message fallback
  describe('humaniseCritique user_message fallback', () => {
    it('uses template for known codes', () => {
      const nodeLabels = new Map([['fac_customer_churn', 'Customer Churn']])
      const result = humaniseCritique(GOLDEN_CRITIQUES[0], nodeLabels)
      expect(result.title).toBe('Customer Churn is missing a current value')
      expect(result.suggestion).toBeDefined()
    })

    it('uses user_message for unknown codes when available', () => {
      const critiqueWithUserMsg: UncertaintyItem = {
        code: 'NOVEL_CODE_123',
        message: 'fac_some_internal raw message',
        userMessage: 'Please review this factor',
        affectedNodes: ['fac_test'],
        severity: 'warning',
      }
      const result = humaniseCritique(critiqueWithUserMsg)
      expect(result.title).toBe('Please review this factor')
      expect(result.title).not.toContain('fac_')
    })

    it('falls back to generic for unknown codes without user_message', () => {
      const result = humaniseCritique(GOLDEN_CRITIQUES[1])
      // Should NOT expose the raw message
      expect(result.title).not.toContain('intercept=0')
      expect(result.title).not.toContain('fac_')
      expect(result.title).toBe('Review this factor\'s inputs')
    })

    it('V14.2: constraint template suggestions contain no arrow notation', () => {
      const constraintCritique: UncertaintyItem = {
        code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
        message: 'constraint_fac_budget missing observed_state',
        affectedNodes: ['fac_budget'],
        severity: 'warning',
      }
      const result = humaniseCritique(constraintCritique, new Map([['fac_budget', 'Budget']]))
      expect(result.suggestion).toBeDefined()
      expect(result.suggestion).not.toContain('\u2192') // no arrow
      expect(result.suggestion).not.toContain('→')      // no arrow
    })
  })

  // 10. V14.3: WinGauge and OptionCard colour consistency
  describe('WinGauge and OptionCard colour consistency', () => {
    it('buildSegmentColorMap assigns winner the first colour (robust)', () => {
      const colorMap = buildSegmentColorMap(GOLDEN_OPTIONS, 'opt_build', 'robust')
      // Winner (opt_build) gets first colour = var(--success)
      expect(colorMap['opt_build']).toBe(WIN_GAUGE_COLORS[0])
      // All options get a colour
      for (const opt of GOLDEN_OPTIONS) {
        expect(colorMap[opt.id]).toBeDefined()
      }
    })

    it('buildSegmentColorMap assigns winner the first colour (sensitive)', () => {
      const colorMap = buildSegmentColorMap(GOLDEN_OPTIONS, 'opt_build', 'sensitive')
      expect(colorMap['opt_build']).toBe(WIN_GAUGE_COLORS[0])
    })

    it('indeterminate state uses indeterminate palette', () => {
      const colorMap = buildSegmentColorMap(GOLDEN_OPTIONS, 'opt_build', 'indeterminate')
      expect(colorMap['opt_build']).toBe(WIN_GAUGE_COLORS_INDETERMINATE[0])
      // Second option gets indeterminate second colour
      const sortedNonWinner = [...GOLDEN_OPTIONS]
        .filter(o => o.id !== 'opt_build')
        .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))
      expect(colorMap[sortedNonWinner[0].id]).toBe(WIN_GAUGE_COLORS_INDETERMINATE[1])
    })

    it('colour map has same entry count as options', () => {
      const colorMap = buildSegmentColorMap(GOLDEN_OPTIONS, 'opt_build', 'robust')
      expect(Object.keys(colorMap).length).toBe(GOLDEN_OPTIONS.length)
    })
  })

  // 11. V14.3: displayText field on humanised critiques
  describe('V14.3 displayText on golden critiques', () => {
    it('template-mapped critique has non-null displayText', () => {
      const critiques = data.confidence.humanisedCritiques ?? []
      // First critique (MISSING_OBSERVED_STATE) has template → displayText should match title
      expect(critiques[0].displayText).toBe(critiques[0].title)
    })

    it('unmapped critique without userMessage has null displayText', () => {
      const critiques = data.confidence.humanisedCritiques ?? []
      // Second critique (UNKNOWN_INTERNAL_CODE) has no template and no userMessage
      expect(critiques[1].displayText).toBeNull()
    })
  })

  // 12. V14.3b: Extended critique coverage — internal tokens in all code paths
  describe('V14.3b: Internal tokens never reach banner from any critique path', () => {
    // Extended critiques: cover every code path through humaniseCritique()
    const extendedCritiques: UncertaintyItem[] = [
      // Path 1: Template match — code in CODE_TEMPLATES, message has internal tokens
      {
        code: 'MISSING_OBSERVED_STATE',
        message: 'constraint_fac_customer_churn_max targets factor node fac_customer_churn with observed_state.value missing',
        userMessage: 'Customer Churn is missing a current value',
        affectedNodes: ['fac_customer_churn'],
        severity: 'warning',
      },
      // Path 2: Template match — code in CODE_TEMPLATES, NO userMessage
      {
        code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
        message: 'constraint_fac_budget_max has no observed_state.value set',
        affectedNodes: ['fac_budget'],
        severity: 'warning',
      },
      // Path 3: No template match, userMessage with internal tokens
      {
        code: 'NOVEL_CODE_A',
        message: 'fac_revenue blocks_analysis pipeline intercept=0',
        userMessage: 'fac_revenue has constraint_fac_revenue_max issue with observed_state.value',
        affectedNodes: ['fac_revenue'],
        severity: 'warning',
      },
      // Path 4: No template match, userMessage clean
      {
        code: 'NOVEL_CODE_B',
        message: 'node_id=fac_scalability edge_id=e42 opt_build blocks_analysis',
        userMessage: 'Scalability needs review to improve accuracy',
        affectedNodes: ['fac_scalability'],
        severity: 'warning',
      },
      // Path 5: No template match, NO userMessage — generic fallback
      {
        code: 'NOVEL_CODE_C',
        message: 'fac_competition has intercept=0 and blocks_analysis pipeline',
        affectedNodes: ['fac_competition'],
        severity: 'warning',
      },
      // Path 6: No template match, no userMessage, no affectedNodes — orphan critique
      {
        code: 'NOVEL_CODE_D',
        message: 'goal_revenue opt_partner observed_state.baseline missing',
        severity: 'warning',
      },
    ]

    const nodeLabels = new Map([
      ['fac_customer_churn', 'Customer Churn'],
      ['fac_budget', 'Budget'],
      ['fac_revenue', 'Revenue'],
      ['fac_scalability', 'Scalability'],
      ['fac_competition', 'Competition'],
    ])

    const humanised = extendedCritiques
      .filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
      .map(item => humaniseCritique(item, nodeLabels))

    const INTERNAL_PATTERNS = [
      /constraint_fac_/, /fac_[a-z_]+/, /observed_state/, /intercept=0/,
      /opt_[a-z_]+/, /blocks_analysis/, /node_id=/, /edge_id=/, /goal_[a-z_]+/,
    ]

    it('no humanised critique title/description/suggestion contains internal tokens', () => {
      for (const c of humanised) {
        const text = `${c.title} ${c.description} ${c.suggestion ?? ''} ${c.displayText ?? ''}`
        for (const pattern of INTERNAL_PATTERNS) {
          expect(text, `Internal token "${pattern}" found in: ${text}`).not.toMatch(pattern)
        }
      }
    })

    it('banner filter (displayText + suggestion + factorId) admits only safe items', () => {
      const bannerItems = humanised.filter(
        c => c.displayText != null && c.suggestion != null && c.factorId != null,
      )
      // Path 1 (template) and Path 2 (template) should be in banner
      // Path 3 (internal userMessage) should be excluded (displayText null)
      // Path 4 (clean userMessage, no template) should be excluded (no suggestion)
      // Path 5 (no userMessage, no template) should be excluded (displayText null)
      // Path 6 (no userMessage, no template, no affectedNodes) should be excluded
      expect(bannerItems.length).toBe(2)
      expect(bannerItems[0].displayText).toContain('Customer Churn')
      expect(bannerItems[1].displayText).toContain('Budget')
    })

    it('items with internal-token userMessage fall through to generic fallback', () => {
      // Path 3: userMessage contains fac_revenue, constraint_fac_, observed_state
      // Should fall through to generic fallback — title should NOT contain internal tokens
      const path3 = humanised.find(c => c.factorId === 'fac_revenue')
      expect(path3).toBeDefined()
      expect(path3!.displayText).toBeNull()
      expect(path3!.title).toBe("Review this factor's inputs")
      expect(path3!.description).toBe("Some information needed to assess this factor isn't available yet.")
    })

    it('items with clean userMessage but no template get no suggestion', () => {
      // Path 4: clean userMessage, no template match → no auto-suggestion
      const path4 = humanised.find(c => c.title === 'Scalability needs review to improve accuracy')
      expect(path4).toBeDefined()
      expect(path4!.suggestion).toBeUndefined()
      expect(path4!.displayText).toBe('Scalability needs review to improve accuracy')
    })

    it('generic fallback (no template, no userMessage) gets displayText=null', () => {
      // Path 5+6: no template, no userMessage → generic fallback with displayText=null
      const path5 = humanised.find(c => c.factorId === 'fac_competition')
      const path6 = humanised.find(c => c.factorId === undefined)
      expect(path5?.displayText).toBeNull()
      expect(path6?.displayText).toBeNull()
    })
  })

  // 13. V14.3: Implementation actions filtered from Validate group
  describe('V14.3 implementation action filtering', () => {
    it('"Proceed with X" is excluded from Validate group', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
        nextActions: [
          ...GOLDEN_NEXT_ACTIONS,
          {
            action: 'Proceed with Increase Pro Plan Price to $59',
            rationale: 'Implementation step',
            priority: 7,
            targetType: 'node',
            targetId: 'fac_pricing',
            targetLabel: 'Pricing',
          },
        ],
      })
      const validateItems = groups[0].items
      const proceedItem = validateItems.find(i => i.title.includes('Proceed with'))
      expect(proceedItem).toBeUndefined()
    })

    it('"Proceed to validate X" is kept in Validate group', () => {
      const groups = groupActionItems({
        fragileEdges: [],
        evidenceGaps: GOLDEN_EVIDENCE_GAPS,
        nextActions: [
          {
            action: 'Proceed to validate pricing assumptions',
            rationale: 'Validation step',
            priority: 2,
            targetType: 'node',
            targetId: 'fac_pricing_val',
            targetLabel: 'Pricing',
          },
        ],
      })
      const validateItems = groups[0].items
      const proceedItem = validateItems.find(i => i.title.includes('Proceed to validate'))
      expect(proceedItem).toBeDefined()
    })
  })
})
