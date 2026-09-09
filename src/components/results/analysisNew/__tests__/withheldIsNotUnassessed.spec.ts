/**
 * ⭐⭐ THE PANEL TOLD THE READER THE COMPARISON WAS "NOT ASSESSED" WHILE THE
 * ENGINE HAD COMPUTED IT AND THE CANVAS WAS SHOWING IT.
 *
 * ── WITNESSED, NOT REASONED ABOUT ───────────────────────────────────────────
 * Deployed `3b2df4ce`, guest, saved example "Customer Data Platform Selection",
 * completed run. Read out of the live store:
 *     option_comparison_status: 'computed'
 *     leading_option_id:        'opt_rudderstack'
 *     win_probability           RudderStack 0.551 · Segment 0.360
 *                               Snowflake 0.030 · Status quo 0.059
 * The canvas rendered those as "Support 55% / 36% / 3% / 6%" on the option
 * nodes. On the same screen this row read *"Which option is most likely — not
 * assessed"* and *"This run returned no comparison verdict"*.
 *
 * ── WHAT IS AND IS NOT BEING CHANGED ────────────────────────────────────────
 * The MECHANISM is right and is untouched. `leader_not_assessed` is the
 * deliberate third state: `leaderDesignationPermitted` did not return true and
 * `separation` was not `'tied'`, so the panel declines to name a leader.
 * Declining is correct.
 *
 * ⛔ THE WORDS were wrong. WITHHELD IS NOT UNASSESSED. "Did Olumi assess it?"
 * and "may this surface state the answer?" are two questions, and the copy
 * answered the second by asserting a falsehood about the first.
 *
 * ⚠ The replacement must be TRUE IN BOTH POPULATIONS this one state covers: a
 * run that genuinely assessed nothing, and a run that assessed and was
 * withheld. That is why this file tests the STRINGS against both readings
 * rather than testing a new predicate — no predicate changed.
 */
import { describe, expect, it } from 'vitest'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'

const checks = (ANALYSIS_NEW_COPY as unknown as {
  checks: Record<string, { label: string; meaning?: string }>
}).checks

const row = checks.leader_not_assessed

describe('⭐ the row exists and is the one under test', () => {
  it('PRECONDITION: leader_not_assessed carries a label and a meaning', () => {
    // Without this, every absence assertion below would pass vacuously on a
    // renamed or deleted key.
    expect(row).toBeDefined()
    expect(typeof row.label).toBe('string')
    expect(typeof row.meaning).toBe('string')
    expect(row.label.length).toBeGreaterThan(10)
    expect((row.meaning ?? '').length).toBeGreaterThan(30)
  })
})

describe('⛔ it may not assert that the run did not assess the comparison', () => {
  it('⭐ the label does not say "not assessed"', () => {
    expect(row.label.toLowerCase()).not.toContain('not assessed')
  })

  it('⭐ the meaning does not claim the run returned no comparison verdict', () => {
    const m = (row.meaning ?? '').toLowerCase()
    expect(m).not.toContain('returned no comparison')
    expect(m).not.toContain('no comparison verdict')
  })

  it('CONTRAST: the sibling rows that ARE about something unassessed still say so', () => {
    // A blanket ban on the phrase would be wrong — these two rows describe
    // checks that genuinely did not run, and their wording is correct.
    expect(checks.robustness_not_assessed?.label.toLowerCase()).toContain('not assessed')
    expect(checks.evidence_not_assessed?.label.toLowerCase()).toContain('not assessed')
  })
})

describe('⭐ it still blocks BOTH original misreadings', () => {
  it('does not imply the options are level', () => {
    const m = (row.meaning ?? '').toLowerCase()
    expect(m).toContain('not a finding that the options are level')
  })

  it('does not read as an all-clear — it says the ordering is unconfirmed', () => {
    expect((row.meaning ?? '').toLowerCase()).toContain('unconfirmed')
  })

  it('⭐ and is true for a run that assessed nothing AND one that was withheld', () => {
    // "could not confirm" holds in both populations; "not assessed" held only
    // in the first. This is the whole repair.
    const both = `${row.label} ${row.meaning}`.toLowerCase()
    expect(both).toMatch(/not confirmed|could not confirm/)
  })
})
