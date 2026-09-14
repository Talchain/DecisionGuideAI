/**
 * ⭐⭐ A SESSION THAT UPGRADES MID-FLIGHT KEEPS ITS REASONING TRAIL.
 *
 * The store is keyed by (decision, finding) now; it used to be keyed by the
 * finding alone. `sessionStorage` outlives a deploy, so a reader who is part
 * way through a session when the new bundle arrives holds records under the OLD
 * shape. Two wrong answers were available and both were tempting:
 *
 *   DROP them   → the reader's own trail vanishes on a deploy, silently.
 *   ADOPT them into whatever decision is open → the exact laundering the whole
 *                 change exists to refuse.
 *
 * So each legacy record moves to the key ITS OWN STAMP names. A record minted
 * before the stamp existed carries none, and lands in the `null` bucket —
 * unattributable, claimed by no decision, deleted by nothing.
 *
 * ⚠ THE PERSISTED `version` DELIBERATELY STAYS 1. Bumping it would make every
 * existing session fall through `loadPersisted`'s version guard and lose the
 * trail outright — which is the harm this function exists to prevent. A legacy
 * key is identified by SHAPE (a composite key parses as a two-element JSON
 * array; a bare finding id does not), which needs no version at all.
 */
import { describe, expect, it } from 'vitest'
import { migrateLegacyKeys, recordKey, decisionOfKey } from '../strengthenStore'
import type { RecRecord } from '../strengthenStore'
import type { Recommendation } from '../../../components/results/strengthen/strengthenTypes'

const DECISION_A = 'scenario-a'

const snap = (id: string): Recommendation => ({
  id,
  helpType: 'clarify',
  title: `Title ${id}`,
  signal: 'signal',
  whyNow: 'why',
  tryThis: 'try',
  sourceLine: 'Source: test.',
  action: { kind: 'ai-dialogue', label: 'Go', actionType: 'discuss', prompt: 'm' },
  targetId: null,
  priority: 10,
})

const legacyRecord = (id: string, scenarioId?: string | null): RecRecord => ({
  id,
  status: 'dismissed',
  snapshot: snap(id),
  analysisHash: 'hash-a',
  isStale: false,
  ...(scenarioId === undefined ? {} : { scenarioId }),
  history: [{ at: 1000, event: 'dismissed' }],
})

describe('THE FIXTURES ARE ACTUALLY LEGACY-SHAPED (positive control)', () => {
  /**
   * ⚠ WITHOUT THIS THE FILE IS VACUOUS. If the fixtures were already composite,
   * every assertion below would pass while the migration did nothing — the
   * classic "guard agreeing with itself". This proves the inputs are the shape
   * the migration is for, and that the two shapes are distinguishable.
   */
  it('a bare finding id is NOT readable as a composite key', () => {
    expect(decisionOfKey('strengthen:robustness')).toBeUndefined()
  })

  it('…while a composite key is — the contrast', () => {
    expect(decisionOfKey(recordKey(DECISION_A, 'strengthen:robustness'))).toBe(DECISION_A)
    expect(decisionOfKey(recordKey(null, 'strengthen:robustness'))).toBeNull()
  })

  it('⚠ an unreadable key yields undefined, NEVER null', () => {
    // `null` is a REAL bucket here — the unattributable one. Returning it for a
    // malformed key would file unreadable records into a bucket that renders.
    expect(decisionOfKey('{not json')).toBeUndefined()
    expect(decisionOfKey('["only-one-element"]')).toBeUndefined()
  })
})

describe('a legacy record moves to the key its own stamp names', () => {
  it('⭐ a stamped legacy record is re-keyed under ITS decision, not a current one', () => {
    const out = migrateLegacyKeys({ 'strengthen:robustness': legacyRecord('strengthen:robustness', DECISION_A) }, [
      'strengthen:robustness',
    ])

    expect(Object.keys(out.records)).toEqual([recordKey(DECISION_A, 'strengthen:robustness')])
    expect(out.records[recordKey(DECISION_A, 'strengthen:robustness')].status).toBe('dismissed')
  })

  it('⭐ an UNSTAMPED legacy record lands in the null bucket — honest, not adopted', () => {
    const out = migrateLegacyKeys({ 'strengthen:evidence': legacyRecord('strengthen:evidence') }, [])

    expect(Object.keys(out.records)).toEqual([recordKey(null, 'strengthen:evidence')])
    // Not deleted, and not claimed by any decision.
    expect(out.records[recordKey(null, 'strengthen:evidence')]).toBeTruthy()
  })

  it('priorityOrder is re-mapped with the records it points at', () => {
    // ⚠ THE ORDER IS NOT DECORATION. `selectActive` READS records THROUGH it,
    // so a migrated record whose order entry still holds the old key is a
    // record no surface can reach — present in the store, invisible.
    const out = migrateLegacyKeys(
      {
        'strengthen:a': legacyRecord('strengthen:a', DECISION_A),
        'strengthen:b': legacyRecord('strengthen:b', DECISION_A),
      },
      ['strengthen:a', 'strengthen:b'],
    )

    expect(out.priorityOrder).toEqual([
      recordKey(DECISION_A, 'strengthen:a'),
      recordKey(DECISION_A, 'strengthen:b'),
    ])
    for (const key of out.priorityOrder) expect(out.records[key]).toBeTruthy()
  })
})

describe('it is idempotent, and it does not touch what is already correct', () => {
  it('an already-composite store passes through unchanged', () => {
    const key = recordKey(DECISION_A, 'strengthen:robustness')
    const input = { [key]: legacyRecord('strengthen:robustness', DECISION_A) }
    const out = migrateLegacyKeys(input, [key])

    expect(Object.keys(out.records)).toEqual([key])
    expect(out.priorityOrder).toEqual([key])
  })

  it('⭐ running it twice changes nothing the second time', () => {
    const once = migrateLegacyKeys(
      { 'strengthen:robustness': legacyRecord('strengthen:robustness', DECISION_A) },
      ['strengthen:robustness'],
    )
    const twice = migrateLegacyKeys(once.records, once.priorityOrder)
    expect(twice).toEqual(once)
  })

  it('a MIXED store — one migrated, one not — comes out wholly composite', () => {
    // The reachable shape when a session was written across a deploy boundary.
    const composite = recordKey(DECISION_A, 'strengthen:a')
    const out = migrateLegacyKeys(
      {
        [composite]: legacyRecord('strengthen:a', DECISION_A),
        'strengthen:b': legacyRecord('strengthen:b', DECISION_A),
      },
      [composite, 'strengthen:b'],
    )

    expect(Object.keys(out.records).sort()).toEqual(
      [composite, recordKey(DECISION_A, 'strengthen:b')].sort(),
    )
    for (const key of Object.keys(out.records)) expect(decisionOfKey(key)).toBe(DECISION_A)
  })
})
