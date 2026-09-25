/**
 * ⛔ A PROVEN-NO-WRITE CONFLICT CARRIES ITS CATEGORY, SO NO SURFACE HAS TO GUESS
 * WHY IT WAS REFUSED.
 *
 * CEE #1868 answers a turn-fence refusal with a 409 `GRAPH_DIVERGED` whose
 * `details.conflict_category` is `turn_fence_stopped` or `turn_fence_superseded`
 * ("nothing of this edit landed"). #1998 put both in
 * `PROVEN_NO_WRITE_CONFLICT_CATEGORIES`, so `settleSystemEventSend` settles them
 * `refused` / `conflict` on EVERY carrier — the same settlement a moved base
 * gets. Every consumer that turned `conflict` into "the model moved on" would
 * then say that about a turn the user STOPPED. The category is the one fact
 * that tells the two apart, and the settlement dropped it.
 */
import { describe, it, expect } from 'vitest'
import {
  settleSystemEventSend,
  type SystemEventSendSettlement,
  type SystemEventSendSettlementDetail,
} from '../settleSystemEventSend'
import { SystemEventSendError } from '../useConversation'
import { fenceRefusalCopyForCategory } from '../../../v5/failureTypeRetryability'

function settle(err: unknown): Promise<[SystemEventSendSettlement, SystemEventSendSettlementDetail]> {
  return new Promise((resolve) => {
    settleSystemEventSend(Promise.reject(err), (s, d) => resolve([s, d]))
  })
}

const FENCE_STOPPED_COPY =
  "That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it."

describe('a refused conflict names its category', () => {
  it('⭐ turn_fence_stopped → refused / conflict, carrying the category, so the fence sentence can be found', async () => {
    const [s, d] = await settle(new SystemEventSendError('server', { conflictCategory: 'turn_fence_stopped' }))
    expect(s).toBe('refused')
    expect(d.refusal).toBe('conflict')
    expect(d.conflictCategory).toBe('turn_fence_stopped')
    expect(fenceRefusalCopyForCategory(d.conflictCategory)).toBe(FENCE_STOPPED_COPY)
  })

  it('turn_fence_superseded → carried too', async () => {
    const [, d] = await settle(new SystemEventSendError('server', { conflictCategory: 'turn_fence_superseded' }))
    expect(d.conflictCategory).toBe('turn_fence_superseded')
  })

  it('CONTRAST — BASE_HASH_DIVERGED is the same settlement, and its category is no fence (null copy)', async () => {
    const [s, d] = await settle(new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' }))
    expect(s).toBe('refused')
    expect(d.refusal).toBe('conflict')
    expect(d.conflictCategory).toBe('BASE_HASH_DIVERGED')
    expect(fenceRefusalCopyForCategory(d.conflictCategory)).toBeNull()
  })

  it('CONTRAST — a declined refusal and an unverified failure carry no conflict category', async () => {
    const [s1, d1] = await settle(
      new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION', reason: 'system_event_refused_no_write' }),
    )
    expect(s1).toBe('refused')
    expect(d1.refusal).toBe('declined')
    expect(d1.conflictCategory).toBeUndefined()
    const [s2, d2] = await settle(new SystemEventSendError('server', { conflictCategory: 'not_a_known_category' }))
    expect(s2).toBe('unverified')
    expect(d2.conflictCategory).toBeUndefined()
  })
})
