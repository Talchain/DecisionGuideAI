/**
 * ⭐ THE GOAL TARGET WRITES MONEY THE CONTRACT'S WAY — a probe table of REAL
 * target shapes (canvas side-by-side vs contract v3.1, item 6, 27 Sep 2026).
 *
 * The contract's Goal card reads `£20,000 / month · 12 months`: the glyph on the
 * figure, then the unit's words. The market-entry starter's Goal read
 * `Target: 11 £M ARR` — the currency after the number, the unit echoed raw —
 * and a bare `GBP` target read `GBP800,000`.
 *
 * ⚠ EVERY ROW IS A SHAPE A PRODUCER ACTUALLY SENT, not one made up here
 * (CLAUDE.md: a self-authored fixture is not evidence about the wire). The
 * source is named on each row: the shipped starters, the e2e geometry fixtures
 * (Paul's MRR boards), and the (raw, unit) pairs harvested from the 27 Sep audit
 * captures under `canvas-8ffc-work/` (counts in brackets). Rows from the repo's
 * own unit corpus are marked `repo`.
 *
 * CLAIM SCOPE: the formatter's string. The three callers (GoalNode, GoalPanel,
 * SuccessTargetLine) print it verbatim.
 */
import { describe, it, expect } from 'vitest'
import { formatGoalTarget } from '../formatGoalTarget'

type Row = readonly [value: number, unit: string, expected: string, source: string]

const PROBE: readonly Row[] = [
  // ── currency with the magnitude written into the unit ──────────────────
  [11, '£M ARR', '£11M ARR', 'market-entry starter goal; audit skeptic-pom7'],
  // ── currency-led word units (POM-9) ─────────────────────────────────────
  [100000, 'GBP MRR', '£100,000 MRR', 'e2e/geometry mrr-17d1cd3a + mrr-90b8f080 (19)'],
  [20000, 'GBP MRR per month', '£20,000 MRR / month', 'w2008 s2029 turns (4)'],
  [20000, 'GBP MRR/month', '£20,000 MRR/month', 'audit captures (8)'],
  // ── per-month currency rates ─────────────────────────────────────────────
  [100000, 'GBP per month', '£100,000 / month', 'skeptic-pom2 graph-3f89249e (10)'],
  [100000, 'GBP/month', '£100,000 / month', "pauls-own-models 08bf9a1f (6)"],
  [20000, '£ per month', '£20,000 / month', 'witness-r2 export'],
  [20000, '£/month', '£20,000 / month', 'witness-r2 export — the contract\'s own figure'],
  // ── plain currency ───────────────────────────────────────────────────────
  [6000000, '£', '£6,000,000', 'audit captures (2)'],
  [800000, 'GBP', '£800,000', 'repo'],
  [6000000, 'USD', '$6,000,000', 'repo'],
  [500, '$', '$500', 'repo'],
  // ── percent, at the user's own precision (F4) ───────────────────────────
  [110, '%', '110%', 'pricing-model starter goal (5)'],
  [115, '%', '115%', 'skeptic-F7 result-pm-pinned (2)'],
  [99.5, '%', '99.5%', 'skeptic-F7 result-bvb-current (6)'],
  [99.4, '%', '99.4%', 'skeptic-F4 result-s2'],
  [85, 'percent', '85%', 'repo'],
  // ── counts and word units ────────────────────────────────────────────────
  [800, 'customers', '800 customers', 'audit capture'],
  [800000, 'count', '800,000', 'repo — the digit-string brief sentinel'],
  [9, 'months', '9 months', 'repo'],
  [3, 'points', '3 points', 'repo'],
  [0.8, 'ratio', '0.8 ratio', 'repo — magnitude preserved, never ×100'],
]

describe('formatGoalTarget — a probe table of real target shapes (contract v3.1 item 6)', () => {
  it(`covers at least ten real shapes (${PROBE.length})`, () => {
    expect(PROBE.length).toBeGreaterThanOrEqual(10)
  })

  for (const [value, unit, expected, source] of PROBE) {
    it(`${value} + ${JSON.stringify(unit)} → ${JSON.stringify(expected)}   [${source}]`, () => {
      expect(formatGoalTarget(value, unit)).toBe(expected)
    })
  }

  it('money never leaves its code or glyph trailing the figure', () => {
    for (const [value, unit] of PROBE) {
      const out = formatGoalTarget(value, unit) ?? ''
      expect(out, `${value} ${unit}`).not.toMatch(/^[\d.,]+\s*(£|\$|€|GBP|USD|EUR)/)
      expect(out, `${value} ${unit}`).not.toMatch(/^(GBP|USD|EUR)/)
    }
  })

  it('the magnitude letter is carried, never applied — digits are the producer\'s own', () => {
    expect(formatGoalTarget(11, '£M ARR')).not.toContain('11,000,000')
    expect(formatGoalTarget(2.5, '$M ARR')).toBe('$2.5M ARR')
    expect(formatGoalTarget(11, '£m ARR')).toBe('£11m ARR')
    expect(formatGoalTarget(11, '£M')).toBe('£11M')
  })

  it('CONTROLS — shapes the magnitude arm must decline print exactly as before', () => {
    // No glyph for the code: kept as written.
    expect(formatGoalTarget(11, 'CHFM ARR')).toBe('11 CHFM ARR')
    // A negative figure: the sign rule compactUnitParts keeps.
    expect(formatGoalTarget(-11, '£M ARR')).toBe('-11 £M ARR')
    // Not a currency head at all.
    expect(formatGoalTarget(5, 'km')).toBe('5 km')
    expect(formatGoalTarget(12, 'engineers')).toBe('12 engineers')
  })
})
