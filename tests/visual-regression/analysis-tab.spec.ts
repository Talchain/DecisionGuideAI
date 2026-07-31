/**
 * Analysis-tab visual-regression harness (Brief 5).
 *
 * Per-phase targeted DOM-snapshot diffs for surfaces touched by this brief.
 * Each surface has a reserved slot below; phases fill in the snapshot assertions
 * as their touched surfaces stabilise.
 *
 * See `tests/visual-regression/README.md` for the per-phase cadence and commands.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import React from 'react'
import { normaliseDomSnapshot, captureByTestId } from './utils'
import { ResultsFooter } from '@/components/results/ResultsFooter'

vi.mock('@/canvas/hooks/useRiskProfile', () => ({
  useRiskProfile: () => ({
    profile: null,
    loading: false,
    selectPreset: vi.fn(),
  }),
  RISK_PRESETS: {
    risk_averse: { label: 'Risk Averse', description: '', icon: '', score: 0.2 },
    neutral: { label: 'Neutral', description: '', icon: '', score: 0.5 },
    risk_seeking: { label: 'Risk Seeking', description: '', icon: '', score: 0.8 },
  },
}))

describe('visual-regression scaffold (Brief 5)', () => {
  it('normaliseDomSnapshot is deterministic', () => {
    const input = `<div   data-reactroot="">  <span class="a">hi</span>  </div>`
    const a = normaliseDomSnapshot(input)
    const b = normaliseDomSnapshot(input)
    expect(a).toBe(b)
    expect(a).not.toContain('data-reactroot')
  })

  it('normalises runtime-generated testid suffixes', () => {
    const a = normaliseDomSnapshot('<div data-testid="row:12345">x</div>')
    const b = normaliseDomSnapshot('<div data-testid="row:67890">x</div>')
    expect(a).toBe(b)
  })

  // ── per-surface slots (each phase fills one) ───────────────────────────
  // Each slot is a placeholder `it.todo(...)` so the spec lists the
  // surfaces we will capture, without inventing fake markup during scaffold
  // time. The phase that owns the surface replaces `it.todo` with a real
  // render + snapshot.

  it('Phase 1 / Task 4 — footer (stability + influence, no leaked hash)', () => {
    const { container } = render(
      React.createElement(ResultsFooter, { stability: 0.82, influencePct: 0.91 }),
    )
    const snap = captureByTestId(container, 'results-footer')
    // Contains the two metadata parts
    expect(snap).toContain('91% of influence')
    expect(snap).toContain('82%')
    // Does NOT contain any hash-shaped token (7+ hex chars) — footer is intentionally
    // stability + influence only; any hash leak regressions would show up here.
    expect(snap).not.toMatch(/[0-9a-f]{7,}/i)
  })
  it('Phase 2 / Task 6 — risk control in Your options (display filter)', async () => {
    // Follow-up IMP-2: render the extracted RiskAppetiteFilter component so
    // the assertion catches conditional-render regressions, not just source
    // drift. The inline JSX was extracted from ResultsBody into an exported
    // sub-component for exactly this purpose.
    const { RiskAppetiteFilter } = await import('@/components/results/ResultsBody')
    const onChange = vi.fn()
    const { container } = render(
      React.createElement(RiskAppetiteFilter, { value: 'neutral', onChange }),
    )
    const snap = captureByTestId(container, 'winner-by-control')

    // Updated copy (Paul's ruling 2026-07-12: explicitly-labelled lens) + testid present.
    //
    // ⭐ SUPERSEDED 2026-07-31 (re-anchoring, §6.2a + §6.5 item 5). Three
    // expectations moved, and each names what it replaced:
    //   · 'Winner by:'  → 'Rank by outcome:'  — the control confers no
    //     endorsement; it re-ranks a view, and now every arm re-ranks it on
    //     the SAME quantity.
    //   · the lens sentence drops the un-anchored noun 'the overall
    //     recommendation' for the quantity that is actually unchanged.
    //   · the arm labels name their percentile instead of a mood, because
    //     the middle arm now ranks p50 rather than the comparative quantity.
    expect(snap).toContain('Rank by outcome:')
    expect(snap).toContain('A view lens over the outcome range. The goal ranking above is unchanged.')
    expect(snap).toContain('Cautious (p10)')
    expect(snap).toContain('Middle (p50)')
    expect(snap).toContain('Optimistic (p90)')
    // The retired label must not survive anywhere in this control.
    expect(snap).not.toContain('Winner by:')
    // Legacy copy absent from rendered output.
    expect(snap).not.toContain('Risk appetite:')

    // Wiring sanity: clicking a pill fires the change handler with the key.
    fireEvent.click(within(container).getByRole('button', { name: /optimistic/i }))
    expect(onChange).toHaveBeenCalledWith('aggressive')
  })

  it('Phase 2 / Task 6 — risk control in Advanced (persistent profile)', async () => {
    const { AdvancedSection } = await import('@/components/results/AdvancedSection')
    const { container } = render(React.createElement(AdvancedSection, {}))
    // Advanced is accordion-collapsed by default; expand to reach the control.
    fireEvent.click(container.querySelector('button[aria-controls], [data-testid="accordion-advanced"] button, .accordion-trigger')
      ?? container.querySelector('button')!)
    const snap = captureByTestId(container, 'risk-profile-control')
    expect(snap).toContain('Risk profile')
    expect(snap).toContain('Persistent profile: used when analysis is rerun.')
    expect(snap).toContain('aria-label="Risk profile"')
    // Legacy copy gone from this surface
    expect(snap).not.toContain('Risk tolerance')
    expect(snap).not.toContain('Re-weights the existing simulation')
  })
  it('Phase 3 / Task 2 — drivers section headers + first row grid alignment', async () => {
    const { DriversSection } = await import('@/components/results/DriversSection')
    const data = {
      drivers: [{
        factorKey: 'f1',
        factorLabel: 'Dedicated Design Expertise',
        rawElasticity: 0.5,
        normalisedInfluence: 0.7,
        influenceScore: 0.7,
        rank: 1,
        direction: 'positive' as const,
        semanticLabel: 'major' as const,
        confidenceScore: 0.8,
        canFocus: true,
        matchedNodeId: 'n1',
      }],
      topDrivers: [] as Array<never>,
      driversStatus: 'computed' as const,
      totalCount: 1,
      hasMagnitudeData: true,
    }
    data.topDrivers = data.drivers.slice(0, 3) as never
    const { container } = render(
      React.createElement(DriversSection, { data, goalLabel: 'Win rate' }),
    )
    const list = container.querySelector('[data-testid="drivers-list"]')
    expect(list).toBeTruthy()
    const headerGrid = list!.querySelector(':scope > .grid')
    const firstRowGrid = list!.querySelector('.space-y-2 > div .grid')
    const headerCols = (headerGrid!.className.match(/grid-cols-\[[^\]]+\]/) ?? [])[0]
    const rowCols = (firstRowGrid!.className.match(/grid-cols-\[[^\]]+\]/) ?? [])[0]
    // Same grid-cols token across header and row = columns align structurally.
    expect(headerCols).toBe(rowCols)
  })
  it('Phase 4 / Task 3 — tornado card: intro copy + legend above first bar; apply/rerun dormant per PLOT_BOUNDS_WIRED gate', async () => {
    const { TornadoChart } = await import('@/components/results/TornadoChart')
    const row = {
      factorKey: 'f1',
      label: 'Design expertise',
      rawElasticity: 0.5,
      lowOutcome: 50,
      highOutcome: 80,
      midOutcome: 65,
    }
    const { container } = render(
      React.createElement(TornadoChart, {
        rows: [row],
        expectedOutcome: 65,
        onApplyAndRerun: () => {},
      }),
    )

    const root = container.querySelector('[data-testid="tornado-chart"]')!
    const snap = normaliseDomSnapshot(root.outerHTML)

    // Codex final-audit B1: intro copy made honest — the bars are a proportional
    // illustration (option spread x influence), not producer per-factor forecasts.
    expect(snap).toContain(
      'Illustrative range for each factor: the recommended option’s overall spread scaled by that factor’s influence. A proportional guide to relative leverage, not a per-factor forecast from the analysis.',
    )
    // Legend relocated above the first bar
    expect(snap).toContain('data-testid="tornado-legend"')
    // Brief 5.2 close-out (item 4): Apply button is dormant via
    // TornadoChart.tsx:51 `PLOT_BOUNDS_WIRED = false`. It must NOT render
    // from the chart even when callers pass onApplyAndRerun. The dormant
    // button's a11y + guarded-click contract is separately covered by the
    // ApplyAndRerunButton subcomponent suite at TornadoChart.spec.tsx:270+.
    // If this assertion flips to toContain, that means someone re-enabled
    // the button without threading factor-space PLoT bounds first —
    // update this line only alongside that work.
    expect(snap).not.toContain('data-testid="tornado-apply-rerun"')
    // Old surfaces gone
    expect(snap).not.toContain('data-testid="tornado-pp-clarification"')
    expect(snap).not.toContain('data-testid="tornado-interaction-strip"')
  })
  // D7: YourExpertise component removed. AI-estimated and missing-data factors
  // are now threaded into Improve confidence triage cards (expertise-triage-cards).
  // Tests for the deleted component removed here.
})
