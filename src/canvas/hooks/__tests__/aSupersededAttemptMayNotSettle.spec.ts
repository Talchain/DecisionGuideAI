/**
 * A SUPERSEDED ATTEMPT MAY NOT SETTLE THE RECORD THAT REPLACED IT.
 *
 * ⛔ FOUND BY AN INDEPENDENT SEAT, and the escalation is the point. `run_key` is
 * `${scenarioId}:${started_at}` and is NOT unique per attempt: the delivery
 * effect re-arms on the SAME key whenever its auth-identity dependency
 * resolves, so attempt A is torn down and attempt B arms underneath it.
 *
 * While this record was read only by the debug bundle, A's late abort
 * overwriting B was a diagnostic blemish. `useAnalysisWaitExhausted` now reads
 * it as PRODUCT AUTHORITY — so the same race would declare B's live schedule
 * stopped and announce an abandoned run over one still in flight.
 *
 * ⭐ A diagnostic-only race becomes a false claim the moment a product surface
 * reads it. The fix is ownership, not a wider key.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  recordDeliveryArmed,
  recordDeliverySettled,
  readDeliveryRecord,
  __resetDeliveryRecordForTest,
} from '../provisionalDeliveryRecord'

const KEY = 'scenario-1:2026-09-19T14:31:06.392Z'

beforeEach(() => __resetDeliveryRecordForTest())

describe('THE CONTROL — the owning attempt still settles normally', () => {
  it('a settle from the attempt that armed is recorded', () => {
    const a = recordDeliveryArmed(KEY)
    recordDeliverySettled(KEY, a, 'delivered')
    expect(readDeliveryRecord()?.outcome).toBe('delivered')
    expect(readDeliveryRecord()?.settled_at).not.toBeNull()
  })
})

describe('THE DEFECT — a re-arm under the same key', () => {
  it('A late abort does NOT settle B, though both share the run key', () => {
    const a = recordDeliveryArmed(KEY)
    const b = recordDeliveryArmed(KEY) // same key, new attempt
    expect(b).not.toBe(a)

    recordDeliverySettled(KEY, a, 'aborted') // A settles late

    const rec = readDeliveryRecord()
    expect(rec?.attempt).toBe(b)
    // B is still in flight: no outcome, nothing for a product surface to read
    // as "this client stopped waiting".
    expect(rec?.outcome).toBeNull()
    expect(rec?.settled_at).toBeNull()
  })

  it('and B settles on its own token', () => {
    recordDeliveryArmed(KEY)
    const b = recordDeliveryArmed(KEY)
    recordDeliverySettled(KEY, b, 'delivered')
    expect(readDeliveryRecord()?.outcome).toBe('delivered')
  })

  /**
   * ⚠ THE PRE-EXISTING KEY GUARD IS KEPT, not replaced — a settle for a
   * different run must still be ignored even if the tokens happened to line up.
   */
  it('a settle for a different run key is still ignored', () => {
    const a = recordDeliveryArmed(KEY)
    recordDeliverySettled('scenario-1:OTHER', a, 'deadline')
    expect(readDeliveryRecord()?.outcome).toBeNull()
  })
})
