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
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  it('Phase 2 / Task 6 — risk control in Your options (display filter)', () => {
    // ResultsBody's risk-appetite row is inline JSX (not an exported
    // component), so we assert the approved copy and testid are present in
    // the source. Cheap and reliable; catches copy drift on save.
    const src = readFileSync(
      resolve(__dirname, '../../src/components/results/ResultsBody.tsx'),
      'utf-8',
    )
    expect(src).toContain('data-testid="winner-by-control"')
    expect(src).toContain('Show winner by:')
    expect(src).toContain('Display filter: reweights which option is shown as winner.')
    // Legacy copy removed from the render tree (comments are fine; only the
    // user-visible span must not ship the old label).
    expect(src).not.toMatch(/>\s*Risk appetite:\s*</)
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
  it.todo('Phase 3 / Task 2 — drivers section headers + first row grid alignment')
  it.todo('Phase 4 / Task 3 — tornado card: intro copy + legend above first bar + apply/rerun button')
  it.todo('Phase 6 / Task 1 — Your-expertise row collapsed (parity with Brief 4 Task 6)')
  it.todo('Phase 6 / Task 1 — Your-expertise row expanded (AI estimates + Missing data groups)')
})
