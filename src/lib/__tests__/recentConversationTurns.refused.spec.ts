/**
 * A REFUSAL IS NOT AN ANSWER.
 *
 * ⭐ EVERY FIXTURE HERE COMES FROM A REAL CAPTURE, not a shape invented to suit
 * the code. Two sources:
 *
 *   `olumi-debug-44e349fa-20260914.json`, scenario 9677de7d-… — the export that
 *   exposed the defect. Its own summary line reads
 *
 *       recent_conversation_turns: captured 18 | failed 0 | answered 17
 *
 *   while turns 13 and 14 told the user *"I couldn't complete that change, and
 *   nothing in your model has changed"*. Both `status: 200`, `completed: true`,
 *   `outcome: answered`. The ledger could not say that anything went wrong.
 *
 *   Deployed staging, scenario 95c3dcdc-… , driven 2026-09-14 — supplies the
 *   exact wire blocks CEE ships for a refusal AND for the things that merely
 *   look like one.
 *
 * ⚠ THE PAIRS ARE THE POINT (CLAUDE.md trap 22b). "The ledger now says refused"
 * and "the ledger says refused only where a turn refused" are different
 * results and only the second is correct — and the obvious wrong predicate is
 * WITNESSED conflating them: CEE's own `v5.edit_graph.turn` logged
 * `outcome="rejected" branch="clarify"` for a turn whose text was a question.
 * So every refusal fixture below is paired with a non-refusal one.
 */
import { describe, it, expect } from 'vitest'
import {
  selectRecentConversationTurns,
  type ConversationTurnSourcePayload,
} from '../recentConversationTurns'

const SCENARIO = '9677de7d-0af8-4bee-b2ac-0e63b45aff8e'
const BUFFERED = 'https://cee-staging.onrender.com/proxy/v5/turn'

function rec(
  id: string,
  body: Record<string, unknown>,
  over: Partial<ConversationTurnSourcePayload> = {},
): ConversationTurnSourcePayload {
  return {
    id,
    service: 'CEE',
    endpoint: BUFFERED,
    timestamp: 1789406000000,
    completed: true,
    status: 200,
    request: { body: { scenario_id: SCENARIO, message: 'set churn to 4%' } },
    response: { body },
    ...over,
  }
}

/** The exact wire block CEE's `buildBoundaryBlocks` ships for a refused edit. */
function errorBlock(rejectionCode: string | null) {
  return {
    type: 'error',
    error_code: 'INTERNAL_ERROR',
    severity: 'warn',
    details: {
      source: 'edit_graph',
      ...(rejectionCode === null ? {} : { rejection_code: rejectionCode }),
    },
  }
}

/** Turns 13 and 14 of the 44e349fa export — the two that read `answered`. */
const REFUSAL_TEXT =
  "I couldn't complete that change, and nothing in your model has changed. "
  + 'Try again in a moment, or describe the change a different way.'

const REFUSED = rec('turn-13', {
  assistant_text: REFUSAL_TEXT,
  blocks: [errorBlock('OPERATION_DID_NOT_LAND')],
})

/** Turn 15 — a CLARIFICATION. The user is being asked something, not refused. */
const CLARIFY = rec('turn-15', {
  assistant_text: 'Which option should I update: Raise Price to £54 (Soft Increase) or Hold Price at £49?',
  blocks: [],
})

/** Turn 1 — an ordinary answered turn from the same session. */
const ANSWERED = rec('turn-9', {
  assistant_text: 'Raising price to £59 with the feature release leads in 72% of simulations.',
  blocks: [],
})

describe('a refusal is counted as a refusal, not as an answer', () => {
  it('scores the measured refusal `refused`, carrying the producer’s own cause', () => {
    const r = selectRecentConversationTurns([REFUSED])
    expect(r.turns).toHaveLength(1)
    expect(r.turns[0].outcome).toBe('refused')
    // Identity, not a value predicate: the cause is CEE's code, verbatim.
    expect(r.turns[0].outcome_reason).toBe('OPERATION_DID_NOT_LAND')
    expect(r.refused_count).toBe(1)
    expect(r.answered_count).toBe(0)
    // Still not a transport failure — that distinction is the other half.
    expect(r.failed_count).toBe(0)
  })

  it('reproduces the export’s own shape: refusals present, `failed` still zero', () => {
    // This is the line the 44e349fa export could not print. Before this change
    // the same input gave answered 3 / refused (no such field) / failed 0.
    const r = selectRecentConversationTurns([REFUSED, CLARIFY, ANSWERED])
    expect(r.captured_count).toBe(3)
    expect(r.refused_count).toBe(1)
    expect(r.answered_count).toBe(2)
    expect(r.failed_count).toBe(0)
  })

  it.each([
    ['ORPHAN_NODE', 'delete the outcome node'],
    ['FEWER_THAN_TWO_OPTIONS', 'remove every option'],
  ])('scores the other live-measured rejection code %s as refused', (code) => {
    const r = selectRecentConversationTurns([
      rec('t', { assistant_text: 'I wasn’t able to apply that change.', blocks: [errorBlock(code)] }),
    ])
    expect(r.turns[0].outcome).toBe('refused')
    expect(r.turns[0].outcome_reason).toBe(code)
  })

  it('falls back to the boundary error_code when the producer stated no rejection_code', () => {
    const r = selectRecentConversationTurns([
      rec('t', {
        assistant_text: 'Something went wrong on my side.',
        blocks: [{ type: 'error', error_code: 'UPSTREAM_TIMEOUT', severity: 'error' }],
      }),
    ])
    expect(r.turns[0].outcome).toBe('refused')
    expect(r.turns[0].outcome_reason).toBe('UPSTREAM_TIMEOUT')
  })

  it('finds the failure block wherever it sits among content blocks', () => {
    const r = selectRecentConversationTurns([
      rec('t', {
        assistant_text: REFUSAL_TEXT,
        blocks: [{ type: 'text', content: 'aside' }, errorBlock('ORPHAN_NODE')],
      }),
    ])
    expect(r.turns[0].outcome).toBe('refused')
  })
})

describe('the twins — things that must stay `answered`', () => {
  it.each([
    ['a clarification (measured: blocks [])', CLARIFY],
    ['an ordinary answer (measured: blocks [])', ANSWERED],
    [
      'a held proposal — carries a block, is not a refusal',
      rec('t', {
        assistant_text: "Heads up: that option has no effect values yet. I'm holding these changes.",
        blocks: [{ type: 'held_proposal', proposal_id: 'p1', summary: 's' }],
      }),
    ],
    [
      'a fresh draft (measured: three coaching blocks)',
      rec('t', {
        assistant_text: 'I have built a first model for "Reach £20k MRR Within 12 Months".',
        blocks: [{ type: 'coaching' }, { type: 'coaching' }, { type: 'coaching' }],
      }),
    ],
    [
      'an analysis result + ui_directive (the 44e349fa export’s own last turn)',
      rec('t', {
        assistant_text: 'Ran analysis on your current scenario.',
        blocks: [
          { type: 'analysis_result', summary: 'Ran analysis…', leading_option_id: null },
          { type: 'ui_directive', verb: 'focus', targets: [], source: 'ladder' },
        ],
      }),
    ],
    ['a body with no blocks key at all', rec('t', { assistant_text: 'reply' })],
  ])('does not score %s as refused', (_label, payload) => {
    const r = selectRecentConversationTurns([payload as ConversationTurnSourcePayload])
    expect(r.turns[0].outcome).toBe('answered')
    expect(r.refused_count).toBe(0)
  })
})

describe('a refusal does not outrank the verdicts above it', () => {
  it('a NON-2xx carrying a failure block stays `failed` — no reply was considered', () => {
    const r = selectRecentConversationTurns([
      rec('t', { assistant_text: 'x', blocks: [errorBlock('OPERATION_DID_NOT_LAND')] }, {
        status: 500,
        source: 'upstream_5xx',
      }),
    ])
    expect(r.turns[0].outcome).toBe('failed')
    expect(r.refused_count).toBe(0)
  })

  it('an unsettled request carrying nothing stays `unsettled`', () => {
    const r = selectRecentConversationTurns([
      rec('t', {}, { completed: false, status: undefined, response: undefined }),
    ])
    expect(r.turns[0].outcome).toBe('unsettled')
    expect(r.refused_count).toBe(0)
  })
})
