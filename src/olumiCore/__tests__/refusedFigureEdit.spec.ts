/**
 * The card's word for a figure core kept whose follow-up read failed: saved, reload to see it, while a timeout (nobody knows whether
 * core saved it) is still "could not confirm".
 *
 * The six lane rows this file held drove a figure edit through useConversation's sendSystemEvent to the /bff lane turn. The View lane
 * sends no system events (lane audit 43, DL ruling 3 Nov) and has no figure-edit door until slice S8 (writes.edit to core's /edit),
 * whose brief carries all six as fail-first rows: a refusal core states takes the figure back in core's words; a timeout keeps it
 * and says it could not confirm; a lost answer keeps it; a refusal for something core cannot honour takes it back; a figure over a
 * range is taken back naming the range; a kept figure whose read failed stays and is said to be saved.
 */
import { describe, it, expect } from 'vitest'
import { valueCommitSettlementWord, VALUE_COMMIT_SETTLEMENT_COPY } from '../../canvas/conversation/valueCommitSettlement'

describe('a figure core kept', () => {
  it('the card says the same: saved, reload to see it', () => {
    const word = valueCommitSettlementWord('unverified', 20, 30, () => 30, { kept: true })
    expect(word).toBe('kept_unread')
    expect(VALUE_COMMIT_SETTLEMENT_COPY[word!].message).toBe('Saved. Olumi could not show the result just now: reload to see it.')
    // a timeout (nobody knows whether core saved it) is still "could not confirm"
    expect(valueCommitSettlementWord('unverified', 20, 30, () => 30, {})).toBe('unconfirmed')
  })
})
