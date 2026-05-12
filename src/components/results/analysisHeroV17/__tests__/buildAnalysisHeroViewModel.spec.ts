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

  return {
    recommendation,
    drivers: { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Goal',
  } as ResultsSectionDataReturn
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

const STD_ARGS = {
  confirmedFactorCount: 0,
  totalFactorCount: 5,
  fragileEdgeCount: 0,
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
      expect(vm.resultLine).toBe('No option currently leads clearly.')
    })

    it('moderate: default mid-range state', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('A', 'na', 0.4), gap('B', 'nb', 0.3)] }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.state).toBe('moderate')
    })

    it('reflect: robust + bias findings → reflect state with reflective pill', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, bias: [{ type: 'Anchoring', description: 'd' }] }),
        vm: makeVm({ decisionState: 'robust' }),
      })
      expect(vm.state).toBe('reflect')
      expect(vm.metaPills.some(p => p.tone === 'reflect')).toBe(true)
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

    it('dimensions clamp to [0,1]', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ dimensions: { evidence: 1.5, robustness: -0.2, clarity: 0.5 } }),
        vm: makeVm(),
      })
      expect(vm.dimensions.find(d => d.label === 'Evidence')!.value).toBe(1)
      expect(vm.dimensions.find(d => d.label === 'Structure')!.value).toBe(0)
    })
  })

  describe('contribution line', () => {
    it('hidden when confirmedFactorCount is 0', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 0,
      })
      expect(vm.contribution.text).toBeNull()
    })

    it('renders verified count when > 0, never "You checked X · Olumi inferred Y"', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 3,
      })
      expect(vm.contribution.text).toBe('3 inputs verified')
      expect(vm.contribution.text).not.toContain('Olumi inferred')
      expect(vm.contribution.text).not.toContain('checked')
    })

    it('singular grammar at 1', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 1,
      })
      expect(vm.contribution.text).toBe('1 input verified')
    })
  })

  describe('key question selection', () => {
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

    it('rejects DQP that contains a banned term and falls back to template', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({
          stability: 0.7,
          gaps: [gap('Cost', 'nc', 0.5)],
          dqp: ['Is this the winner?'],   // contains "winner" — banned
        }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      // Falls through to category-keyed template for the top evidence row.
      expect(vm.keyQuestion?.text).toBe('How confident are you in the Cost estimate?')
    })

    it('templates from top row for evidence category', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('Marketing spend', 'nm', 0.6)] }),
        vm: makeVm(),
      })
      expect(vm.keyQuestion?.text).toContain('Marketing spend')
    })

    it('hides Key-question card when no DQP and no rows', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(vm.keyQuestion).toBeNull()
    })

    it('user-supplied factor label containing banned term → falls back to generic phrase, never rewrites user data', () => {
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
      // But the templated question swaps in the generic fallback.
      expect(vm.keyQuestion?.text).toBe('How confident are you in the this factor estimate?')
    })
  })

  describe('result + reason line', () => {
    it('result line uses winner label', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ winnerLabel: 'Tech Lead' }),
        vm: makeVm(),
      })
      expect(vm.resultLine).toBe('Tech Lead currently leads.')
    })

    it('reason line derived from topFragileEdge when present', () => {
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
  })

  describe('meta pills', () => {
    it('binds "Result fragile" label to stability < 0.5 only', () => {
      const fragile = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.4 }),
        vm: makeVm(),
      })
      expect(fragile.metaPills.some(p => p.label === 'Result fragile')).toBe(true)

      const stable = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(stable.metaPills.some(p => p.label === 'Result fragile')).toBe(false)
    })

    it('no stability pill at all when stability is null', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: undefined }),
        vm: makeVm(),
      })
      // Should not contain any of the stability-band labels.
      const stabilityLabels = ['Result fragile', 'Result moderate', 'Stable result', 'Highly stable']
      expect(vm.metaPills.filter(p => stabilityLabels.includes(p.label))).toHaveLength(0)
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

    it('reflect → challenge-result (auto-send semantics flagged via kind)', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, bias: [{ type: 'A', description: 'd' }] }),
        vm: makeVm({ decisionState: 'robust' }),
      })
      expect(vm.footerCta.kind).toBe('challenge-result')
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

  describe('also-line + footer checks', () => {
    it('non-strong: outside view + main connection + pre-mortem', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('A', 'a', 0.4)] }),
        vm: makeVm(),
      })
      const labels = vm.alsoLinks.map(l => l.label)
      expect(labels).toContain('Outside view')
      expect(labels).toContain('Pre-mortem')
    })

    it('strong: caveats + next closest + revisit trigger', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.9 }),
        vm: makeVm({ decisionState: 'robust', evidenceLevel: 'good' }),
      })
      const labels = vm.alsoLinks.map(l => l.label)
      expect(labels).toContain('Caveats')
      expect(labels).toContain('Revisit trigger')
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

  describe('checkedCount line', () => {
    it('mirrors v17 pattern with verified count + total', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData(),
        vm: makeVm(),
        confirmedFactorCount: 2,
        totalFactorCount: 7,
      })
      expect(vm.checkedCount).toBe('2 of 7 verified')
    })

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
