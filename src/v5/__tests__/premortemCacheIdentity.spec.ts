/**
 * P02 fix (DL 8 Oct, CHAT-STABLE Codex P1 on #2634): the per-browser pre-mortem worksheet copy belongs to ONE identity.
 * User A's worksheet must never restore for user B in the same browser, on the same Run. The mechanisms autosave and
 * snapshots already use (CAN-F2w): the entry carries the identity epoch it was written under and is read back only if
 * `belongsToThisIdentity`; its prefix is in the identity boundary's sweep; and a tab never writes under an identity it
 * did not boot under (a late response to A's request, landing after B signed in elsewhere: Codex r1 P1 on #2652).
 * Each row imports the module fresh, so the tab "boots" under the identity the row sets first.
 */
import { describe, it, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import elig3 from './premortem-fixtures/premortem-elig3-v2.json'
import type { PremortemWorksheetV1 } from '../readPremortemWorksheet'
import { IDENTITY_EPOCH_STORAGE_KEY, sweepUserScopedStorage, USER_SCOPED_STORAGE_PREFIXES } from '../../lib/auth/userScopedKeys'

const W = (elig3 as unknown as { existing_risk: PremortemWorksheetV1 }).existing_risk
const RUN = { scenarioId: W.scenario_id, graphHashAtRun: W.run.graph_hash_at_run, computedAt: W.run.computed_at }
const asIdentity = (epoch: string) => localStorage.setItem(IDENTITY_EPOCH_STORAGE_KEY, epoch)
const keysWithWorksheet = () => Object.keys(localStorage).filter(k => (localStorage.getItem(k) ?? '').includes(W.rows[0].row_id))
/** A tab that boots under the identity currently in storage. */
const bootTab = async () => { vi.resetModules(); return import('../readPremortemWorksheet') }

beforeEach(() => { localStorage.clear() })

describe('P02 worksheet cache: one identity', () => {
  it('RED: written as A, read as B (same browser, same Run, no sweep) → nothing restores', async () => {
    asIdentity('epoch-A')
    const tabA = await bootTab()
    tabA.storePremortemWorksheet(W)
    asIdentity('epoch-B')
    const tabB = await bootTab()
    assert.equal(tabB.loadPremortemWorksheet(RUN), null)
  })

  it('CONTROL: written as A, read as A → the same worksheet restores', async () => {
    asIdentity('epoch-A')
    const tabA = await bootTab()
    tabA.storePremortemWorksheet(W)
    assert.equal((await bootTab()).loadPremortemWorksheet(RUN)?.rows[0].row_id, W.rows[0].row_id)
  })

  it('RED (Codex r1 P1 on #2652): A’s late response lands after B signed in in another tab → never cached for B', async () => {
    asIdentity('epoch-A')
    const tabA = await bootTab()
    asIdentity('epoch-B') // another tab's boundary: fresh epoch (+ sweep)
    sweepUserScopedStorage()
    tabA.storePremortemWorksheet(W) // A's request, answered late, in A's still-open tab
    assert.deepEqual(keysWithWorksheet(), [])
    assert.equal((await bootTab()).loadPremortemWorksheet(RUN), null)
  })

  it('RED: the identity boundary sweep removes the cached worksheet', async () => {
    asIdentity('epoch-A')
    ;(await bootTab()).storePremortemWorksheet(W)
    assert.equal(keysWithWorksheet().length, 1)
    sweepUserScopedStorage()
    assert.deepEqual(keysWithWorksheet(), [])
    assert.ok((USER_SCOPED_STORAGE_PREFIXES as readonly string[]).includes('olumi-premortem-worksheet:'))
  })

  it('RED: an unstamped entry (as #2634 wrote it) never restores', async () => {
    asIdentity('epoch-A')
    const tab = await bootTab()
    tab.storePremortemWorksheet(W)
    const key = keysWithWorksheet()[0]
    localStorage.setItem(key, JSON.stringify(W))
    assert.equal(tab.loadPremortemWorksheet(RUN), null)
  })
})
