/**
 * A BLOCKED ANALYSIS MAKES NO CLAIM ABOUT THE USER'S OPTIONS.
 *
 * ── THE REGRESSION, MEASURED AND LIVE ─────────────────────────────────────
 * `normaliseV5AnalysisReady` rejects a payload whose `goal_node_id` is empty or
 * whose `options` array is empty. A blocked refusal used to be exactly that —
 * witnessed on an authenticated journey:
 *
 *   { options: [], goal_node_id: "", status: "blocked",
 *     blocked_reason: "MISSING_OPTION_VALUE" }
 *
 * So the guard WAS the status check: nothing downstream ever saw a blocked
 * payload, and `BaseNode` could treat mere PRESENCE as a licence to mark an
 * option incomplete.
 *
 * CEE now carries model identity on refusals — correctly, because a refusal
 * that cannot name the model is one a user cannot act on. The composer returns
 * `{ ...refusal, goal_node_id, options }`, each unvalued option carrying
 * `interventions: {}`. The guard ADMITS, and every unvalued option on a blocked
 * run rendered a dashed "incomplete" border: a claim about the user's model
 * that nothing established.
 *
 * ⚠ THE FIX IS THE READER, NOT THE WRITER. Withholding identity is the defect
 * the CEE change exists to close.
 *
 * ── BOTH DIRECTIONS, and the second is the one that matters more ──────────
 * Silencing the TRUE case would be worse than the false one: an option that
 * genuinely has no interventions on an analysis that DID assess it must still
 * render uncertain. Every case below is paired.
 */
import { describe, it, expect } from 'vitest'
import { optionsWereAssessed } from '../optionAssessment'
import {
  RECOGNISED_ANALYSIS_READY_STATUSES,
  type RecognisedAnalysisReadyStatus,
} from '../../../adapters/cee/types'

describe('optionsWereAssessed — did the analysis project these options?', () => {
  it('PRECONDITION — the status union is populated (a guard over an empty set is vacuous)', () => {
    expect(RECOGNISED_ANALYSIS_READY_STATUSES.length).toBeGreaterThanOrEqual(5)
    expect(RECOGNISED_ANALYSIS_READY_STATUSES).toContain('blocked')
  })

  it('⛔ a BLOCKED refusal licenses no claim — CEE refused before projecting', () => {
    expect(optionsWereAssessed('blocked')).toBe(false)
  })

  it('⛔ OPPOSITE DIRECTION — every other recognised status still licenses the claim', () => {
    // The harm this must not cause: silencing a TRUE incompleteness finding.
    const others = RECOGNISED_ANALYSIS_READY_STATUSES.filter(
      (s: RecognisedAnalysisReadyStatus) => s !== 'blocked',
    )
    expect(others.length).toBeGreaterThan(0)
    for (const status of others) {
      expect(optionsWereAssessed(status), `status ${status} must still assess`).toBe(true)
    }
  })

  it('FAIL-SAFE — absent or unrecognised status keeps the pre-existing behaviour', () => {
    // Narrowing here would withdraw a true claim on every payload that predates
    // refusals carrying identity — the opposite-direction harm, at scale.
    for (const s of [undefined, null, '', 'some_future_status']) {
      expect(optionsWereAssessed(s as never), `input ${String(s)}`).toBe(true)
    }
  })

  it('⭐ TOTALITY — the map decides EVERY recognised status, so a new one cannot slip through', () => {
    // The typecheck enforces this at build time; this asserts it at runtime too,
    // so a cast or a loosened type cannot quietly reopen the gap.
    for (const status of RECOGNISED_ANALYSIS_READY_STATUSES) {
      expect(typeof optionsWereAssessed(status)).toBe('boolean')
    }
    // …and the two answers are BOTH represented, so the map has not collapsed
    // to a constant — which would pass every case above.
    const answers = new Set(RECOGNISED_ANALYSIS_READY_STATUSES.map(optionsWereAssessed))
    expect(answers.size, 'the map must discriminate, not return one answer').toBe(2)
  })
})
