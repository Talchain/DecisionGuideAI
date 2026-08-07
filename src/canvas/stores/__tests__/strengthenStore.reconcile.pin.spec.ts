/**
 * strengthenStore.reconcile — OBSERVED-BEHAVIOUR PIN (test-only, no fix).
 *
 * Stage 1 of the UI-SEM-085 guidance-rank work does not change reconcile. This
 * spec pins what reconcile ACTUALLY does today, before anything later comes to
 * rely on it — specifically the two hash-driven transitions that a reader of
 * the module doc could easily assume are narrower than they are:
 *
 *   1. `:114` — a NEW resultsHash reopens EVERY addressed/dismissed record
 *      whose trigger fires again. The reopen is driven by the hash changing,
 *      not by any evidence the underlying signal actually got worse.
 *   2. `:133-148` — a record in 'in_progress'/'reopened' whose trigger stops
 *      firing under a new hash is AUTO-ADDRESSED and credited to "resolved by
 *      a model change". Nothing verifies the model change is what resolved it;
 *      the trigger merely stopped firing.
 *
 * These are pinned as OBSERVATIONS, not endorsements. If a later change makes
 * either transition narrower or better-evidenced, these tests SHOULD fail and
 * be rewritten deliberately.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useStrengthenStore } from '../strengthenStore'
import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'

const rec = (id: string, priority = 10): Recommendation => ({
  id,
  helpType: 'clarify',
  title: `Title ${id}`,
  signal: 'signal',
  whyNow: 'why now',
  tryThis: 'try this',
  sourceLine: 'Source: test.',
  action: { kind: 'ai-dialogue', label: 'Work through', actionType: 'discuss', prompt: 'p' },
  targetId: null,
  priority,
})

describe('strengthenStore.reconcile — observed behaviour pin', () => {
  beforeEach(() => {
    useStrengthenStore.getState()._reset()
  })

  it('PIN (:114): a NEW resultsHash reopens an ADDRESSED record whose trigger fires again', () => {
    const store = useStrengthenStore.getState()
    store.reconcile([rec('r1')], 'hash-A')
    store.markAddressed('r1', 'user fixed it')
    expect(useStrengthenStore.getState().records.r1.status).toBe('addressed')

    // Same hash: never nags.
    useStrengthenStore.getState().reconcile([rec('r1')], 'hash-A')
    expect(useStrengthenStore.getState().records.r1.status).toBe('addressed')

    // New hash: reopened, with the recorded reason.
    useStrengthenStore.getState().reconcile([rec('r1')], 'hash-B')
    const after = useStrengthenStore.getState().records.r1
    expect(after.status).toBe('reopened')
    expect(after.history.at(-1)).toMatchObject({
      event: 'reopened',
      reopenReason: 'the signal returned after the model changed',
    })
  })

  it('PIN (:114): a NEW resultsHash also reopens a DISMISSED record', () => {
    const store = useStrengthenStore.getState()
    store.reconcile([rec('r1')], 'hash-A')
    store.dismiss('r1')
    expect(useStrengthenStore.getState().records.r1.status).toBe('dismissed')

    useStrengthenStore.getState().reconcile([rec('r1')], 'hash-B')
    expect(useStrengthenStore.getState().records.r1.status).toBe('reopened')
  })

  it('PIN (:133-148): an IN_PROGRESS record that stops firing is auto-addressed as "resolved by a model change"', () => {
    const store = useStrengthenStore.getState()
    store.reconcile([rec('r1')], 'hash-A')
    store.markInProgress('r1')
    expect(useStrengthenStore.getState().records.r1.status).toBe('in_progress')

    // r1 no longer fires under a NEW hash.
    useStrengthenStore.getState().reconcile([rec('r2')], 'hash-B')
    const after = useStrengthenStore.getState().records.r1
    expect(after.status).toBe('addressed')
    expect(after.history.at(-1)).toMatchObject({
      event: 'auto_addressed',
      whatChanged: 'resolved by a model change',
    })
  })

  it('PIN (:133-148): a REOPENED record that stops firing is likewise auto-addressed', () => {
    const store = useStrengthenStore.getState()
    store.reconcile([rec('r1')], 'hash-A')
    store.markAddressed('r1')
    useStrengthenStore.getState().reconcile([rec('r1')], 'hash-B')
    expect(useStrengthenStore.getState().records.r1.status).toBe('reopened')

    useStrengthenStore.getState().reconcile([rec('r2')], 'hash-C')
    expect(useStrengthenStore.getState().records.r1.status).toBe('addressed')
  })

  it('PIN: a RECOMMENDED record that stops firing is retained, not auto-addressed or deleted', () => {
    const store = useStrengthenStore.getState()
    store.reconcile([rec('r1')], 'hash-A')
    useStrengthenStore.getState().reconcile([rec('r2')], 'hash-B')
    const after = useStrengthenStore.getState().records.r1
    expect(after).toBeDefined()
    expect(after.status).toBe('recommended')
    expect(useStrengthenStore.getState().priorityOrder).not.toContain('r1')
  })

  it('PIN: priorityOrder is ASCENDING by priority (lower number sorts first)', () => {
    useStrengthenStore.getState().reconcile([rec('low', 200), rec('high', 0)], 'hash-A')
    expect(useStrengthenStore.getState().priorityOrder).toEqual(['high', 'low'])
  })
})
