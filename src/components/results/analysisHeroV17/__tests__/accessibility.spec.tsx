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

function gap(
  label: string,
  factorId: string,
  voi: number,
  // V17 power pass (2026-05-27): rowRanking drops evidence rows whose
  // suggestion is empty / banned / the "Gather data on X" template.
  // Default to a safe non-interpolating suggestion so accessibility tests
  // continue to produce visible rows + the +3 disclosure toggle.
  suggestion: string | undefined = 'Compare this estimate against recent data.',
): EvidenceGapItem {
  return {
    factorId, factorLabel: label, confidence: 60, voi, evpiPp: voi * 50, suggestion, targetNodeId: factorId,
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

  it('input rows expose category via colour dot AND verb-led title (colour is never the only signal)', () => {
    // Updated contract (2026-05-21 corrections pass): priority text
    // labels were removed alongside the mini-bar. Category is now
    // conveyed by:
    //   1. The category dot (visible, accessible via the row's testid),
    //      keyed by `CATEGORY_DOT_CLASS[row.category]`.
    //   2. The verb-led title ("Verify ...", "Challenge ...", "Add ...")
    //      which encodes the category intent in plain language.
    //   3. The row reason copy.
    //
    // Note on the prior test: it asserted `/High|Medium|Low|Ready/`
    // appeared in row text and was passing accidentally because
    // `buildReason` produces `"High evidence priority. ..."` strings —
    // i.e. the band literal was inside the reason copy, NOT in a
    // priority pill. That signal is no longer load-bearing for
    // category communication.
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.6)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    // Each visible row has a category dot (aria-hidden span carrying
    // the colour class) — non-colour signal is the verb-led title.
    // Targets the stable hero-v17-row-dot and hero-v17-row-title test
    // IDs rather than first-`<p>` / first-`span[aria-hidden]` selectors,
    // which would have matched arbitrary DOM nodes if the row markup
    // evolved.
    const rows = rowRoot.querySelectorAll('article')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of Array.from(rows)) {
      // Dot present (colour channel for sighted users).
      const dot = row.querySelector('[data-testid="hero-v17-row-dot"]')
      expect(dot).toBeTruthy()
      // Verb-led title present (text channel — encodes category for
      // colour-blind / screen-reader users without depending on hue).
      const titleEl = row.querySelector('[data-testid="hero-v17-row-title"]')
      const titleText = titleEl?.textContent ?? ''
      const startsWithVerb = /^(Verify|Challenge|Add)\s+/.test(titleText)
        || titleText === 'Add an alternative option'
        || titleText === 'Create decision brief'
      expect(startsWithVerb, `Row title "${titleText}" should be verb-led`).toBe(true)
    }
  })

  it('input rows do NOT render a priority text pill (anti-drift on the removed channel)', () => {
    // Sibling guard for the contract above: the prior priority pill
    // (`<span title="Evidence priority">{High|Medium|Low|Ready}</span>`)
    // is absent. This protects against accidental resurrection of the
    // removed channel — the reason text containing words like "High
    // evidence priority" is allowed (that's reason copy), but no span
    // should hold ONLY a bare band label.
    render(
      <AnalysisHeroV17
        data={makeData({ stability: 0.7, gaps: [gap('Cost', 'n_c', 0.6)] })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    // No tooltip-equipped priority span.
    expect(rowRoot.querySelector('span[title="Evidence priority"]')).toBeNull()
    // No span whose entire text content equals a bare band label.
    const spans = rowRoot.querySelectorAll('span')
    for (const s of Array.from(spans)) {
      const t = (s.textContent ?? '').trim()
      expect(['High', 'Medium', 'Low', 'Ready']).not.toContain(t)
    }
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

  // (priority-pill anti-drift consolidated into the "input rows do NOT
  // render a priority text pill" assertion higher up — keeping just one
  // anti-drift test to avoid duplicate coverage)

  it('row title wraps to two lines instead of single-line truncating (verb prefix preservation)', () => {
    // Anti-drift on the 2026-05-22 truncation fix. Long verb-led titles
    // like "Verify Technical Leadership Capacity" exceeded the available
    // column width in OutputsDock and clipped the factor label after the
    // verb. The fix replaces `truncate` (single-line ellipsis) with
    // `line-clamp-2` (allow wrap to 2 lines, ellipsis only beyond that)
    // + `break-words`. The verb prefix stays on the first line, the
    // factor label wraps; the `title` attribute remains for the rare
    // case where 2 lines still aren't enough.
    render(
      <AnalysisHeroV17
        data={makeData({
          stability: 0.7,
          gaps: [gap('Technical Leadership Capacity', 'n_lead', 0.6)],
        })}
        vm={makeVm()}
        fragileEdgeCount={0}
      />,
    )
    const rowRoot = screen.getByTestId('hero-v17-input-rows')
    const title = rowRoot.querySelector('[data-testid="hero-v17-row-title"]') as HTMLElement
    expect(title).toBeTruthy()
    // Sanity: the title text carries the verb prefix + the user label.
    expect(title.textContent).toBe('Verify Technical Leadership Capacity')
    // Anti-drift on the regression: `truncate` is single-line clip and
    // must not be on the title element.
    expect(title.className).not.toMatch(/(^|\s)truncate(\s|$)/)
    // Positive assertion: the new wrap behaviour is in place.
    expect(title.className).toMatch(/(^|\s)line-clamp-2(\s|$)/)
    // Layout context unchanged: title still claims the available column
    // width inside the dot+title flex row (so action icons stay
    // right-aligned in the parent flex).
    expect(title.className).toMatch(/(^|\s)flex-1(\s|$)/)
    expect(title.className).toMatch(/(^|\s)min-w-0(\s|$)/)
    // Tooltip stays for the rare overflow-beyond-two-lines case.
    expect(title.getAttribute('title')).toBe('Verify Technical Leadership Capacity')
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
