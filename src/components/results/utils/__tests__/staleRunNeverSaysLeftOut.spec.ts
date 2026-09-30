/**
 * ⛔ AIQ pre-share hold, S3 (R3 B0 5903722709 / 5903754711): right after a newer partial Run the hot turn said
 * "Comparing 3 of your 4 options … was left out" and the new option's card said "left out of the comparison" — about
 * an option Run 1 never saw. A Run that is not current is never re-described against today's option list.
 */
import { describe, it, expect } from 'vitest'
import { deriveComparisonScope } from '../goalAnchorCopy'
import { notAnalysedReasonCopy } from '../notAnalysedCopy'
import { wireSaysRunSuperseded } from '../../../../canvas/hooks/useAnalysisResultsAreCurrent'

const OPTS = [{ id: 'a', label: 'Hold £49' }, { id: 'b', label: 'Raise to £59' }, { id: 'c', label: 'Raise to £54' }, { id: 'n', label: 'Improve trial-to-Pro conversion', notAnalysed: true }]

describe('a Run that is not current says nothing about today\'s option list', () => {
  it('CONTROL: a current Run with one option not compared keeps its scope', () => {
    expect(deriveComparisonScope(OPTS)).not.toBeNull()
  })
  it('RED: the same options on a Run that is not current → no scope ("left out") at all', () => {
    expect(deriveComparisonScope(OPTS.map((o) => ({ ...o, runNotCurrent: true })))).toBeNull()
  })
  it('RED: the no-values card sentence keeps the graph fact and drops "left out" when the Run is not current', () => {
    expect(notAnalysedReasonCopy('no_interventions', true)).toMatch(/left out/)
    expect(notAnalysedReasonCopy('no_interventions', false)).not.toMatch(/left out/)
    expect(notAnalysedReasonCopy('no_interventions', false)).toMatch(/no values set yet/)
  })
  it('the wire says superseded for complete_stale, and for complete_current with a rerun or C2 — not otherwise', () => {
    expect(wireSaysRunSuperseded({ run_state: { kind: 'complete_stale' } })).toBe(true)
    expect(wireSaysRunSuperseded({ run_state: { kind: 'complete_current' }, requires_rerun: true })).toBe(true)
    expect(wireSaysRunSuperseded({ run_state: { kind: 'complete_current' }, contradictions: ['fact_status_success_but_degraded_newer'] })).toBe(true)
    expect(wireSaysRunSuperseded({ run_state: { kind: 'complete_current' }, requires_rerun: false, contradictions: [] })).toBe(false)
    expect(wireSaysRunSuperseded(null)).toBe(false)
  })
})
