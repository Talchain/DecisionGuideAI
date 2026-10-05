/**
 * The "Test without this link" offer gate: the Science owner's predicate over producer fields, strict on absence.
 * Every hold row changes ONE field of an eligible base, so a gate that held everything, or nothing, fails a row.
 */
import { describe, expect, it } from 'vitest'
import {
  TEST_WITHOUT_LINK_HOLD_COPY,
  testWithoutLinkEligibility,
  type TestWithoutLinkEligibilityInput,
} from '../testWithoutLinkEligibility'

/** The served shape (journey-4 wire/16 field paths) of a Run the service will answer. */
const ELIGIBLE: TestWithoutLinkEligibilityInput = {
  permittedAnalysisMode: 'quantified_provisional',
  analysisState: {
    run_state: { kind: 'complete_current', computed_at: '2026-10-04T18:32:06.624Z' },
    requires_rerun: false,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
  },
  hasResult: true,
  sourceType: 'factor',
  targetType: 'goal',
  edgeType: 'directed',
}
const state = (over: Record<string, unknown>) => ({ ...(ELIGIBLE.analysisState as Record<string, unknown>), ...over })
const holdOf = (over: Partial<TestWithoutLinkEligibilityInput>) => {
  const r = testWithoutLinkEligibility({ ...ELIGIBLE, ...over })
  return r.eligible ? 'eligible' : r.hold
}

describe('Test without this link: when it is offered', () => {
  it('is offered on a current, quantified Run for a causal link, including when the leader is withheld', () => {
    expect(holdOf({})).toBe('eligible')
    expect(holdOf({ permittedAnalysisMode: 'comparative_leader' })).toBe('eligible')
    // The leader licence is not an input: separation_unavailable and a near tie still get the press.
    expect(holdOf({ analysisState: state({ leader_claim: { permitted: false, withheld_reason: 'options_do_not_separate' } }) })).toBe('eligible')
  })

  it.each([
    ['exploratory', 'exploratory'],
    ['none', 'none'],
    ['an unknown future mode', 'some_new_mode'],
  ] as const)('holds below quantified_provisional (%s admission)', (_label, mode) => {
    expect(holdOf({ permittedAnalysisMode: mode })).toBe('not_quantified')
  })

  // A fresh-browser cold load stores no admission (see the module header), so absence is "not loaded": the press is
  // offered and the service, which reads the admission itself, decides. Holding would state a refusal nobody made.
  it.each([['absent', undefined], ['null', null]] as const)('offers the press when the admission is %s (not loaded)', (_label, mode) => {
    expect(holdOf({ permittedAnalysisMode: mode })).toBe('eligible')
  })

  it('holds when the goal scope is unresolved, and only for that withheld reason', () => {
    expect(holdOf({ analysisState: state({ leader_claim: { permitted: false, withheld_reason: 'goal_scope_unresolved' } }) }))
      .toBe('goal_scope_unresolved')
  })

  it.each([
    ['the Run is stale', state({ run_state: { kind: 'complete_stale' } })],
    ['a rerun is required', state({ requires_rerun: true })],
    ['there is no analysis state (strict on absence)', null],
    ['the analysis state has no run state', state({ run_state: undefined })],
  ])('holds when %s', (_label, analysisState) => {
    expect(holdOf({ analysisState })).toBe('not_current')
  })

  it('holds when no analysis result is on hand', () => {
    expect(holdOf({ hasResult: false })).toBe('no_result')
  })

  it.each([
    ['an option source', { sourceType: 'option' }],
    ['a decision source', { sourceType: 'decision' }],
    ['an option target', { targetType: 'option' }],
  ] as const)('holds option wiring: %s', (_label, over) => {
    expect(holdOf(over)).toBe('option_wiring')
  })

  it('holds a bidirected link, and keeps a link with no edge_type', () => {
    expect(holdOf({ edgeType: 'bidirected' })).toBe('bidirected')
    expect(holdOf({ edgeType: undefined })).toBe('eligible')
  })

  it('a link-level hold outranks a Run-level one, because it stays true after a rerun', () => {
    expect(holdOf({ sourceType: 'option', permittedAnalysisMode: 'exploratory' })).toBe('option_wiring')
  })

  it('every hold has one plain sentence with no figure', () => {
    for (const [hold, sentence] of Object.entries(TEST_WITHOUT_LINK_HOLD_COPY)) {
      expect(sentence.length, hold).toBeGreaterThan(20)
      expect(sentence, hold).not.toMatch(/\d/)
    }
  })
})
