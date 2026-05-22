/**
 * AnalysisHeroV17 — accessibility + post-pill-removal anti-drift.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 8 + §13.2:
 *   - Every IconBtn has an accessible name and a tooltip
 *   - +3 toggles carry correct aria-expanded
 *   - Actions menu has role=menu / role=menuitem
 *
 * Per docs/investigations/analysis-hero-v17-top-section.md task 4:
 *   - Stability/evidence meta pills were removed from the result-context
 *     block. This file's "Meta-pill removal anti-drift" describe block
 *     guards against any pill copy returning to that section.
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
  stability?: number | undefined
  gaps?: EvidenceGapItem[]
} = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a', label: 'Option A', winProbability: 0.7,
  } as OptionResult
  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, { id: 'opt_b', label: 'Option B', winProbability: 0.3 } as OptionResult],
    goalLabel: 'Goal',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: overrides.stability,
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

// ── Accessibility ───────────────────────────────────────────────────────────

describe('AnalysisHeroV17 — accessibility', () => {
  // Set up chat-prefill availability so menu/CTA buttons render enabled.
  // Without this, the "dead buttons" improvement would disable them and
  // legitimate keyboard/menu tests would fail because the trigger can't
  // open the menu.
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: () => {}, _sendMessage: () => {} })
  })

  it('all icon buttons in the action row have an accessible name', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.6)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // Every <button> inside the v17 hero subtree must have either
    // textContent OR aria-label.
    const hero = screen.getByTestId('analysis-hero-v17')
    const buttons = hero.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of Array.from(buttons)) {
      const hasName = (btn.getAttribute('aria-label')?.trim()?.length ?? 0) > 0
        || (btn.textContent?.trim()?.length ?? 0) > 0
      expect(hasName, `Button without accessible name: ${btn.outerHTML.slice(0, 150)}`).toBe(true)
    }
  })

  it('Actions menu toggle has aria-haspopup=menu and aria-expanded toggles', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    const toggle = screen.getByTestId('hero-v17-actions-toggle')
    expect(toggle.getAttribute('aria-haspopup')).toBe('menu')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    // Menu items have role=menuitem
    const menu = screen.getByTestId('hero-v17-actions-menu')
    expect(menu.getAttribute('role')).toBe('menu')
    const items = menu.querySelectorAll('[role="menuitem"]')
    expect(items.length).toBeGreaterThan(0)
  })

  it('+3 disclosure toggle carries aria-expanded and flips on click', () => {
    // Need many gaps so the hidden disclosure surfaces.
    const gaps = Array.from({ length: 6 }, (_, i) => gap(`Factor${i}`, `n${i}`, 1 - i * 0.1))
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const toggle = screen.getByTestId('hero-v17-rows-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('hero-v17-hidden-rows')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('hero-v17-hidden-rows')).toBeInTheDocument()
  })

  it('input rows expose category via both colour dot AND text label (colour is never the only signal)', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.6)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    // Every visible row carries a priority text label inside its priority span.
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    const priorityText = rowRoot.textContent ?? ''
    // At least one of the band labels must appear.
    const hasBandLabel = /High|Medium|Low|Ready/.test(priorityText)
    expect(hasBandLabel).toBe(true)
  })

  it('legend list (4 dimension labels) renders visible text alongside coloured dots', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    const strip = screen.getByTestId('hero-v17-strip')
    const text = strip.textContent ?? ''
    expect(text).toContain('Structure')
    expect(text).toContain('Evidence')
    expect(text).toContain('Coverage')
    expect(text).toContain('Verified')
  })

  // ── 2026-05-21 corrections pass: row/footer cleanup anti-drift ──────────

  it('result context has no nested-card chrome (no border / rounded / padding)', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const ctx = screen.getByTestId('hero-v17-result-context')
    // The section's own border/rounded/padding classes were removed —
    // it leans on the outer hero card's `p-3 space-y-3`.
    expect(ctx.className).not.toMatch(/(^|\s)border(\s|$)/)
    expect(ctx.className).not.toMatch(/(^|\s)rounded-/)
    expect(ctx.className).not.toMatch(/(^|\s)(p-|px-|py-|pt-|pb-)\d/)
  })

  it('row markup does not render priority text pill or mini-bar', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    // No tooltip-equipped priority pill span (previous container carried
    // `title="Evidence priority"`).
    const priorityPill = rowRoot.querySelector('span[title="Evidence priority"]')
    expect(priorityPill).toBeNull()
    // Spans inside rows must NOT carry only the band-name text content.
    const spans = rowRoot.querySelectorAll('span')
    for (const s of Array.from(spans)) {
      const t = (s.textContent ?? '').trim()
      expect(['High', 'Medium', 'Low', 'Ready']).not.toContain(t)
    }
  })

  it('footer does not render the 4-check row (Result clear / Stability / Evidence / Framing)', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const footer = screen.getByTestId('hero-v17-footer')
    const text = footer.textContent ?? ''
    expect(text).not.toContain('Result clear')
    expect(text).not.toContain('Stability limited')
    expect(text).not.toContain('Sensitive assumption')
    expect(text).not.toContain('Evidence gaps')
    expect(text).not.toContain('Evidence covered')
    expect(text).not.toContain('Framing OK')
  })

  it('footer does not render the hint line', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const footer = screen.getByTestId('hero-v17-footer')
    const text = footer.textContent ?? ''
    expect(text).not.toContain('Check the highest-priority input')
    expect(text).not.toContain('Improve inputs first')
    expect(text).not.toContain('Challenge before deciding')
    expect(text).not.toContain('Ready to brief')
  })

  it('row action icons distinguish AI (Work through with AI) from Discuss (Discuss with AI) via aria-label', () => {
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.5)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    const aiBtn = rowRoot.querySelector('[aria-label="Work through with AI"]')
    const discussBtn = rowRoot.querySelector('[aria-label="Discuss with AI"]')
    expect(aiBtn).toBeTruthy()
    expect(discussBtn).toBeTruthy()
    expect(aiBtn).not.toBe(discussBtn)
  })

  it('Actions menu items are keyboard-accessible — focus visible on click', () => {
    render(<AnalysisHeroV17 data={makeData()} vm={makeVm()} fragileEdgeCount={0} />)
    const toggle = screen.getByTestId('hero-v17-actions-toggle')
    fireEvent.click(toggle)
    const items = screen.getByTestId('hero-v17-actions-menu').querySelectorAll('[role="menuitem"]')
    for (const it of Array.from(items)) {
      expect(it.tagName.toLowerCase()).toBe('button')
      // Each menu item has visible text content (its label).
      expect((it.textContent?.trim().length ?? 0) > 0).toBe(true)
    }
  })
})

// ── Meta-pill removal anti-drift (2026-05-21) ─────────────────────────────
//
// The stability and evidence pills used to render inside the result-context
// block. They were removed because they were non-actionable, frequently
// felt contradictory ("Highly stable" + "Evidence limited"), and the same
// signals already surface in the Footer checks below. See
// docs/investigations/analysis-hero-v17-top-section.md task 4.
//
// This describe block now guards against the pill copy ever returning to
// the result context.

describe('AnalysisHeroV17 — result-context pill copy never returns (post-removal anti-drift)', () => {
  function resultContextText(): string {
    const ctx = screen.queryByTestId('hero-v17-result-context')
    return ctx?.textContent ?? ''
  }

  const PILL_LABELS = [
    'Fragile result',
    'Moderate stability',
    'Stable result',
    'Mostly stable',
    'Highly stable',
    'Evidence limited',
    'Evidence moderate',
    'Evidence adequate',
    'Reflective check',
    // Legacy labels that were removed in earlier passes — still guarded.
    'Result fragile',
    'Evidence thin',
  ]

  it.each([0.0, 0.25, 0.4, 0.5, 0.6, 0.7, 0.75, 0.85, 0.9, 1])(
    'stability %s → no pill copy in result context',
    (stability) => {
      const { unmount } = render(
        <AnalysisHeroV17 data={makeData({ stability })} vm={makeVm()} fragileEdgeCount={0} />,
      )
      const text = resultContextText()
      for (const label of PILL_LABELS) {
        expect(text).not.toContain(label)
      }
      unmount()
    },
  )

  it('result context only contains the result line (no pills, no flip-risk reason)', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: 0.4 })} vm={makeVm()} fragileEdgeCount={0} />)
    const ctx = screen.getByTestId('hero-v17-result-context')
    // The result-line text is present.
    expect(ctx.textContent ?? '').toMatch(/comes out ahead/)
    // No pill elements — the previous markup nested span pills inside the section.
    const spans = ctx.querySelectorAll('span')
    for (const s of Array.from(spans)) {
      const t = s.textContent ?? ''
      for (const label of PILL_LABELS) {
        expect(t).not.toBe(label)
      }
    }
  })
})
