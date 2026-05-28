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

function gap(
  label: string,
  factorId: string,
  voi: number,
  // V17 power pass (2026-05-27): rowRanking drops evidence rows whose
  // suggestion is empty / banned / the "Gather data on X" template.
  // Default to a safe non-interpolating suggestion so existing P1 tests
  // continue to produce evidence rows.
  suggestion: string | undefined = 'Compare this estimate against recent data.',
): EvidenceGapItem {
  return {
    factorId, factorLabel: label, confidence: 60, voi, evpiPp: voi * 50, suggestion, targetNodeId: factorId,
  } as EvidenceGapItem
}

// ── P1.1 — prefillChat must never auto-send ────────────────────────────────

describe('AnalysisHeroV17 — P1.1: prefillChat never auto-sends', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null })
  })

  it('moderate CTA: when _prefillChat is null, CTA stays visible with "Focus key estimate" label and focuses on click (Fix 6)', () => {
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
    // The moderate-state CTA stays visible even when chat is closed
    // (Fix 6) because its focus side-effect is still useful. The label
    // flips to "Focus {target}" mirror (2026-05-21 corrections) — Row 1
    // is 'Verify Cost', so the cleaned target is 'Cost'.
    expect(cta.textContent).toBe('Focus Cost')
    fireEvent.click(cta)
    expect(focusSpy).toHaveBeenCalledWith('n_c')  // focus runs
    expect(sendSpy).not.toHaveBeenCalled()        // never auto-sends
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

  it('row AI action: when _prefillChat is null, the button is HIDDEN (Fix 6)', () => {
    const sendSpy = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: sendSpy })

    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // Fix 6 swapped the earlier disabled-button treatment for full
    // hiding. Edit/Confirm stay visible (they don't need prefill); AI,
    // Discuss, Add, Challenge, Brief disappear when chat is closed.
    const row = screen.getByTestId('hero-v17-input-rows').querySelector('article')
    expect(row).toBeTruthy()
    expect(row!.querySelector('[aria-label="Work through with AI"]')).toBeNull()
    expect(row!.querySelector('[aria-label="Discuss with AI"]')).toBeNull()
    // The evidence row has a target node → Edit + Confirm should still render.
    expect(row!.querySelector('[aria-label="Edit"]')).toBeTruthy()
    expect(row!.querySelector('[aria-label="Confirm"]')).toBeTruthy()
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('REFLECT CTA: prefills via _prefillChat — does NOT auto-send (Fix 9)', () => {
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
    const cta = screen.getByTestId('hero-v17-footer-cta')
    // Fix 9: label renamed to avoid implying a formal devil's advocacy
    // handler (run_devils_advocacy is Needs handler in V5 contract v1.3).
    expect(cta.textContent).toBe('Test the result')
    fireEvent.click(cta)
    // Prefill is called; sendMessage (auto-send) never fires.
    expect(prefillSpy).toHaveBeenCalledTimes(1)
    expect(prefillSpy.mock.calls[0][0]).toContain('Challenge the current leading option')
    expect(sendSpy).not.toHaveBeenCalled()
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
    // Verb-led title (2026-05-21 corrections): evidence → 'Verify {raw
    // label}'. The user's exact label is preserved verbatim after the
    // verb prefix — we don't rewrite user data, we just prepend a verb.
    expect(row.title).toBe('Verify the winning team')
    // But the generated chatPrompt must NOT contain the banned term —
    // chatPrompt continues to interpolate the raw label via safeRowLabel,
    // which substitutes 'this factor' when the underlying label is unsafe.
    expect(row.chatPrompt.toLowerCase()).not.toContain('winning')
    expect(row.chatPrompt).toContain('this factor')
  })

  it('fragile edge row with banned-term fromLabel → reason swaps to the generic fallback ("this factor"), no upstream label leak', () => {
    // 'graph' is a banned glossary term — the full label "graph traversal
    // cost" therefore trips safeRowLabel, which returns the fallback
    // "this factor" before interpolation. The rendered reason then names
    // a safe stand-in instead of the user data.
    const data = makeData({ fragileFromLabel: 'graph traversal cost' })
    const rows = rankHeroRows(data, 'moderate')
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    // Upstream label MUST NOT appear in the rendered reason.
    expect(riskRow!.reason.toLowerCase()).not.toContain('graph traversal')
    // Exact fallback copy (Codex round-3 P2 #4 form).
    expect(riskRow!.reason).toBe('If the estimate for this factor changes, the leading option could change.')
    // chatPrompt still uses safeRowLabel, so the banned-term label
    // becomes "this factor" in generated copy.
    expect(riskRow!.chatPrompt.toLowerCase()).not.toContain('graph traversal')
    expect(riskRow!.chatPrompt).toContain('this factor')
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

  // Verified count moved (2026-05-21) from visible header text to the
  // Verified strip-segment's tooltip + aria-label. The visible header
  // never carries the count any more; we read it off the segment's
  // composite title attribute "Verified: NN% (No inputs verified)".
  // See docs/investigations/analysis-hero-v17-top-section.md task 2.
  function verifiedTooltipCount(): string {
    const seg = screen.queryByTestId('strip-verified')
    const title = seg?.getAttribute('title') ?? ''
    const m = title.match(/(\d+ input(s)? verified|No inputs verified)/)
    return m ? m[0] : ''
  }

  it('verified-segment tooltip always carries the count alongside the percentage', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n_factor', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor' } } as never,
        { id: 'n_goal', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal' } } as never,
      ],
      confirmedNodeIds: new Set(['n_factor']),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    const seg = screen.getByTestId('strip-verified')
    const title = seg.getAttribute('title') ?? ''
    expect(title).toMatch(/^Verified: \d+%/)
    expect(title).toContain('1 input verified')
    expect(seg.getAttribute('aria-label')).toBe(title)
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
    expect(verifiedTooltipCount()).toBe('1 input verified')
  })

  it('counts nodes whose React Flow type IS "factor" (legacy path still works)', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'n_legacy', type: 'factor', position: { x: 0, y: 0 }, data: {} } as never,
      ],
      confirmedNodeIds: new Set(['n_legacy']),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    expect(verifiedTooltipCount()).toBe('1 input verified')
  })

  it('zero factors → tooltip carries no count, no NaN, no "of 0" leak', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n_g', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal' } } as never],
      confirmedNodeIds: new Set<string>(),
    })
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    expect(verifiedTooltipCount()).toBe('')
    // Strip header never carries the count text any more (moved to tooltip).
    const strip = screen.queryByTestId('hero-v17-strip')
    expect(strip?.textContent ?? '').not.toMatch(/inputs? verified/)
    // Anti-drift: the legacy "0 of 4 verified" form is gone.
    expect(strip?.textContent ?? '').not.toMatch(/\d+ of \d+ verified/)
  })
})

// ── Polish pass — fragile/risk row rendered DOM guardrail ────────────────────
//
// Reviewer P1: the truncation fix was only unit-tested as a string. We can't
// validate pixel-width truncation in JSDOM (no layout engine), but we CAN
// guard against the two ways truncation could silently re-creep in:
//   1. The full reason string failing to land verbatim in the rendered DOM
//      (e.g. if a future change reintroduces the `High evidence priority.`
//      lede and someone clips it at the source).
//   2. A trailing ellipsis character being baked into the text content
//      (e.g. a future copy edit that adds `…` directly instead of relying
//      on CSS).
// Final pixel-level visual verification still requires a browser pass.

describe('AnalysisHeroV17 — polish pass: fragile/risk row rendered DOM', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
    useCanvasStore.setState({ nodes: [], confirmedNodeIds: new Set<string>() })
  })

  it('top-ranked risk row renders the factor-specific reason verbatim with no ellipsis', () => {
    // V17 power pass (2026-05-27): the risk-row reason now names the
    // factor explicitly so users don't conflate fragility with dominance.
    // The earlier "Check this first. It could change the result." was
    // generic and read like a dominance claim.
    const { container } = render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, fragileFromLabel: 'Technical Leadership Capacity' })}
        vm={makeVm()}
        fragileEdgeCount={1}
      />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('If the estimate for Technical Leadership Capacity changes, the leading option could change.')
    // Anti-drift on the previous shorter copy.
    expect(text).not.toContain('Check this first. It could change the result.')
    expect(text).not.toContain('If Technical Leadership Capacity changes, the leading option could change.')
    // Anti-drift on the older longer copy that caused the truncation.
    expect(text).not.toContain('Highest-priority assumption')
    expect(text).not.toContain('Most likely to change which option leads')
    // Anti-drift on text-level ellipsis (CSS line-clamp uses '…' as the
    // replacement char — we never want it baked into the source string).
    expect(text).not.toContain('…')
  })
})
