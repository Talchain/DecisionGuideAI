/**
 * buildAnalysisHeroViewModel — orchestrator tests per investigation §15.2.
 *
 * Covers each state branch, every data-absence fallback, banned-term
 * resilience for user-supplied labels, and the Verified bar grounding.
 */

import { describe, it, expect } from 'vitest'
import { buildAnalysisHeroViewModel } from '../buildAnalysisHeroViewModel'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ResultsVM } from '../../types'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  EvidenceGapItem,
  OptionResult,
  FragileEdgeItem,
} from '../../types'

function makeOption(id: string, label: string, winProb: number): OptionResult {
  return { id, label, winProbability: winProb } as OptionResult
}

function makeData(overrides: {
  winnerLabel?: string
  stability?: number | undefined
  options?: OptionResult[]
  gaps?: EvidenceGapItem[]
  fragile?: FragileEdgeItem
  dimensions?: { evidence: number; robustness: number; clarity: number }
  bias?: Array<{ type: string; description: string }>
  dqp?: string[]
  /**
   * Review status surfaced on `data.confidence.reviewStatus`. The Key
   * question card requires `'complete'` to render — defaulted to that
   * value here so existing DQP-present tests behave unchanged.
   */
  reviewStatus?: string
  /** Drivers list for dependency-line corroboration. */
  drivers?: DriverItem[]
} = {}): ResultsSectionDataReturn {
  const winner = overrides.winnerLabel === null
    ? null
    : makeOption('opt_a', overrides.winnerLabel ?? 'Option A', 0.7)

  const options = overrides.options ?? (winner
    ? [winner, makeOption('opt_b', 'Option B', 0.3)]
    : [])

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: options,
    goalLabel: 'Maximise success',
    isSingleOption: options.length <= 1,
    analysisStatus: 'computed',
    recommendationStability: overrides.stability,
    coachingReadinessDimensions: overrides.dimensions ?? { evidence: 0.6, robustness: 0.7, clarity: 0.65 },
  } as DecisionResultData

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: overrides.gaps ?? [],
    topEvidenceGaps: overrides.gaps ?? [],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: overrides.fragile,
    // Honour an explicit `undefined` in overrides (distinct from "key
    // absent"). 'in' check lets callers test the "missing reviewStatus"
    // case alongside other values like 'in_progress'.
    reviewStatus: 'reviewStatus' in overrides ? overrides.reviewStatus : 'complete',
    m2BiasFindings: overrides.bias?.map(b => ({
      type: b.type,
      source: 'test',
      description: b.description,
      affectedElements: [],
      linkedCritiqueCode: '',
    })),
    m2DecisionQualityPrompts: overrides.dqp?.map(q => ({
      principle: 'test',
      appliesBecause: 'test',
      question: q,
    })),
  } as ConfidenceSectionData

  const drivers = overrides.drivers ?? []

  return {
    recommendation,
    drivers: {
      drivers,
      topDrivers: drivers.slice(0, 3),
      driversStatus: 'computed',
      totalCount: drivers.length,
      hasMagnitudeData: drivers.length > 0,
    },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

/** Build a DriverItem stub with the influence corroboration field populated. */
function makeDriver(factorKey: string, factorLabel: string, normalisedInfluence: number): DriverItem {
  return {
    factorKey,
    factorLabel,
    rawElasticity: normalisedInfluence,
    normalisedInfluence,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: true,
  } as DriverItem
}

function makeVm(overrides: Partial<ResultsVM> = {}): ResultsVM {
  return {
    decisionState: 'robust',
    gapTop2: 0.4,
    hinge: null,
    evidenceLevel: 'fair',
    topAction: null,
    raw: makeData(),
    ...overrides,
  } as ResultsVM
}

function gap(label: string, factorId: string, voi: number): EvidenceGapItem {
  return {
    factorId,
    factorLabel: label,
    confidence: 50,
    voi,
    evpiPp: voi * 50,
    targetNodeId: factorId,
  } as EvidenceGapItem
}

// Default structure + coverage signals: "fully complete" so existing
// tests that don't care about strip values aren't perturbed. Strip-
// specific tests override these locally.
const STD_ARGS = {
  confirmedFactorCount: 0,
  totalFactorCount: 5,
  fragileEdgeCount: 0,
  structureSignals: {
    hasGoal: true,
    hasMultipleOptions: true,
    hasFactors: true,
    hasConnections: true,
  },
  coverageSignals: {
    hasMultipleOptions: true,
    hasRisks: true,
    hasBaseline: true,
    hasGoalThreshold: true,
  },
}

describe('buildAnalysisHeroViewModel', () => {
  describe('state branches', () => {
    it('weak: no winner → weak state, no key question template, fragile-tone pill suppressed', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ winnerLabel: null as unknown as string }),
        vm: makeVm({ decisionState: 'indeterminate' }),
      })
      expect(vm.state).toBe('weak')
      expect(vm.resultLine).toBe('No option currently comes out ahead clearly.')
    })

    it('moderate: default mid-range state', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('A', 'na', 0.4), gap('B', 'nb', 0.3)] }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.state).toBe('moderate')
    })

    it('reflect: robust + bias findings → reflect state with reflective footer check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, bias: [{ type: 'Anchoring', description: 'd' }] }),
        vm: makeVm({ decisionState: 'robust' }),
      })
      expect(vm.state).toBe('reflect')
      // The reflect signal now surfaces via the 4th footer check
      // (pills removed 2026-05-21 — see analysis-hero-v17-top-section.md task 4).
      expect(vm.footerChecks.some(c => c.tone === 'reflect')).toBe(true)
    })

    it('strong: high stability + no gaps + no fragile → strong, ready row, brief CTA', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9 }),
        vm: makeVm({ decisionState: 'robust', evidenceLevel: 'good' }),
      })
      expect(vm.state).toBe('strong')
      expect(vm.inputRows[0]?.category).toBe('ready')
      expect(vm.footerCta.kind).toBe('create-decision-brief')
      expect(vm.keyQuestion).toBeNull()
    })

    it('defensive: undefined data does not crash — renders empty-state VM', () => {
      // Bundles in flight / error states may omit `data.recommendation` or
      // `data.confidence`. The VM builder must not throw — the
      // SectionErrorBoundary fallback is worse UX than a hero in its
      // empty state.
      expect(() => buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: undefined as unknown as ResultsSectionDataReturn,
        vm: undefined as unknown as ResultsVM,
      })).not.toThrow()
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: undefined as unknown as ResultsSectionDataReturn,
        vm: undefined as unknown as ResultsVM,
      })
      expect(vm.state).toBe('weak')
      expect(vm.resultLine).toBe('No option currently comes out ahead clearly.')
      expect(vm.reasonLine).toBeNull()
    })

    it('defensive: data with no recommendation slice does not crash', () => {
      expect(() => buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: { confidence: makeData().confidence } as ResultsSectionDataReturn,
        vm: makeVm(),
      })).not.toThrow()
    })
  })

  describe('dimensions', () => {
    it('renders 4 segments labelled Structure / Evidence / Coverage / Verified', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 0.6, robustness: 0.7, clarity: 0.8 } }),
        vm: makeVm(),
      })
      expect(vm.dimensions.map(d => d.label)).toEqual(['Structure', 'Evidence', 'Coverage', 'Verified'])
    })

    it('Verified is sourced from confirmedFactorCount / totalFactorCount', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 2,
        totalFactorCount: 4,
      })
      const verified = vm.dimensions.find(d => d.label === 'Verified')!
      expect(verified.value).toBe(0.5)
    })

    it('Verified is 0 when totalFactorCount is 0 (never NaN)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 0,
        totalFactorCount: 0,
      })
      expect(vm.dimensions.find(d => d.label === 'Verified')!.value).toBe(0)
    })

    it('Evidence clamps to [0,1] when coachingReadinessDimensions.evidence is out of range', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 1.5, robustness: 0.5, clarity: 0.5 } }),
        vm: makeVm(),
      })
      expect(vm.dimensions.find(d => d.label === 'Evidence')!.value).toBe(1)
    })

    it('Structure score is derived from canvas signals — not from robustness', () => {
      // All four structure signals present → score 1.0.
      const full = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 0.5, robustness: 0.0, clarity: 0.5 } }),
        vm: makeVm(),
        structureSignals: { hasGoal: true, hasMultipleOptions: true, hasFactors: true, hasConnections: true },
      })
      expect(full.dimensions.find(d => d.label === 'Structure')!.value).toBe(1)

      // No structure signals → score 0.0 even if robustness is high.
      const empty = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 0.5, robustness: 0.99, clarity: 0.5 } }),
        vm: makeVm(),
        structureSignals: { hasGoal: false, hasMultipleOptions: false, hasFactors: false, hasConnections: false },
      })
      expect(empty.dimensions.find(d => d.label === 'Structure')!.value).toBe(0)

      // Two of four signals → 0.5.
      const half = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        structureSignals: { hasGoal: true, hasMultipleOptions: true, hasFactors: false, hasConnections: false },
      })
      expect(half.dimensions.find(d => d.label === 'Structure')!.value).toBe(0.5)
    })

    it('Coverage score is derived from canvas + recommendation signals — not from clarity', () => {
      const full = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 0.5, robustness: 0.5, clarity: 0.0 } }),
        vm: makeVm(),
        coverageSignals: { hasMultipleOptions: true, hasRisks: true, hasBaseline: true, hasGoalThreshold: true },
      })
      expect(full.dimensions.find(d => d.label === 'Coverage')!.value).toBe(1)

      const empty = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 0.5, robustness: 0.5, clarity: 0.99 } }),
        vm: makeVm(),
        coverageSignals: { hasMultipleOptions: false, hasRisks: false, hasBaseline: false, hasGoalThreshold: false },
      })
      expect(empty.dimensions.find(d => d.label === 'Coverage')!.value).toBe(0)
    })
  })

  describe('contribution line (deprecated post-Fix-1)', () => {
    // Fix 1 (2026-05-13): the contribution line was a second redundant
    // line below the strip showing the same verified count as
    // `checkedCount`. Removed. `contribution.text` is now always null.
    // The single source of truth for the count is `checkedCount` —
    // covered by the new "checkedCount line" block below.

    it.each([0, 1, 3, 5])('contribution.text is always null (count=%i)', (count) => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: count,
      })
      expect(vm.contribution.text).toBeNull()
    })
  })

  describe('checkedCount line (Fix 1)', () => {
    it('reads "No inputs verified" when count is 0 and total > 0', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 0,
        totalFactorCount: 4,
      })
      expect(vm.checkedCount).toBe('No inputs verified')
    })

    it('singular grammar at 1', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 1,
        totalFactorCount: 4,
      })
      expect(vm.checkedCount).toBe('1 input verified')
    })

    it('plural grammar at 2+, no longer mentions total to avoid colliding with the 4-segment strip', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 3,
        totalFactorCount: 7,
      })
      expect(vm.checkedCount).toBe('3 inputs verified')
      // Fix-1 anti-drift: the old "0 of 4 verified" / "N of M verified"
      // form is no longer used.
      expect(vm.checkedCount).not.toContain(' of ')
    })

    it('hidden when totalFactorCount is 0', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 0,
        totalFactorCount: 0,
      })
      expect(vm.checkedCount).toBeNull()
    })
  })

  describe('key question selection', () => {
    // 2026-05-21: card renders ONLY when a real V5 Phase-3 DQP is present
    // and passes the glossary gate. The category-driven template fallback
    // was removed — generic templated questions on M1 burned space without
    // adding signal. See docs/investigations/analysis-hero-v17-top-section.md
    // task 5.

    it('uses decision_quality_prompts[0] verbatim when present and clean', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          stability: 0.7,
          dqp: ['What evidence would change your view?'],
        }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.keyQuestion?.text).toBe('What evidence would change your view?')
    })

    it('hides the card when reviewStatus !== "complete" even if a clean DQP is present (in-progress / stale guard)', () => {
      // Upstream selector exposes m2DecisionQualityPrompts even during a
      // partial review. Without the reviewStatus gate the card would
      // surface stale or in-progress prompts.
      const cases: Array<string | undefined> = [undefined, 'in_progress', 'pending', 'failed']
      for (const status of cases) {
        const vm = buildAnalysisHeroViewModel({
          ...STD_ARGS,
          data: makeData({
            stability: 0.7,
            dqp: ['What evidence would change your view?'],
            reviewStatus: status,
          }),
          vm: makeVm({ decisionState: 'sensitive' }),
        })
        expect(vm.keyQuestion, `reviewStatus=${status ?? 'undefined'}`).toBeNull()
      }
    })

    it('rejects DQP that contains a banned term and hides the card (no template fallback)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          stability: 0.7,
          gaps: [gap('Cost', 'nc', 0.5)],
          dqp: ['Is this the winner?'],   // contains "winner" — banned
        }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.keyQuestion).toBeNull()
    })

    it('hides Key-question card on M1 templated-fallback (no DQP, has top row)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('Marketing spend', 'nm', 0.6)] }),
        vm: makeVm(),
      })
      expect(vm.keyQuestion).toBeNull()
    })

    it('hides Key-question card when no DQP and no rows', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(vm.keyQuestion).toBeNull()
    })

    it('strong state always hides the key-question card', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          stability: 0.9,
          dqp: ['What evidence would change your view?'],
        }),
        vm: makeVm({ decisionState: 'robust', evidenceLevel: 'good' }),
      })
      expect(vm.state).toBe('strong')
      expect(vm.keyQuestion).toBeNull()
    })

    it('user-supplied factor label containing banned term → row title preserves user data; key question hidden on fallback', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          stability: 0.7,
          gaps: [gap('the winning team', 'nw', 0.6)],
        }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      // Row title preserves the user's label (we never rewrite user data).
      expect(vm.inputRows[0].title).toBe('the winning team')
      // No DQP → card hidden. The banned-term-in-label never reaches the
      // question text path because that path no longer exists.
      expect(vm.keyQuestion).toBeNull()
    })
  })

  describe('result + reason + dependency lines', () => {
    it('result line uses winner label with "comes out ahead most often" framing', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ winnerLabel: 'Tech Lead' }),
        vm: makeVm(),
      })
      expect(vm.resultLine).toBe('Tech Lead comes out ahead most often.')
    })

    it('reason line derived from topFragileEdge stays on the VM (rendered in Row 1, not result context)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          fragile: {
            fromId: 'nf',
            fromLabel: 'leadership capacity',
            toId: 'ny',
            toLabel: 'Outcome',
            switchProbability: 0.42,
            alternativeWinnerLabel: 'Two Developers',
          } as FragileEdgeItem,
        }),
        vm: makeVm(),
      })
      expect(vm.reasonLine).toBe('If leadership capacity shifts, Two Developers could come out ahead.')
    })

    it('reason line null when no fragile data — never fabricate', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(vm.reasonLine).toBeNull()
    })

    // ── Dependency line: "The result depends most on {factor}." ──────────
    // Sourced ONLY from `data.recommendation.dominantFactorId/Label`. That
    // path in useResultsSectionData.ts collapses two safe sources (PLoT B1
    // and M1 key_drivers); the legacy heuristic only contaminates
    // `data.drivers.dominantFactor*`, which the hero deliberately does not
    // read.
    //
    // Three additional gates (2026-05-21 review):
    //  1. dominantFactorId + dominantFactorLabel both populated
    //  2. matching driver in data.drivers.drivers[] has normalisedInfluence >= 0.5
    //     (corroborates against M1 emissions without confidence + tie cases)
    //  3. cleaned label passes the glossary banned-term gate

    it('renders "The result depends most on {factor}." when dominantFactor matches a driver with influence >= 0.5', () => {
      const data = makeData({
        winnerLabel: 'Tech Lead',
        stability: 0.7,
        drivers: [makeDriver('n_lead', 'Technical Leadership Capacity', 0.62)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      ;(data.recommendation as any).dominantFactorLabel = 'Technical Leadership Capacity'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBe('The result depends most on Technical Leadership Capacity.')
    })

    it('omits the dependency line when no dominantFactor is supplied (no fabrication)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(vm.dependencyLine).toBeNull()
    })

    it('omits the dependency line when dominantFactorId is present but label is missing', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_lead', 'Tech Lead', 0.7)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBeNull()
    })

    it('omits the dependency line when the factor label contains a banned glossary term', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_w', 'the winning capacity', 0.7)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_w'
      ;(data.recommendation as any).dominantFactorLabel = 'the winning capacity'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBeNull()
    })

    it('strips encoding notation from the factor label before rendering', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_lead', 'Tech Lead Capacity', 0.7)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      ;(data.recommendation as any).dominantFactorLabel = 'Tech Lead Capacity (0/1)'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBe('The result depends most on Tech Lead Capacity.')
    })

    it('omits the dependency line when the matching driver has low influence (<0.5) — suppresses M1 emissions without confidence', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_lead', 'Tech Lead', 0.45)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      ;(data.recommendation as any).dominantFactorLabel = 'Tech Lead'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBeNull()
    })

    it('omits the dependency line when no driver matches the dominantFactorId (stale or inconsistent state)', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_other', 'Other Factor', 0.9)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      ;(data.recommendation as any).dominantFactorLabel = 'Tech Lead'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBeNull()
    })

    it('omits the dependency line in a tie (neither top driver crosses 0.5)', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [
          makeDriver('n_a', 'Factor A', 0.48),
          makeDriver('n_b', 'Factor B', 0.46),
        ],
      })
      // Even if recommendation names one of them as dominant, the
      // 0.5 corroboration floor isn't met → omit.
      ;(data.recommendation as any).dominantFactorId = 'n_a'
      ;(data.recommendation as any).dominantFactorLabel = 'Factor A'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBeNull()
    })

    it('renders at the exact 0.5 boundary (>= 0.5 is enough)', () => {
      const data = makeData({
        stability: 0.7,
        drivers: [makeDriver('n_lead', 'Tech Lead', 0.5)],
      })
      ;(data.recommendation as any).dominantFactorId = 'n_lead'
      ;(data.recommendation as any).dominantFactorLabel = 'Tech Lead'
      const vm = buildAnalysisHeroViewModel({ ...STD_ARGS, data, vm: makeVm() })
      expect(vm.dependencyLine).toBe('The result depends most on Tech Lead.')
    })
  })

  describe('meta pills removal (2026-05-21)', () => {
    // Pills were removed from the result-context block. Stability and
    // evidence signals continue to surface in the HeroFooter checks below.
    // See docs/investigations/analysis-hero-v17-top-section.md task 4.

    it('the VM does not expose a metaPills field', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect((vm as Record<string, unknown>).metaPills).toBeUndefined()
    })
  })

  describe('footer CTA', () => {
    it('weak → review-weak-inputs prefill', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ winnerLabel: null as unknown as string }),
        vm: makeVm({ decisionState: 'indeterminate' }),
      })
      expect(vm.footerCta.kind).toBe('review-weak-inputs')
      expect(vm.footerCta.label).toBe('Review weak inputs')
    })

    it('moderate → check-key-estimate with topRow focusTargetId', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('Cost', 'n_cost', 0.5)] }),
        vm: makeVm(),
      })
      expect(vm.footerCta.kind).toBe('check-key-estimate')
      expect(vm.footerCta.focusTargetId).toBe('n_cost')
      expect(vm.footerCta.chatPrompt).toContain('Cost')
    })

    it('moderate with no topRow → focusTargetId undefined, generic prompt', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.footerCta.kind).toBe('check-key-estimate')
      expect(vm.footerCta.focusTargetId).toBeUndefined()
    })

    it('reflect → challenge-result kind, "Test the result" label (Fix 9)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, bias: [{ type: 'A', description: 'd' }] }),
        vm: makeVm({ decisionState: 'robust' }),
      })
      // Internal kind retained for handler stability.
      expect(vm.footerCta.kind).toBe('challenge-result')
      // User-facing label renamed to avoid implying a formal devil's
      // advocacy handler (`run_devils_advocacy` is Needs handler per
      // V5 contract v1.3 §3).
      expect(vm.footerCta.label).toBe('Test the result')
      // Anti-drift: the old "Challenge result" label is gone.
      expect(vm.footerCta.label).not.toBe('Challenge result')
    })

    it('strong → create-decision-brief (prefill)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9 }),
        vm: makeVm({ decisionState: 'robust', evidenceLevel: 'good' }),
      })
      expect(vm.footerCta.kind).toBe('create-decision-brief')
    })
  })

  describe('rows + hidden rows', () => {
    it('top 3 visible, next 3 hidden, remainder dropped', () => {
      const manyGaps = Array.from({ length: 8 }, (_, i) => gap(`Gap${i}`, `n${i}`, 1 - i * 0.1))
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: manyGaps }),
        vm: makeVm(),
      })
      expect(vm.inputRows).toHaveLength(3)
      expect(vm.hiddenRows).toHaveLength(3)
    })
  })

  describe('also-line + footer checks (Fix 7 contract filter)', () => {
    it('non-strong: Outside view + Pre-mortem absent (contract: needs-handler), Main connection retained', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('A', 'a', 0.4)] }),
        vm: makeVm(),
      })
      const labels = vm.alsoLinks.map(l => l.label)
      expect(labels).not.toContain('Outside view')
      expect(labels).not.toContain('Pre-mortem')
      expect(labels).toContain('Main connection')
    })

    it('non-strong: only 1 safe link → minimum-items rule triggers at the renderer (alsoLinks.length < 2)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('A', 'a', 0.4)] }),
        vm: makeVm(),
      })
      // The renderer (HeroFooter) hides the "Also:" lede when count < 2.
      expect(vm.alsoLinks.length).toBeLessThan(2)
    })

    it('strong: caveats + next closest + revisit trigger (3 safe items, renders normally)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9 }),
        vm: makeVm({ decisionState: 'robust', evidenceLevel: 'good' }),
      })
      const labels = vm.alsoLinks.map(l => l.label)
      expect(labels).toContain('Caveats')
      expect(labels).toContain('Revisit trigger')
      expect(vm.alsoLinks.length).toBeGreaterThanOrEqual(2)
    })

    it('footer checks render 4 items per state', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
      })
      expect(vm.footerChecks).toHaveLength(4)
    })
  })

  // ── Polish pass: grounded stability/sensitivity wording ────────────────
  // The hero used to show "Stable result" alongside a generic "Sensitive"
  // footer check at 0.7–0.85 stability, which read contradictory. The
  // grounded rule below ties both labels to whether a fragile/sensitive
  // factor is actually present in the data.

  describe('grounded stability + sensitivity wording (footer-check only post-pill-removal)', () => {
    const fragileEdge = {
      fromId: 'n_f',
      fromLabel: 'Hiring rate',
      toId: 'n_x',
      toLabel: 'Outcome',
      switchProbability: 0.42,
      alternativeWinnerLabel: 'Option B',
    } as FragileEdgeItem

    it('0.75 stability with NO fragile factor → "Stability limited" check (not "Sensitive assumption")', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.75 }),
        vm: makeVm(),
      })
      const stabilityCheck = vm.footerChecks[1]
      expect(stabilityCheck.label).toBe('Stability limited')
      expect(stabilityCheck.label).not.toBe('Sensitive')
      expect(stabilityCheck.label).not.toBe('Sensitive assumption')
    })

    it('0.75 stability WITH fragile factor → "Sensitive assumption" check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.75, fragile: fragileEdge }),
        vm: makeVm(),
      })
      expect(vm.footerChecks[1].label).toBe('Sensitive assumption')
    })

    it('low stability WITH fragile factor → "Sensitive assumption" check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.6, fragile: fragileEdge }),
        vm: makeVm(),
      })
      expect(vm.footerChecks[1].label).toBe('Sensitive assumption')
    })

    it('low stability WITHOUT fragile factor → "Stability limited" check (no over-claim)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.4 }),
        vm: makeVm(),
      })
      expect(vm.footerChecks[1].label).toBe('Stability limited')
    })

    it('≥0.85 stability → "Stable" check regardless of fragile-factor presence', () => {
      const withFragile = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9, fragile: fragileEdge }),
        vm: makeVm(),
      })
      const withoutFragile = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9 }),
        vm: makeVm(),
      })
      expect(withFragile.footerChecks[1].label).toBe('Stable')
      expect(withoutFragile.footerChecks[1].label).toBe('Stable')
    })
  })

  describe('checkedCount legacy null-total case', () => {
    it('null when total is 0', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 0,
        totalFactorCount: 0,
      })
      expect(vm.checkedCount).toBeNull()
    })
  })
})
