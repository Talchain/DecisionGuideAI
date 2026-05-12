/**
 * AnalysisHeroV17 — P1 fix regression guards.
 *
 * Locks in the post-review fixes:
 *   P1.1  prefillChat must NEVER auto-send when _prefillChat is unavailable.
 *         Only the reflect-state CTA (via sendMessage) may auto-send.
 *   P1.2  Actions menu must not contain "Olumi inferred" overclaim.
 *   P1.3  When v17 renders, TriageActionCardsBody suppresses its
 *         unified-triage-queue + stability narrative + AlsoConsiderDisclosure
 *         (avoiding the duplicate input surface). Other body blocks remain.
 *   P1.4  Row chatPrompts use a glossary-safe fallback when the user's
 *         label trips the banned-term scanner. The row's title still
 *         carries the user's label verbatim — we do not rewrite user data.
 *   P1.5  Factor filter widens to OR `data.kind === 'factor'`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisHeroV17 } from '../../AnalysisHeroV17'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { useCanvasStore } from '@/canvas/store'
import { rankHeroRows } from '../rowRanking'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ResultsVM } from '../../types'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  EvidenceGapItem,
  OptionResult,
  FragileEdgeItem,
} from '../../types'

function makeData(overrides: {
  stability?: number
  gaps?: EvidenceGapItem[]
  fragileFromLabel?: string
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a', label: 'Option A', winProbability: 0.7,
  } as OptionResult

  const fragile: FragileEdgeItem | undefined = overrides.fragileFromLabel ? {
    fromId: 'nf',
    fromLabel: overrides.fragileFromLabel,
    toId: 'ny',
    toLabel: 'Outcome',
    switchProbability: 0.42,
    alternativeWinnerLabel: 'Option B',
  } as FragileEdgeItem : undefined

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
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: overrides.gaps ?? [],
    topEvidenceGaps: overrides.gaps ?? [],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: fragile,
  } as ConfidenceSectionData

  return {
    recommendation,
    drivers: { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false, isError: false, goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

function makeVm(): ResultsVM {
  return {
    decisionState: 'robust', gapTop2: 0.4, hinge: null,
    evidenceLevel: 'fair', topAction: null, raw: makeData(),
  } as ResultsVM
}

function gap(label: string, factorId: string, voi: number): EvidenceGapItem {
  return {
    factorId, factorLabel: label, confidence: 60, voi, evpiPp: voi * 50, targetNodeId: factorId,
  } as EvidenceGapItem
}

// ── P1.1 — prefillChat must never auto-send ────────────────────────────────

describe('AnalysisHeroV17 — P1.1: prefillChat never auto-sends', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null })
  })

  it('moderate CTA: when _prefillChat is null, the CTA renders disabled — no auto-send, no focus', () => {
    const sendSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: sendSpy })
    const focusSpy = vi.fn()

    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
        onFocusNode={focusSpy}
      />,
    )
    const cta = screen.getByTestId('hero-v17-footer-cta') as HTMLButtonElement
    // Per the "dead buttons" improvement: when chat-prefill is unavailable,
    // the CTA renders disabled. Clicking does nothing — focus and send
    // are both gated. UX is explicit (greyed out + tooltip) rather than
    // silent no-op on a visually-active button.
    expect(cta.disabled).toBe(true)
    fireEvent.click(cta)
    expect(focusSpy).not.toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('moderate CTA: when _prefillChat IS available, focus runs THEN prefill (no auto-send)', () => {
    const prefillSpy = vi.fn()
    const sendSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillSpy, _sendMessage: sendSpy })
    const focusSpy = vi.fn()

    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
        onFocusNode={focusSpy}
      />,
    )
    fireEvent.click(screen.getByTestId('hero-v17-footer-cta'))
    expect(focusSpy).toHaveBeenCalledWith('n_c')
    expect(prefillSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()  // moderate never auto-sends
  })

  it('row AI action: when _prefillChat is null, button is disabled — click does NOT auto-send', () => {
    const sendSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: sendSpy })

    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // First action icon on the first row is the AI button (Sparkles).
    // When the IconBtn renders disabled, the aria-label sits on its
    // wrapping <span> (for tooltip-fires-on-hover), not on the inner
    // <button>. We look for the wrapper, then drill into the disabled
    // button.
    const row = screen.getByTestId('hero-v17-input-rows').querySelector('article')
    expect(row).toBeTruthy()
    const aiWrapper = row!.querySelector('[aria-label="Work through with AI"]')
    expect(aiWrapper).toBeTruthy()
    const aiBtn = aiWrapper!.querySelector('button') as HTMLButtonElement | null
      ?? (aiWrapper as HTMLButtonElement) // when enabled, the <button> itself carries aria-label
    expect(aiBtn).toBeTruthy()
    expect(aiBtn.disabled).toBe(true)
    fireEvent.click(aiBtn)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('REFLECT CTA: when _sendMessage is available, IS called (reflect is the only auto-send)', () => {
    const sendSpy = vi.fn()
    const prefillSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillSpy, _sendMessage: sendSpy })

    render(
      <AnalysisHeroV17
        data={{
          ...makeData({ stability: 0.7 }),
          confidence: {
            ...makeData({ stability: 0.7 }).confidence,
            m2BiasFindings: [{ type: 'Anchoring', source: 't', description: 'd', affectedElements: [], linkedCritiqueCode: '' }],
          },
        } as ResultsSectionDataReturn}
        vm={{ ...makeVm(), decisionState: 'robust' } as ResultsVM}
        fragileEdgeCount={0}
      />,
    )
    fireEvent.click(screen.getByTestId('hero-v17-footer-cta'))
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0][0]).toContain('Challenge the current leading option')
    // Prefill must NOT be called for reflect — only sendMessage.
    expect(prefillSpy).not.toHaveBeenCalled()
  })

  it('prefill is preferred over send when _prefillChat IS available (no double-fire)', () => {
    const sendSpy = vi.fn()
    const prefillSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillSpy, _sendMessage: sendSpy })

    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    fireEvent.click(screen.getByTestId('hero-v17-footer-cta'))
    expect(prefillSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

// ── P1.2 — Actions menu must not overclaim provenance ──────────────────────

describe('AnalysisHeroV17 — P1.2: no provenance-overclaim copy', () => {
  it('Actions menu items do not say "Olumi inferred" or "what Olumi inferred"', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    fireEvent.click(screen.getByTestId('hero-v17-actions-toggle'))
    const menu = screen.getByTestId('hero-v17-actions-menu')
    const text = menu.textContent ?? ''
    expect(text).not.toContain('Olumi inferred')
    expect(text).not.toContain('what Olumi')
  })

  it('rendered v17 hero never contains "You checked X · Olumi inferred Y" anywhere', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const hero = screen.getByTestId('analysis-hero-v17')
    expect(hero.textContent ?? '').not.toContain('Olumi inferred')
  })
})

// ── P1.3 — No duplicate input surface when v17 is rendered ─────────────────

describe('AnalysisHeroV17 — P1.3: composed body suppresses its triage queue', () => {
  it('renders v17 input rows BUT not the body\'s unified-triage-queue', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // v17 own rows present.
    expect(screen.getByTestId('hero-v17-input-rows')).toBeInTheDocument()
    // Body's queue suppressed.
    expect(screen.queryByTestId('unified-triage-queue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stability-narrative')).not.toBeInTheDocument()
    expect(screen.queryByTestId('also-consider-rows')).not.toBeInTheDocument()
  })

  it('body\'s contextual blocks (flip-risk, dominant nudge, checks footer) still render', () => {
    render(
      <AnalysisHeroV17
        data={makeData({
          stability: 0.7,
          gaps: [gap('Cost', 'n_c', 0.5)],
          fragileFromLabel: 'Hiring rate',
        })}
        vm={makeVm()}
        fragileEdgeCount={1}
      />,
    )
    expect(screen.getByTestId('t1-flip-risk-callout')).toBeInTheDocument()
    expect(screen.getByTestId('t1-checks-footer')).toBeInTheDocument()
  })
})

// ── P1.4 — Glossary fallback on row chatPrompts ────────────────────────────

describe('rowRanking — P1.4: row chatPrompts use safe fallback for banned labels', () => {
  it('evidence row with banned-term factor label → chatPrompt uses "this factor", title preserved', () => {
    const data = makeData({
      stability: 0.7,
      gaps: [gap('the winning team', 'n_w', 0.5)],
    })
    const rows = rankHeroRows(data, 'moderate')
    const row = rows[0]
    // Title preserves the user's exact label — we do not rewrite user data.
    expect(row.title).toBe('the winning team')
    // But the generated chatPrompt must NOT contain the banned term.
    expect(row.chatPrompt.toLowerCase()).not.toContain('winning')
    expect(row.chatPrompt).toContain('this factor')
  })

  it('fragile edge row with banned-term fromLabel → reason uses "a key factor"', () => {
    const data = makeData({ fragileFromLabel: 'graph traversal cost' })
    const rows = rankHeroRows(data, 'moderate')
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    // Reason must not amplify "graph".
    expect(riskRow!.reason.toLowerCase()).not.toContain('graph traversal')
    expect(riskRow!.reason).toContain('a key factor')
  })

  it('clean labels pass through untouched', () => {
    const data = makeData({
      stability: 0.7,
      gaps: [gap('Marketing spend', 'n_m', 0.5)],
    })
    const rows = rankHeroRows(data, 'moderate')
    expect(rows[0].chatPrompt).toContain('Marketing spend')
  })
})

// ── P1.5 — Factor filter widens via data.kind ──────────────────────────────

describe('AnalysisHeroV17 — P1.5: factor filter widens with data.kind', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      confirmedNodeIds: new Set<string>(),
    })
  })

  it('counts a node whose React Flow type is undefined but data.kind === "factor"', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n_factor_by_kind', type: undefined as unknown as string, position: { x: 0, y: 0 }, data: { kind: 'factor' } } as never,
        { id: 'n_goal', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal' } } as never,
      ],
      confirmedNodeIds: new Set(['n_factor_by_kind']),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    // The widened filter sees 1 factor (kind), 1 confirmed factor → Verified 100%.
    // Easiest assertion: the contribution line reads "1 input verified".
    expect(screen.queryByTestId('hero-v17-contribution')?.textContent).toBe('1 input verified')
  })

  it('counts nodes whose React Flow type IS "factor" (legacy path still works)', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n_legacy', type: 'factor', position: { x: 0, y: 0 }, data: {} } as never,
      ],
      confirmedNodeIds: new Set(['n_legacy']),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    expect(screen.queryByTestId('hero-v17-contribution')?.textContent).toBe('1 input verified')
  })

  it('zero factors → contribution line hidden, no NaN', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n_g', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal' } } as never],
      confirmedNodeIds: new Set<string>(),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    expect(screen.queryByTestId('hero-v17-contribution')).toBeNull()
  })
})
