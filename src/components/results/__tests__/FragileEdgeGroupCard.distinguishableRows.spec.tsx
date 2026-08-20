/**
 * Two DIFFERENT fragile relationships must not render as the same sentence.
 *
 * ── The reported defect, and the correction to its diagnosis ───────────────
 * ISSUE-LEDGER L-37 records: *"Fragile-factors list duplicates a row — 'If
 * Leadership capacity shifts' appears twice; 'Fragile factors (3)' counts the
 * duplicate."* That diagnosis is WRONG, and acting on it would delete a
 * producer finding.
 *
 * Read off the live React tree on deployed staging `c71ea7e0`, the three rows
 * behind "Fragile factors (3)" were:
 *
 *   fac_4day_adoption → risk_coverage_gap        (Support Coverage Gap)
 *   fac_4day_adoption → risk_productivity_loss   (Productivity Shortfall Risk)
 *   fac_impl_spend    → risk_impl_overrun        (Implementation Cost Overrun)
 *
 * Three distinct edges. `dedupeFragileEdgesByIdentity` correctly kept all
 * three — its own header states the case: *"Two genuinely different
 * relationships can render the same 'If X shifts' line — one source factor
 * feeding two targets — and collapsing those would delete producer findings."*
 *
 * So the count is right and the dedup is right. **The ROW COPY is wrong**: it
 * names only the SOURCE, so one factor feeding two targets produces two
 * identical sentences and two identically-labelled Review chips. The user sees
 * a duplicate; the product is holding two findings and describing them with
 * one sentence.
 *
 * ── The fix, and the shape of this guard ───────────────────────────────────
 * Disambiguate by naming the relationship — but ONLY where it is ambiguous, so
 * the common single-target case keeps its short line. That makes a
 * DISCRIMINATING PAIR the right instrument (CLAUDE.md trap 19): a blanket
 * change in either direction fails one of the two cases below.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { FragileEdgeGroupCard } from '../FragileEdgeGroupCard'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const ALT = 'Full 4-Day Week Rollout'

/** The deployed run's own group: one source factor, two different targets. */
const SHARED_SOURCE = [
  {
    edge_id: 'fac_4day_adoption->risk_coverage_gap',
    from_id: 'fac_4day_adoption',
    from_label: '4-Day Week Adoption Level',
    to_label: 'Support Coverage Gap',
    switch_probability: 0.32,
    alternative_winner_label: ALT,
  },
  {
    edge_id: 'fac_4day_adoption->risk_productivity_loss',
    from_id: 'fac_4day_adoption',
    from_label: '4-Day Week Adoption Level',
    to_label: 'Productivity Shortfall Risk',
    switch_probability: 0.28,
    alternative_winner_label: ALT,
  },
]

/** The ordinary case: distinct sources, nothing to disambiguate. */
const DISTINCT_SOURCES = [
  {
    edge_id: 'fac_impl_spend->risk_impl_overrun',
    from_id: 'fac_impl_spend',
    from_label: 'Implementation Spend',
    to_label: 'Implementation Cost Overrun',
    switch_probability: 0.3,
    alternative_winner_label: ALT,
  },
  {
    edge_id: 'fac_4day_adoption->risk_coverage_gap',
    from_id: 'fac_4day_adoption',
    from_label: '4-Day Week Adoption Level',
    to_label: 'Support Coverage Gap',
    switch_probability: 0.2,
    alternative_winner_label: ALT,
  },
]

function rowsFor(edges: typeof SHARED_SOURCE): { lines: string[]; chipLabels: string[] } {
  const { container } = render(
    <FragileEdgeGroupCard
      altWinnerLabel={ALT}
      edges={edges}
      onFocusNode={() => {}}
      designationsWithheld={false}
      flipEvidenceAttestsNoFlip={false}
    />,
  )
  const chips = Array.from(container.querySelectorAll('[data-testid^="fragile-review-chip-"]'))
  return {
    // The trigger sentence is the row's own text minus the chip label.
    lines: chips.map(chip => {
      const row = chip.parentElement!
      const chipText = (chip.textContent ?? '').trim()
      return (row.textContent ?? '').replace(chipText, '').replace(/\s+/g, ' ').trim()
    }),
    chipLabels: chips.map(c => c.getAttribute('aria-label') ?? ''),
  }
}

describe('FragileEdgeGroupCard — one sentence per relationship', () => {
  it('POSITIVE CONTROL: the probe reads one row per edge', () => {
    expect(rowsFor(SHARED_SOURCE).lines).toHaveLength(2)
    expect(rowsFor(DISTINCT_SOURCES).lines).toHaveLength(2)
  })

  it('two edges from the SAME source are told apart — by row copy and by chip label', () => {
    const { lines, chipLabels } = rowsFor(SHARED_SOURCE)
    expect(new Set(lines).size, `Both rows read: ${lines[0]}`).toBe(2)
    expect(new Set(chipLabels).size, `Both chips read: ${chipLabels[0]}`).toBe(2)
  })

  it('both targets are NAMED — the disambiguation is the producer\'s data, not an index', () => {
    const { lines } = rowsFor(SHARED_SOURCE)
    expect(lines.join(' | ')).toContain('Support Coverage Gap')
    expect(lines.join(' | ')).toContain('Productivity Shortfall Risk')
  })

  it('DISCRIMINATING TWIN: distinct sources keep the short line — no target is added', () => {
    const { lines } = rowsFor(DISTINCT_SOURCES)
    expect(new Set(lines).size).toBe(2)
    expect(lines.join(' | '), 'the short form must survive where nothing is ambiguous').not.toContain('Implementation Cost Overrun')
    expect(lines.join(' | ')).not.toContain('Support Coverage Gap')
  })
})
