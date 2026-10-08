/**
 * P02 fix (DL 8 Oct, CHAT-STABLE Codex P1 on #2634): the per-browser pre-mortem worksheet copy belongs to ONE identity.
 * User A's worksheet must never restore for user B in the same browser, on the same Run. Two mechanisms, the ones
 * autosave and snapshots already use (CAN-F2w): the entry carries the identity epoch it was written under and is read
 * back only if `belongsToThisIdentity`, and its prefix is in the identity boundary's sweep.
 */
import { describe, it, beforeEach } from 'vitest'
import assert from 'node:assert/strict'
import elig3 from './premortem-fixtures/premortem-elig3-v2.json'
import { loadPremortemWorksheet, storePremortemWorksheet, type PremortemWorksheetV1 } from '../readPremortemWorksheet'
import { IDENTITY_EPOCH_STORAGE_KEY, sweepUserScopedStorage, USER_SCOPED_STORAGE_PREFIXES } from '../../lib/auth/userScopedKeys'

const W = (elig3 as unknown as { existing_risk: PremortemWorksheetV1 }).existing_risk
const RUN = { scenarioId: W.scenario_id, graphHashAtRun: W.run.graph_hash_at_run, computedAt: W.run.computed_at }
const asIdentity = (epoch: string) => localStorage.setItem(IDENTITY_EPOCH_STORAGE_KEY, epoch)
const keysWithWorksheet = () => Object.keys(localStorage).filter(k => (localStorage.getItem(k) ?? '').includes(W.rows[0].row_id))

beforeEach(() => { localStorage.clear() })

describe('P02 worksheet cache: one identity', () => {
  it('RED: written as A, read as B (same browser, same Run, no sweep: a stale tab) → nothing restores', () => {
    asIdentity('epoch-A')
    storePremortemWorksheet(W)
    asIdentity('epoch-B')
    assert.equal(loadPremortemWorksheet(RUN), null)
  })

  it('CONTROL: written as A, read as A → the same worksheet restores', () => {
    asIdentity('epoch-A')
    storePremortemWorksheet(W)
    asIdentity('epoch-B')
    asIdentity('epoch-A')
    assert.equal(loadPremortemWorksheet(RUN)?.rows[0].row_id, W.rows[0].row_id)
  })

  it('RED: the identity boundary sweep removes the cached worksheet', () => {
    asIdentity('epoch-A')
    storePremortemWorksheet(W)
    assert.equal(keysWithWorksheet().length, 1)
    sweepUserScopedStorage()
    assert.deepEqual(keysWithWorksheet(), [])
    assert.ok((USER_SCOPED_STORAGE_PREFIXES as readonly string[]).includes('olumi-premortem-worksheet:'))
  })

  it('RED: an unstamped entry (as #2634 wrote it) never restores', () => {
    asIdentity('epoch-A')
    storePremortemWorksheet(W)
    const key = keysWithWorksheet()[0]
    localStorage.setItem(key, JSON.stringify(W))
    assert.equal(loadPremortemWorksheet(RUN), null)
  })
})
