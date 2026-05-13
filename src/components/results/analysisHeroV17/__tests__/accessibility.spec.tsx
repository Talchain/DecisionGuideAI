/**
 * AnalysisHeroV17 — accessibility + "Fragile" label binding.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 8 + §13.2:
 *   - Every IconBtn has an accessible name and a tooltip
 *   - +3 toggles carry correct aria-expanded
 *   - Actions menu has role=menu / role=menuitem
 *   - "Result fragile" pill is bound to stability < 0.5 only
 *
 * Per docs/investigations/analysis-hero-v17.md §12.3:
 *   - The string "Result fragile" must only render when stability is
 *     numeric AND < 0.5. Above that, the appropriate band label renders
 *     (Result moderate / Stable result / Highly stable).
 *   - When stability is null/NaN, no stability-band pill renders at all.
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

// ── "Fragile" label binding (investigation §12.3) ──────────────────────────

describe('AnalysisHeroV17 — "Fragile" label binding to stability', () => {
  function findPill(label: string): HTMLElement | null {
    // Pills render inside hero-v17-result-context. Search there for the
    // exact text.
    const ctx = screen.queryByTestId('hero-v17-result-context')
    if (!ctx) return null
    const candidates = ctx.querySelectorAll('span')
    for (const c of Array.from(candidates)) {
      if (c.textContent === label) return c as HTMLElement
    }
    return null
  }

  // Pill labels normalised in Fix 2:
  //   "Result fragile"  → "Fragile result"
  //   "Result moderate" → "Moderate stability"
  //   "Stable result"   unchanged
  //   "Highly stable"   unchanged

  it('stability 0.4 → "Fragile result" pill renders with danger tone', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: 0.4 })} vm={makeVm()} fragileEdgeCount={0} />)
    const pill = findPill('Fragile result')
    expect(pill).toBeTruthy()
    expect(pill!.className).toContain('text-danger')
  })

  it('stability 0.5 exactly → NOT fragile (boundary)', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: 0.5 })} vm={makeVm()} fragileEdgeCount={0} />)
    expect(findPill('Fragile result')).toBeNull()
    expect(findPill('Moderate stability')).toBeTruthy()
  })

  it('stability 0.7 → "Stable result"', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: 0.7 })} vm={makeVm()} fragileEdgeCount={0} />)
    expect(findPill('Fragile result')).toBeNull()
    expect(findPill('Stable result')).toBeTruthy()
  })

  it('stability 0.9 → "Highly stable"', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: 0.9 })} vm={makeVm()} fragileEdgeCount={0} />)
    expect(findPill('Fragile result')).toBeNull()
    expect(findPill('Highly stable')).toBeTruthy()
  })

  it('stability missing → no stability-band pill renders at all', () => {
    render(<AnalysisHeroV17 data={makeData({ stability: undefined })} vm={makeVm()} fragileEdgeCount={0} />)
    expect(findPill('Fragile result')).toBeNull()
    expect(findPill('Moderate stability')).toBeNull()
    expect(findPill('Stable result')).toBeNull()
    expect(findPill('Highly stable')).toBeNull()
  })

  it('"Fragile result" copy NEVER renders when stability >= 0.5 (anti-drift)', () => {
    for (const stability of [0.5, 0.6, 0.7, 0.85, 0.9, 1]) {
      const { container, unmount } = render(
        <AnalysisHeroV17 data={makeData({ stability })} vm={makeVm()} fragileEdgeCount={0} />,
      )
      expect(container.textContent ?? '').not.toContain('Fragile result')
      unmount()
    }
  })

  it('Fix-2 anti-drift: the legacy "Result fragile" copy never appears at any stability', () => {
    for (const stability of [0.0, 0.25, 0.49, 0.5, 0.7, 0.9, 1]) {
      const { container, unmount } = render(
        <AnalysisHeroV17 data={makeData({ stability })} vm={makeVm()} fragileEdgeCount={0} />,
      )
      expect(container.textContent ?? '').not.toContain('Result fragile')
      unmount()
    }
  })
})
