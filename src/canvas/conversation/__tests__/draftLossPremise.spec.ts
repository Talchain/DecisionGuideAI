/**
 * ROADMAP 2.719 — the F1-branch premise, rewritten from the fence's truth.
 *
 * The F1 keep-the-preview branch (useConversation.ts) justified itself by
 * PR #751: "the server turn runs to completion and commits" on disconnect.
 * The turn fence INVERTED that premise on precisely the preempt path — a new
 * send claims a higher generation and the server REFUSED the draft's commit
 * (fresh-journey P0, diagnosis §2 R2). CEE's 2.709 fix re-prices the fence
 * (a first draft now commits through a mid-draft claim) and adds the
 * server-side draft-loss notice for the residual failures — so the CLIENT
 * premise is now: the commit usually lands, the client cannot confirm it on
 * the socket it just aborted, and a loss is surfaced by the SERVER on the
 * scenario's next turn. This suite pins that the code and the copy state
 * THAT premise, not #751's.
 *
 * Source-level where it must be (a comment's premise is not observable at
 * runtime); copy-level for the user-facing sentence. narrationHonesty
 * governs the copy's vocabulary automatically via the *_NOTICE manifest.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  STOPPED_DRAFT_NOTICE,
  UNSETTLED_DRAFT_NOTICE,
} from '../../components/DraftLoadingAnimation'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const USE_CONVERSATION = path.join(HERE, '..', 'useConversation.ts')

describe('2.719 — the stopped-draft notice states the NEW premise', () => {
  it('tells the user save-state is unconfirmed, and that a loss will be surfaced in the conversation', () => {
    // Save-uncertainty: the client aborted the socket the receipt would have
    // arrived on, so asserting either "saved" or "not saved" would be a guess.
    expect(STOPPED_DRAFT_NOTICE).toMatch(/whether (this|your) draft saved/i)
    // The receipt channel that does NOT depend on that socket: CEE's 2.709
    // invariant-6 notice, carried in the next reply on this conversation.
    expect(STOPPED_DRAFT_NOTICE).toMatch(/next reply/i)
    // The retry affordance's promise is unchanged.
    expect(STOPPED_DRAFT_NOTICE).toMatch(/start a new draft/i)
  })

  it('does not assert the old #751 certainty ("still here" as a durability claim) without the save caveat', () => {
    // The pre-2.719 copy said "The structure is still here" with no word
    // about persistence — true of the canvas, read as true of the server.
    // Any wording keeping that sentence must sit beside the save caveat
    // (asserted above); the naked form is what this pin forbids.
    const naked = /structure is still here — start a new draft/i
    expect(naked.test(STOPPED_DRAFT_NOTICE)).toBe(false)
  })

  it('the UNSETTLED notice (fallback-decline path) keeps its committed-model premise — CEE itself verified the commit by declining to re-draft', () => {
    expect(UNSETTLED_DRAFT_NOTICE).toMatch(/not final/i)
  })
})

describe('2.719 — the F1 branch comment argues from the fence, not from #751', () => {
  const source = readFileSync(USE_CONVERSATION, 'utf8')
  // ⚠ NORMALISED before matching — comment-marker + whitespace collapse — so a
  // LINE-WRAPPED revival of the stale sentence cannot slip the absence pin.
  // Proven necessary by mutation: the raw-text form of this assertion
  // SURVIVED a mutant that reinserted the sentence wrapped across two
  // comment lines (the exact shape a real edit would take at this indent).
  const normalised = source.replace(/^\s*\/\/\s?/gm, '').replace(/\s+/g, ' ')

  it('the stale #751 commit-certainty justification is gone from the abort branch', () => {
    // The exact claims the diagnosis flagged as premise rot (R2/§6.8):
    expect(normalised).not.toContain(
      'Per #751 the server turn runs to completion and commits',
    )
    expect(normalised).not.toContain('per #751 the turn continues and commits')
    // POSITIVE CONTROL (trap 13): the normaliser CAN see a wrapped revival.
    const wrapped = '      //   · anchor. Per #751 the\n      //     server turn runs to completion and commits at ~61 s.'
    const wrappedNormalised = wrapped.replace(/^\s*\/\/\s?/gm, '').replace(/\s+/g, ' ')
    expect(wrappedNormalised).toContain('Per #751 the server turn runs to completion and commits')
  })

  it('the replacement premise names the fence and the server-side loss notice', () => {
    // 2.709/2.719 anchor: the comment must argue from the CURRENT server
    // behaviour — first-write exemption + next-turn loss notice — so the
    // next reader prices the trade correctly.
    expect(source).toMatch(/first-write exemption/i)
    expect(source).toMatch(/draft[- ]loss notice/i)
  })
})
