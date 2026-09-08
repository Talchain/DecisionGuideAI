/**
 * A message sent to Olumi never quotes a fallback as if it were the user's own
 * words, and a count line never states a zero it is about to contradict.
 *
 * ── DEFECT 1: A GOAL LITERALLY NAMED "not set" ─────────────────────────────
 * `DISCUSS_GOAL` composed:
 *
 *     Help me understand my goal 'not set' and whether the target of not set
 *     is appropriate
 *
 * Quoting a fallback inside single quotes tells Olumi the goal IS the string
 * "not set", which is a different conversation from the one the user asked for.
 * The unquoted second half is nearly as bad: "the target of not set". This is
 * the panel's own rule about labels applied to what we SEND, not just to what
 * we draw — the message is user-facing the moment it lands in the chat.
 *
 * ── DEFECT 2: "0 items" ABOVE "Nothing needs attention here." ──────────────
 * The queue header prints its count unconditionally, so the empty state reads
 * the same fact twice in two registers, one of them a bare zero.
 */
import { describe, expect, it } from 'vitest'
import { GROUP_ACTIONS } from '../groupActions'

const goalAction = () => {
  const action = Object.values(GROUP_ACTIONS)
    .flat()
    .find((a) => a.id === 'goal-discuss')
  expect(action, 'the goal discuss action must exist').toBeTruthy()
  return action!
}

describe('a question to Olumi states what is missing, rather than quoting it', () => {
  it('CONTROL: a fully-stated goal is quoted verbatim', () => {
    // Without this, every assertion below could pass against a message that had
    // stopped naming the goal at all.
    const msg = goalAction().message({
      goalLabel: 'Hit £4m ARR before the Series B window closes',
      goalTarget: '£4m',
    } as never)
    expect(msg).toContain('Hit £4m ARR before the Series B window closes')
    expect(msg).toContain('£4m')
  })

  it('an unset goal is never quoted as a name', () => {
    const msg = goalAction().message({ goalLabel: null, goalTarget: null } as never)
    expect(msg, `sent to Olumi: "${msg}"`).not.toMatch(/'not set'/)
    expect(msg, `sent to Olumi: "${msg}"`).not.toMatch(/target of not set/)
  })

  it('DISCRIMINATOR: a goal with NO target still names the goal', () => {
    // The mixed case, and the one a blanket rewrite would lose: the user has
    // written their goal and not set a number. The message must still carry the
    // goal, or the fix has thrown away the context it was protecting.
    const msg = goalAction().message({ goalLabel: 'Replace the CDP', goalTarget: null } as never)
    expect(msg).toContain('Replace the CDP')
    expect(msg).not.toMatch(/'not set'|of not set/)
  })

  it('the message is still a question about the goal', () => {
    const msg = goalAction().message({ goalLabel: null, goalTarget: null } as never)
    expect(msg.length, 'an empty message sends nothing').toBeGreaterThan(20)
    expect(msg.toLowerCase()).toContain('goal')
  })
})
