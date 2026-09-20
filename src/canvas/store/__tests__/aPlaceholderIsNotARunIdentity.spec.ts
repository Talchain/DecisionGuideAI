/**
 * A RESTORED RUN'S PLACEHOLDER ID MAY NOT BE PERSISTED AS ITS IDENTITY.
 *
 * ⛔ MEASURED ON DEPLOYED `ed9635cc`, guest, saved starter, live localStorage:
 *
 *     runId:      "restored:v5:1b52318633d62bf4"
 *     hash:       "v5:4d59b14212ca8cdc"
 *
 * Two identity fields in one record, naming different runs, with the WRONG one
 * being a placeholder this codebase minted. `hash` is the identity that exists
 * on the wire; the `runId` beside it embeds a hash from an earlier run.
 *
 * ⚠ IT IS A LOOP: `resultsConnecting` — the only writer that would stamp a real
 * id — has ZERO product callers, so the record persists no id; the restorer
 * mints `restored:<hash>` for the store; the projection persists that back; the
 * next reopen re-stamps it while `hash` moves on. Breaking it at the projection
 * returns the record to the state it was already in: no `runId` at all, which is
 * true, rather than one that is false.
 */
import { describe, expect, it } from 'vitest'
import { analysisSnapshotFromStore } from '../autosaveProjection'
import { isSyntheticRestoreId, syntheticRestoreId } from '../restoreAnalysisFromAutosave'

const complete = (over: Record<string, unknown> = {}) =>
  ({
    results: {
      status: 'complete',
      report: { model_card: { response_hash: 'v5:4d59b14212ca8cdc' } },
      hash: 'v5:4d59b14212ca8cdc',
      finishedAt: Date.parse('2026-09-18T12:58:15.960Z'),
      ...over,
    },
  }) as unknown as Parameters<typeof analysisSnapshotFromStore>[0]

describe('the placeholder and its predicate share one owner', () => {
  it('recognises exactly what it mints', () => {
    expect(isSyntheticRestoreId(syntheticRestoreId('v5:4d59b14212ca8cdc'))).toBe(true)
    // …including the hashless case the mint itself allows for.
    expect(isSyntheticRestoreId(syntheticRestoreId(undefined))).toBe(true)
  })

  it('⭐ DISCRIMINATES — a real id is not mistaken for a placeholder', () => {
    // Without this the projection could drop EVERY id and both arms below
    // would still pass, which would lose the identity it exists to protect.
    expect(isSyntheticRestoreId('v5:4d59b14212ca8cdc')).toBe(false)
    expect(isSyntheticRestoreId('run_01J8ZQ')).toBe(false)
    expect(isSyntheticRestoreId(undefined)).toBe(false)
    expect(isSyntheticRestoreId(null)).toBe(false)
  })
})

describe('the projection persists no placeholder', () => {
  it('⛔ drops the id the restorer minted, keeping the record honest', () => {
    // The exact bytes read off the deployed build.
    const snapshot = analysisSnapshotFromStore(
      complete({ runId: 'restored:v5:1b52318633d62bf4' }),
    )
    // PRECONDITION: a snapshot was produced at all. A null here would make
    // every assertion below vacuous (trap 13).
    expect(snapshot, 'no snapshot was projected — this case is vacuous').not.toBeNull()
    expect(snapshot?.runId).toBeUndefined()
    // …and the identity that IS on the wire is untouched.
    expect(snapshot?.hash).toBe('v5:4d59b14212ca8cdc')
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: a real id is persisted unchanged', () => {
    // The discriminating half (trap 19). Without it, "drops the placeholder"
    // is satisfied by a projection that drops every id — which would delete
    // the very fact this change exists to preserve.
    const snapshot = analysisSnapshotFromStore(complete({ runId: 'run_01J8ZQ' }))
    expect(snapshot?.runId).toBe('run_01J8ZQ')
  })

  it('leaves an absent id absent, rather than inventing one', () => {
    expect(analysisSnapshotFromStore(complete())?.runId).toBeUndefined()
  })

  it('⭐ the record round-trips to a FIXED POINT', () => {
    // The loop in one assertion: project, restore, project again. Before this
    // change the second projection differed from the first, which is how a
    // placeholder became permanent. Now reopening cannot change the record.
    const first = analysisSnapshotFromStore(complete({ runId: 'restored:v5:1b52318633d62bf4' }))
    const restoredStoreId = first?.runId ?? syntheticRestoreId(first?.hash)
    const second = analysisSnapshotFromStore(complete({ runId: restoredStoreId }))
    expect(second?.runId).toBe(first?.runId)
    expect(second?.hash).toBe(first?.hash)
  })
})
