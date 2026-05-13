/**
 * AnalysisHeroV17 — chat-closed render mode tests (Fix 6 + Fix 7).
 *
 * When `_prefillChat` is null (the common state — `DraftChat.tsx` is
 * minimised by default after a graph exists), prefill-only surfaces
 * hide so the hero collapses gracefully to a "read-only mode":
 *
 *   - row actions: AI / Discuss / Add / Challenge / Brief hidden;
 *     Edit + Confirm stay visible where they have a target.
 *   - Actions menu trigger: hidden entirely (every menu item prefills).
 *   - Key-question chips: hidden (every chip prefills).
 *   - Also-line: hidden (every link prefills + minimum-items rule).
 *   - Footer CTA: hidden for weak / reflect / strong; moderate stays
 *     visible with the softer label "Focus key estimate" because the
 *     focus side-effect remains useful without chat.
 *
 * When chat opens, every surface returns to its full interactive form.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisHeroV17 } from '../../AnalysisHeroV17'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ResultsVM } from '../../types'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  EvidenceGapItem,
  OptionResult,
} from '../../types'

function makeData(overrides: {
  stability?: number
  gaps?: EvidenceGapItem[]
  bias?: Array<{ type: string; description: string }>
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = { id: 'opt_a', label: 'Option A', winProbability: 0.7 } as OptionResult
  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, { id: 'opt_b', label: 'Option B', winProbability: 0.3 } as OptionResult],
    goalLabel: 'Goal',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: overrides.stability ?? 0.7,
    coachingReadinessDimensions: { evidence: 0.6, robustness: 0.7, clarity: 0.65 },
  } as DecisionResultData
  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [], topUncertainties: [],
    improvements: [], topImprovements: [],
    evidenceGaps: overrides.gaps ?? [],
    topEvidenceGaps: overrides.gaps ?? [],
    nextActions: [], topNextActions: [],
    m2BiasFindings: overrides.bias?.map(b => ({
      type: b.type, source: 't', description: b.description,
      affectedElements: [], linkedCritiqueCode: '',
    })),
  } as ConfidenceSectionData
  return {
    recommendation,
    drivers: { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false, isError: false, goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

function makeVm(overrides: Partial<ResultsVM> = {}): ResultsVM {
  return {
    decisionState: 'sensitive', gapTop2: 0.4, hinge: null,
    evidenceLevel: 'fair', topAction: null, raw: makeData(),
    ...overrides,
  } as ResultsVM
}

function gap(label: string, factorId: string, voi: number): EvidenceGapItem {
  return {
    factorId, factorLabel: label, confidence: 60, voi, evpiPp: voi * 50,
    targetNodeId: factorId,
  } as EvidenceGapItem
}

describe('AnalysisHeroV17 — chat-closed render mode', () => {
  beforeEach(() => {
    // Default to chat closed for this whole spec.
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null })
  })

  describe('row action filtering', () => {
    it('row with target → Edit + Confirm visible; AI / Discuss / Add / Challenge / Brief hidden', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      const row = screen.getByTestId('hero-v17-input-rows').querySelector('article')!
      expect(row.querySelector('[aria-label="Edit"]')).toBeTruthy()
      expect(row.querySelector('[aria-label="Confirm"]')).toBeTruthy()
      expect(row.querySelector('[aria-label="Work through with AI"]')).toBeNull()
      expect(row.querySelector('[aria-label="Discuss with AI"]')).toBeNull()
      expect(row.querySelector('[aria-label="Add"]')).toBeNull()
    })

    it('coverage-row with no target → all actions hidden (no edit/confirm to keep)', () => {
      // Single-option model triggers the coverage row, which has no
      // target → coverage actions are all prefill-only.
      const data: ResultsSectionDataReturn = {
        ...makeData(),
        recommendation: {
          ...makeData().recommendation,
          allOptions: [{ id: 'only', label: 'Only option', winProbability: 1 } as OptionResult],
        },
      } as ResultsSectionDataReturn
      render(<AnalysisHeroV17 data={data} vm={makeVm()} fragileEdgeCount={0} />)
      const coverageRow = screen.queryByTestId('hero-v17-row-coverage')
      expect(coverageRow).toBeTruthy()
      // No icons should render — the entire HeroActionRow returns null
      // when filtering leaves the list empty.
      expect(coverageRow!.querySelectorAll('[aria-label]')).toHaveLength(0)
    })
  })

  describe('actions menu', () => {
    it('Actions trigger is HIDDEN when chat is closed', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-actions-toggle')).toBeNull()
      expect(screen.queryByTestId('hero-v17-actions-menu')).toBeNull()
    })

    it('Actions trigger RETURNS when chat opens', () => {
      const { rerender } = render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-actions-toggle')).toBeNull()
      useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
      rerender(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.getByTestId('hero-v17-actions-toggle')).toBeInTheDocument()
    })
  })

  describe('key-question chips', () => {
    it('chips strip is HIDDEN when chat is closed (key-question text still renders)', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      // Key-question text still renders so the user can still read it.
      expect(screen.queryByTestId('hero-v17-key-question-text')).toBeTruthy()
      // Chips strip hidden.
      expect(screen.queryByTestId('hero-v17-key-question-chips')).toBeNull()
    })
  })

  describe('also-line', () => {
    it('hidden when chat is closed (every link is prefill)', () => {
      // Strong state has 3 safe items normally — but chat-closed hides
      // anyway because the links are prefill-dependent.
      render(
        <AnalysisHeroV17
          data={makeData({ stability: 0.9 })}
          vm={makeVm({ decisionState: 'robust', evidenceLevel: 'good' })}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-also-line')).toBeNull()
    })

    it('minimum-items rule (Fix 7): chat-open + non-strong state has only 1 safe link → still hidden', () => {
      useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm({ decisionState: 'sensitive' })}
          fragileEdgeCount={0}
        />,
      )
      // Non-strong state's Also-line has only "Main connection" after
      // the contract filter — that's a single item, hidden by the
      // minimum-items rule.
      expect(screen.queryByTestId('hero-v17-also-line')).toBeNull()
    })

    it('chat-open + strong state (3 items) → also-line renders', () => {
      useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
      render(
        <AnalysisHeroV17
          data={makeData({ stability: 0.9 })}
          vm={makeVm({ decisionState: 'robust', evidenceLevel: 'good' })}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.getByTestId('hero-v17-also-line')).toBeInTheDocument()
    })
  })

  describe('footer CTA visibility per state', () => {
    it('weak state CTA: hidden when chat is closed', () => {
      // No winner = weak state
      const data: ResultsSectionDataReturn = {
        ...makeData({ gaps: [gap('A', 'a', 0.4), gap('B', 'b', 0.3), gap('C', 'c', 0.2), gap('D', 'd', 0.1)] }),
        recommendation: { ...makeData().recommendation, recommendedOption: null, allOptions: [] },
      } as ResultsSectionDataReturn
      render(
        <AnalysisHeroV17
          data={data}
          vm={makeVm({ decisionState: 'indeterminate' })}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-footer-cta')).toBeNull()
    })

    it('moderate state CTA: VISIBLE with label "Focus key estimate" when chat is closed', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      const cta = screen.getByTestId('hero-v17-footer-cta')
      expect(cta.textContent).toBe('Focus key estimate')
    })

    it('reflect state CTA: hidden when chat is closed (prefill-only post-Fix-9)', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ bias: [{ type: 'Anchoring', description: 'd' }] })}
          vm={makeVm({ decisionState: 'robust' })}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-footer-cta')).toBeNull()
    })

    it('strong state CTA: hidden when chat is closed', () => {
      render(
        <AnalysisHeroV17
          data={makeData({ stability: 0.9 })}
          vm={makeVm({ decisionState: 'robust', evidenceLevel: 'good' })}
          fragileEdgeCount={0}
        />,
      )
      expect(screen.queryByTestId('hero-v17-footer-cta')).toBeNull()
    })

    it('moderate CTA flips back to "Test the result"-ish full label when chat opens', () => {
      useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
      render(
        <AnalysisHeroV17
          data={makeData({ gaps: [gap('Cost', 'n_c', 0.5)] })}
          vm={makeVm()}
          fragileEdgeCount={0}
        />,
      )
      const cta = screen.getByTestId('hero-v17-footer-cta')
      expect(cta.textContent).toBe('Check key estimate')
    })
  })
})

describe('AnalysisHeroV17 — Actions menu items post-Fix-8', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
  })

  it('menu does not contain "Run a pre-mortem" or "Use the outside view" (contract: needs-handler)', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    fireEvent.click(screen.getByTestId('hero-v17-actions-toggle'))
    const text = screen.getByTestId('hero-v17-actions-menu').textContent ?? ''
    expect(text).not.toContain('Run a pre-mortem')
    expect(text).not.toContain('Use the outside view')
  })

  it('menu does not contain "Challenge the current result" (renamed to "Test the result" — Fix 8)', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    fireEvent.click(screen.getByTestId('hero-v17-actions-toggle'))
    const text = screen.getByTestId('hero-v17-actions-menu').textContent ?? ''
    expect(text).not.toContain('Challenge the current result')
    expect(text).toContain('Test the result')
  })

  it('menu has exactly 4 items post-Fix-8', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    fireEvent.click(screen.getByTestId('hero-v17-actions-toggle'))
    const items = screen.getByTestId('hero-v17-actions-menu').querySelectorAll('[role="menuitem"]')
    expect(items).toHaveLength(4)
  })
})

describe('AnalysisHeroV17 — row action order post-Fix-4', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
  })

  it('first action in every visible row is the AI sparkle button', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ gaps: [gap('Cost', 'n_c', 0.5), gap('Time', 'n_t', 0.3)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rows = screen.getByTestId('hero-v17-input-rows').querySelectorAll('article')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of Array.from(rows)) {
      const firstAction = row.querySelector('[role="group"][aria-label="Row actions"] button')
      expect(firstAction?.getAttribute('aria-label')).toBe('Work through with AI')
    }
  })
})
