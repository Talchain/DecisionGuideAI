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
      expect(vm.resultLine).toBe('No option currently leads clearly.')
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
      // The factor label is intentionally not interpolated — the row title
      // above the question already names it.
      expect(vm.keyQuestion?.text).toBe('How confident are you this estimate is realistic?')
    })

    it('templates from top row for evidence category — generic phrasing, no label interpolation', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, gaps: [gap('Marketing spend', 'nm', 0.6)] }),
        vm: makeVm(),
      })
      // Polish-pass: the factor label is NOT interpolated into the question.
      // The row title carries the label visually; the question stays generic
      // so it reads cleanly for any factor type.
      expect(vm.keyQuestion?.text).toBe('How confident are you this estimate is realistic?')
      expect(vm.keyQuestion?.text).not.toContain('Marketing spend')
    })

    it('hides Key-question card when no DQP and no rows', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(vm.keyQuestion).toBeNull()
    })

    it('risk-category top row → same factor/estimate template, no "underperform"', () => {
      // Polish-pass refinement 3: a factor-targeted risk row (the fragile
      // edge) must not say "underperform" — that verb fits options, not
      // factors/estimates/risks/costs/capacities.
      const fragile = {
        fromId: 'n_f', fromLabel: 'Technical Leadership Capacity',
        toId: 'n_x', toLabel: 'Outcome',
        switchProbability: 0.42,
        alternativeWinnerLabel: 'Option B',
      } as FragileEdgeItem
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7, fragile }),
        vm: makeVm({ decisionState: 'sensitive' }),
      })
      expect(vm.inputRows[0].category).toBe('risk')
      expect(vm.keyQuestion?.text).toBe('How confident are you this estimate is realistic?')
      expect(vm.keyQuestion?.text.toLowerCase()).not.toContain('underperform')
      expect(vm.keyQuestion?.text).not.toContain('Technical Leadership Capacity')
    })

    it('user-supplied factor label containing banned term → row title preserves user data, question stays generic', () => {
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
      // Polish-pass: the question template no longer interpolates the
      // factor label, so banned-term smuggling via labels is moot here.
      expect(vm.keyQuestion?.text).toBe('How confident are you this estimate is realistic?')
      expect(vm.keyQuestion?.text.toLowerCase()).not.toContain('winning')
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

  describe('meta pills (Fix 2 label normalisation)', () => {
    it('binds "Fragile result" label to stability < 0.5 only', () => {
      const fragile = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.4 }),
        vm: makeVm(),
      })
      expect(fragile.metaPills.some(p => p.label === 'Fragile result')).toBe(true)
      // Anti-drift: legacy label gone.
      expect(fragile.metaPills.some(p => p.label === 'Result fragile')).toBe(false)

      const stable = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.7 }),
        vm: makeVm(),
      })
      expect(stable.metaPills.some(p => p.label === 'Fragile result')).toBe(false)
    })

    it('stability bands → labels: 0.4 Fragile result; 0.6 Moderate stability; 0.75 Stable result; 0.9 Highly stable', () => {
      const cases: Array<[number, string]> = [
        [0.4, 'Fragile result'],
        [0.6, 'Moderate stability'],
        [0.75, 'Stable result'],
        [0.9, 'Highly stable'],
      ]
      for (const [stability, expectedLabel] of cases) {
        const vm = buildAnalysisHeroViewModel({
          ...STD_ARGS,
          data: makeData({ stability }),
          vm: makeVm(),
        })
        expect(vm.metaPills.some(p => p.label === expectedLabel), `stability ${stability}`).toBe(true)
      }
    })

    it('evidenceLevel → pill: needs_work=Evidence limited; fair=Evidence moderate; good=Evidence adequate', () => {
      const cases: Array<['needs_work' | 'fair' | 'good', string]> = [
        ['needs_work', 'Evidence limited'],
        ['fair', 'Evidence moderate'],
        ['good', 'Evidence adequate'],
      ]
      for (const [level, expectedLabel] of cases) {
        const vm = buildAnalysisHeroViewModel({
          ...STD_ARGS,
          data: makeData({ stability: 0.7 }),
          vm: makeVm({ evidenceLevel: level }),
        })
        expect(vm.metaPills.some(p => p.label === expectedLabel), `level ${level}`).toBe(true)
      }
    })

    it('the legacy "Evidence thin" pill never appears (Fix 2 anti-drift)', () => {
      for (const level of ['needs_work', 'fair', 'good'] as const) {
        const vm = buildAnalysisHeroViewModel({
          ...STD_ARGS,
          data: makeData({ stability: 0.7 }),
          vm: makeVm({ evidenceLevel: level }),
        })
        expect(vm.metaPills.some(p => p.label === 'Evidence thin')).toBe(false)
      }
    })

    it('no stability pill at all when stability is null', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: undefined }),
        vm: makeVm(),
      })
      const stabilityLabels = ['Fragile result', 'Moderate stability', 'Stable result', 'Highly stable']
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

  describe('grounded stability + sensitivity wording', () => {
    const fragileEdge = {
      fromId: 'n_f',
      fromLabel: 'Hiring rate',
      toId: 'n_x',
      toLabel: 'Outcome',
      switchProbability: 0.42,
      alternativeWinnerLabel: 'Option B',
    } as FragileEdgeItem

    it('0.75 stability with NO fragile factor → "Stable result" pill + "Stability limited" check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.75 }),
        vm: makeVm(),
      })
      expect(vm.metaPills.map(p => p.label)).toContain('Stable result')
      expect(vm.metaPills.map(p => p.label)).not.toContain('Mostly stable')
      const stabilityCheck = vm.footerChecks[1]
      expect(stabilityCheck.label).toBe('Stability limited')
      // Anti-drift: the bare "Sensitive" must not appear, and we must
      // not over-claim a specific assumption when none is grounded.
      expect(stabilityCheck.label).not.toBe('Sensitive')
      expect(stabilityCheck.label).not.toBe('Sensitive assumption')
    })

    it('0.75 stability WITH fragile factor → "Mostly stable" pill + "Sensitive assumption" check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.75, fragile: fragileEdge }),
        vm: makeVm(),
      })
      expect(vm.metaPills.map(p => p.label)).toContain('Mostly stable')
      expect(vm.metaPills.map(p => p.label)).not.toContain('Stable result')
      const stabilityCheck = vm.footerChecks[1]
      expect(stabilityCheck.label).toBe('Sensitive assumption')
    })

    it('low stability WITH fragile factor → fragile/moderate pill + "Sensitive assumption" check', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.6, fragile: fragileEdge }),
        vm: makeVm(),
      })
      // Pill stays "Moderate stability" — the soften only applies to the
      // 0.7–0.85 band; below that the pessimistic pill is already accurate.
      expect(vm.metaPills.map(p => p.label)).toContain('Moderate stability')
      expect(vm.footerChecks[1].label).toBe('Sensitive assumption')
    })

    it('low stability WITHOUT fragile factor → "Stability limited" check (not "Sensitive assumption")', () => {
      const vm = buildAnalysisHeroViewModel({
        ...STD_ARGS,
        data: makeData({ stability: 0.4 }),
        vm: makeVm(),
      })
      const stabilityCheck = vm.footerChecks[1]
      expect(stabilityCheck.label).toBe('Stability limited')
      // The fragile-result pill is still surfaced at the system level —
      // this only governs the footer check, where over-claiming a single
      // named assumption when none is grounded would be wrong.
      expect(vm.metaPills.map(p => p.label)).toContain('Fragile result')
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
