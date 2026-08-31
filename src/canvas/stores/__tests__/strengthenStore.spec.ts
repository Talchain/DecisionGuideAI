/**
 * Wave 3a lifecycle store — RED contracts (brief §8.5 lifecycle + §8.9
 * history; plan §3 visible-but-stale ownership).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { selectActive, selectHistory, useStrengthenStore } from '../strengthenStore'
import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'

const rec = (id: string, priority = 10): Recommendation => ({
  id,
  helpType: 'clarify',
  title: `Title ${id}`,
  signal: 'signal',
  whyNow: 'why',
  tryThis: 'try',
  sourceLine: 'Source: test.',
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', prompt: 'm' },
  targetId: null,
  priority,
})

const s = () => useStrengthenStore.getState()

beforeEach(() => {
  s()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
})

describe('strengthenStore — reconcile-by-id (§8.5)', () => {
  it('new ids insert as recommended, in engine priority order', () => {
    s().reconcile([rec('a', 2), rec('b', 1)], 'h1', 1000)
    const active = selectActive(s())
    expect(active.map((r) => r.id)).toEqual(['b', 'a'])
    expect(active.every((r) => r.status === 'recommended')).toBe(true)
    expect(active[0].analysisHash).toBe('h1')
  })

  it('a new analysis response NEVER resets progress: status and history survive', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    s().reconcile([rec('a')], 'h2', 2000)
    const a = s().records['a']
    expect(a.status).toBe('in_progress')
    expect(a.analysisHash).toBe('h2') // snapshot re-grounded
    expect(a.isStale).toBe(false)
    expect(a.history.some((e) => e.event === 'in_progress')).toBe(true)
  })

  it('an addressed id whose trigger re-fires under a NEW hash reopens WITH a reason', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markAddressed('a', 'set a range', 1001)
    s().reconcile([rec('a')], 'h2', 2000)
    const a = s().records['a']
    expect(a.status).toBe('reopened')
    const reopen = a.history.find((e) => e.event === 'reopened')
    expect(reopen?.reopenReason).toBeTruthy()
  })

  it('a dismissed id stays dismissed under the SAME hash, reopens only under a new one', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dismiss('a', 1001)
    s().reconcile([rec('a')], 'h1', 1002) // same analysis — no nagging
    expect(s().records['a'].status).toBe('dismissed')
    s().reconcile([rec('a')], 'h2', 2000) // the model changed
    expect(s().records['a'].status).toBe('reopened')
  })

  it('in_progress ids whose trigger no longer fires are auto-addressed with an explanation', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    s().reconcile([], 'h2', 2000)
    const a = s().records['a']
    expect(a.status).toBe('addressed')
    const evt = a.history.find((e) => e.event === 'auto_addressed')
    expect(evt?.whatChanged).toBeTruthy()
  })

  it('recommended ids that stop firing drop from the active list but the record is retained', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().reconcile([], 'h2', 2000)
    expect(selectActive(s()).map((r) => r.id)).not.toContain('a')
    expect(s().records['a']).toBeDefined() // never silently deleted
  })
})

describe('strengthenStore — visible-but-stale (plan §3)', () => {
  it('markAllStale labels active records without evicting them (stale-but-shown pin)', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    s().markAllStale()
    const active = selectActive(s())
    expect(active.map((r) => r.id)).toContain('a') // still rendered
    expect(s().records['a'].isStale).toBe(true) // but labelled
    // The snapshot still carries the display copy even if the source is gone.
    expect(s().records['a'].snapshot.title).toBe('Title a')
  })
})

describe('strengthenStore — history (§8.9)', () => {
  it('dismissed means not relevant: excluded from active, present in history, never deleted', () => {
    s().reconcile([rec('a'), rec('b')], 'h1', 1000)
    s().dismiss('a', 1001)
    expect(selectActive(s()).map((r) => r.id)).toEqual(['b'])
    expect(selectHistory(s()).map((r) => r.id)).toContain('a')
  })

  it('addressed moves to history with what changed', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markAddressed('a', 'gave the factor a range', 1001)
    const hist = selectHistory(s())
    expect(hist.map((r) => r.id)).toContain('a')
    expect(s().records['a'].history.find((e) => e.event === 'addressed')?.whatChanged).toBe(
      'gave the factor a range',
    )
  })
})

describe('strengthenStore — undo dismiss (restoreDismissed)', () => {
  it('restores a dismissed rec to recommended and back into the active list', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dismiss('a', 1001)
    expect(selectActive(s()).map((r) => r.id)).not.toContain('a')
    s().restoreDismissed('a', 1002)
    expect(s().records['a'].status).toBe('recommended')
    expect(selectActive(s()).map((r) => r.id)).toContain('a')
    expect(s().records['a'].history.some((e) => e.event === 'restored')).toBe(true)
  })

  it('restores the status held BEFORE dismissal (in_progress survives the round trip)', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    s().dismiss('a', 1002)
    s().restoreDismissed('a', 1003)
    expect(s().records['a'].status).toBe('in_progress')
  })

  it('is a no-op on non-dismissed records', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markAddressed('a', 'done', 1001)
    s().restoreDismissed('a', 1002)
    expect(s().records['a'].status).toBe('addressed')
    expect(s().records['a'].history.some((e) => e.event === 'restored')).toBe(false)
  })

  it('a second dismiss/restore cycle still lands on the pre-dismiss status', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    s().dismiss('a', 1002)
    s().restoreDismissed('a', 1003)
    s().dismiss('a', 1004)
    s().restoreDismissed('a', 1005)
    expect(s().records['a'].status).toBe('in_progress')
  })
})

describe('strengthenStore — session persistence', () => {
  it('round-trips records via sessionStorage with a version key', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().markInProgress('a', 1001)
    const raw = sessionStorage.getItem('strengthen.lifecycle.v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.version).toBe(1)
    expect(parsed.records['a'].status).toBe('in_progress')
  })
})

/**
 * ⭐⭐ DISAGREEMENT. The product's only answer to "I think this is wrong" was
 * "Not relevant", which RETIRES the card — a reasoning act converted into a
 * disappearance, with the reason unrecorded. `dispute` records the position
 * and leaves the finding exactly where it was.
 */
describe('strengthenStore — dispute (a position, not a disposal)', () => {
  it('records the reason on the history and leaves the finding ACTIVE', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dispute('a', 'The lead time assumption is wrong for our supplier.', 1002)

    const a = s().records['a']
    const event = a.history.find((e) => e.event === 'disputed')
    expect(event?.disputeReason).toBe('The lead time assumption is wrong for our supplier.')

    /**
     * ⚠ THE LOAD-BEARING ASSERTION, AND THE REASON THIS IS NOT A `RecStatus`.
     * `selectActive` filters on an explicit triple of statuses. Had a dispute
     * been modelled as a status, the record would have dropped out of it and
     * disagreeing would have made the card VANISH — the exact defect being
     * fixed, reintroduced by the fix. Bound by IDENTITY, not by count.
     */
    expect(a.status).toBe('recommended')
    expect(selectActive(s()).map((r) => r.id)).toContain('a')
    expect(selectHistory(s()).map((r) => r.id)).not.toContain('a')
  })

  it('can still be worked through or set aside AFTER being disputed', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dispute('a', 'Wrong for us.', 1002)
    s().dismiss('a', 1003)

    const a = s().records['a']
    expect(a.status).toBe('dismissed')
    // Both acts survive: the objection is not erased by the later disposal.
    expect(a.history.map((e) => e.event)).toEqual(['recommended', 'disputed', 'dismissed'])
    expect(a.history.find((e) => e.event === 'disputed')?.disputeReason).toBe('Wrong for us.')
  })

  it('a later objection supersedes an earlier one without erasing it', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dispute('a', 'First thought.', 1002)
    s().dispute('a', 'What I actually mean.', 1003)

    const events = s().records['a'].history.filter((e) => e.event === 'disputed')
    expect(events.map((e) => e.disputeReason)).toEqual(['First thought.', 'What I actually mean.'])
  })

  /**
   * ⚠ THE OPPOSITE DIRECTION. A recorded disagreement with no stated ground is
   * the same silence in a different costume, and it would render an empty
   * quote block on the card.
   */
  it('is a NO-OP on an empty or whitespace-only reason, and on an unknown id', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dispute('a', '   ', 1002)
    expect(s().records['a'].history.some((e) => e.event === 'disputed')).toBe(false)

    s().dispute('never-seen', 'anything', 1003)
    expect(s().records['never-seen']).toBeUndefined()
  })

  it('survives a new analysis, like every other lifecycle fact', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dispute('a', 'Still disagree.', 1002)
    s().reconcile([rec('a')], 'h2', 2000)
    expect(s().records['a'].history.find((e) => e.event === 'disputed')?.disputeReason).toBe(
      'Still disagree.',
    )
  })
})

/**
 * ⭐⭐ `seedIfAbsent` — measured on the deployed build `fdeb08d2`.
 *
 * `reconcile` is called from ONE place, `StrengthenContainer`, which mounts only
 * on the old Analysis tab. Analysis (New) is deliberately read-only. So a live
 * run rendered six findings while the store held four, from an earlier run seen
 * on the other tab — and every control gated on "does the store hold this id"
 * appeared on some cards and not others, for a reason invisible to the reader.
 */
describe('strengthenStore — seedIfAbsent (a record for the row the user just acted on)', () => {
  it('creates a recommended record, stamped with the run it was grounded in', () => {
    s().seedIfAbsent(rec('a'), 'v5:hash', 1000)
    const a = s().records['a']
    expect(a.status).toBe('recommended')
    expect(a.analysisHash).toBe('v5:hash')
    expect(a.isStale).toBe(false)
    expect(a.history).toEqual([{ at: 1000, event: 'recommended' }])
    expect(selectActive(s()).map((r) => r.id)).toEqual(['a'])
  })

  /**
   * ⚠ THE LOAD-BEARING DIRECTION. `reconcile` owns bulk lifecycle state; if a
   * seed could overwrite it, then dismissing a finding and acting on it again
   * would resurrect it, and every user action would quietly erase its own
   * history. Bound to the surviving status and history, not to a call count.
   */
  it('is a NO-OP when a record already exists, whatever its status', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dismiss('a', 1001)
    s().seedIfAbsent(rec('a'), 'v5:different', 1002)

    const a = s().records['a']
    expect(a.status).toBe('dismissed')
    expect(a.analysisHash).toBe('h1')
    expect(a.history.map((e) => e.event)).toEqual(['recommended', 'dismissed'])
  })

  it('appends to priorityOrder rather than asserting a rank it does not know', () => {
    s().reconcile([rec('a', 1), rec('b', 2)], 'h1', 1000)
    s().seedIfAbsent(rec('z'), 'h1', 1001)
    expect(s().priorityOrder).toEqual(['a', 'b', 'z'])
    // And seeding twice must not duplicate the entry.
    s().seedIfAbsent(rec('z'), 'h1', 1002)
    expect(s().priorityOrder).toEqual(['a', 'b', 'z'])
  })

  it('lets a seeded record then be disputed and dismissed like any other', () => {
    s().seedIfAbsent(rec('a'), 'v5:hash', 1000)
    s().dispute('a', 'Not true for us.', 1001)
    expect(s().records['a'].history.find((e) => e.event === 'disputed')?.disputeReason).toBe(
      'Not true for us.',
    )
    expect(s().records['a'].status).toBe('recommended')
  })
})

/**
 * ⚠⚠ RESTORING MUST NOT DELETE THE FINDING FROM EVERY SURFACE.
 *
 * `reconcile` REBUILDS `priorityOrder` from the firing set alone, so a record
 * that stops firing is dropped from that array while its record survives.
 * `selectActive` maps over `priorityOrder`; `selectHistory` filters on
 * dismissed|addressed. So restoring such a record used to remove it from the
 * trail AND leave it invisible in the active list — present in the store,
 * reachable by nobody. Found by an audit of the trail's own Restore control.
 */
describe('strengthenStore — restore puts the finding back where it can be seen', () => {
  it('re-enters priorityOrder when reconcile has dropped the id', () => {
    s().reconcile([rec('a'), rec('b')], 'h1', 1000)
    s().dismiss('a', 1001)
    // 'a' no longer fires, so reconcile rebuilds the order without it.
    s().reconcile([rec('b')], 'h2', 2000)
    expect(s().priorityOrder).not.toContain('a')

    s().restoreDismissed('a', 2001)

    // Bound to REACHABILITY, not to the array — that is the property at stake.
    expect(selectActive(s()).map((r) => r.id)).toContain('a')
    expect(selectHistory(s()).map((r) => r.id)).not.toContain('a')
  })

  it('does not duplicate the id when it is already in the order', () => {
    s().reconcile([rec('a')], 'h1', 1000)
    s().dismiss('a', 1001)
    s().restoreDismissed('a', 1002)
    expect(s().priorityOrder.filter((id) => id === 'a')).toHaveLength(1)
  })
})
