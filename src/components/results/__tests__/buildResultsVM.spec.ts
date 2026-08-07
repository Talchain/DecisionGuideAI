import { describe, it, expect } from 'vitest'
import {
  buildResultsVM,
  deriveDecisionState,
  computeGapTop2,
  resolveStability,
  selectHinge,
  deriveEvidenceLevel,
  GAP_THRESHOLD,
  ROBUST_THRESHOLD,
  SENSITIVE_THRESHOLD,
} from '../buildResultsVM'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  DriverItem,
  EvidenceGapItem,
} from '../types'

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'opt-a',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 80, p50: 100, p90: 120 },
    p10: 80,
    p50: 100,
    p90: 120,
    isRecommended: true,
    winProbability: 0.65,
    ...overrides,
  }
}

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac-revenue',
    factorLabel: 'Revenue Growth',
    rawElasticity: 1.2,
    normalisedInfluence: 0.8,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: true,
    ...overrides,
  }
}

function makeEvidenceGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'fac-churn',
    factorLabel: 'Churn Rate',
    confidence: 40,
    voi: 0.7,
    suggestion: 'Validate churn assumptions',
    ...overrides,
  }
}

function makeData(overrides: {
  options?: OptionResult[]
  recommendationStability?: number
  robustnessLevel?: 'high' | 'moderate' | 'low' | 'very_low'
  coachingReadiness?: 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing' | 'low' | 'not_ready'
  topFragileEdge?: ConfidenceSectionData['topFragileEdge']
  m1CoachingTopFragileEdge?: ConfidenceSectionData['m1CoachingTopFragileEdge']
  evidenceGaps?: EvidenceGapItem[]
  topEvidenceGaps?: EvidenceGapItem[]
  drivers?: DriverItem[]
  totalHighRiskEdges?: number
} = {}): ResultsSectionDataReturn {
  const options = overrides.options ?? [
    makeOption({ id: 'opt-a', label: 'Option A', winProbability: 0.65, isRecommended: true }),
    makeOption({ id: 'opt-b', label: 'Option B', winProbability: 0.35, isRecommended: false }),
  ]
  const recommendedOption = options.find(o => o.isRecommended) ?? options[0] ?? null

  const recommendation: DecisionResultData = {
    recommendedOption,
    allOptions: options,
    goalLabel: 'Maximise revenue',
    isSingleOption: options.length <= 1,
    analysisStatus: 'computed',
    recommendationStability: overrides.recommendationStability,
    robustnessLevel: overrides.robustnessLevel,
    coachingReadiness: overrides.coachingReadiness,
  }

  const drivers: DriversSectionData = {
    drivers: overrides.drivers ?? [makeDriver()],
    driversStatus: 'computed',
    topDrivers: (overrides.drivers ?? [makeDriver()]).slice(0, 3),
    totalCount: (overrides.drivers ?? [makeDriver()]).length,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'Fair quality' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    topFragileEdge: overrides.topFragileEdge,
    m1CoachingTopFragileEdge: overrides.m1CoachingTopFragileEdge,
    evidenceGaps: overrides.evidenceGaps,
    topEvidenceGaps: overrides.topEvidenceGaps,
    totalHighRiskEdges: overrides.totalHighRiskEdges,
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
    voiRanking: null,
  }
}

// ─── deriveDecisionState ────────────────────────────────────────────────────

describe('deriveDecisionState', () => {
  it('returns indeterminate when gap < GAP_THRESHOLD (gap overrides stability)', () => {
    expect(deriveDecisionState(0.04, 0.85)).toBe('indeterminate')
  })

  it('returns robust when gap >= 0.10 and stability >= 0.80', () => {
    expect(deriveDecisionState(0.25, 0.85)).toBe('robust')
  })

  it('returns sensitive when gap >= 0.10 and stability in [0.55, 0.80)', () => {
    expect(deriveDecisionState(0.25, 0.65)).toBe('sensitive')
  })

  it('returns indeterminate when gap >= 0.10 but stability < 0.55', () => {
    expect(deriveDecisionState(0.25, 0.40)).toBe('indeterminate')
  })

  // V14.1: deriveDecisionState is purely gap + stability — readiness no longer downgrades
  it('remains robust regardless of readiness (V14.1: readiness decoupled)', () => {
    // Extra args are ignored — deriveDecisionState only takes (gap, stability)
    expect(deriveDecisionState(0.25, 0.85)).toBe('robust')
  })

  it('returns robust at exact ROBUST_THRESHOLD boundary', () => {
    expect(deriveDecisionState(0.10, 0.80)).toBe('robust')
  })

  it('returns sensitive at exact SENSITIVE_THRESHOLD boundary', () => {
    expect(deriveDecisionState(0.10, 0.55)).toBe('sensitive')
  })

  it('returns indeterminate at exact GAP_THRESHOLD - epsilon', () => {
    expect(deriveDecisionState(0.099, 0.90)).toBe('indeterminate')
  })
})

// ─── computeGapTop2 ────────────────────────────────────────────────────────

describe('computeGapTop2', () => {
  it('returns 0 for empty options', () => {
    expect(computeGapTop2([])).toBe(0)
  })

  it('returns the single option winProbability when only 1 option', () => {
    expect(computeGapTop2([{ winProbability: 0.72 }])).toBe(0.72)
  })

  it('returns absolute gap between top 2 options', () => {
    const options = [
      { winProbability: 0.65 },
      { winProbability: 0.35 },
    ]
    expect(computeGapTop2(options)).toBeCloseTo(0.30)
  })

  it('handles options not sorted by winProbability', () => {
    const options = [
      { winProbability: 0.20 },
      { winProbability: 0.50 },
      { winProbability: 0.30 },
    ]
    expect(computeGapTop2(options)).toBeCloseTo(0.20)
  })

  it('handles undefined winProbability as 0', () => {
    const options = [
      { winProbability: 0.65 },
      { winProbability: undefined },
    ]
    expect(computeGapTop2(options)).toBeCloseTo(0.65)
  })

  it('returns 0 when top 2 options are tied', () => {
    const options = [
      { winProbability: 0.50 },
      { winProbability: 0.50 },
    ]
    expect(computeGapTop2(options)).toBe(0)
  })
})

// ─── resolveStability ───────────────────────────────────────────────────────

// Audit F-56: resolveStability no longer fabricates numeric values from categorical levels
describe('resolveStability', () => {
  it('uses recommendationStability when present', () => {
    expect(resolveStability(0.72, 'high')).toBe(0.72)
  })

  it('returns null when only robustnessLevel available (no fabrication)', () => {
    expect(resolveStability(undefined, 'moderate')).toBeNull()
  })

  it('returns null for all categorical levels (no fabrication)', () => {
    expect(resolveStability(undefined, 'high')).toBeNull()
    expect(resolveStability(undefined, 'low')).toBeNull()
    expect(resolveStability(undefined, 'very_low')).toBeNull()
  })

  it('returns null when both missing (no fabrication)', () => {
    expect(resolveStability(undefined, undefined)).toBeNull()
  })
})

// ─── selectHinge ────────────────────────────────────────────────────────────

describe('selectHinge', () => {
  it('selects topFragileEdge as priority 1', () => {
    const data = makeData({
      topFragileEdge: {
        fromId: 'fac-price',
        fromLabel: 'Price Sensitivity',
        toId: 'goal-rev',
        toLabel: 'Revenue',
        alternativeWinnerLabel: 'Option B',
        switchProbability: 0.6,
      },
      topEvidenceGaps: [makeEvidenceGap()],
      drivers: [makeDriver()],
    })
    const hinge = selectHinge(data)
    expect(hinge).not.toBeNull()
    expect(hinge!.label).toBe('Price Sensitivity')
    expect(hinge!.nodeId).toBe('fac-price')
    expect(hinge!.kind).toBe('edge')
    expect(hinge!.reason).toBe('fragile_edge')
    expect(hinge!.edgeDetail).toBe('Price Sensitivity to Revenue')
    expect(hinge!.alternativeWinnerLabel).toBe('Option B')
  })

  it('falls back to top evidence gap when no fragile edge', () => {
    const data = makeData({
      topEvidenceGaps: [makeEvidenceGap({ factorLabel: 'Churn Rate', factorId: 'fac-churn' })],
      drivers: [makeDriver()],
    })
    const hinge = selectHinge(data)
    expect(hinge).not.toBeNull()
    expect(hinge!.label).toBe('Churn Rate')
    expect(hinge!.kind).toBe('node')
    expect(hinge!.reason).toBe('voi')
    expect(hinge!.edgeDetail).toBeNull()
  })

  it('falls back to evidenceGaps when topEvidenceGaps empty', () => {
    const data = makeData({
      evidenceGaps: [makeEvidenceGap({ factorLabel: 'Market Size' })],
      drivers: [makeDriver()],
    })
    const hinge = selectHinge(data)
    expect(hinge!.label).toBe('Market Size')
    expect(hinge!.reason).toBe('voi')
  })

  it('falls back to heuristic driver when no gaps', () => {
    const data = makeData({
      drivers: [
        makeDriver({
          factorKey: 'fac-cost',
          factorLabel: 'Operating Cost',
          rawElasticity: 2.0,
          confidence: 0.3,
        }),
        makeDriver({
          factorKey: 'fac-rev',
          factorLabel: 'Revenue',
          rawElasticity: 1.0,
          confidence: 0.9,
        }),
      ],
    })
    const hinge = selectHinge(data)
    expect(hinge).not.toBeNull()
    // Operating Cost: |2.0| * (1 - 0.3) = 1.4
    // Revenue: |1.0| * (1 - 0.9) = 0.1
    expect(hinge!.label).toBe('Operating Cost')
    expect(hinge!.kind).toBe('node')
    expect(hinge!.reason).toBe('heuristic')
  })

  it('picks heuristic driver with alternativeWinnerLabel from fragileEdgeInfo', () => {
    const data = makeData({
      drivers: [
        makeDriver({
          factorKey: 'fac-cost',
          factorLabel: 'Operating Cost',
          rawElasticity: 2.0,
          confidence: 0.3,
          fragileEdgeInfo: { switchProbability: 0.4, alternativeWinnerLabel: 'Plan B' },
        }),
      ],
    })
    const hinge = selectHinge(data)
    expect(hinge!.alternativeWinnerLabel).toBe('Plan B')
  })

  it('returns null when no drivers, no gaps, no fragile edges', () => {
    const data = makeData({ drivers: [] })
    const hinge = selectHinge(data)
    expect(hinge).toBeNull()
  })

  it('skips heuristic driver when all elasticities are zero', () => {
    const data = makeData({
      drivers: [
        makeDriver({ rawElasticity: 0, confidence: 0.5 }),
      ],
    })
    const hinge = selectHinge(data)
    expect(hinge).toBeNull()
  })

  it('uses matchedNodeId when available for heuristic hinge', () => {
    const data = makeData({
      drivers: [
        makeDriver({
          factorKey: 'fac-x',
          matchedNodeId: 'canvas-node-x',
          rawElasticity: 1.5,
          confidence: 0.2,
        }),
      ],
    })
    const hinge = selectHinge(data)
    expect(hinge!.nodeId).toBe('canvas-node-x')
  })

  it('uses targetNodeId from evidence gap when available', () => {
    const data = makeData({
      topEvidenceGaps: [makeEvidenceGap({ factorId: 'fac-a', targetNodeId: 'node-a-canvas' })],
    })
    const hinge = selectHinge(data)
    expect(hinge!.nodeId).toBe('node-a-canvas')
  })

  // V12: Priority 0 — coaching top_fragile_edge overrides robustness topFragileEdge
  it('selects m1CoachingTopFragileEdge as priority 0 over robustness topFragileEdge', () => {
    const data = makeData({
      m1CoachingTopFragileEdge: {
        fromId: 'fac-pmf',
        fromLabel: 'Product-Market Fit',
        toId: 'out-acq',
        toLabel: 'Customer Acquisition',
        switchProbability: 0.468,
        alternativeWinnerLabel: 'Build Dedicated Product',
      },
      topFragileEdge: {
        fromId: 'fac-price',
        fromLabel: 'Price Sensitivity',
        toId: 'goal-rev',
        toLabel: 'Revenue',
        alternativeWinnerLabel: 'Option B',
        switchProbability: 0.6,
      },
      topEvidenceGaps: [makeEvidenceGap()],
      drivers: [makeDriver()],
    })
    const hinge = selectHinge(data)
    expect(hinge).not.toBeNull()
    expect(hinge!.label).toBe('Product-Market Fit')
    expect(hinge!.nodeId).toBe('fac-pmf')
    expect(hinge!.kind).toBe('edge')
    expect(hinge!.reason).toBe('fragile_edge')
    expect(hinge!.edgeDetail).toBe('Product-Market Fit to Customer Acquisition')
    expect(hinge!.alternativeWinnerLabel).toBe('Build Dedicated Product')
  })

  it('falls through to priority 1 when m1CoachingTopFragileEdge absent', () => {
    const data = makeData({
      topFragileEdge: {
        fromId: 'fac-price',
        fromLabel: 'Price Sensitivity',
        toId: 'goal-rev',
        toLabel: 'Revenue',
        alternativeWinnerLabel: 'Option B',
        switchProbability: 0.6,
      },
    })
    const hinge = selectHinge(data)
    expect(hinge!.label).toBe('Price Sensitivity')
    expect(hinge!.reason).toBe('fragile_edge')
  })
})

// ─── deriveEvidenceLevel ────────────────────────────────────────────────────

describe('deriveEvidenceLevel', () => {
  it('returns good when robust and fragileRatio <= 0.1', () => {
    expect(deriveEvidenceLevel('robust', 1, 20)).toBe('good')
  })

  it('returns needs_work when indeterminate regardless of ratio', () => {
    expect(deriveEvidenceLevel('indeterminate', 0, 20)).toBe('needs_work')
  })

  it('returns needs_work when fragileRatio > 0.3', () => {
    expect(deriveEvidenceLevel('sensitive', 7, 20)).toBe('needs_work')
  })

  it('returns fair for sensitive with moderate fragile ratio', () => {
    expect(deriveEvidenceLevel('sensitive', 3, 20)).toBe('fair')
  })

  it('returns fair when robust but fragileRatio > 0.1', () => {
    expect(deriveEvidenceLevel('robust', 3, 20)).toBe('fair')
  })

  it('returns needs_work when totalEdgeCount is 0 and state is indeterminate', () => {
    expect(deriveEvidenceLevel('indeterminate', 0, 0)).toBe('needs_work')
  })

  it('returns good when totalEdgeCount is 0 and state is robust (ratio defaults to 0)', () => {
    expect(deriveEvidenceLevel('robust', 0, 0)).toBe('good')
  })
})

// ─── buildResultsVM (integration) ──────────────────────────────────────────

describe('buildResultsVM', () => {
  it('produces robust state for clear winner with high stability', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.65, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.35, isRecommended: false }),
      ],
      recommendationStability: 0.85,
    })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('robust')
    expect(vm.gapTop2).toBeCloseTo(0.30)
  })

  it('produces sensitive state for moderate stability', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.60, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.40, isRecommended: false }),
      ],
      recommendationStability: 0.65,
    })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('sensitive')
  })

  it('produces indeterminate for tiny gap even with high stability', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.52, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.48, isRecommended: false }),
      ],
      recommendationStability: 0.90,
    })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('indeterminate')
    expect(vm.gapTop2).toBeCloseTo(0.04)
  })

  it('handles empty options without crashing', () => {
    const data = makeData({ options: [] })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('indeterminate')
    expect(vm.gapTop2).toBe(0)
    expect(vm.hinge).not.toBeUndefined() // may be null or from drivers
  })

  it('handles single option correctly', () => {
    const data = makeData({
      options: [makeOption({ id: 'solo', winProbability: 0.80, isRecommended: true })],
      recommendationStability: 0.85,
    })
    const vm = buildResultsVM(data)
    expect(vm.gapTop2).toBe(0.80)
    expect(vm.decisionState).toBe('robust')
  })

  it('uses robustnessLevel fallback when recommendationStability missing', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.70, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.30, isRecommended: false }),
      ],
      robustnessLevel: 'moderate',
    })
    const vm = buildResultsVM(data)
    // stability = 0.65 (moderate map), gap = 0.40
    expect(vm.decisionState).toBe('sensitive')
  })

  it('passes through raw data unchanged', () => {
    const data = makeData()
    const vm = buildResultsVM(data)
    expect(vm.raw).toBe(data)
  })

  it('computes evidence level with meta edge counts', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.70, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.30, isRecommended: false }),
      ],
      recommendationStability: 0.85,
    })
    const vm = buildResultsVM(data, { fragileEdgeCount: 1, totalEdgeCount: 20 })
    expect(vm.evidenceLevel).toBe('good')
  })

  it('evidence level needs_work when many fragile edges', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.70, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.30, isRecommended: false }),
      ],
      recommendationStability: 0.85,
    })
    const vm = buildResultsVM(data, { fragileEdgeCount: 8, totalEdgeCount: 20 })
    expect(vm.evidenceLevel).toBe('needs_work')
  })

  it('topAction mirrors hinge with couldFlip from fragile edge', () => {
    const data = makeData({
      topFragileEdge: {
        fromId: 'fac-x',
        fromLabel: 'Factor X',
        toId: 'goal',
        toLabel: 'Goal',
        alternativeWinnerLabel: 'Option B',
        switchProbability: 0.5,
      },
    })
    const vm = buildResultsVM(data)
    expect(vm.topAction).not.toBeNull()
    expect(vm.topAction!.label).toBe('Factor X')
    expect(vm.topAction!.couldFlip).toBe(true)
  })

  it('topAction.couldFlip is false for non-fragile-edge hinge', () => {
    const data = makeData({
      topEvidenceGaps: [makeEvidenceGap()],
    })
    const vm = buildResultsVM(data)
    expect(vm.topAction).not.toBeNull()
    expect(vm.topAction!.couldFlip).toBe(false)
  })

  it('falls back to totalHighRiskEdges when meta.fragileEdgeCount missing', () => {
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.70, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.30, isRecommended: false }),
      ],
      recommendationStability: 0.85,
      totalHighRiskEdges: 1,
    })
    // No meta provided, should use totalHighRiskEdges = 1
    // But totalEdgeCount defaults to 0, so ratio = 0 (safe fallback)
    const vm = buildResultsVM(data)
    expect(vm.evidenceLevel).toBe('good') // robust + 0 ratio
  })

  it('exports thresholds for external use', () => {
    expect(GAP_THRESHOLD).toBe(0.10)
    expect(ROBUST_THRESHOLD).toBe(0.80)
    expect(SENSITIVE_THRESHOLD).toBe(0.55)
  })

  // ── V11.1 Fix 5: VM is sole source of truth for decisionState ─────────

  it('decisionState ignores raw robustnessLevel when stability is available', () => {
    // robustnessLevel says "very_low" (would map to 0.35 → indeterminate)
    // but actual stability is 0.85 → robust overrides
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.70, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.30, isRecommended: false }),
      ],
      recommendationStability: 0.85,
      robustnessLevel: 'very_low',
    })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('robust')
  })

  it('decisionState derives from gap even when robustnessLevel is high', () => {
    // robustnessLevel = "high" but gap is tiny → indeterminate (gap overrides)
    const data = makeData({
      options: [
        makeOption({ id: 'a', winProbability: 0.51, isRecommended: true }),
        makeOption({ id: 'b', winProbability: 0.49, isRecommended: false }),
      ],
      robustnessLevel: 'high',
    })
    const vm = buildResultsVM(data)
    expect(vm.decisionState).toBe('indeterminate')
  })
})
