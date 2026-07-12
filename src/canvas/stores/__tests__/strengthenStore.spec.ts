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
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', message: 'm' },
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
