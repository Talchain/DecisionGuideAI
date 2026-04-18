/**
 * Analysis-tab visual-regression harness (Brief 5).
 *
 * Per-phase targeted DOM-snapshot diffs for surfaces touched by this brief.
 * Each surface has a reserved slot below; phases fill in the snapshot assertions
 * as their touched surfaces stabilise.
 *
 * See `tests/visual-regression/README.md` for the per-phase cadence and commands.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { normaliseDomSnapshot, captureByTestId } from './utils'
import { ResultsFooter } from '@/components/results/ResultsFooter'

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
  it.todo('Phase 2 / Task 6 — risk control in Your options (display filter)')
  it.todo('Phase 2 / Task 6 — risk control in Advanced (persistent profile)')
  it.todo('Phase 3 / Task 2 — drivers section headers + first row grid alignment')
  it.todo('Phase 4 / Task 3 — tornado card: intro copy + legend above first bar + apply/rerun button')
  it.todo('Phase 6 / Task 1 — Your-expertise row collapsed (parity with Brief 4 Task 6)')
  it.todo('Phase 6 / Task 1 — Your-expertise row expanded (AI estimates + Missing data groups)')
})
