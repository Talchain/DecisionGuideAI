/**
 * ⭐⭐ ONE CHIP, ONE PAIRING: A COMPARATIVE ACTION MUST ASK A COMPARATIVE QUESTION.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `DecisionNode`'s "Challenge this result" chip carried the typed action
 * `what_would_flip` — which asks what would change the ORDER of the options —
 * while the sentence it actually sent read:
 *
 *     "What assumptions would need to change for a different option to be
 *      most likely to hit my goal?"
 *
 * That fuses two questions with two different answers. **An option can rank
 * first and still be unlikely to reach the goal, and the goal probability can
 * move without any option changing place.**
 *
 * ⚠ IT REACHED THE USER AS A CHAT MESSAGE, NOT A BADGE, which is why every
 * repair to the visible bar missed it.
 *
 * ── ⚠⚠ THIS FILE'S FIRST VERSION HAD TWO DEFECTS OF ITS OWN, BOTH CAUGHT IN
 *    REVIEW, AND BOTH ARE THE POINT ───────────────────────────────────────────
 *
 * **It banned the shape on EVERY chip.** But a goal-attainment question is
 * perfectly legitimate when the ACTION is about the goal — `GoalNode` rightly
 * asks *"Why is the probability of reaching my goal target so low?"*. The
 * defect was never "this phrasing exists"; it was **this phrasing under a
 * COMPARATIVE action**. A ban wide enough to catch the second would eventually
 * forbid the first, and a guard that reds on correct work gets deleted, taking
 * the real property with it.
 *
 * **And its comparative assertion could pass without the fixed chip existing.**
 * It read `messages.some(m => /compar/i.test(m))` over the whole file — and
 * `decision_compare_options` sends *"Compare the options side by side"*. So the
 * assertion was satisfied by an unrelated sibling: a value predicate another
 * object satisfies, which is the binding this repo bans and which I had quoted
 * twice the same night before writing it.
 *
 * Both are fixed by binding to ONE chip BY ID and checking its action and its
 * message TOGETHER — the pairing is the property, and neither half alone is.
 *
 * ── ⚠ AND A CLAIM THIS HEADER USED TO MAKE, WITHDRAWN ────────────────────────
 * It said a `NodeChip`'s `message` *"can only be tested in source"* because it
 * is a prop rather than DOM text. **That is false**: the chip dispatches through
 * `_dispatchAction` / `_sendMessage`, both mockable, so a click test can observe
 * the emitted payload. A source check is chosen here because the change is
 * copy-only and the pairing lives in one JSX attribute set — not because
 * runtime observation is impossible.
 *
 * ⚠ SCOPE: `DecisionNode.tsx`, the `decision_challenge_result` chip, comments
 * stripped. It says nothing about any other chip, and deliberately so.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const DECISION_NODE = path.resolve(__dirname, '../DecisionNode.tsx')
const CHIP_ID = 'decision_challenge_result'

/** The one chip's JSX, by id — never by position or by a phrase a sibling shares. */
function challengeChip(): string {
  const src = stripComments(readFileSync(DECISION_NODE, 'utf8'), 'DecisionNode.tsx')
  const match = src.match(new RegExp(`<NodeChip[^>]*chipId="${CHIP_ID}"[^>]*/>`, 's'))
  // PRECONDITION PINNED IN-TEST: a matcher that found nothing agrees with every
  // other matcher that found nothing (trap 13).
  expect(match, `no <NodeChip chipId="${CHIP_ID}"> found — the assertions below are vacuous`).not.toBeNull()
  return match![0]
}

const messageOf = (chip: string) => chip.match(/message="([^"]+)"/)?.[1] ?? ''
const actionOf = (chip: string) => chip.match(/actionType="([^"]+)"/)?.[1] ?? ''

/**
 * ⚠ A CORPUS, NAMED AS ONE. "Does this sentence import a goal-attainment
 * premise?" is not derivable, so this is a hand-written list of the shapes that
 * do. It is applied ONLY to a chip whose action is comparative — the same
 * phrasing under a goal action is legitimate and must stay allowed.
 */
const ATTAINMENT_PREMISE = [
  /most likely to (hit|reach|meet)/i,
  /likelihood of (hitting|reaching|meeting)/i,
  /chance of (hitting|reaching|meeting)/i,
  /probability of (hitting|reaching|meeting)/i,
]

describe('the comparative chip asks a comparative question', () => {
  it('pairs the what_would_flip route with a question about the comparison', () => {
    const chip = challengeChip()
    // BOTH HALVES, TOGETHER. The route alone was always right; the sentence
    // alone could be comparative on a chip that does something else entirely.
    expect(actionOf(chip), 'the typed route changed — this guard is about the pairing').toBe('what_would_flip')
    expect(messageOf(chip)).toMatch(/compar/i)
  })

  it('carries no goal-attainment premise', () => {
    const message = messageOf(challengeChip())
    for (const banned of ATTAINMENT_PREMISE) {
      expect(
        banned.test(message),
        `"${message}" matches ${banned}. A comparative action asks what changes the ORDER ` +
          'of the options; an option can rank first and still be unlikely to reach the goal.',
      ).toBe(false)
    }
  })

  it('CONTRAST — the corpus catches the removed sentence AND leaves a real goal question alone', () => {
    // Without the first half the guard above passes on a corpus matching
    // nothing. Without the second it would licence a ban wide enough to forbid
    // `GoalNode`'s legitimate question, which is how a guard gets deleted.
    const removed = 'What assumptions would need to change for a different option to be most likely to hit my goal?'
    expect(ATTAINMENT_PREMISE.some(p => p.test(removed)), 'the corpus misses the sentence it replaced').toBe(true)

    const legitimate = 'Is my current goal target realistic given the factors in my model?'
    expect(
      ATTAINMENT_PREMISE.some(p => p.test(legitimate)),
      'the corpus would ban a goal question that is correct under a goal action',
    ).toBe(false)
  })
})
