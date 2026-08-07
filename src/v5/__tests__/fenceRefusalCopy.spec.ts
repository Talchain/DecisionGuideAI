/**
 * resolveFenceRefusalCopy — the fail-closed fallback, pinned (#559 review
 * amendment 1).
 *
 * The safety core of the fence-copy fix is the fallback direction: a fence
 * category this table does not know must resolve to the GENERIC fence copy
 * (honest "nothing changed"), NEVER to null — null would fall through to
 * `resolveFailureBaseCopy` and silently restore the false staleness banner
 * for exactly the future verdict the prefix gate exists to protect. Before
 * this spec, a `FENCE_REFUSAL_COPY[category] ?? null` mutant survived the
 * entire suite (the live-chain spec only exercises known verdicts); the
 * three assertions below make that mutant RED.
 */

import { describe, it, expect } from 'vitest'
import type { BoundaryError } from '@talchain/schemas/boundary'
import { resolveFenceRefusalCopy } from '../failureTypeRetryability'

function boundary409(details: Record<string, unknown>): BoundaryError {
  return {
    error: 'GRAPH_DIVERGED',
    boundary: 'B1',
    direction: 'egress',
    validator: 'turn_commit',
    details,
    request_id: 'req-fence-unit',
    retryable: false,
  } as BoundaryError
}

const GENERIC_FENCE_COPY =
  "That change couldn't be saved, so nothing in your decision changed. Try it again in a moment."

describe('resolveFenceRefusalCopy — fail-closed fallback (never the staleness banner)', () => {
  it('turn_fence_unavailable (real verdict, no dedicated copy) → the generic fence copy', () => {
    const copy = resolveFenceRefusalCopy(
      boundary409({
        phase: 'commit',
        fence_verdict: 'unavailable',
        conflict_category: 'turn_fence_unavailable',
        recovery_action: 'retry_later',
      }),
    )
    expect(copy).toBe(GENERIC_FENCE_COPY)
  })

  it('an UNKNOWN future turn_fence_ verdict → the generic fence copy, never null', () => {
    const copy = resolveFenceRefusalCopy(
      boundary409({
        phase: 'commit',
        fence_verdict: 'quarantined',
        conflict_category: 'turn_fence_quarantined',
        recovery_action: 'retry_later',
      }),
    )
    // The load-bearing half: null here would fall through to the canonical
    // staleness banner for a write refusal.
    expect(copy).not.toBeNull()
    expect(copy).toBe(GENERIC_FENCE_COPY)
  })

  it('absent or non-string conflict_category → null (non-fence errors keep canonical resolution)', () => {
    expect(resolveFenceRefusalCopy(boundary409({ phase: 'commit' }))).toBeNull()
    expect(
      resolveFenceRefusalCopy(boundary409({ phase: 'commit', conflict_category: 42 })),
    ).toBeNull()
    expect(
      resolveFenceRefusalCopy(
        boundary409({ phase: 'commit', conflict_category: 'analysis_affecting_conflict' }),
      ),
    ).toBeNull()
    expect(resolveFenceRefusalCopy(undefined)).toBeNull()
  })
})
